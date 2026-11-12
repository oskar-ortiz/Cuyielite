import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import { applyPullPage, listInboxEntries, reconcileInbox } from './work.sync.pull.apply';
import type { SyncPullPage } from './work.sync.pull.validation';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CREATED = '2026-11-06T10:00:00.000Z';
const OFFSET = '2026-11-06T10:00:00.123456+00:00';

const MADRE = '33333333-3333-4333-8333-333333333333';
const CRIA = '44444444-4444-4444-8444-444444444444';
const PARTO = '55555555-5555-4555-8555-555555555555';
const PARTO_B = '66666666-6666-4666-8666-666666666666';
const EVENTO = '77777777-7777-4777-8777-777777777777';
const PESAJE = '88888888-8888-4888-8888-888888888888';
const VINCULO = '99999999-9999-4999-8999-999999999999';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

async function makeDb() {
  const db = new DatabaseSync(':memory:');
  const adapter = adapterFor(db);
  await initializeWorkSyncDatabase(adapter);
  db.prepare('UPDATE sync_context SET scope_id=? WHERE singleton=1').run(SCOPE);
  return { db, adapter };
}

function record(id: string, version: string, data: Record<string, unknown>, deletedAt: string | null = null) {
  return {
    id,
    version,
    created_at: CREATED,
    updated_at: OFFSET,
    deleted_at: deletedAt,
    last_client_edited_at: null,
    data,
  };
}

function page(items: SyncPullPage['items'], nextCursor = 'c1', hasMore = false): SyncPullPage {
  return { protocol_version: 1, scope_id: SCOPE, items, next_cursor: nextCursor, has_more: hasMore };
}

function cuy(id: string, code: string, extra: Record<string, unknown> = {}) {
  return {
    poza_id: null,
    galpon_origen_id: null,
    codigo_identificacion: code,
    sexo: 'H',
    fecha_nacimiento: '2025-03-12',
    color_codigo: null,
    ojos_codigo: null,
    pelaje_original: null,
    padre_id: null,
    madre_id: null,
    categoria_ml: null,
    ultimo_peso_g: null,
    estado: 'ACTIVO',
    ...extra,
  };
}

function parto(id: string, madre: string) {
  return {
    madre_id: madre,
    fecha_parto: '2026-01-20',
    numero_parto: 1,
    nacidos_vivos: 1,
    nacidos_muertos: 0,
    tamano_camada_nacida: 1,
  };
}

function evento(cuyId: string) {
  return {
    cuy_id: cuyId,
    tipo: 'DESTETE',
    fecha: '2026-02-04',
    macho_id: null,
    poza_origen_id: null,
    poza_destino_id: null,
    detalle: null,
  };
}

function pesaje(cuyId: string, eventoId: string) {
  return {
    cuy_id: cuyId,
    fecha_pesaje: '2026-02-04',
    peso_gramos: '270.00',
    etapa: 'DESTETE',
    parto_id: null,
    evento_id: eventoId,
  };
}

function vinculo(partoId: string, cuyId: string) {
  return { parto_id: partoId, cuy_id: cuyId, rol: 'CRIA' };
}

function count(db: DatabaseSync, table: string): number {
  return Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
}

function cursorOf(db: DatabaseSync): string | null {
  return (db.prepare('SELECT cursor FROM sync_context WHERE singleton=1').get() as { cursor: string | null }).cursor;
}

