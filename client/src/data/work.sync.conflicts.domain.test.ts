import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { updateCuyo, updateEvento, updateParto, updatePesaje, updateVinculoRol } from './work.domain.repository';
import type { MigrationDb } from './work.migration';
import { prepareEligible, sendPrepared, type FrozenRequest, type SyncPushResponse } from './work.sync.client';
import {
  listConflictCases,
  resolveConflictKeepCentral,
  resolveConflictRetry,
  type ConflictCase,
} from './work.sync.conflicts';
import {
  editableFields,
  formatConflictValue,
  type ConflictEntity,
  type ConflictField,
} from './work.sync.conflicts.config';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import type { PullRecord } from './work.sync.pull.validation';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOW = '2026-11-06T10:00:00.000Z';
const GALPON = '10000000-0000-4000-8000-000000000001';
const POZA = '10000000-0000-4000-8000-000000000002';
const MADRE = '10000000-0000-4000-8000-000000000003';
const CRIA = '10000000-0000-4000-8000-000000000004';
const MACHO = '10000000-0000-4000-8000-000000000005';
const PARTO = '10000000-0000-4000-8000-000000000006';
const PESAJE = '10000000-0000-4000-8000-000000000007';
const EVENTO = '10000000-0000-4000-8000-000000000008';
const VINCULO = '10000000-0000-4000-8000-000000000009';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

function record(id: string, version: string, data: Record<string, unknown>): PullRecord {
  return {
    id,
    version,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    last_client_edited_at: NOW,
    data,
  };
}

function cuyData(code: string) {
  return {
    poza_id: POZA,
    galpon_origen_id: null,
    codigo_identificacion: code,
    sexo: 'H',
    fecha_nacimiento: '2025-01-01',
    color_codigo: null,
    ojos_codigo: null,
    pelaje_original: null,
    padre_id: null,
    madre_id: null,
    categoria_ml: null,
    ultimo_peso_g: null,
    estado: 'ACTIVO',
  };
}

function partoData(vivos = 1) {
  return {
    madre_id: MADRE,
    fecha_parto: '2026-02-01',
    numero_parto: 1,
    nacidos_vivos: vivos,
    nacidos_muertos: 0,
    tamano_camada_nacida: 1,
  };
}

function pesajeData(peso = '1000.00') {
  return {
    cuy_id: CRIA,
    fecha_pesaje: '2026-02-02',
    peso_gramos: peso,
    etapa: 'DESTETE',
    parto_id: null,
    evento_id: null,
  };
}

function eventoData(detalle = 'Inicial') {
  return {
    cuy_id: CRIA,
    tipo: 'DESTETE',
    fecha: '2026-02-03',
    macho_id: null,
    poza_origen_id: null,
    poza_destino_id: null,
    detalle,
  };
}

function vinculoData(rol = 'CRIA') {
  return { parto_id: PARTO, cuy_id: CRIA, rol };
}

function cuyoInput(code: string) {
  return {
    pozaId: POZA,
    galponOrigenId: null,
    codigoIdentificacion: code,
    sexo: 'H' as const,
    fechaNacimiento: '2025-01-01',
    colorCodigo: null,
    ojosCodigo: null,
    pelajeOriginal: null,
    padreId: null,
    madreId: null,
    categoriaMl: null,
    ultimoPesoG: null,
    estado: 'ACTIVO',
  };
}

function partoInput(vivos: number) {
  return {
    madreId: MADRE,
    fechaParto: '2026-02-01',
    numeroParto: 1,
    nacidosVivos: vivos,
    nacidosMuertos: 0,
    tamanoCamadaNacida: 1,
    crias: [] as string[],
  };
}

function pesajeInput(peso: string) {
  return {
    cuyId: CRIA,
    fechaPesaje: '2026-02-02',
    pesoGramos: peso,
    etapa: 'DESTETE',
    partoId: null,
    eventoId: null,
  };
}

function eventoInput(detalle: string) {
  return {
    cuyId: CRIA,
    tipo: 'DESTETE',
    fecha: '2026-02-03',
    machoId: null,
    pozaOrigenId: null,
    pozaDestinoId: null,
    detalle,
  };
}

