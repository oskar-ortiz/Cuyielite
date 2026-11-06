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
    const r = await work();
    await db.exec('COMMIT');
    return r;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

export interface FrozenRequest {
  protocol_version: number;
  device_id: string;
  operations: {
    operation_id: string;
    entity: Entity;
    record_id: string;
    action: string;
    base_version: string | null;
    client_created_at?: string | null;
    client_edited_at?: string | null;
    data: unknown;
  }[];
}

export interface SyncResultRecord {
  operation_id: string;
  entity: string;
  record_id: string;
  status: 'accepted' | 'conflict' | 'rejected';
  changed: boolean;
  code: string | null;
  record: {
    id: string;
    version: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    last_client_edited_at: string | null;
    data: unknown;
  } | null;
}

export interface SyncPushResponse {
  protocol_version: number;
  results: SyncResultRecord[];
}

export type SendFn = (req: FrozenRequest) => Promise<SyncPushResponse>;

export class SyncReceiptError extends Error {}

export function validateReceipt(req: FrozenRequest, resp: SyncPushResponse): void {
  if (resp.protocol_version !== req.protocol_version) {
    throw new SyncReceiptError('protocol_version mismatch');
  }
  if (!Array.isArray(resp.results) || resp.results.length !== req.operations.length) {
    throw new SyncReceiptError('result count mismatch');
  }
  const seen = new Set<string>();
  for (let i = 0; i < req.operations.length; i++) {
    const op = req.operations[i];
    const res = resp.results[i];
    if (!res) throw new SyncReceiptError('missing result');
    if (seen.has(res.operation_id)) throw new SyncReceiptError('duplicate result operation_id');
    seen.add(res.operation_id);
    if (res.operation_id !== op.operation_id) throw new SyncReceiptError('operation_id mismatch');
    if (res.entity !== op.entity) throw new SyncReceiptError('entity mismatch');
    if (res.record_id !== op.record_id) throw new SyncReceiptError('record_id mismatch');
  }
  if (seen.size !== req.operations.length) throw new SyncReceiptError('result uniqueness violation');
}

export async function prepareOperation(db: MigrationDb, localSeq: number, deviceId: string): Promise<boolean> {
  return tx(db, async () => {
    const op = await one(db, 'SELECT * FROM sync_outbox WHERE local_seq=?', [localSeq]);
    if (!op) return false;
    if (op.state !== 'queued') return false;
    let baseVersion: string | null = null;
    const predId = op.predecessor_id as string | null;
    if (predId) {
      const pred = await one(db, 'SELECT state,result_json FROM sync_outbox WHERE operation_id=?', [predId]);
      if (!pred) return false;
      if (pred.state === 'prepared') return false;
      if (pred.state !== 'accepted' && pred.state !== 'queued') return false;
      if (pred.state !== 'accepted') return false;
      const receipt = JSON.parse(String(pred.result_json ?? 'null')) as SyncResultRecord | null;
      const acceptedVersion = receipt?.record?.version;
      if (
        receipt?.status !== 'accepted' ||
        receipt.operation_id !== predId ||
        receipt.entity !== op.entity ||
        receipt.record_id !== op.record_id ||
        !acceptedVersion ||
        !/^[1-9][0-9]*$/.test(acceptedVersion)
      ) {
        throw new Error('Recibo aceptado de predecesora incoherente');
      }
      baseVersion = acceptedVersion;
    }
    const parentCreateId = op.parent_create_id as string | null;
    if (parentCreateId) {
      const parent = await one(db, 'SELECT state FROM sync_outbox WHERE operation_id=?', [parentCreateId]);
      if (!parent || parent.state !== 'accepted') return false;
    }
    const entity = op.entity as Entity;
    const recordId = op.record_id as string;
    const action = op.action as string;
    if (action !== 'create') {
      // A local edit is anchored when it is created. A later pull must not silently
      // rebase it; successors use only the accepted version of their predecessor.
      if (!predId) baseVersion = (op.base_anchor as string | null) ?? null;
      if (action === 'update' && (!baseVersion || !/^[1-9][0-9]*$/.test(baseVersion))) {
        return false;
      }
    }
    const snapshot = JSON.parse(op.business_snapshot as string);
    const frozen = {
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
  let prepared = 0;
  const queued = await all(
    db,
    "SELECT local_seq FROM sync_outbox WHERE state='queued' AND local_seq<=? ORDER BY local_seq",
    [maxLocalSeq],
  );
  for (const row of queued) {
    const seq = row.local_seq as number;
    const ok = await prepareOperation(db, seq, deviceId);
    if (ok) prepared++;
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
    const seq = row.local_seq as number;
    const frozen = JSON.parse(row.frozen_request as string) as FrozenRequest;
    try {
      const resp = await send(frozen);
      validateReceipt(frozen, resp);
      const result = resp.results[0];
      await tx(db, async () => {
        const newState =
          result.status === 'accepted' ? 'accepted' : result.status === 'conflict' ? 'conflict' : 'rejected';
        await db.run('UPDATE sync_outbox SET state=?, result_json=? WHERE local_seq=?', [
          newState,
          JSON.stringify(result),
          seq,
        ]);
        if (result.record) {
          const rec = result.record;
          if (!/^[1-9][0-9]*$/.test(rec.version)) throw new SyncReceiptError('invalid server record version');
          const current = await one(
            db,
            'SELECT server_version,local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?',
            [result.entity, result.record_id],
          );
          const currentVersion = current?.server_version as string | null;
          if (!currentVersion || BigInt(rec.version) >= BigInt(currentVersion)) {
            await db.run(
              'INSERT INTO sync_record_state(entity, record_id, server_version, server_snapshot, local_head_operation_id) VALUES(?,?,?,?,?) ' +
                'ON CONFLICT(entity, record_id) DO UPDATE SET server_version=excluded.server_version, server_snapshot=excluded.server_snapshot',
              [
                result.entity,
                result.record_id,
                rec.version,
                JSON.stringify(rec),
                current?.local_head_operation_id ?? null,
              ],
            );
          }
        }
      });
      sent++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      // keep prepared for retry; do not change state
      break;
    }
  }
  return { sent, failed, errors };
}
