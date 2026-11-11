import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  createCuyo,
  createEvento,
  createParto,
  createPesaje,
  listCuyesByPoza,
  listPartosByCuyo,
  updateCuyo,
} from './work.domain.repository';
import { validateCuyo, validateEvento, validateParto, validatePesaje } from './work.domain.validation';
import type { MigrationDb } from './work.migration';
import { initializeWorkSyncDatabase } from './work.sync.migration';

const G = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';
const T = '2026-01-01T00:00:00Z';

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
  db.prepare('INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at) VALUES(?,?,?,?,?)').run(
    G,
    'Galpón sintético',
    null,
    T,
    T,
  );
  db.prepare(
    'INSERT INTO pozas(id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
  ).run(P, G, 'P-1', 'cría', 20, T, T);
  return { db, adapter };
}

const cuyInput = (codigo: string) => ({
  pozaId: P,
  galponOrigenId: null,
  codigoIdentificacion: codigo,
  sexo: 'H' as const,
  fechaNacimiento: '2025-03-12',
  colorCodigo: null,
  ojosCodigo: null,
  pelajeOriginal: null,
  padreId: null,
  madreId: null,
  categoriaMl: null,
  ultimoPesoG: null,
  estado: 'ACTIVO',
});

describe('validación de dominio', () => {
  it('mantiene NULL frente a cero y exige referencias', () => {
    expect(validateCuyo({ ...cuyInput('C-1'), pozaId: '' }).ok).toBe(false);
    const conVacios = validateCuyo({ ...cuyInput('C-1'), ultimoPesoG: '', sexo: null });
    expect(conVacios.ok).toBe(true);
    if (conVacios.ok) {
      expect(conVacios.value.ultimoPesoG).toBeNull();
      expect(conVacios.value.sexo).toBeNull();
    }
    expect(
      validatePesaje({
        cuyId: 'no-uuid',
        fechaPesaje: null,
        pesoGramos: '',
        etapa: null,
        partoId: null,
        eventoId: null,
      }).ok,
    ).toBe(false);
    expect(
      validateParto({
        madreId: '33333333-3333-4333-8333-333333333333',
        fechaParto: '2026-01-20',
        numeroParto: 0,
        nacidosVivos: 1,
        nacidosMuertos: 0,
        tamanoCamadaNacida: 1,
        crias: [],
      }).ok,
    ).toBe(false);
    expect(
      validateEvento({
        cuyId: '33333333-3333-4333-8333-333333333333',
        tipo: '',
        fecha: null,
        machoId: null,
        pozaOrigenId: null,
        pozaDestinoId: null,
        detalle: null,
      }).ok,
    ).toBe(false);
  });

  it('rechaza pesos no decimales y dos vínculos en un pesaje', () => {
    expect(
      validatePesaje({
        cuyId: '33333333-3333-4333-8333-333333333333',
        fechaPesaje: null,
        pesoGramos: '270,5',
        etapa: null,
        partoId: null,
        eventoId: null,
      }).ok,
    ).toBe(false);
    expect(
      validatePesaje({
        cuyId: '33333333-3333-4333-8333-333333333333',
        fechaPesaje: null,
        pesoGramos: '270.50',
        etapa: null,
        partoId: '44444444-4444-4444-8444-444444444444',
        eventoId: '55555555-5555-4555-8555-555555555555',
      }).ok,
    ).toBe(false);
  });
});