async function seedBase(db: DatabaseSync): Promise<MigrationDb> {
  const adapter = adapterFor(db);
  await initializeWorkSyncDatabase(adapter);
  db.prepare('UPDATE sync_context SET scope_id=? WHERE singleton=1').run(SCOPE);
  db.prepare('INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at) VALUES(?,?,NULL,?,?)').run(
    GALPON,
    'Galpón',
    NOW,
    NOW,
  );
  db.prepare(
    'INSERT INTO pozas(id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
  ).run(POZA, GALPON, 'P-1', 'cría', 10, NOW, NOW);
  const insertCuy = db.prepare(
    'INSERT INTO cuyes(id,poza_id,codigo_identificacion,sexo,estado,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
  );
  insertCuy.run(MADRE, POZA, 'MADRE', 'H', 'ACTIVO', NOW, NOW);
  insertCuy.run(CRIA, POZA, 'CRIA', 'H', 'ACTIVO', NOW, NOW);
  insertCuy.run(MACHO, POZA, 'MACHO', 'M', 'ACTIVO', NOW, NOW);
  db.prepare(
    'INSERT INTO partos(id,madre_id,fecha_parto,numero_parto,nacidos_vivos,nacidos_muertos,tamano_camada_nacida,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
  ).run(PARTO, MADRE, '2026-02-01', 1, 1, 0, 1, NOW, NOW);
  db.prepare(
    'INSERT INTO pesajes(id,cuy_id,fecha_pesaje,peso_gramos,etapa,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
  ).run(PESAJE, CRIA, '2026-02-02', '1000.00', 'DESTETE', NOW, NOW);
  db.prepare('INSERT INTO eventos(id,cuy_id,tipo,fecha,detalle,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(
    EVENTO,
    CRIA,
    'DESTETE',
    '2026-02-03',
    'Inicial',
    NOW,
    NOW,
  );
  db.prepare('INSERT INTO parto_crias(id,parto_id,cuy_id,rol,created_at) VALUES(?,?,?,?,?)').run(
    VINCULO,
    PARTO,
    CRIA,
    'CRIA',
    NOW,
  );
  return adapter;
}

function seedState(adapter: MigrationDb, entity: ConflictEntity, id: string, data: Record<string, unknown>) {
  adapter.run('INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot) VALUES(?,?,?,?)', [
    entity,
    id,
    '1',
    JSON.stringify(record(id, '1', data)),
  ]);
}

async function markConflict(
  adapter: MigrationDb,
  entity: ConflictEntity,
  id: string,
  remoteData: Record<string, unknown>,
): Promise<void> {
  await prepareEligible(adapter, (await initializeWorkSyncDatabase(adapter)).deviceId);
  await sendPrepared(adapter, async (request: FrozenRequest) => ({
    protocol_version: request.protocol_version,
    results: [
      {
        operation_id: request.operations[0].operation_id,
        entity,
        record_id: id,
        status: 'conflict',
        changed: false,
        code: 'VERSION_CONFLICT',
        record: record(id, '2', remoteData),
      },
    ],
  }));
}

function retryInput(item: ConflictCase): Record<string, string> {
  return Object.fromEntries(
    editableFields(item.review.entity).map((field) => [
      field.key,
      item.local[field.key] == null ? '' : String(item.local[field.key]),
    ]),
  );
}

async function accepted(request: FrozenRequest): Promise<SyncPushResponse> {
  return {
    protocol_version: request.protocol_version,
    results: [
      {
        operation_id: request.operations[0].operation_id,
        entity: request.operations[0].entity,
        record_id: request.operations[0].record_id,
        status: 'accepted',
        changed: true,
        code: null,
        record: record(request.operations[0].record_id, '3', request.operations[0].data as Record<string, unknown>),
      },
    ],
  };
}

