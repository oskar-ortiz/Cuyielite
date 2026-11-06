import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { createWorkGalpon } from './work.outbox';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import { applyPullPage } from './work.sync.pull.apply';
import type { SyncPullPage } from './work.sync.pull.validation';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const GALPON = '11111111-1111-4111-8111-111111111111';
const POZA = '22222222-2222-4222-8222-222222222222';
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

function record(id: string, version: string, data: Record<string, unknown>) {
  return {
    id,
    version,
    created_at: CREATED,
    updated_at: CREATED,
    deleted_at: null,
    last_client_edited_at: CREATED,
    data,
  };
}

function page(items: SyncPullPage['items'], nextCursor = 'opaque-next', hasMore = false): SyncPullPage {
  return { protocol_version: 1, scope_id: SCOPE, items, next_cursor: nextCursor, has_more: hasMore };
}

async function makeDb() {
  const db = new DatabaseSync(':memory:');
  const adapter = adapterFor(db);
  const identity = await initializeWorkSyncDatabase(adapter);
  db.prepare('UPDATE sync_context SET scope_id=? WHERE singleton=1').run(SCOPE);
  return { db, adapter, identity };
}

describe('pull-v1 transactional apply', () => {
  it('aplica galpón y poza en orden, y confirma página con cursor en una transacción', async () => {
    const { db, adapter } = await makeDb();
    const response = page([
      { seq: '1', entity: 'galpon', record: record(GALPON, '1', { nombre: 'Central', ubicacion: 'Lote' }) },
      {
        seq: '2',
        entity: 'poza',
        record: record(POZA, '1', { galpon_id: GALPON, codigo: 'P-1', tipo: 'cría', capacidad_maxima: 25 }),
      },
    ]);
    const result = await applyPullPage(adapter, SCOPE, null, response, 50);
    expect(result).toMatchObject({ applied: 2, preservedLocal: 0, ignoredOlder: 0, cursor: 'opaque-next' });
    expect(db.prepare('SELECT nombre FROM galpones WHERE id=?').get(GALPON)).toMatchObject({ nombre: 'Central' });
    expect(db.prepare('SELECT codigo,galpon_id FROM pozas WHERE id=?').get(POZA)).toMatchObject({
      codigo: 'P-1',
      galpon_id: GALPON,
    });
    expect(db.prepare('SELECT cursor FROM sync_context WHERE singleton=1').get()).toMatchObject({
      cursor: 'opaque-next',
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);
    db.close();
  });


  it('guarda snapshot central pero conserva campos locales con outbox pendiente', async () => {
    const { db, adapter } = await makeDb();
    const local = await createWorkGalpon(adapter, { nombre: 'Local pendiente', ubicacion: null });
    const response = page([
      { seq: '1', entity: 'galpon', record: record(local.id, '7', { nombre: 'Central nueva', ubicacion: 'Lote C' }) },
    ]);
    const applied = await applyPullPage(adapter, SCOPE, null, response, 50);
    expect(applied.preservedLocal).toBe(1);
    expect(db.prepare('SELECT nombre,ubicacion FROM galpones WHERE id=?').get(local.id)).toMatchObject({
      nombre: 'Local pendiente',
      ubicacion: null,
    });
    expect(
      db
        .prepare('SELECT server_version,server_snapshot FROM sync_record_state WHERE entity=? AND record_id=?')
        .get('galpon', local.id),
    ).toMatchObject({ server_version: '7' });
    expect(db.prepare('SELECT COUNT(*) AS count FROM sync_outbox').get()).toMatchObject({ count: 1 });
    db.close();
  });


  it('no retrocede una versión de servidor aunque llegue una página antigua', async () => {
    const { db, adapter } = await makeDb();
    await applyPullPage(
      adapter,
      SCOPE,
      null,
      page(
        [
          {
            seq: '2',
            entity: 'galpon',
            record: record(GALPON, '9007199254740993', { nombre: 'Nuevo', ubicacion: null }),
          },
        ],
        'c1',
      ),
      50,
    );
    const result = await applyPullPage(
      adapter,
      SCOPE,
      'c1',
      page(
        [
          {
            seq: '3',
            entity: 'galpon',
            record: record(GALPON, '9007199254740992', { nombre: 'Viejo', ubicacion: null }),
          },
        ],
        'c2',
      ),
      50,
    );
    expect(result.ignoredOlder).toBe(1);
    expect(db.prepare('SELECT nombre FROM galpones WHERE id=?').get(GALPON)).toMatchObject({ nombre: 'Nuevo' });
    expect(
      db.prepare('SELECT server_version FROM sync_record_state WHERE entity=? AND record_id=?').get('galpon', GALPON),
    ).toMatchObject({ server_version: '9007199254740993' });
    db.close();
  });


  it('rollback revierte entidad y cursor si la poza no tiene padre', async () => {
    const { db, adapter } = await makeDb();
    await expect(
      applyPullPage(
        adapter,
        SCOPE,
        null,
        page([
          { seq: '1', entity: 'galpon', record: record(GALPON, '1', { nombre: 'Padre', ubicacion: null }) },
          {
            seq: '2',
            entity: 'poza',
            record: record(POZA, '1', {
              galpon_id: '33333333-3333-4333-8333-333333333333',
              codigo: 'P1',
              tipo: 'cría',
              capacidad_maxima: 12,
            }),
          },
        ]),
        50,
      ),
    ).rejects.toThrow();
    expect(db.prepare('SELECT COUNT(*) AS count FROM galpones').get()).toMatchObject({ count: 0 });
    expect(db.prepare('SELECT cursor FROM sync_context WHERE singleton=1').get()).toMatchObject({ cursor: null });
    db.close();
  });

});
