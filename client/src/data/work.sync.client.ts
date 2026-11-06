import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

type Entity = 'galpon' | 'poza';
type Row = Record<string, unknown>;

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  const res = await db.query(sql, params);
  return ((res.values ?? [])[0] as Row | undefined) ?? null;
}

async function all(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row[]> {
  const res = await db.query(sql, params);
  return (res.values ?? []) as Row[];
}

async function tx<T>(db: MigrationDb, work: () => Promise<T>): Promise<T> {
  await initializeWorkSyncDatabase(db);
  await db.exec('BEGIN IMMEDIATE');
  try {
    await initializeWorkSyncDatabase(db);
    const result = await work();
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

export interface FrozenRequest {
  protocol_version: number;
  device_id: string;
  operations: {
    operation_id: string;
    entity: Entity;
    record_id: string;
    action: 'create' | 'update';
    base_version: string | null;
    client_created_at?: string | null;
    client_edited_at?: string | null;
    data: unknown;
  }[];
}

export interface SyncRecord {
  id: string;
  version: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_client_edited_at: string | null;
  data: unknown;
}

export interface SyncOperationResult {
  operation_id: string;
  entity: Entity;
  record_id: string;
  status: 'accepted' | 'conflict' | 'rejected';
  changed: boolean;
  code: string | null;
  record: SyncRecord | null;
}

export interface SyncPushResponse {
  protocol_version: number;
  results: SyncOperationResult[];
}

export type SendFn = (request: FrozenRequest) => Promise<SyncPushResponse>;

export class SyncReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncReceiptError';
  }
}

function isSyncRecord(value: unknown, recordId: string): value is SyncRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<SyncRecord>;
  return (
    record.id === recordId &&
    typeof record.version === 'string' &&
    /^[1-9][0-9]*$/.test(record.version) &&
    typeof record.created_at === 'string' &&
    typeof record.updated_at === 'string' &&
    (record.deleted_at === null || typeof record.deleted_at === 'string') &&
    (record.last_client_edited_at === null || typeof record.last_client_edited_at === 'string') &&
    record.data !== null &&
    typeof record.data === 'object'
  );
}

export function validateReceipt(request: FrozenRequest, response: SyncPushResponse): void {
  if (response.protocol_version !== request.protocol_version) {
    throw new SyncReceiptError('protocol_version mismatch');
  }
  if (!Array.isArray(response.results) || response.results.length !== request.operations.length) {
    throw new SyncReceiptError('result count mismatch');
  }

  const expected = new Map(request.operations.map((operation) => [operation.operation_id, operation]));
  if (expected.size !== request.operations.length) {
    throw new SyncReceiptError('duplicate request operation_id');
  }
  const received = new Set<string>();
  for (const result of response.results) {
    if (!result || typeof result !== 'object') throw new SyncReceiptError('invalid result');
    if (received.has(result.operation_id)) throw new SyncReceiptError('duplicate result operation_id');
    received.add(result.operation_id);
    const operation = expected.get(result.operation_id);
    if (!operation) throw new SyncReceiptError('unknown result operation_id');
    if (result.entity !== operation.entity || result.record_id !== operation.record_id) {
      throw new SyncReceiptError('result record mismatch');
    }
    if (!['accepted', 'conflict', 'rejected'].includes(result.status)) {
      throw new SyncReceiptError('invalid result status');
    }
    if (typeof result.changed !== 'boolean' || (result.code !== null && typeof result.code !== 'string')) {
      throw new SyncReceiptError('invalid result fields');
    }
    if (result.status === 'accepted' && !isSyncRecord(result.record, operation.record_id)) {
      throw new SyncReceiptError('accepted result has invalid record');
    }
    if (result.record !== null && !isSyncRecord(result.record, operation.record_id)) {
      throw new SyncReceiptError('invalid result record');
    }
  }
  if (received.size !== expected.size) throw new SyncReceiptError('missing result operation_id');
}

