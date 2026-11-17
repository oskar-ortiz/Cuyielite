import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

import { createCuyo, createParto } from './work.domain.repository';
import type { MigrationDb } from './work.migration';
import { createWorkGalpon, createWorkPoza } from './work.outbox';
import {
  freezePayload,
  prepareEligible,
  protocolForEntity,
  sendPrepared,
  type FrozenRequest,
  type SyncPushResponse,
} from './work.sync.client';
import { runSyncCycle } from './work.sync.coordinator';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import { pullUntilCheckpoint } from './work.sync.pull';
import { applyPullPage, listInboxEntries } from './work.sync.pull.apply';
import { validatePullPage, type PullRecord, type SyncPullPage } from './work.sync.pull.validation';
import type { SyncTransport } from './work.sync.transport';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CREATED = '2026-11-06T10:00:00.000Z';
const CUY = '11111111-1111-4111-8111-111111111111';
const PARTO = '22222222-2222-4222-8222-222222222222';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

function record(id: string, version: string, data: Record<string, unknown>, deleted: string | null = null): PullRecord {
  return {
    id,
    version,
    created_at: CREATED,
    updated_at: CREATED,
    deleted_at: deleted,
    last_client_edited_at: null,
    data,
  };
}

function page(items: SyncPullPage['items'], cursor: string, hasMore = false, protocol = 2): SyncPullPage {
  return { protocol_version: protocol, scope_id: SCOPE, items, next_cursor: cursor, has_more: hasMore };
}

function cuyData(code = 'C-1', poza: string | null = null) {
  return {
    poza_id: poza,
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
  };
}

function partoData(madreId: string) {
  return {
    madre_id: madreId,
    fecha_parto: '2026-01-20',
    numero_parto: 1,
    nacidos_vivos: 2,
    nacidos_muertos: 0,
    tamano_camada_nacida: 2,
  };
}

function accepted(request: FrozenRequest, version = '1'): SyncPushResponse {
  const operation = request.operations[0];
  return {
    protocol_version: request.protocol_version,
    results: [
      {
        operation_id: operation.operation_id,
        entity: operation.entity,
        record_id: operation.record_id,
        status: 'accepted',
        changed: true,
        code: null,
        record: record(operation.record_id, version, operation.data as Record<string, unknown>),
      },
    ],
  };
}

function queueV2Cuy(db: DatabaseSync, id = CUY) {
  db.prepare(
    'INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,state,created_at) VALUES(?,?,?,?,?,?,?)',
  ).run(crypto.randomUUID(), 'cuyes', id, 'create', JSON.stringify(cuyData('QUEUED')), 'queued', CREATED);
}