describe('conflictos de dominio en la UI', () => {
  it('compara y resuelve un animal conservando la operación y el recibo originales', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await seedBase(db);
    seedState(adapter, 'cuyes', CRIA, cuyData('CRIA'));
    const a = await updateCuyo(adapter, CRIA, cuyoInput('LOCAL-A'));
    const b = await updateCuyo(adapter, CRIA, cuyoInput('LOCAL-B'));
    await markConflict(adapter, 'cuyes', CRIA, cuyData('CENTRAL'));
    const cases = await listConflictCases(adapter);
    expect(cases).toHaveLength(1);
    expect(cases[0].review.entity).toBe('cuyes');
    expect(cases[0].local.codigo_identificacion).toBe('LOCAL-B');
    expect(cases[0].central.data.codigo_identificacion).toBe('CENTRAL');
    const before = db
      .prepare('SELECT state,result_json,frozen_request FROM sync_outbox WHERE operation_id=?')
      .get(a.operationId!) as any;
    const input = retryInput(cases[0]);
    input.codigo_identificacion = 'REVISADO';
    const result = await resolveConflictRetry(adapter, cases[0].review, input);
    expect(result.operationId).toBeTruthy();
    expect(result.operationId).not.toBe(b.operationId);
    expect(db.prepare('SELECT codigo_identificacion FROM cuyes WHERE id=?').get(CRIA)).toMatchObject({
      codigo_identificacion: 'REVISADO',
    });
    const after = db
      .prepare('SELECT state,result_json,frozen_request FROM sync_outbox WHERE operation_id=?')
      .get(a.operationId!) as any;
    expect(after.state).toBe('discarded');
    expect(after.result_json).toBe(before.result_json);
    expect(after.frozen_request).toBe(before.frozen_request);
    const created = db
      .prepare('SELECT base_anchor,state FROM sync_outbox WHERE operation_id=?')
      .get(result.operationId!) as any;
    expect(created).toMatchObject({ base_anchor: '2', state: 'queued' });
    await prepareEligible(adapter, (await initializeWorkSyncDatabase(adapter)).deviceId);
    expect(await sendPrepared(adapter, accepted)).toMatchObject({ sent: 1, failed: 0 });
    await expect(resolveConflictRetry(adapter, cases[0].review, input)).rejects.toThrow(
      /cambió|ya no está en conflicto/,
    );
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM sync_outbox WHERE entity='cuyes' AND record_id=?").get(CRIA),
    ).toMatchObject({ n: 3 });
    db.close();
  });

  it.each([
    ['partos', PARTO, partoData(1), partoData(2), 'nacidos_vivos', '3', 'nacidos_vivos', 3],
    [
      'pesajes',
      PESAJE,
      pesajeData('1000.00'),
      pesajeData('1200.00'),
      'peso_gramos',
      '1500.00',
      'peso_gramos',
      '1500.00',
    ],
    ['eventos', EVENTO, eventoData('Inicial'), eventoData('Central'), 'detalle', 'Revisado', 'detalle', 'Revisado'],
  ] as const)(
    'compara y resuelve %s con una operación nueva',
    async (entity, id, initial, central, editKey, editValue, column, expected) => {
      const db = new DatabaseSync(':memory:');
      const adapter = await seedBase(db);
      seedState(adapter, entity, id, initial);
      if (entity === 'partos') {
        await updateParto(adapter, PARTO, partoInput(2));
        await updateParto(adapter, PARTO, partoInput(3));
      } else if (entity === 'pesajes') {
        await updatePesaje(adapter, PESAJE, pesajeInput('1100.00'));
        await updatePesaje(adapter, PESAJE, pesajeInput('1234.50'));
      } else {
        await updateEvento(adapter, EVENTO, eventoInput('Local B'));
      }
      await markConflict(adapter, entity, id, central as Record<string, unknown>);
      const cases = await listConflictCases(adapter);
      expect(cases).toHaveLength(1);
      expect(cases[0].review.entity).toBe(entity);
      const input = retryInput(cases[0]);
      input[editKey] = editValue;
      const result = await resolveConflictRetry(adapter, cases[0].review, input);
      expect(result.operationId).toBeTruthy();
      expect(db.prepare(`SELECT ${column} FROM ${entity} WHERE id=?`).get(id)).toMatchObject({ [column]: expected });
      db.close();
    },
  );

  it('resuelve un vínculo cría–parto y bloquea un vínculo inválido por UNIQUE(cuy_id)', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await seedBase(db);
    seedState(adapter, 'parto_crias', VINCULO, vinculoData('CRIA'));
    await updateVinculoRol(adapter, VINCULO, 'LOCAL-B');
    await markConflict(adapter, 'parto_crias', VINCULO, vinculoData('CENTRAL'));
    const cases = await listConflictCases(adapter);
    expect(cases[0].review.entity).toBe('parto_crias');
    const input = retryInput(cases[0]);
    input.rol = 'REVISADO';
    const result = await resolveConflictRetry(adapter, cases[0].review, input);
    expect(result.operationId).toBeTruthy();
    expect(db.prepare('SELECT rol FROM parto_crias WHERE id=?').get(VINCULO)).toMatchObject({ rol: 'REVISADO' });

    const second = '10000000-0000-4000-8000-000000000010';
    db.prepare('INSERT INTO parto_crias(id,parto_id,cuy_id,rol,created_at) VALUES(?,?,?,?,?)').run(
      second,
      PARTO,
      MACHO,
      'CRIA',
      NOW,
    );
    const nextOperation = result.operationId!;
    const invalid = { ...vinculoData('CRIA'), cuy_id: MACHO };
    db.prepare("UPDATE sync_outbox SET state='conflict', result_json=? WHERE operation_id=?").run(
      JSON.stringify({
        operation_id: nextOperation,
        entity: 'parto_crias',
        record_id: VINCULO,
        status: 'conflict',
        changed: false,
        code: 'VERSION_CONFLICT',
        record: record(VINCULO, '4', invalid),
      }),
      nextOperation,
    );
    db.prepare(
      'UPDATE sync_record_state SET server_version=?, server_snapshot=?, local_head_operation_id=? WHERE entity=? AND record_id=?',
    ).run('4', JSON.stringify(record(VINCULO, '4', invalid)), nextOperation, 'parto_crias', VINCULO);
    const invalidCase = (await listConflictCases(adapter))[0];
    await expect(resolveConflictRetry(adapter, invalidCase.review, { rol: 'REVISADO' })).rejects.toThrow(
      /ya está vinculada/,
    );

    const mother = { ...vinculoData('CRIA'), cuy_id: MADRE };
    db.prepare('UPDATE sync_record_state SET server_version=?, server_snapshot=? WHERE entity=? AND record_id=?').run(
      '5',
      JSON.stringify(record(VINCULO, '5', mother)),
      'parto_crias',
      VINCULO,
    );
    await expect(
      resolveConflictRetry(adapter, { ...invalidCase.review, expectedServerVersion: '5' }, { rol: 'REVISADO' }),
    ).rejects.toThrow(/madre no puede ser cría/);
    db.close();
  });

  it('conserva los derivados del servidor al aceptar central si el recibo no los incluye', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await seedBase(db);
    db.prepare('UPDATE cuyes SET categoria_ml=?, ultimo_peso_g=? WHERE id=?').run('ELITE', '950.00', CRIA);
    seedState(adapter, 'cuyes', CRIA, cuyData('CRIA'));
    await updateCuyo(adapter, CRIA, cuyoInput('LOCAL'));
    const receipt = cuyData('CENTRAL');
    delete (receipt as Partial<typeof receipt>).categoria_ml;
    delete (receipt as Partial<typeof receipt>).ultimo_peso_g;
    await markConflict(adapter, 'cuyes', CRIA, receipt);
    const item = (await listConflictCases(adapter))[0];
    expect(item.missingServerFields.sort()).toEqual(['categoria_ml', 'ultimo_peso_g']);
    await resolveConflictKeepCentral(adapter, item.review);
    expect(
      db.prepare('SELECT codigo_identificacion,categoria_ml,ultimo_peso_g FROM cuyes WHERE id=?').get(CRIA),
    ).toMatchObject({
      codigo_identificacion: 'CENTRAL',
      categoria_ml: 'ELITE',
      ultimo_peso_g: '950.00',
    });
    db.close();
  });

  it('rechaza resolver si la versión central cambió y conserva el conflicto', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await seedBase(db);
    seedState(adapter, 'eventos', EVENTO, eventoData('Inicial'));
    await updateEvento(adapter, EVENTO, {
      cuyId: CRIA,
      tipo: 'DESTETE',
      fecha: '2026-02-03',
      machoId: null,
      pozaOrigenId: null,
      pozaDestinoId: null,
      detalle: 'Local',
    });
    await markConflict(adapter, 'eventos', EVENTO, eventoData('Central'));
    const item = (await listConflictCases(adapter))[0];
    db.prepare('UPDATE sync_record_state SET server_version=? WHERE entity=? AND record_id=?').run(
      '3',
      'eventos',
      EVENTO,
    );
    await expect(resolveConflictKeepCentral(adapter, item.review)).rejects.toThrow(/cambió/);
    expect(
      db.prepare('SELECT state FROM sync_outbox WHERE operation_id=?').get(item.review.conflictOperationId),
    ).toMatchObject({
      state: 'conflict',
    });
    expect(db.prepare('SELECT detalle FROM eventos WHERE id=?').get(EVENTO)).toMatchObject({ detalle: 'Local' });
    db.close();
  });

  it('rechaza una revisión obsoleta si aparece una edición posterior', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = await seedBase(db);
    seedState(adapter, 'pesajes', PESAJE, pesajeData('1000.00'));
    await updatePesaje(adapter, PESAJE, pesajeInput('1100.00'));
    await markConflict(adapter, 'pesajes', PESAJE, pesajeData('1200.00'));
    const item = (await listConflictCases(adapter))[0];
    const later = crypto.randomUUID();
    db.prepare(
      'INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,predecessor_id,state,created_at) VALUES(?,?,?,?,?,?,?,?)',
    ).run(
      later,
      'pesajes',
      PESAJE,
      'update',
      JSON.stringify(pesajeData('1300.00')),
      item.review.expectedHeadOperationId,
      'queued',
      NOW,
    );
    db.prepare('UPDATE sync_record_state SET local_head_operation_id=? WHERE entity=? AND record_id=?').run(
      later,
      'pesajes',
      PESAJE,
    );
    await expect(resolveConflictKeepCentral(adapter, item.review)).rejects.toThrow(/cambió/);
    expect(
      db.prepare('SELECT state FROM sync_outbox WHERE operation_id=?').get(item.review.conflictOperationId),
    ).toMatchObject({
      state: 'conflict',
    });
    expect(db.prepare('SELECT peso_gramos FROM pesajes WHERE id=?').get(PESAJE)).toMatchObject({
      peso_gramos: '1100.00',
    });
    db.close();
  });
});

describe('presentación de conflictos', () => {
  const field = (key: string, kind: ConflictField['kind'], unit?: string): ConflictField => ({
    key,
    label: key,
    kind,
    unit,
  });
  const references = {
    galpones: [],
    pozas: [],
    cuyes: [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', label: 'C-AND-V2 · aaaaaaaa' },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', label: 'C-AND-V2 · bbbbbbbb' },
    ],
    partos: [],
    eventos: [],
  };

  it('distingue NULL de cero, formatea fechas y pesos y resuelve chapas repetidas', () => {
    expect(formatConflictValue(field('peso_gramos', 'decimal', 'g'), '1234.50', references)).toBe('1234.50 g');
    expect(formatConflictValue(field('nacidos_vivos', 'integer'), 0, references)).toBe('0');
    expect(formatConflictValue(field('detalle', 'text'), null, references)).toBe('Sin dato');
    expect(formatConflictValue(field('fecha', 'date'), '2026-02-01', references)).toBe('01/02/2026');
    expect(
      formatConflictValue(
        { key: 'cuy_id', label: 'Animal', kind: 'reference', reference: 'cuyes' },
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        references,
      ),
    ).toBe('C-AND-V2 · bbbbbbbb');
  });
});