describe('repositorio de dominio y outbox', () => {
  it('crea negocio y outbox en la misma transacción; guardar igual es no-op', async () => {
    const { db, adapter } = await makeDb();
    const created = await createCuyo(adapter, cuyInput('C-1'));
    expect(created.changed).toBe(true);
    expect(created.operationId).toBeTruthy();
    expect(db.prepare('SELECT COUNT(*) AS n FROM cuyes').get()).toMatchObject({ n: 1 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get()).toMatchObject({ n: 1 });
    const state = db
      .prepare('SELECT local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?')
      .get('cuyes', created.id) as { local_head_operation_id: string };
    expect(state.local_head_operation_id).toBe(created.operationId);

    const again = await updateCuyo(adapter, created.id, cuyInput('C-1'));
    expect(again).toMatchObject({ changed: false, operationId: null });
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get()).toMatchObject({ n: 1 });

    const changed = await updateCuyo(adapter, created.id, { ...cuyInput('C-1'), estado: 'VENDIDO' });
    expect(changed.changed).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get()).toMatchObject({ n: 2 });
    const op = db
      .prepare('SELECT action,predecessor_id FROM sync_outbox WHERE operation_id=?')
      .get(changed.operationId);
    expect(op).toMatchObject({ action: 'update', predecessor_id: created.operationId });
    db.close();
  });

  it('crea parto con parto_crias y conserva el vínculo padre/hijo', async () => {
    const { db, adapter } = await makeDb();
    const madre = await createCuyo(adapter, cuyInput('MADRE'));
    const cria = await createCuyo(adapter, cuyInput('CRIA'));
    const parto = await createParto(adapter, {
      madreId: madre.id,
      fechaParto: '2026-01-20',
      numeroParto: 1,
      nacidosVivos: 1,
      nacidosMuertos: 0,
      tamanoCamadaNacida: 1,
      crias: [cria.id],
    });
    expect(parto.changed).toBe(true);
    expect(db.prepare('SELECT COUNT(*) AS n FROM parto_crias').get()).toMatchObject({ n: 1 });
    const vinculo = db.prepare('SELECT operation_id FROM sync_outbox WHERE entity=?').all('parto_crias') as {
      operation_id: string;
    }[];
    expect(vinculo).toHaveLength(1);
    expect(
      db.prepare('SELECT parent_create_id FROM sync_outbox WHERE operation_id=?').get(vinculo[0].operation_id),
    ).toMatchObject({ parent_create_id: parto.operationId });
    expect(await listPartosByCuyo(adapter, madre.id)).toHaveLength(1);
    expect(await listCuyesByPoza(adapter, P)).toHaveLength(2);
    db.close();
  });

  it('revierte el lote sintético si una cría ya pertenece a otro parto', async () => {
    const { db, adapter } = await makeDb();
    const madre = await createCuyo(adapter, cuyInput('MADRE'));
    const cria = await createCuyo(adapter, cuyInput('CRIA'));
    await createParto(adapter, {
      madreId: madre.id,
      fechaParto: '2026-01-20',
      numeroParto: 1,
      nacidosVivos: 1,
      nacidosMuertos: 0,
      tamanoCamadaNacida: 1,
      crias: [cria.id],
    });
    const partosAntes = db.prepare('SELECT COUNT(*) AS n FROM partos').get() as { n: number };
    const outboxAntes = db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get() as { n: number };
    await expect(
      createParto(adapter, {
        madreId: madre.id,
        fechaParto: '2026-02-20',
        numeroParto: 2,
        nacidosVivos: 1,
        nacidosMuertos: 0,
        tamanoCamadaNacida: 1,
        crias: [cria.id],
      }),
    ).rejects.toThrow(/ya está vinculada/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM partos').get()).toMatchObject({ n: partosAntes.n });
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get()).toMatchObject({ n: outboxAntes.n });
    db.close();
  });

  it('crea pesaje y evento con sus referencias y rechaza una referencia inexistente', async () => {
    const { db, adapter } = await makeDb();
    const cuy = await createCuyo(adapter, cuyInput('C-2'));
    const evento = await createEvento(adapter, {
      cuyId: cuy.id,
      tipo: 'DESTETE',
      fecha: '2026-02-04',
      machoId: null,
      pozaOrigenId: P,
      pozaDestinoId: null,
      detalle: null,
    });
    const pesaje = await createPesaje(adapter, {
      cuyId: cuy.id,
      fechaPesaje: '2026-02-04',
      pesoGramos: '270.50',
      etapa: 'DESTETE',
      partoId: null,
      eventoId: evento.id,
    });
    expect(pesaje.changed).toBe(true);
    expect(db.prepare('SELECT evento_id,peso_gramos FROM pesajes WHERE id=?').get(pesaje.id)).toMatchObject({
      evento_id: evento.id,
      peso_gramos: '270.50',
    });
    const outboxAntes = db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get() as { n: number };
    await expect(
      createPesaje(adapter, {
        cuyId: cuy.id,
        fechaPesaje: null,
        pesoGramos: '100.00',
        etapa: null,
        partoId: null,
        eventoId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toThrow(/no existe/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get()).toMatchObject({ n: outboxAntes.n });
    db.close();
  });
});