export async function prepareOperation(db: MigrationDb, localSeq: number, deviceId: string): Promise<boolean> {
  return tx(db, async () => {
    const op = await one(db, 'SELECT * FROM sync_outbox WHERE local_seq=?', [localSeq]);
    if (!op || op.state !== 'queued') return false;

    const predecessorId = op.predecessor_id as string | null;
    let acceptedPredecessorVersion: string | null = null;
    if (predecessorId) {
      const predecessor = await one(db, 'SELECT state,result_json FROM sync_outbox WHERE operation_id=?', [predecessorId]);
      if (!predecessor || predecessor.state !== 'accepted') return false;
      const receipt = JSON.parse(String(predecessor.result_json ?? 'null')) as SyncOperationResult | null;
      const version = receipt?.record?.version;
      if (
        receipt?.status !== 'accepted' ||
        receipt.operation_id !== predecessorId ||
        receipt.entity !== op.entity ||
        receipt.record_id !== op.record_id ||
        !version ||
        !/^[1-9][0-9]*$/.test(version)
      ) {
        throw new Error('Recibo aceptado de predecesora incoherente');
      }
      acceptedPredecessorVersion = version;
    }

    const parentCreateId = op.parent_create_id as string | null;
    if (parentCreateId) {
      const parent = await one(db, 'SELECT state FROM sync_outbox WHERE operation_id=?', [parentCreateId]);
      if (!parent || parent.state !== 'accepted') return false;
    }

    const entity = op.entity as Entity;
    const recordId = op.record_id as string;
    const action = op.action as string;
    if (action !== 'create' && action !== 'update') return false;

    const baseVersion =
      action === 'create'
        ? null
        : (acceptedPredecessorVersion ?? (op.base_anchor as string | null) ?? null);
    if (action === 'update' && (!baseVersion || !/^[1-9][0-9]*$/.test(baseVersion))) return false;

    const snapshot = JSON.parse(op.business_snapshot as string);
    const frozen: FrozenRequest = {
      protocol_version: 1,
      device_id: deviceId,
      operations: [
        {
          operation_id: op.operation_id as string,
          entity,
          record_id: recordId,
          action,
          base_version: baseVersion,
          client_created_at: action === 'create' ? (op.created_at as string) : null,
          client_edited_at: op.created_at as string,
          data: snapshot,
        },
      ],
    };
    await db.run("UPDATE sync_outbox SET state='prepared', frozen_request=? WHERE local_seq=? AND state='queued'", [
      JSON.stringify(frozen),
      localSeq,
    ]);
    return true;
  });
}

export async function prepareEligible(
  db: MigrationDb,
  deviceId: string,
  maxLocalSeq = Number.MAX_SAFE_INTEGER,
): Promise<number> {
  await initializeWorkSyncDatabase(db);
  const queued = await all(db, "SELECT local_seq FROM sync_outbox WHERE state='queued' AND local_seq<=? ORDER BY local_seq", [
    maxLocalSeq,
  ]);
  let prepared = 0;
  for (const row of queued) {
    if (await prepareOperation(db, row.local_seq as number, deviceId)) prepared++;
  }
  return prepared;
}

export async function sendPrepared(
  db: MigrationDb,
  send: SendFn,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  await initializeWorkSyncDatabase(db);
  const prepared = await all(
    db,
    "SELECT local_seq, frozen_request FROM sync_outbox WHERE state='prepared' ORDER BY local_seq",
  );
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of prepared) {
    try {
      const frozen = JSON.parse(String(row.frozen_request)) as FrozenRequest;
      const response = await send(frozen);
      validateReceipt(frozen, response);

      await tx(db, async () => {
        for (const result of response.results) {
          const outbox = await one(db, 'SELECT state FROM sync_outbox WHERE operation_id=?', [result.operation_id]);
          if (!outbox || outbox.state !== 'prepared') {
            throw new Error('La operaciÃ³n preparada cambiÃ³ antes de aplicar el recibo');
          }
          const newState = result.status;
          await db.run("UPDATE sync_outbox SET state=?, result_json=? WHERE operation_id=? AND state='prepared'", [
            newState,
            JSON.stringify(result),
            result.operation_id,
          ]);
          if (result.record) {
            const current = await one(
              db,
              'SELECT server_version,local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?',
              [result.entity, result.record_id],
            );
            const currentVersion = current?.server_version as string | null;
            if (!currentVersion || BigInt(result.record.version) >= BigInt(currentVersion)) {
              await db.run(
                'INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id) VALUES(?,?,?,?,?) ' +
                  'ON CONFLICT(entity,record_id) DO UPDATE SET server_version=excluded.server_version, server_snapshot=excluded.server_snapshot',
                [
                  result.entity,
                  result.record_id,
                  result.record.version,
                  JSON.stringify(result.record),
                  (current?.local_head_operation_id as string | null) ?? null,
                ],
              );
            }
          }
        }
      });
      sent++;
    } catch (error) {
      failed++;
      errors.push(error instanceof Error ? error.message : String(error));
      // No se alteran frozen_request ni state; el mismo cuerpo queda disponible para reintento.
    }
  }
  return { sent, failed, errors };
}