describe('integración de dominio v2', () => {
  it('congela el cuerpo v2 sin campos del servidor y deja v1 intacto', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    queueV2Cuy(db, CUY);
    db.prepare(
      'INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,state,created_at) VALUES(?,?,?,?,?,?,?)',
    ).run(
      crypto.randomUUID(),
      'galpon',
      crypto.randomUUID(),
      'create',
      JSON.stringify({ nombre: 'G', ubicacion: null }),
      'queued',
      CREATED,
    );

    expect(await prepareEligible(adapter, identity.deviceId)).toBe(2);
    const cuy = db.prepare("SELECT frozen_request FROM sync_outbox WHERE entity='cuyes'").get() as {
      frozen_request: string;
    };
    const frozen = JSON.parse(cuy.frozen_request) as FrozenRequest;
    expect(frozen.protocol_version).toBe(2);
    expect(Object.keys(frozen.operations[0].data as object).sort()).toEqual(
      [
        'poza_id',
        'galpon_origen_id',
        'codigo_identificacion',
        'sexo',
        'fecha_nacimiento',
        'color_codigo',
        'ojos_codigo',
        'pelaje_original',
        'padre_id',
        'madre_id',
        'estado',
      ].sort(),
    );
    expect(frozen.operations[0].data).not.toHaveProperty('categoria_ml');
    expect(frozen.operations[0].data).not.toHaveProperty('ultimo_peso_g');

    const galpon = db.prepare("SELECT frozen_request FROM sync_outbox WHERE entity='galpon'").get() as {
      frozen_request: string;
    };
    expect((JSON.parse(galpon.frozen_request) as FrozenRequest).protocol_version).toBe(1);
    expect(protocolForEntity('cuyes')).toBe(2);
    expect(protocolForEntity('poza')).toBe(1);
    expect(freezePayload('galpon', { nombre: 'G' })).toEqual({ nombre: 'G' });
    db.close();
  });

  it('no prepara un parto hasta que la madre pendiente esté aceptada', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    const galpon = crypto.randomUUID();
    const poza = crypto.randomUUID();
    db.prepare('INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at) VALUES(?,?,NULL,?,?)').run(
      galpon,
      'G',
      CREATED,
      CREATED,
    );
    db.prepare(
      'INSERT INTO pozas(id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    ).run(poza, galpon, 'P', 'cría', 10, CREATED, CREATED);
    const madre = await createCuyo(adapter, {
      pozaId: poza,
      galponOrigenId: null,
      codigoIdentificacion: 'MADRE-DEP',
      sexo: 'H',
      fechaNacimiento: null,
      colorCodigo: null,
      ojosCodigo: null,
      pelajeOriginal: null,
      padreId: null,
      madreId: null,
      categoriaMl: null,
      ultimoPesoG: null,
      estado: 'ACTIVO',
    });
    const parto = await createParto(adapter, {
      madreId: madre.id,
      fechaParto: '2026-02-01',
      numeroParto: 1,
      nacidosVivos: 1,
      nacidosMuertos: 0,
      tamanoCamadaNacida: 1,
      crias: [],
    });

    expect(await prepareEligible(adapter, identity.deviceId)).toBe(1);
    expect(db.prepare('SELECT state FROM sync_outbox WHERE operation_id=?').get(parto.operationId)).toMatchObject({
      state: 'queued',
    });
    await sendPrepared(adapter, async (request) => accepted(request));
    expect(await prepareEligible(adapter, identity.deviceId)).toBe(1);
    expect(db.prepare('SELECT state FROM sync_outbox WHERE operation_id=?').get(parto.operationId)).toMatchObject({
      state: 'prepared',
    });
    db.close();
  });

  it('mantiene preparada una dependencia rechazada y la acepta al reintentar', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    queueV2Cuy(db, CUY);
    await prepareEligible(adapter, identity.deviceId);
    const frozen = JSON.parse(
      (db.prepare("SELECT frozen_request FROM sync_outbox WHERE entity='cuyes'").get() as { frozen_request: string })
        .frozen_request,
    ) as FrozenRequest;

    const rejected = await sendPrepared(adapter, async () => ({
      protocol_version: 2,
      results: [
        {
          operation_id: frozen.operations[0].operation_id,
          entity: 'cuyes',
          record_id: CUY,
          status: 'rejected',
          changed: false,
          code: 'DEPENDENCY_PENDING',
          record: null,
        },
      ],
    }));
    expect(rejected).toMatchObject({ sent: 1, failed: 0 });
    const states = db.prepare("SELECT state FROM sync_outbox WHERE entity='cuyes' ORDER BY local_seq").all() as {
      state: string;
    }[];
    expect(states.map((row) => row.state)).toEqual(['superseded', 'queued']);
    expect((db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get() as { n: number }).n).toBe(2);

    expect(await prepareEligible(adapter, identity.deviceId)).toBe(1);
    const acceptedResult = await sendPrepared(adapter, async (request) => accepted(request));
    expect(acceptedResult).toMatchObject({ sent: 1, failed: 0 });
    expect(
      db.prepare("SELECT state FROM sync_outbox WHERE entity='cuyes' ORDER BY local_seq DESC LIMIT 1").get(),
    ).toMatchObject({
      state: 'accepted',
    });
    db.close();
  });

  it('aplica pull v2 desde cero con cursor independiente y replay idempotente', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    await initializeWorkSyncDatabase(adapter);
    db.prepare('UPDATE sync_context SET scope_id=?, cursor=?, cursor_v2=NULL WHERE singleton=1').run(
      SCOPE,
      'v1-cursor',
    );

    const firstPage = page([{ seq: '1', entity: 'cuyes', record: record(CUY, '1', cuyData('V2-1')) }], 'v2-c1');
    const result = await pullUntilCheckpoint(adapter, SCOPE, async () => firstPage, 50, 2);
    expect(result.applied).toBe(1);
    expect(db.prepare('SELECT cursor,cursor_v2 FROM sync_context WHERE singleton=1').get()).toMatchObject({
      cursor: 'v1-cursor',
      cursor_v2: 'v2-c1',
    });
    expect(db.prepare('SELECT codigo_identificacion FROM cuyes WHERE id=?').get(CUY)).toMatchObject({
      codigo_identificacion: 'V2-1',
    });

    const replay = await applyPullPage(adapter, SCOPE, null, firstPage, 50, 2);
    expect(replay.applied).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM cuyes').get() as { n: number }).n).toBe(1);
    db.close();
  });

  it('acepta una página v2 vacía con has_more y continúa hasta el checkpoint', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    await initializeWorkSyncDatabase(adapter);
    db.prepare('UPDATE sync_context SET scope_id=? WHERE singleton=1').run(SCOPE);
    const pages = [
      page([], 'v2-empty', true),
      page([{ seq: '1', entity: 'cuyes', record: record(CUY, '1', cuyData('DESPUES')) }], 'v2-final'),
    ];
    let calls = 0;
    const result = await pullUntilCheckpoint(adapter, SCOPE, async () => pages[calls++], 1, 2);
    expect(result.pages).toBe(2);
    expect(result.applied).toBe(1);
    expect(calls).toBe(2);
    expect(db.prepare('SELECT codigo_identificacion FROM cuyes WHERE id=?').get(CUY)).toMatchObject({
      codigo_identificacion: 'DESPUES',
    });
    db.close();
  });

  it('staging durable de una dependencia v2 se aplica al llegar el padre', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    await initializeWorkSyncDatabase(adapter);
    db.prepare('UPDATE sync_context SET scope_id=? WHERE singleton=1').run(SCOPE);

    await pullUntilCheckpoint(
      adapter,
      SCOPE,
      async () => page([{ seq: '1', entity: 'partos', record: record(PARTO, '1', partoData(CUY)) }], 'v2-c1'),
      50,
      2,
    );
    expect((db.prepare('SELECT COUNT(*) AS n FROM partos').get() as { n: number }).n).toBe(0);
    expect(await listInboxEntries(adapter, 'staged')).toHaveLength(1);

    await pullUntilCheckpoint(
      adapter,
      SCOPE,
      async () => page([{ seq: '2', entity: 'cuyes', record: record(CUY, '1', cuyData('MADRE')) }], 'v2-c2'),
      50,
      2,
    );
    expect((db.prepare('SELECT COUNT(*) AS n FROM partos').get() as { n: number }).n).toBe(1);
    expect(await listInboxEntries(adapter, 'applied')).toHaveLength(1);
    db.close();
  });

  it('rechaza entidades v1 en una página v2', () => {
    expect(() =>
      validatePullPage(
        page([{ seq: '1', entity: 'galpon', record: record(CUY, '1', { nombre: 'G', ubicacion: null }) }], 'x'),
        SCOPE,
        50,
        2,
      ),
    ).toThrow(/inválido|incompatible/);
  });

  it('coordina v1 para galpon/poza y v2 para cuyes con cursores separados', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    const galpon = await createWorkGalpon(adapter, { nombre: 'Galpón', ubicacion: null });
    const poza = await createWorkPoza(adapter, galpon.id, { codigo: 'P-1', tipo: 'cría', capacidadMaxima: 10 });
    await createCuyo(adapter, {
      pozaId: poza.id,
      galponOrigenId: null,
      codigoIdentificacion: 'C-1',
      sexo: 'H',
      fechaNacimiento: null,
      colorCodigo: null,
      ojosCodigo: null,
      pelajeOriginal: null,
      padreId: null,
      madreId: null,
      categoriaMl: null,
      ultimoPesoG: null,
      estado: 'ACTIVO',
    });
    const v1Pushes: FrozenRequest[] = [];
    const v2Pushes: FrozenRequest[] = [];
    const transport: SyncTransport = {
      context: async () => ({
        protocol_version: 1,
        scope_id: SCOPE,
        device_id: identity.deviceId,
        limits: { pull_default: 50, pull_max: 100 },
      }),
      contextV2: async () => ({
        protocol_version: 2,
        scope_id: SCOPE,
        device_id: identity.deviceId,
        supported_entities: ['cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias'],
        limits: { pull_default: 50, pull_max: 100 },
      }),
      pull: async () => page([], 'v1-checkpoint', false, 1),
      pullV2: async () => page([], 'v2-checkpoint', false, 2),
      push: vi.fn(async (_token: string, body: unknown) => {
        v1Pushes.push(body as FrozenRequest);
        return accepted(body as FrozenRequest);
      }),
      pushV2: vi.fn(async (_token: string, body: unknown) => {
        v2Pushes.push(body as FrozenRequest);
        return accepted(body as FrozenRequest);
      }),
    };
    const result = await runSyncCycle(adapter, transport, 'synthetic-token-abcdefghijklmnopqrstuvwxyz', {
      sleep: async () => {},
      random: () => 0.5,
    });
    expect(result.pending).toBe(0);
    expect(v1Pushes.map((request) => request.operations[0].entity)).toEqual(['galpon', 'poza']);
    expect(v2Pushes.map((request) => request.operations[0].entity)).toEqual(['cuyes']);
    expect(db.prepare('SELECT cursor,cursor_v2 FROM sync_context WHERE singleton=1').get()).toMatchObject({
      cursor: 'v1-checkpoint',
      cursor_v2: 'v2-checkpoint',
    });
    db.close();
  });
});
