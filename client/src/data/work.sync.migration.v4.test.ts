import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { migrateAndSeed } from './galpones.migration';
import { initializeWorkDatabase, type MigrationDb } from './work.migration';
import { migrateWorkSyncV2ToV3, initializeWorkSyncDatabase, computeSyncChecksum } from './work.sync.migration';

const CREATED = '2026-11-06T10:00:00.000Z';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

function meta(db: DatabaseSync, key: string): string {
  return (db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string }).value;
}

function userVersion(db: DatabaseSync): number {
  return Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
}

async function makeV3(db: DatabaseSync): Promise<MigrationDb> {
  const adapter = adapterFor(db);
  await initializeWorkDatabase(adapter);
  await migrateWorkSyncV2ToV3(adapter);
  return adapter;
}

function seedV3Rows(db: DatabaseSync, scope: string) {
  const galpon = '11111111-1111-4111-8111-111111111111';
  const operation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  db.prepare('INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at) VALUES(?,?,?,?,?)').run(
    galpon,
    'Sintético v3',
    null,
    CREATED,
    CREATED,
  );
  db.prepare(
    'INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,state,result_json,created_at) ' +
      'VALUES(?,?,?,?,?,?,?,?)',
  ).run(
    operation,
    'galpon',
    galpon,
    'create',
    JSON.stringify({ nombre: 'Sintético v3', ubicacion: null }),
    'conflict',
    JSON.stringify({ status: 'conflict', code: 'VERSION_CONFLICT' }),
    CREATED,
  );
  db.prepare(
    'INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id) VALUES(?,?,?,?,?)',
  ).run('galpon', galpon, '2', JSON.stringify({ id: galpon, version: '2' }), operation);
  db.prepare('UPDATE sync_context SET scope_id=?, cursor=? WHERE singleton=1').run(scope, 'cursor-v3');
  return { galpon, operation };
}

describe('upgrade de SQLite sync v3 a dominio v4', () => {
  it('conserva filas, outbox, estado, cursor y checksum histórico de C2', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await makeV3(db);
    const { galpon, operation } = seedV3Rows(db, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    const c2Checksum = meta(db, 'schema_checksum');
    const v3Checksum = await computeSyncChecksum();

    const identity = await initializeWorkSyncDatabase(adapter);

    expect(identity.schemaVersion).toBe(4);
    expect(userVersion(db)).toBe(4);
    expect(meta(db, 'schema_checksum')).toBe(c2Checksum);
    expect(meta(db, 'previous_sync_checksum')).toBe(v3Checksum);
    expect(meta(db, 'sync_migration_id')).toBe('0003_work_domain_sync');
    expect(meta(db, 'previous_sync_migration_id')).toBe('0002_work_sync');
    expect(identity.datasetId).toBe(meta(db, 'dataset_id'));
    expect(db.prepare('SELECT nombre FROM galpones WHERE id=?').get(galpon)).toMatchObject({ nombre: 'Sintético v3' });
    expect(
      db
        .prepare('SELECT operation_id,state,result_json,local_seq FROM sync_outbox WHERE operation_id=?')
        .get(operation),
    ).toMatchObject({
      operation_id: operation,
      state: 'conflict',
      local_seq: 1,
      result_json: JSON.stringify({ status: 'conflict', code: 'VERSION_CONFLICT' }),
    });
    expect(
      db
        .prepare('SELECT server_version,local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?')
        .get('galpon', galpon),
    ).toMatchObject({ server_version: '2', local_head_operation_id: operation });
    expect(db.prepare('SELECT cursor FROM sync_context WHERE singleton=1').get()).toMatchObject({
      cursor: 'cursor-v3',
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);

    // El CHECK ampliado admite entidades de dominio en la outbox.
    db.prepare(
      'INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,state,created_at) VALUES(?,?,?,?,?,?,?)',
    ).run(crypto.randomUUID(), 'cuyes', crypto.randomUUID(), 'create', '{}', 'queued', CREATED);
    db.close();
  });

  it('la segunda ejecución es no-op y no altera checksums', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await makeV3(db);
    seedV3Rows(db, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    const first = await initializeWorkSyncDatabase(adapter);
    const checksum = meta(db, 'sync_schema_checksum');
    const second = await initializeWorkSyncDatabase(adapter);
    expect(second).toEqual(first);
    expect(meta(db, 'sync_schema_checksum')).toBe(checksum);
    expect(userVersion(db)).toBe(4);
    db.close();
  });

  it('un fallo durante la migración revierte todo y permite reintentar desde v3', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await makeV3(db);
    const { galpon, operation } = seedV3Rows(db, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    const v3Checksum = meta(db, 'sync_schema_checksum');

    const failing: MigrationDb = {
      ...adapter,
      exec: (sql) => {
        if (sql.startsWith('CREATE TABLE sync_inbox')) throw new Error('fallo inyectado en inbox');
        return adapter.exec(sql);
      },
    };
    await expect(initializeWorkSyncDatabase(failing)).rejects.toThrow('fallo inyectado en inbox');

    expect(userVersion(db)).toBe(3);
    expect(meta(db, 'sync_schema_checksum')).toBe(v3Checksum);
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='sync_inbox'").get()).toBeUndefined();
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='sync_outbox_v3'").get()).toBeUndefined();
    expect(db.prepare('SELECT state FROM sync_outbox WHERE operation_id=?').get(operation)).toMatchObject({
      state: 'conflict',
    });
    expect(db.prepare('SELECT nombre FROM galpones WHERE id=?').get(galpon)).toMatchObject({ nombre: 'Sintético v3' });

    expect((await initializeWorkSyncDatabase(adapter)).schemaVersion).toBe(4);
    expect(userVersion(db)).toBe(4);
    db.close();
  });

  it('rechaza un v4 incompleto sin reparación silenciosa', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await makeV3(db);
    await initializeWorkSyncDatabase(adapter);
    db.exec('DROP INDEX sync_inbox_pending');
    db.exec('DROP TABLE sync_inbox');
    await expect(initializeWorkSyncDatabase(adapter)).rejects.toThrow('sync_inbox');
    expect(userVersion(db)).toBe(4);
    db.close();
  });

  it('no convierte ni modifica una base demo', async () => {
    const db = new DatabaseSync(':memory:');
    await migrateAndSeed(adapterFor(db));
    const demoVersion = userVersion(db);
    const galpones = Number((db.prepare('SELECT COUNT(*) AS n FROM galpones').get() as { n: number }).n);
    const pozas = Number((db.prepare('SELECT COUNT(*) AS n FROM pozas').get() as { n: number }).n);
    expect(demoVersion).toBe(1);
    await expect(initializeWorkSyncDatabase(adapterFor(db))).rejects.toThrow(/no reconocida/);
    expect(userVersion(db)).toBe(1);
    expect(Number((db.prepare('SELECT COUNT(*) AS n FROM galpones').get() as { n: number }).n)).toBe(galpones);
    expect(Number((db.prepare('SELECT COUNT(*) AS n FROM pozas').get() as { n: number }).n)).toBe(pozas);
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='sync_inbox'").get()).toBeUndefined();
    db.close();
  });
});
