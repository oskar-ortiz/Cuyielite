import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { updateWorkGalpon } from './work.outbox';
import { prepareEligible, sendPrepared } from './work.sync.client';
import {
  listConflictCases,
  resolveConflictKeepCentral,
  resolveConflictRetry,
  type ConflictReview,
} from './work.sync.conflicts';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import { bindContext } from './work.sync.scope';

const ID = '11111111-1111-4111-8111-111111111111';
const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOW = '2026-11-06T10:00:00.000Z';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

async function setup() {
  const db = new DatabaseSync(':memory:');
  const adapter = adapterFor(db);
  const identity = await initializeWorkSyncDatabase(adapter);
  await bindContext(adapter, { scope_id: SCOPE, device_id: identity.deviceId, protocol_version: 1 }, identity.deviceId);
  db.prepare('INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at) VALUES(?,?,?,?,?)').run(
    ID,
    'Central v1',
    null,
    NOW,
    NOW,
  );
  const v1 = {
    id: ID,
    version: '1',
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    last_client_edited_at: NOW,
    data: { nombre: 'Central v1', ubicacion: null },
  };
  db.prepare('INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot) VALUES(?,?,?,?)').run(
    'galpon',
    ID,
    '1',
    JSON.stringify(v1),
  );
  const a = await updateWorkGalpon(adapter, ID, { nombre: 'Local A', ubicacion: null });
  const b = await updateWorkGalpon(adapter, ID, { nombre: 'Local B', ubicacion: 'Lote B' });
  await prepareEligible(adapter, identity.deviceId);
  const remote = {
    id: ID,
    version: '2',
    created_at: NOW,
    updated_at: '2026-11-06T11:00:00.000Z',
    deleted_at: null,
    last_client_edited_at: NOW,
    data: { nombre: 'Central v2', ubicacion: 'Lote C' },
  };
  await sendPrepared(adapter, async (request) => ({
    protocol_version: 1,
    results: [
      {
        operation_id: request.operations[0].operation_id,
        entity: 'galpon',
        record_id: ID,
        status: 'conflict',
        changed: false,
        code: 'VERSION_CONFLICT',
        record: remote,
      },
    ],
  }));
  return { db, adapter, deviceId: identity.deviceId, a, b, remote };
}

function review(a: string, b: string, version = '2'): ConflictReview {
  return {
    entity: 'galpon',
    recordId: ID,
    conflictOperationId: a,
    expectedHeadOperationId: b,
    expectedServerVersion: version,
  };
}


describe('conflict resolution', () => {
  it('permite conservar una eliminación central y prohíbe reintentar contra ella', async () => {
    const { db, adapter, remote } = await setup();
    const deleted = { ...remote, deleted_at: '2026-11-06T12:00:00.000Z' };
    db.prepare('UPDATE sync_record_state SET server_snapshot=? WHERE entity=? AND record_id=?').run(
      JSON.stringify(deleted),
      'galpon',
      ID,
    );
    const caseRecord = (await listConflictCases(adapter))[0];
    expect(caseRecord.central.deleted_at).toBe(deleted.deleted_at);
    await expect(
      resolveConflictRetry(adapter, caseRecord.review, { nombre: 'Local B', ubicacion: 'Lote B' }),
    ).rejects.toThrow(/eliminado/);
    await resolveConflictKeepCentral(adapter, caseRecord.review);
    expect(db.prepare('SELECT deleted_at FROM galpones WHERE id=?').get(ID)).toMatchObject({
      deleted_at: deleted.deleted_at,
    });
    db.close();
  });


  it('reintenta con operation_id nuevo y versión central revisada; descarta cadena previa', async () => {
    const { db, adapter, deviceId, a, b } = await setup();
    const resolution = await resolveConflictRetry(adapter, review(a.operationId!, b.operationId!), {
      nombre: 'Central fusionado',
      ubicacion: 'Lote C + ajuste local',
    });
    expect(resolution.operationId).toBeTruthy();
    expect(resolution.operationId).not.toBe(a.operationId);
    expect(resolution.discarded).toBe(2);
    expect(
      db
        .prepare('SELECT state FROM sync_outbox WHERE operation_id IN (?,?) ORDER BY operation_id')
        .all(a.operationId, b.operationId)
        .every((row: any) => row.state === 'discarded'),
    ).toBe(true);
    expect(db.prepare('SELECT nombre,ubicacion FROM galpones WHERE id=?').get(ID)).toMatchObject({
      nombre: 'Central fusionado',
      ubicacion: 'Lote C + ajuste local',
    });
    await prepareEligible(adapter, deviceId);
    const frozen = db
      .prepare('SELECT frozen_request,state,base_anchor FROM sync_outbox WHERE operation_id=?')
      .get(resolution.operationId) as any;
    expect(frozen.state).toBe('prepared');
    expect(frozen.base_anchor).toBe('2');
    expect(JSON.parse(frozen.frozen_request).operations[0].base_version).toBe('2');
    db.close();
  });


  it('conservar central descarta solo la cadena revisada y limpia local_head', async () => {
    const { db, adapter, a, b, remote } = await setup();
    const resolution = await resolveConflictKeepCentral(adapter, review(a.operationId!, b.operationId!));
    expect(resolution).toEqual({ operationId: null, discarded: 2 });
    expect(db.prepare('SELECT nombre,ubicacion FROM galpones WHERE id=?').get(ID)).toMatchObject({
      nombre: remote.data.nombre,
      ubicacion: remote.data.ubicacion,
    });
    expect(
      db
        .prepare('SELECT local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?')
        .get('galpon', ID),
    ).toMatchObject({ local_head_operation_id: null });
    db.close();
  });


  it('rechaza una resolución si la versión central cambió tras la revisión', async () => {
    const { db, adapter, a, b } = await setup();
    db.prepare('UPDATE sync_record_state SET server_version=? WHERE entity=? AND record_id=?').run('3', 'galpon', ID);
    await expect(resolveConflictKeepCentral(adapter, review(a.operationId!, b.operationId!))).rejects.toThrow(/cambió/);
    expect(db.prepare('SELECT state FROM sync_outbox WHERE operation_id=?').get(a.operationId)).toMatchObject({
      state: 'conflict',
    });
    expect(db.prepare('SELECT nombre FROM galpones WHERE id=?').get(ID)).toMatchObject({ nombre: 'Local B' });
    db.close();
  });


  it('rejects additional fields when retrying a conflict', async () => {
    const { db, adapter, a, b } = await setup();
    await expect(
      resolveConflictRetry(adapter, review(a.operationId!, b.operationId!), {
        nombre: 'No aceptar campos extra',
        ubicacion: null,
        scope_id: 'otro-scope',
      }),
    ).rejects.toThrow(/inválidos/);
    expect(db.prepare('SELECT state FROM sync_outbox WHERE operation_id=?').get(a.operationId)).toMatchObject({
      state: 'conflict',
    });
    db.close();
  });
});
