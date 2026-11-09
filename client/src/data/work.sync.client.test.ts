import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration.js';
import { createWorkGalpon, createWorkPoza, updateWorkGalpon } from './work.outbox.js';
import {
  prepareEligible,
  sendPrepared,
  validateReceipt,
  SyncReceiptError,
  type FrozenRequest,
  type SyncPushResponse,
} from './work.sync.client.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

const databases: DatabaseSync[] = [];

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  const db: MigrationDb = {
    exec: (sql) => sqlite.exec(sql),
    run: (sql, params) => {
      sqlite.prepare(sql).run(...((params ?? []) as never[]));
    },
    query: (sql, params) => ({
      values: sqlite.prepare(sql).all(...((params ?? []) as never[])) as Record<string, unknown>[],
    }),
  };
  return { sqlite, db };
}

function getOutbox(sqlite: DatabaseSync, operationId: string) {
  return sqlite.prepare('SELECT state, frozen_request FROM sync_outbox WHERE operation_id=?').get(operationId) as
    { state: string; frozen_request: string | null } | undefined;
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe('preparación local de operaciones de sincronización', () => {
  it('mantiene una poza queued hasta aceptar el alta de su galpón padre', async () => {
    const { sqlite, db } = makeDb();
    const galpon = await createWorkGalpon(db, { nombre: 'Norte', ubicacion: null });
    const poza = await createWorkPoza(db, galpon.id, {
      codigo: 'P-1',
      tipo: 'cría',
      capacidadMaxima: 25,
    });
    const identity = await initializeWorkSyncDatabase(db);

    expect(await prepareEligible(db, identity.deviceId)).toBe(1);
    expect(getOutbox(sqlite, galpon.operationId!)?.state).toBe('prepared');
    expect(getOutbox(sqlite, poza.operationId!)?.state).toBe('queued');
  });

  it('espera al predecesor accepted y congela la última versión central conocida', async () => {
    const { sqlite, db } = makeDb();
    const galpon = await createWorkGalpon(db, { nombre: 'Norte', ubicacion: null });
    const edit = await updateWorkGalpon(db, galpon.id, { nombre: 'Norte 2', ubicacion: 'Lote 2' });
    const identity = await initializeWorkSyncDatabase(db);

    expect(await prepareEligible(db, identity.deviceId)).toBe(1);
    expect(getOutbox(sqlite, edit.operationId!)?.state).toBe('queued');

    // Simula un recibo central persistido para la operación anterior.
    const previousRequest = JSON.parse(getOutbox(sqlite, galpon.operationId!)!.frozen_request!) as FrozenRequest;
    const previousReceipt = acceptedResponse(previousRequest).results[0];
    previousReceipt.record!.version = '7';
    sqlite
      .prepare("UPDATE sync_outbox SET state='accepted', result_json=? WHERE operation_id=?")
      .run(JSON.stringify(previousReceipt), galpon.operationId);
    sqlite
      .prepare("UPDATE sync_record_state SET server_version='7' WHERE entity='galpon' AND record_id=?")
      .run(galpon.id);

    expect(await prepareEligible(db, identity.deviceId)).toBe(1);
    const frozen = getOutbox(sqlite, edit.operationId!)?.frozen_request;
    expect(JSON.parse(frozen!).operations[0]).toMatchObject({
      operation_id: edit.operationId,
      action: 'update',
      base_version: '7',
      data: { nombre: 'Norte 2', ubicacion: 'Lote 2' },
    });
    expect(await prepareEligible(db, identity.deviceId)).toBe(0);
    expect(getOutbox(sqlite, edit.operationId!)?.frozen_request).toBe(frozen);
  });

  it('deja queued las acciones fuera del contrato de push v1', async () => {
    const { sqlite, db } = makeDb();
    const galpon = await createWorkGalpon(db, { nombre: 'Norte', ubicacion: null });
    sqlite.prepare('UPDATE sync_outbox SET action=? WHERE operation_id=?').run('delete', galpon.operationId);
    const identity = await initializeWorkSyncDatabase(db);

    expect(await prepareEligible(db, identity.deviceId)).toBe(0);
    expect(getOutbox(sqlite, galpon.operationId!)).toEqual({ state: 'queued', frozen_request: null });
  });

  it('valida y aplica un recibo accepted actualizando la versión central', async () => {
    const { sqlite, db } = makeDb();
    const galpon = await createWorkGalpon(db, { nombre: 'Norte', ubicacion: null });
    const identity = await initializeWorkSyncDatabase(db);
    expect(await prepareEligible(db, identity.deviceId)).toBe(1);

    const result = await sendPrepared(db, async (request) => acceptedResponse(request));

    expect(result).toEqual({ sent: 1, failed: 0, errors: [] });
    expect(getOutbox(sqlite, galpon.operationId!)?.state).toBe('accepted');
    expect(
      sqlite
        .prepare("SELECT server_version FROM sync_record_state WHERE entity='galpon' AND record_id=?")
        .get(galpon.id),
    ).toEqual({ server_version: '1' });
  });

  it('conserva el cuerpo frozen y prepared si falla el transporte', async () => {
    const { sqlite, db } = makeDb();
    const galpon = await createWorkGalpon(db, { nombre: 'Norte', ubicacion: null });
    const identity = await initializeWorkSyncDatabase(db);
    await prepareEligible(db, identity.deviceId);
    const before = getOutbox(sqlite, galpon.operationId!)?.frozen_request;

    const result = await sendPrepared(db, async () => {
      throw new Error('transporte no disponible');
    });

    expect(result).toEqual({ sent: 0, failed: 1, errors: ['transporte no disponible'] });
    expect(getOutbox(sqlite, galpon.operationId!)).toEqual({ state: 'prepared', frozen_request: before });
  });

  it('conserva prepared si el recibo no corresponde a la operación enviada', async () => {
    const { sqlite, db } = makeDb();
    const galpon = await createWorkGalpon(db, { nombre: 'Norte', ubicacion: null });
    const identity = await initializeWorkSyncDatabase(db);
    await prepareEligible(db, identity.deviceId);
    const before = getOutbox(sqlite, galpon.operationId!)?.frozen_request;

    const result = await sendPrepared(db, async (request) => ({
      protocol_version: request.protocol_version,
      results: [
        {
          operation_id: 'unexpected-operation',
          entity: 'galpon',
          record_id: galpon.id,
          status: 'accepted',
          changed: true,
          code: null,
          record: null,
        },
      ],
    }));

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(getOutbox(sqlite, galpon.operationId!)).toEqual({ state: 'prepared', frozen_request: before });
    expect(() =>
      validateReceipt(
        JSON.parse(before!) as FrozenRequest,
        {
          protocol_version: 1,
          results: [
            {
              operation_id: 'unexpected-operation',
              entity: 'galpon',
              record_id: galpon.id,
              status: 'accepted',
              changed: true,
              code: null,
              record: null,
            },
          ],
        } as SyncPushResponse,
      ),
    ).toThrow(SyncReceiptError);
  });

  it('aplica conflictos sin sobreescribir la versión local aceptada', async () => {
    const { sqlite, db } = makeDb();
    const galpon = await createWorkGalpon(db, { nombre: 'Norte', ubicacion: null });
    const identity = await initializeWorkSyncDatabase(db);
    await prepareEligible(db, identity.deviceId);

    const result = await sendPrepared(db, async (request) => ({
      protocol_version: request.protocol_version,
      results: [
        {
          operation_id: request.operations[0].operation_id,
          entity: 'galpon',
          record_id: galpon.id,
          status: 'conflict',
          changed: false,
          code: 'VERSION_CONFLICT',
          record: null,
        },
      ],
    }));

    expect(result).toEqual({ sent: 1, failed: 0, errors: [] });
    expect(getOutbox(sqlite, galpon.operationId!)?.state).toBe('conflict');
    expect(
      sqlite
        .prepare("SELECT server_version FROM sync_record_state WHERE entity='galpon' AND record_id=?")
        .get(galpon.id),
    ).toEqual({ server_version: null });
  });

  it('ancla la operacion sucesora a la version aceptada de su predecesora', async () => {
    const { sqlite, db } = makeDb();
    const galpon = await createWorkGalpon(db, { nombre: 'G1', ubicacion: null });
    const edit = await updateWorkGalpon(db, galpon.id, { nombre: 'G1 editado', ubicacion: null });
    const ctx = await initializeWorkSyncDatabase(db);

    expect(await prepareEligible(db, ctx.deviceId)).toBe(1);
    const result = await sendPrepared(db, async (request) => {
      const response = acceptedResponse(request);
      response.results[0].record!.version = '12';
      return response;
    });
    expect(result.sent).toBe(1);
    expect(await prepareEligible(db, ctx.deviceId)).toBe(1);
    const successor = getOutbox(sqlite, edit.operationId!)?.frozen_request;
    expect(JSON.parse(successor!).operations[0].base_version).toBe('12');
  });

  it('limita la preparación al corte local capturado por el coordinador', async () => {
    const { sqlite, db } = makeDb();
    await createWorkGalpon(db, { nombre: 'G1', ubicacion: null });
    await createWorkGalpon(db, { nombre: 'G2', ubicacion: null });
    const ctx = await initializeWorkSyncDatabase(db);
    const firstSeq = (sqlite.prepare('SELECT MIN(local_seq) AS seq FROM sync_outbox').get() as { seq: number }).seq;

    expect(await prepareEligible(db, ctx.deviceId, firstSeq)).toBe(1);
    const rows = sqlite.prepare('SELECT state FROM sync_outbox ORDER BY local_seq').all() as { state: string }[];
    expect(rows.map((row) => row.state)).toEqual(['prepared', 'queued']);
  });
});

function acceptedResponse(request: FrozenRequest): SyncPushResponse {
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
        record: {
          id: operation.record_id,
          version: '1',
          created_at: '2026-11-06T00:00:00Z',
          updated_at: '2026-11-06T00:00:00Z',
          deleted_at: null,
          last_client_edited_at: '2026-11-06T00:00:00Z',
          data: operation.data,
        },
      },
    ],
  };
}
