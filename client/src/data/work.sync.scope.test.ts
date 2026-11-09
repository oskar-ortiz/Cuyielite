import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import { bindContext, getBoundScope } from './work.sync.scope';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

describe('vinculacion de scope S3', () => {
  it('primera vinculacion asigna scope_id', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    const ctx = await initializeWorkSyncDatabase(a);
    await bindContext(a, { scope_id: 'scope-1', device_id: ctx.deviceId, protocol_version: 1 }, ctx.deviceId);
    expect(await getBoundScope(a)).toBe('scope-1');
    expect(db.prepare('SELECT dataset_id, device_id, scope_id FROM sync_context WHERE singleton=1').get()).toEqual({
      dataset_id: ctx.datasetId,
      device_id: ctx.deviceId,
      scope_id: 'scope-1',
    });
    db.close();
  });

  it('segunda vinculacion con mismo scope es no-op', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    const ctx = await initializeWorkSyncDatabase(a);
    await bindContext(a, { scope_id: 'scope-1', device_id: ctx.deviceId, protocol_version: 1 }, ctx.deviceId);
    await bindContext(a, { scope_id: 'scope-1', device_id: ctx.deviceId, protocol_version: 1 }, ctx.deviceId);
    expect(await getBoundScope(a)).toBe('scope-1');
    db.close();
  });

  it('scope distinto genera error sin alterar base', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    const ctx = await initializeWorkSyncDatabase(a);
    await bindContext(a, { scope_id: 'scope-1', device_id: ctx.deviceId, protocol_version: 1 }, ctx.deviceId);
    await expect(
      bindContext(a, { scope_id: 'scope-2', device_id: ctx.deviceId, protocol_version: 1 }, ctx.deviceId),
    ).rejects.toThrow();
    expect(await getBoundScope(a)).toBe('scope-1');
    db.close();
  });

  it('dispositivo distinto genera error', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    const ctx = await initializeWorkSyncDatabase(a);
    await expect(
      bindContext(a, { scope_id: 'scope-1', device_id: 'other-device', protocol_version: 1 }, ctx.deviceId),
    ).rejects.toThrow();
    db.close();
  });

  it('rechaza una version de protocolo no compatible sin vincular el scope', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    const ctx = await initializeWorkSyncDatabase(a);
    await expect(
      bindContext(a, { scope_id: 'scope-1', device_id: ctx.deviceId, protocol_version: 2 }, ctx.deviceId),
    ).rejects.toThrow('Version de protocolo no compatible');
    expect(await getBoundScope(a)).toBeNull();
    db.close();
  });

  it('reapertura conserva scope vinculado', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyielite-s3-scope-'));
    const file = path.join(dir, 'trabajo.db');
    try {
      const first = new DatabaseSync(file);
      const a1 = adapterFor(first);
      const ctx = await initializeWorkSyncDatabase(a1);
      await bindContext(a1, { scope_id: 'scope-1', device_id: ctx.deviceId, protocol_version: 1 }, ctx.deviceId);
      first.close();
      const reopened = new DatabaseSync(file);
      const a2 = adapterFor(reopened);
      await initializeWorkSyncDatabase(a2);
      expect(await getBoundScope(a2)).toBe('scope-1');
      reopened.close();
    } finally {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.rmdirSync(dir);
    }
  });
});