describe('aplicación transaccional de dominio (D3)', () => {
  it('aplica las cinco entidades y resuelve dependencias dentro de la misma página', async () => {
    const { db, adapter } = await makeDb();
    const response = page([
      { seq: '1', entity: 'pesajes', record: record(PESAJE, '1', pesaje(CRIA, EVENTO)) },
      { seq: '2', entity: 'eventos', record: record(EVENTO, '1', evento(CRIA)) },
      { seq: '3', entity: 'parto_crias', record: record(VINCULO, '1', vinculo(PARTO, CRIA)) },
      { seq: '4', entity: 'cuyes', record: record(CRIA, '1', cuy(CRIA, 'CRIA-1', { madre_id: MADRE })) },
      { seq: '5', entity: 'cuyes', record: record(MADRE, '1', cuy(MADRE, 'MADRE-1')) },
      { seq: '6', entity: 'partos', record: record(PARTO, '1', parto(PARTO, MADRE)) },
    ]);
    const result = await applyPullPage(adapter, SCOPE, null, response, 50);
    expect(result).toMatchObject({ applied: 2, staged: 4, reconciled: 4, conflicts: 0, cursor: 'c1' });
    expect(count(db, 'cuyes')).toBe(2);
    expect(count(db, 'partos')).toBe(1);
    expect(count(db, 'eventos')).toBe(1);
    expect(count(db, 'parto_crias')).toBe(1);
    expect(count(db, 'pesajes')).toBe(1);
    expect(db.prepare('SELECT madre_id FROM cuyes WHERE id=?').get(CRIA)).toMatchObject({ madre_id: MADRE });
    expect(db.prepare('SELECT cuy_id,evento_id FROM pesajes WHERE id=?').get(PESAJE)).toMatchObject({
      cuy_id: CRIA,
      evento_id: EVENTO,
    });
    expect(cursorOf(db)).toBe('c1');
    expect(db.prepare('PRAGMA foreign_key_check').all()).toHaveLength(0);
    const inbox = await listInboxEntries(adapter);
    expect(inbox).toHaveLength(4);
    expect(inbox.every((entry) => entry.state === 'applied')).toBe(true);
    db.close();
  });

  it('conserva versión y borrado lógico, y no retrocede con páginas viejas', async () => {
    const { db, adapter } = await makeDb();
    await applyPullPage(
      adapter,
      SCOPE,
      null,
      page([{ seq: '1', entity: 'cuyes', record: record(MADRE, '1', cuy(MADRE, 'M')) }]),
      50,
    );
    const deletedAt = '2026-11-07T00:00:00.000Z';
    const second = page(
      [
        {
          seq: '2',
          entity: 'cuyes',
          record: record(MADRE, '2', cuy(MADRE, 'M', { estado: 'VENDIDO' }), deletedAt),
        },
      ],
      'c2',
    );
    await applyPullPage(adapter, SCOPE, 'c1', second, 50);
    expect(db.prepare('SELECT estado,deleted_at FROM cuyes WHERE id=?').get(MADRE)).toMatchObject({
      estado: 'VENDIDO',
      deleted_at: deletedAt,
    });
    expect(
      db.prepare('SELECT server_version FROM sync_record_state WHERE entity=? AND record_id=?').get('cuyes', MADRE),
    ).toMatchObject({ server_version: '2' });

    const stale = await applyPullPage(
      adapter,
      SCOPE,
      'c2',
      page([{ seq: '1', entity: 'cuyes', record: record(MADRE, '1', cuy(MADRE, 'VIEJO')) }], 'c3'),
      50,
    );
    expect(stale.ignoredOlder).toBe(1);
    expect(db.prepare('SELECT codigo_identificacion FROM cuyes WHERE id=?').get(MADRE)).toMatchObject({
      codigo_identificacion: 'M',
    });
    db.close();
  });

  it('repetir la misma página es idempotente y no duplica filas', async () => {
    const { db, adapter } = await makeDb();
    const response = page([{ seq: '1', entity: 'cuyes', record: record(MADRE, '1', cuy(MADRE, 'M')) }]);
    await applyPullPage(adapter, SCOPE, null, response, 50);
    // Reintento con el cursor anterior: la página ya está confirmada.
    const retry = await applyPullPage(adapter, SCOPE, null, response, 50);
    expect(retry).toMatchObject({ applied: 0, staged: 0, cursor: 'c1' });
    // Reintento con el cursor confirmado: misma versión y snapshot.
    const same = await applyPullPage(adapter, SCOPE, 'c1', response, 50);
    expect(same.applied).toBe(0);
    expect(count(db, 'cuyes')).toBe(1);
    expect(count(db, 'sync_inbox')).toBe(0);
    db.close();
  });

  it('guarda en inbox una dependencia posterior, avanza el cursor y la aplica al llegar', async () => {
    const { db, adapter } = await makeDb();
    const first = await applyPullPage(
      adapter,
      SCOPE,
      null,
      page([{ seq: '1', entity: 'pesajes', record: record(PESAJE, '1', pesaje(CRIA, EVENTO)) }], 'c1'),
      50,
    );
    expect(first).toMatchObject({ applied: 0, staged: 1, cursor: 'c1' });
    expect(count(db, 'pesajes')).toBe(0);
    const staged = await listInboxEntries(adapter, 'staged');
    expect(staged).toHaveLength(1);
    expect(staged[0].missingRefs.sort()).toEqual(['cuy_id->cuyes', 'evento_id->eventos']);

    const second = await applyPullPage(
      adapter,
      SCOPE,
      'c1',
      page(
        [
          { seq: '2', entity: 'cuyes', record: record(CRIA, '1', cuy(CRIA, 'C')) },
          { seq: '3', entity: 'eventos', record: record(EVENTO, '1', evento(CRIA)) },
        ],
        'c2',
      ),
      50,
    );
    expect(second).toMatchObject({ applied: 2, reconciled: 1, cursor: 'c2' });
    expect(count(db, 'pesajes')).toBe(1);
    expect(db.prepare('SELECT cuy_id FROM pesajes WHERE id=?').get(PESAJE)).toMatchObject({ cuy_id: CRIA });
    expect((await listInboxEntries(adapter)).every((entry) => entry.state === 'applied')).toBe(true);
    db.close();
  });

  it('conserva el contenido local y registra conflicto explícito', async () => {
    const { db, adapter } = await makeDb();
    const operation = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const localSnapshot = cuy(MADRE, 'LOCAL');
    db.prepare('INSERT INTO cuyes(id,codigo_identificacion,sexo,estado,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(
      MADRE,
      'LOCAL',
      'H',
      'LOCAL-EDIT',
      CREATED,
      CREATED,
    );
    db.prepare(
      'INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,base_anchor,state,created_at) ' +
        'VALUES(?,?,?,?,?,?,?,?)',
    ).run(operation, 'cuyes', MADRE, 'update', JSON.stringify(localSnapshot), '1', 'queued', CREATED);
    db.prepare(
      'INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id) VALUES(?,?,?,?,?)',
    ).run('cuyes', MADRE, '1', JSON.stringify(record(MADRE, '1', cuy(MADRE, 'BASE'))), operation);

    const result = await applyPullPage(
      adapter,
      SCOPE,
      null,
      page([
        {
          seq: '1',
          entity: 'cuyes',
          record: record(MADRE, '2', cuy(MADRE, 'CENTRAL', { estado: 'VENDIDO' })),
        },
      ]),
      50,
    );
    expect(result).toMatchObject({ applied: 0, preservedLocal: 1, conflicts: 1 });
    expect(db.prepare('SELECT codigo_identificacion,estado FROM cuyes WHERE id=?').get(MADRE)).toMatchObject({
      codigo_identificacion: 'LOCAL',
      estado: 'LOCAL-EDIT',
    });
    const outbox = db
      .prepare('SELECT state,result_json,business_snapshot FROM sync_outbox WHERE operation_id=?')
      .get(operation) as { state: string; result_json: string; business_snapshot: string };
    expect(outbox.state).toBe('conflict');
    expect(JSON.parse(outbox.result_json)).toMatchObject({ status: 'conflict', code: 'VERSION_CONFLICT' });
    expect(outbox.business_snapshot).toBe(JSON.stringify(localSnapshot));
    expect(
      db
        .prepare('SELECT server_version,local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?')
        .get('cuyes', MADRE),
    ).toMatchObject({ server_version: '2', local_head_operation_id: operation });
    db.close();
  });

  it('un fallo intermedio revierte datos aplicados, inbox y cursor', async () => {
    const { db, adapter } = await makeDb();
    const failing: MigrationDb = {
      ...adapter,
      run: (sql, params) => {
        if (sql.startsWith('INSERT INTO sync_inbox')) throw new Error('fallo inyectado en staging');
        return adapter.run(sql, params);
      },
    };
    await expect(
      applyPullPage(
        failing,
        SCOPE,
        null,
        page([
          { seq: '1', entity: 'cuyes', record: record(MADRE, '1', cuy(MADRE, 'M')) },
          { seq: '2', entity: 'eventos', record: record(EVENTO, '1', evento(CRIA)) },
        ]),
        50,
      ),
    ).rejects.toThrow('fallo inyectado en staging');
    expect(count(db, 'cuyes')).toBe(0);
    expect(count(db, 'eventos')).toBe(0);
    expect(count(db, 'sync_inbox')).toBe(0);
    expect(cursorOf(db)).toBeNull();
    db.close();
  });

  it('un error permanente queda diagnosticable sin sobrescribir la relación existente', async () => {
    const { db, adapter } = await makeDb();
    await applyPullPage(
      adapter,
      SCOPE,
      null,
      page(
        [
          { seq: '1', entity: 'cuyes', record: record(CRIA, '1', cuy(CRIA, 'C')) },
          { seq: '2', entity: 'partos', record: record(PARTO, '1', parto(PARTO, CRIA)) },
          { seq: '3', entity: 'parto_crias', record: record(VINCULO, '1', vinculo(PARTO, CRIA)) },
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
          { seq: '4', entity: 'partos', record: record(PARTO_B, '1', parto(PARTO_B, CRIA)) },
          {
            seq: '5',
            entity: 'parto_crias',
            record: record('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '1', vinculo(PARTO_B, CRIA)),
          },
        ],
        'c2',
      ),
      50,
    );
    expect(result).toMatchObject({ applied: 1, staged: 1, cursor: 'c2' });
    expect(db.prepare('SELECT parto_id FROM parto_crias WHERE cuy_id=?').get(CRIA)).toMatchObject({ parto_id: PARTO });
    const incomplete = await listInboxEntries(adapter, 'incomplete');
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]).toMatchObject({ code: 'UNIQUE_CONFLICT', entity: 'parto_crias' });
    expect(incomplete[0].payload.data).toMatchObject({ parto_id: PARTO_B, cuy_id: CRIA });
    db.close();
  });

  it('la reapertura conserva inbox y cursor y reintenta el staging', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cuyielite-d3-'));
    const file = path.join(dir, 'trabajo.db');
    try {
      const firstDb = new DatabaseSync(file);
      const firstAdapter = adapterFor(firstDb);
      await initializeWorkSyncDatabase(firstAdapter);
      firstDb.prepare('UPDATE sync_context SET scope_id=? WHERE singleton=1').run(SCOPE);
      await applyPullPage(
        firstAdapter,
        SCOPE,
        null,
        page([{ seq: '1', entity: 'pesajes', record: record(PESAJE, '1', pesaje(CRIA, EVENTO)) }], 'c1'),
        50,
      );
      firstDb.close();

      const reopened = new DatabaseSync(file);
      const reopenedAdapter = adapterFor(reopened);
      const identity = await initializeWorkSyncDatabase(reopenedAdapter);
      expect(identity.schemaVersion).toBe(5);
      expect(cursorOf(reopened)).toBe('c1');
      expect(await listInboxEntries(reopenedAdapter, 'staged')).toHaveLength(1);
      expect(await reconcileInbox(reopenedAdapter)).toMatchObject({ applied: 0, staged: 1 });

      await applyPullPage(
        reopenedAdapter,
        SCOPE,
        'c1',
        page(
          [
            { seq: '2', entity: 'cuyes', record: record(CRIA, '1', cuy(CRIA, 'C')) },
            { seq: '3', entity: 'eventos', record: record(EVENTO, '1', evento(CRIA)) },
          ],
          'c2',
        ),
        50,
      );
      expect(count(reopened, 'pesajes')).toBe(1);
      expect(cursorOf(reopened)).toBe('c2');
      reopened.close();
    } finally {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.rmdirSync(dir);
    }
  });
});
