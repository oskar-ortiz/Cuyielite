import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';
import { stableJson, validatePullPage, type Entity, SyncPullError, type PullRecord } from './work.sync.pull.validation.js';

type Row = Record<string, unknown>;

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

async function transaction<T>(db: MigrationDb, work: () => Promise<T>): Promise<T> {
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

async function hasPendingLocalHead(db: MigrationDb, entity: Entity, recordId: string): Promise<boolean> {
  const row = await one(
    db,
    "SELECT 1 AS pending FROM sync_outbox WHERE entity=? AND record_id=? AND state IN ('queued','prepared','conflict','rejected') LIMIT 1",
    [entity, recordId],
  );
  return row !== null;
}

export async function applyCentralBusinessRecord(db: MigrationDb, entity: Entity, record: PullRecord): Promise<void> {
  const data = record.data;
  if (entity === 'galpon') {
    await db.run(
      'INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?) ' +
        'ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre,ubicacion=excluded.ubicacion,' +
        'created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at',
      [record.id, data.nombre, data.ubicacion, record.created_at, record.updated_at, record.deleted_at],
    );
    return;
  }
  const current = await one(db, 'SELECT galpon_id FROM pozas WHERE id=?', [record.id]);
  if (current && current.galpon_id !== data.galpon_id) {
    throw new SyncPullError('pull no puede cambiar el galpón padre de una poza');
  }
  await db.run(
    'INSERT INTO pozas(id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT(id) DO UPDATE SET codigo=excluded.codigo,tipo=excluded.tipo,' +
      'capacidad_maxima=excluded.capacidad_maxima,created_at=excluded.created_at,' +
      'updated_at=excluded.updated_at,deleted_at=excluded.deleted_at',
    [
      record.id,
      data.galpon_id,
      data.codigo,
      data.tipo,
      data.capacidad_maxima,
      record.created_at,
      record.updated_at,
      record.deleted_at,
    ],
  );
}

export async function applyPullPage(
  db: MigrationDb,
  expectedScopeId: string,
  expectedCursor: string | null,
  response: unknown,
  limit: number,
): Promise<{ applied: number; preservedLocal: number; ignoredOlder: number; cursor: string }> {
  const page = validatePullPage(response, expectedScopeId, limit);
  return transaction(db, async () => {
    const context = await one(db, 'SELECT scope_id,cursor FROM sync_context WHERE singleton=1');
    if (!context || context.scope_id !== expectedScopeId) throw new SyncPullError('scope local no coincide');
    const storedCursor = (context.cursor as string | null) ?? null;
    if (storedCursor !== expectedCursor) throw new SyncPullError('cursor local cambió durante el pull');

    let applied = 0;
    let preservedLocal = 0;
    let ignoredOlder = 0;
    for (const item of page.items) {
      const { entity, record } = item;
      const current = await one(
        db,
        'SELECT server_version,server_snapshot,local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?',
        [entity, record.id],
      );
      const currentVersion = current?.server_version as string | null;
      if (currentVersion && BigInt(currentVersion) > BigInt(record.version)) {
        ignoredOlder++;
        continue;
      }
      if (currentVersion && BigInt(currentVersion) === BigInt(record.version)) {
        const existingSnapshot = current?.server_snapshot ? JSON.parse(String(current.server_snapshot)) : null;
        if (!existingSnapshot || stableJson(existingSnapshot) !== stableJson(record)) {
          throw new SyncPullError('misma versión central con snapshots diferentes');
        }
        continue;
      }

      const pending = await hasPendingLocalHead(db, entity, record.id);
      if (pending) {
        preservedLocal++;
        if (record.deleted_at !== null) {
          await db.run(`UPDATE ${entity === 'galpon' ? 'galpones' : 'pozas'} SET deleted_at=? WHERE id=?`, [
            record.deleted_at,
            record.id,
          ]);
        }
      } else {
        await applyCentralBusinessRecord(db, entity, record);
      }
      await db.run(
        'INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id) VALUES(?,?,?,?,?) ' +
          'ON CONFLICT(entity,record_id) DO UPDATE SET server_version=excluded.server_version,' +
          'server_snapshot=excluded.server_snapshot,local_head_operation_id=excluded.local_head_operation_id',
        [
          entity,
          record.id,
          record.version,
          JSON.stringify(record),
          pending ? (current?.local_head_operation_id ?? null) : null,
        ],
      );
      applied++;
    }

    await db.run('UPDATE sync_context SET cursor=? WHERE singleton=1 AND scope_id=? AND cursor IS ?', [
      page.next_cursor,
      expectedScopeId,
      expectedCursor,
    ]);
    const check = await one(db, 'SELECT cursor FROM sync_context WHERE singleton=1');
    if (check?.cursor !== page.next_cursor) throw new SyncPullError('no se pudo confirmar cursor pull');
    return { applied, preservedLocal, ignoredOlder, cursor: page.next_cursor };
  });
}

