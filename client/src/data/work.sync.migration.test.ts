import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { initializeWorkDatabase, type MigrationDb } from './work.migration';
import { initializeWorkSyncDatabase } from './work.sync.migration';

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

describe('upgrade de SQLite trabajo a sync v3', () => {
  it('crea v2 y luego v3 sin seed en una instalación nueva', async () => {
    const db = new DatabaseSync(':memory:');
    const result = await initializeWorkSyncDatabase(adapterFor(db));
    expect(result.schemaVersion).toBe(4);
    expect(result.deviceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.datasetId).toBe(meta(db, 'dataset_id'));
    expect(meta(db, 'schema_checksum')).toBe(result.checksum);
    expect(meta(db, 'sync_schema_checksum')).toBe(result.syncChecksum);
    expect(meta(db, 'sync_migration_id')).toBe('0003_work_domain_sync');
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(4);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_inbox'").get()).toBeDefined();
    expect((db.prepare('SELECT COUNT(*) AS n FROM galpones').get() as { n: number }).n).toBe(0);
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);
    db.close();
  });

  it('conserva datos, relaciones, UUID y checksum de C2 al migrar una v2 existente', async () => {
    const db = new DatabaseSync(':memory:');
    const old = await initializeWorkDatabase(adapterFor(db));
    const g = crypto.randomUUID();
    const p = crypto.randomUUID();
    const t = '2026-01-01T00:00:00Z';
    db.prepare('INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at) VALUES(?,?,?,?,?)').run(
      g,
      'Sintético',
      null,
      t,
      t,
    );
    db.prepare(
      'INSERT INTO pozas(id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    ).run(p, g, 'P-S2', 'cría', 20, t, t);
    const result = await initializeWorkSyncDatabase(adapterFor(db));
    expect(result.datasetId).toBe(old.datasetId);
    expect(result.checksum).toBe(old.checksum);
    expect(db.prepare('SELECT * FROM galpones WHERE id = ?').get(g)).toMatchObject({
      nombre: 'Sintético',
      created_at: t,
    });
    expect(db.prepare('SELECT * FROM pozas WHERE id = ?').get(p)).toMatchObject({ galpon_id: g, capacidad_maxima: 20 });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);
    db.close();
  });

  it('el segundo inicio es no-op y la reapertura conserva identidades', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyielite-s2-'));
    const file = path.join(dir, 'trabajo.db');
    try {
      const firstDb = new DatabaseSync(file);
      const first = await initializeWorkSyncDatabase(adapterFor(firstDb));
      const second = await initializeWorkSyncDatabase(adapterFor(firstDb));
      expect(second).toEqual(first);
      firstDb.close();
      const reopened = new DatabaseSync(file);
      expect(await initializeWorkSyncDatabase(adapterFor(reopened))).toEqual(first);
      reopened.close();
    } finally {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.rmdirSync(dir);
    }
  });

  it('un fallo intermedio revierte el upgrade y permite reintentar desde v2', async () => {
    const db = new DatabaseSync(':memory:');
    const old = await initializeWorkDatabase(adapterFor(db));
    const original = adapterFor(db);
    const failing: MigrationDb = {
      ...original,
      run: (sql, params) => {
        if (sql.startsWith('INSERT INTO sync_context')) throw new Error('fallo inyectado');
        return original.run(sql, params);
      },
    };
    await expect(initializeWorkSyncDatabase(failing)).rejects.toThrow('fallo inyectado');
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(2);
    expect(meta(db, 'schema_checksum')).toBe(old.checksum);
    expect(meta(db, 'schema_version')).toBe('2');
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='sync_context'").get()).toBeUndefined();
    expect((await initializeWorkSyncDatabase(original)).schemaVersion).toBe(4);
    db.close();
  });

  it('rechaza checksum C2 alterado y versión futura sin modificar la base', async () => {
    const db = new DatabaseSync(':memory:');
    await initializeWorkDatabase(adapterFor(db));
    db.prepare("UPDATE meta SET value='falso' WHERE key='schema_checksum'").run();
    await expect(initializeWorkSyncDatabase(adapterFor(db))).rejects.toThrow('checksum');
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(2);
    db.exec('PRAGMA user_version=99');
    await expect(initializeWorkSyncDatabase(adapterFor(db))).rejects.toThrow('futura');
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(99);
    db.close();
  });

  it('rechaza esquema v3 incompleto sin reparación silenciosa', async () => {
    const db = new DatabaseSync(':memory:');
    await initializeWorkSyncDatabase(adapterFor(db));
    db.exec('DROP INDEX sync_outbox_one_prepared');
    await expect(initializeWorkSyncDatabase(adapterFor(db))).rejects.toThrow('índice');
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE name='sync_outbox_one_prepared'").get()).toBeUndefined();
    db.close();
  });

  it('rechaza un índice preparado reemplazado por otro no único', async () => {
    const db = new DatabaseSync(':memory:');
    await initializeWorkSyncDatabase(adapterFor(db));
    db.exec('DROP INDEX sync_outbox_one_prepared');
    db.exec("CREATE INDEX sync_outbox_one_prepared ON sync_outbox(entity,record_id) WHERE state='prepared'");
    await expect(initializeWorkSyncDatabase(adapterFor(db))).rejects.toThrow('único parcial');
    db.close();
  });
});
