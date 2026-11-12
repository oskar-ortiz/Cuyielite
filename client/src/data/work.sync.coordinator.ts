import type { MigrationDb } from './work.migration.js';
import { prepareEligible, sendPrepared, type FrozenRequest, type SyncProtocol } from './work.sync.client.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';
import { pullUntilCheckpoint } from './work.sync.pull.js';
import { bindContext } from './work.sync.scope.js';
import type { SyncContext, SyncContextV2, SyncTransport } from './work.sync.transport.js';

type Row = Record<string, unknown>;
const activeDatasets = new Set<string>();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const V2_ENTITIES = ['cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias'];
const V1_ONLY: ReadonlySet<SyncProtocol> = new Set<SyncProtocol>([1]);
const BOTH_PROTOCOLS: ReadonlySet<SyncProtocol> = new Set<SyncProtocol>([1, 2]);

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

function validateContext(value: SyncContext, deviceId: string): void {
  if (
    value.protocol_version !== 1 ||
    !UUID_V4.test(value.scope_id) ||
    value.device_id !== deviceId ||
    !value.limits ||
    value.limits.pull_max !== 100 ||
    value.limits.pull_default !== 50
  ) {
    throw new Error('Contexto central incompatible con sync-v1');
  }
}

function validateContextV2(value: SyncContextV2, v1: SyncContext, deviceId: string): void {
  if (
    value.protocol_version !== 2 ||
    !UUID_V4.test(value.scope_id) ||
    value.scope_id !== v1.scope_id ||
    value.device_id !== deviceId ||
    !Array.isArray(value.supported_entities) ||
    !V2_ENTITIES.every((entity) => value.supported_entities.includes(entity)) ||
    !value.limits ||
    value.limits.pull_max !== 100 ||
    value.limits.pull_default !== 50
  ) {
    throw new Error('Contexto central incompatible con sync-v2');
  }
}

function retryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/HTTP (?!503\b)\d{3}/.test(message)) return false;
  return /HTTP 503\b|network|fetch failed|timeout|timed out|aborted|ECONN|socket/i.test(message);
}

export interface CoordinatorOptions {
  limit?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export interface SyncCycleResult {
  scopeId: string;
  capturedThroughLocalSeq: number;
  pagesBeforePush: number;
  pagesAfterPush: number;
  pagesV2BeforePush: number;
  pagesV2AfterPush: number;
  appliedV2RemoteRecords: number;
  appliedRemoteRecords: number;
  preservedLocalRecords: number;
  ignoredOlderRecords: number;
  pushedResults: number;
  pending: number;
  conflicts: number;
  rejected: number;
}

async function sendWithRetry<T>(
  send: (request: FrozenRequest) => Promise<T>,
  request: FrozenRequest,
  sleep: (ms: number) => Promise<void>,
  random: () => number,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send(request);
    } catch (error) {
      if (attempt >= 2 || !retryable(error)) throw error;
      const maxDelay = attempt === 0 ? 1000 : 2000;
      await sleep(Math.floor(Math.min(1, Math.max(0, random())) * maxDelay));
    }
  }
}

export async function runSyncCycle(
  db: MigrationDb,
  transport: SyncTransport,
  token: string,
  options: CoordinatorOptions = {},
): Promise<SyncCycleResult> {
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('limit pull fuera de rango');
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const identity = await initializeWorkSyncDatabase(db);
  if (activeDatasets.has(identity.datasetId)) throw new Error('Ya hay un ciclo activo para esta base de trabajo');
  activeDatasets.add(identity.datasetId);
  try {
    const context = await transport.context(token);
    validateContext(context, identity.deviceId);
    await bindContext(db, context, identity.deviceId);

    let contextV2: SyncContextV2 | null = null;
    if (transport.contextV2) {
      contextV2 = await transport.contextV2(token);
      validateContextV2(contextV2, context, identity.deviceId);
    }
    const protocols = contextV2 ? BOTH_PROTOCOLS : V1_ONLY;
    const send = (request: FrozenRequest) =>
      request.protocol_version === 2
        ? sendWithRetry(
            (frozen) => {
              if (!transport.pushV2) throw new Error('Transporte push v2 no disponible');
              return transport.pushV2(token, frozen);
            },
            request,
            sleep,
            random,
          )
        : sendWithRetry((frozen) => transport.push(token, frozen), request, sleep, random);

    const maxRow = await one(db, 'SELECT COALESCE(MAX(local_seq),0) AS max_seq FROM sync_outbox');
    const capturedThroughLocalSeq = Number(maxRow?.max_seq ?? 0);

    const syncPage = () =>
      pullUntilCheckpoint(db, context.scope_id, (cursor, pageLimit) => transport.pull(token, cursor, pageLimit), limit);
    const syncPageV2 = contextV2
      ? () =>
          pullUntilCheckpoint(
            db,
            context.scope_id,
            (cursor, pageLimit) => {
              if (!transport.pullV2) throw new Error('Transporte pull v2 no disponible');
              return transport.pullV2(token, cursor, pageLimit);
            },
            limit,
            2,
          )
      : null;

    // Resolve durable requests with unknown outcomes before pulling newer snapshots.
    const replay = await sendPrepared(db, send, protocols);
    if (replay.failed > 0) throw new Error(`No se pudo reconciliar ${replay.failed} operación(es) preparada(s)`);

    const before = await syncPage();
    const beforeV2 = syncPageV2 ? await syncPageV2() : null;
    let pushedResults = replay.sent;
    while (true) {
      const prepared = await prepareEligible(db, identity.deviceId, capturedThroughLocalSeq, protocols);
      if (prepared === 0) break;
      const sent = await sendPrepared(db, send, protocols);
      pushedResults += sent.sent;
      if (sent.failed > 0) throw new Error(`No se pudo enviar ${sent.failed} operación(es) preparada(s)`);
    }

    const after = await syncPage();
    const afterV2 = syncPageV2 ? await syncPageV2() : null;
    const counts = await one(
      db,
      'SELECT COUNT(*) AS pending, ' +
        "SUM(CASE WHEN state='conflict' THEN 1 ELSE 0 END) AS conflicts, " +
        "SUM(CASE WHEN state='rejected' THEN 1 ELSE 0 END) AS rejected " +
        "FROM sync_outbox WHERE state IN ('queued','prepared','conflict','rejected')",
    );
    return {
      scopeId: context.scope_id,
      capturedThroughLocalSeq,
      pagesBeforePush: before.pages,
      pagesAfterPush: after.pages,
      pagesV2BeforePush: beforeV2?.pages ?? 0,
      pagesV2AfterPush: afterV2?.pages ?? 0,
      appliedV2RemoteRecords: (beforeV2?.applied ?? 0) + (afterV2?.applied ?? 0),
      appliedRemoteRecords: before.applied + after.applied,
      preservedLocalRecords: before.preservedLocal + after.preservedLocal,
      ignoredOlderRecords: before.ignoredOlder + after.ignoredOlder,
      pushedResults,
      pending: Number(counts?.pending ?? 0),
      conflicts: Number(counts?.conflicts ?? 0),
      rejected: Number(counts?.rejected ?? 0),
    };
  } finally {
    activeDatasets.delete(identity.datasetId);
  }
}

export type { SyncContext, SyncContextV2 };
