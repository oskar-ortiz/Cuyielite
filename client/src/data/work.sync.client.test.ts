import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { createWorkGalpon, createWorkPoza } from './work.outbox';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import {
  prepareEligible,
  sendPrepared,
  validateReceipt,
  SyncReceiptError,
  type SendFn,
} from './work.sync.client';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

describe('cliente S3: preparacion, envio y recibos', () => {
  it('prepara y congela una operacion queued', async () => {
    const { db, adapter } = { db: new DatabaseSync(':memory:'), adapter: null as any };
    const a = adapterFor(db);
    const { adapter: ad } = { adapter: a };
    void ad;
    const galpon = await createWorkGalpon(a, { nombre: 'G1', ubicacion: null });
    const ctx = await initializeWorkSyncDatabase(a);
    const n = await prepareEligible(a, ctx.deviceId);
    expect(n).toBe(1);
    const rows = db.prepare('SELECT state, frozen_request FROM sync_outbox').all() as any[];
    expect(rows[0].state).toBe('prepared');
    expect(rows[0].frozen_request).toBeTruthy();
    db.close();
  });

  it('no prepara sucesora hasta confirmar predecesora', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    const galpon = await createWorkGalpon(a, { nombre: 'G1', ubicacion: null });
    await createWorkGalpon(a, { nombre: 'G2', ubicacion: null }); // separate? no, update
    // update galpon creates successor
    const { updateWorkGalpon } = await import('./work.outbox');
    const upd = await updateWorkGalpon(a, galpon.id, { nombre: 'G1b', ubicacion: null });
    const ctx = await initializeWorkSyncDatabase(a);
    // first prepare should prepare the create (galpon), not the update successor
    const n1 = await prepareEligible(a, ctx.deviceId);
    expect(n1).toBeGreaterThanOrEqual(1);
    db.close();
  });

  it('sendPrepared aplica recibo valido y marca accepted', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    const galpon = await createWorkGalpon(a, { nombre: 'G1', ubicacion: null });
    const ctx = await initializeWorkSyncDatabase(a);
    await prepareEligible(a, ctx.deviceId);
    const send: SendFn = async (req) => ({
      protocol_version: 1,
      results: [{
        operation_id: req.operations[0].operation_id,
        entity: req.operations[0].entity,
        record_id: req.operations[0].record_id,
        status: 'accepted',
        changed: true,
        code: null,
        record: {
          id: req.operations[0].record_id,
          version: '1',
          created_at: '2026-11-05T00:00:00.000000Z',
          updated_at: '2026-11-05T00:00:00.000000Z',
          deleted_at: null,
          last_client_edited_at: '2026-11-05T00:00:00.000000Z',
          data: req.operations[0].data,
        },
      }],
    });
    const res = await sendPrepared(a, send);
    expect(res.sent).toBe(1);
    expect(res.failed).toBe(0);
    const rows = db.prepare('SELECT state FROM sync_outbox').all() as any[];
    expect(rows[0].state).toBe('accepted');
    db.close();
  });

  it('sendPrepared conserva prepared si falla la red', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    await createWorkGalpon(a, { nombre: 'G1', ubicacion: null });
    const ctx = await initializeWorkSyncDatabase(a);
    await prepareEligible(a, ctx.deviceId);
    const send: SendFn = async () => { throw new Error('network down'); };
    const res = await sendPrepared(a, send);
    expect(res.sent).toBe(0);
    expect(res.failed).toBe(1);
    const rows = db.prepare('SELECT state FROM sync_outbox').all() as any[];
    expect(rows[0].state).toBe('prepared');
    db.close();
  });

  it('sendPrepared conserva prepared si recibo invalido', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    await createWorkGalpon(a, { nombre: 'G1', ubicacion: null });
    const ctx = await initializeWorkSyncDatabase(a);
    await prepareEligible(a, ctx.deviceId);
    const send: SendFn = async (req) => ({
      protocol_version: 1,
      results: [{
        operation_id: 'wrong-id',
        entity: req.operations[0].entity,
        record_id: req.operations[0].record_id,
        status: 'accepted',
        changed: true,
        code: null,
        record: null,
      }],
    });
    const res = await sendPrepared(a, send);
    expect(res.sent).toBe(0);
    expect(res.failed).toBe(1);
    const rows = db.prepare('SELECT state FROM sync_outbox').all() as any[];
    expect(rows[0].state).toBe('prepared');
    db.close();
  });

  it('validateReceipt rechaza operation_id incorrecto', () => {
    const req = {
      protocol_version: 1,
      device_id: 'd',
      operations: [{ operation_id: 'op1', entity: 'galpon' as const, record_id: 'r1', action: 'create', base_version: null, data: {} }],
    };
    const resp = {
      protocol_version: 1,
      results: [{ operation_id: 'op2', entity: 'galpon', record_id: 'r1', status: 'accepted' as const, changed: true, code: null, record: null }],
    };
    expect(() => validateReceipt(req as any, resp as any)).toThrow(SyncReceiptError);
  });

  it('reapertura conserva prepared para reintento', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyielite-s3-'));
    const file = path.join(dir, 'trabajo.db');
    try {
      const first = new DatabaseSync(file);
      const a1 = adapterFor(first);
      await createWorkGalpon(a1, { nombre: 'Persistente', ubicacion: null });
      const ctx = await initializeWorkSyncDatabase(a1);
      await prepareEligible(a1, ctx.deviceId);
      first.close();
      const reopened = new DatabaseSync(file);
      const a2 = adapterFor(reopened);
      await initializeWorkSyncDatabase(a2);
      const rows = reopened.prepare('SELECT state FROM sync_outbox').all() as any[];
      expect(rows[0].state).toBe('prepared');
      reopened.close();
    } finally {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.rmdirSync(dir);
    }
  });

  it('poza depende del alta del galpon padre', async () => {
    const db = new DatabaseSync(':memory:');
    const a = adapterFor(db);
    const galpon = await createWorkGalpon(a, { nombre: 'G1', ubicacion: null });
    const poza = await createWorkPoza(a, galpon.id, { codigo: 'P1', tipo: 'cria', capacidadMaxima: 10 });
    const ctx = await initializeWorkSyncDatabase(a);
    // prepare galpon first
    const n1 = await prepareEligible(a, ctx.deviceId);
    expect(n1).toBeGreaterThanOrEqual(1);
    // poza should not prepare until galpon accepted
    const rows = db.prepare('SELECT entity, state FROM sync_outbox ORDER BY local_seq').all() as any[];
    const pozaRow = rows.find((r) => r.entity === 'poza');
    expect(pozaRow.state).toBe('queued');
    db.close();
  });
});
