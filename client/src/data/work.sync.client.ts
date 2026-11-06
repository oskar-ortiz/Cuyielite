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

export async function prepareOperation(db: MigrationDb, localSeq: number, deviceId: string): Promise<boolean> {
  return tx(db, async () => {
    const op = await one(db, 'SELECT * FROM sync_outbox WHERE local_seq=?', [localSeq]);
    if (!op || op.state !== 'queued') return false;

    const predecessorId = op.predecessor_id as string | null;
    if (predecessorId) {
      const predecessor = await one(db, 'SELECT state FROM sync_outbox WHERE operation_id=?', [predecessorId]);
      if (!predecessor || predecessor.state !== 'accepted') return false;
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

    const state =
      action === 'update'
        ? await one(db, 'SELECT server_version FROM sync_record_state WHERE entity=? AND record_id=?', [
            entity,
            recordId,
          ])
        : null;
    const baseVersion =
      action === 'create'
        ? null
        : ((state?.server_version as string | null) ?? (op.base_anchor as string | null) ?? null);
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

export async function prepareEligible(db: MigrationDb, deviceId: string): Promise<number> {
  await initializeWorkSyncDatabase(db);
  const queued = await all(db, "SELECT local_seq FROM sync_outbox WHERE state='queued' ORDER BY local_seq");
  let prepared = 0;
  for (const row of queued) {
    if (await prepareOperation(db, row.local_seq as number, deviceId)) prepared++;
  }
  return prepared;
}
