import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { createWorkGalpon, createWorkPoza, updateWorkGalpon, updateWorkPoza } from './work.outbox';
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

function makeDb() {
  const db = new DatabaseSync(':memory:');
  const adapter = adapterFor(db);
  return { db, adapter };
}

function outbox(db: DatabaseSync) {
  return db.prepare('SELECT * FROM sync_outbox ORDER BY local_seq').all() as Record<string, any>[];
}

describe('escrituras locales y outbox transaccional', () => {
  it('reapertura conserva operación pendiente, snapshot e identidad de dispositivo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyielite-s2-outbox-'));
    const file = path.join(dir, 'trabajo.db');
    try {
      const first = new DatabaseSync(file);
      const identity = await initializeWorkSyncDatabase(adapterFor(first));
      const created = await createWorkGalpon(adapterFor(first), { nombre: 'Persistente', ubicacion: null });
      first.close();
      const reopened = new DatabaseSync(file);
      expect((await initializeWorkSyncDatabase(adapterFor(reopened))).deviceId).toBe(identity.deviceId);
      expect(outbox(reopened)[0]).toMatchObject({
        operation_id: created.operationId,
        record_id: created.id,
        state: 'queued',
      });
      expect(reopened.prepare('SELECT nombre FROM galpones WHERE id=?').get(created.id)).toMatchObject({
        nombre: 'Persistente',
      });
      reopened.close();
    } finally {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.rmdirSync(dir);
    }
  });
  it('crea galpón y poza con UUID, snapshots y dependencia del alta del padre', async () => {
    const { db, adapter } = makeDb();
    const galpon = await createWorkGalpon(adapter, { nombre: ' Norte ', ubicacion: null });
    const poza = await createWorkPoza(adapter, galpon.id, { codigo: ' P-1 ', tipo: 'cría', capacidadMaxima: 25 });
    expect(galpon.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(poza.operationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(outbox(db)).toHaveLength(2);
    expect(outbox(db)[1]).toMatchObject({
      action: 'create',
      entity: 'poza',
      parent_create_id: galpon.operationId,
      state: 'queued',
    });
    expect(JSON.parse(outbox(db)[1].business_snapshot)).toEqual({
      galpon_id: galpon.id,
      codigo: 'P-1',
      tipo: 'cría',
      capacidad_maxima: 25,
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);
    db.close();
  });

  it('una edición sucesora depende de la operación anterior y no inventa versión', async () => {
    const { db, adapter } = makeDb();
    const first = await createWorkGalpon(adapter, { nombre: 'A', ubicacion: null });
    const next = await updateWorkGalpon(adapter, first.id, { nombre: 'B', ubicacion: 'Campo' });
    expect(outbox(db)[1]).toMatchObject({ predecessor_id: first.operationId, base_anchor: null, action: 'update' });
    const state = db
      .prepare(
        "SELECT local_head_operation_id,server_version FROM sync_record_state WHERE entity='galpon' AND record_id=?",
      )
      .get(first.id) as Record<string, any>;
    expect(state).toMatchObject({ local_head_operation_id: next.operationId, server_version: null });
    db.close();
  });

  it('guardar sin cambios conserva updated_at y no añade outbox', async () => {
    const { db, adapter } = makeDb();
    const created = await createWorkGalpon(adapter, { nombre: 'A', ubicacion: null });
    const before = db.prepare('SELECT updated_at FROM galpones WHERE id=?').get(created.id);
    const result = await updateWorkGalpon(adapter, created.id, { nombre: ' A ', ubicacion: null });
    expect(result).toEqual({ id: created.id, operationId: null, changed: false });
    expect(db.prepare('SELECT updated_at FROM galpones WHERE id=?').get(created.id)).toEqual(before);
    expect(outbox(db)).toHaveLength(1);
    db.close();
  });

  it('la edición de poza conserva relación e identificador y crea una sucesora', async () => {
    const { db, adapter } = makeDb();
    const parent = await createWorkGalpon(adapter, { nombre: 'A', ubicacion: null });
    const child = await createWorkPoza(adapter, parent.id, { codigo: 'P-1', tipo: 'cría', capacidadMaxima: 20 });
    const before = db.prepare('SELECT id,galpon_id,created_at FROM pozas WHERE id=?').get(child.id);
    const updated = await updateWorkPoza(adapter, parent.id, child.id, {
      codigo: 'P-2',
      tipo: 'engorde',
      capacidadMaxima: 40,
    });
    expect(db.prepare('SELECT id,galpon_id,created_at FROM pozas WHERE id=?').get(child.id)).toEqual(before);
    expect(outbox(db)[2]).toMatchObject({ predecessor_id: child.operationId, operation_id: updated.operationId });
    db.close();
  });

  it('un fallo al escribir outbox revierte también la entidad y el estado', async () => {
    const { db, adapter } = makeDb();
    await initializeWorkSyncDatabase(adapter);
    const failing: MigrationDb = {
      ...adapter,
      run: (sql, params) => {
        if (sql.includes('INSERT INTO sync_outbox')) throw new Error('fallo de cola');
        return adapter.run(sql, params);
      },
    };
    await expect(createWorkGalpon(failing, { nombre: 'No persistir', ubicacion: null })).rejects.toThrow(
      'fallo de cola',
    );
    expect(db.prepare('SELECT COUNT(*) AS n FROM galpones').get()).toMatchObject({ n: 0 });
    expect(outbox(db)).toHaveLength(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_record_state').get()).toMatchObject({ n: 0 });
    db.close();
  });

  it('rechaza entradas inválidas y edición de fila sin versión ni cadena local', async () => {
    const { db, adapter } = makeDb();
    await initializeWorkSyncDatabase(adapter);
    await expect(
      createWorkPoza(adapter, crypto.randomUUID(), { codigo: 'P', tipo: 'cría', capacidadMaxima: 20 }),
    ).rejects.toThrow('padre');
    await expect(createWorkGalpon(adapter, { nombre: ' ', ubicacion: null })).rejects.toThrow('obligatorio');
    const id = crypto.randomUUID();
    const t = '2026-01-01T00:00:00Z';
    db.prepare('INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at) VALUES(?,?,?,?,?)').run(
      id,
      'Importado',
      null,
      t,
      t,
    );
    await expect(updateWorkGalpon(adapter, id, { nombre: 'Editado', ubicacion: null })).rejects.toThrow('sin estado');
    expect(outbox(db)).toHaveLength(0);
    expect(db.prepare('SELECT nombre FROM galpones WHERE id=?').get(id)).toMatchObject({ nombre: 'Importado' });
    db.close();
  });
});
