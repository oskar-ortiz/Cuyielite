import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { updateWorkGalpon } from './work.outbox';
import { prepareEligible, sendPrepared } from './work.sync.client';
import { listConflictCases, readConflictReview, type ConflictReview } from './work.sync.conflicts.review';
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

describe('conflict review', () => {
  it('presenta ambas versiones y la revisión exacta de la cadena pendiente', async () => {
    const { db, adapter, a, b } = await setup();
    const cases = await listConflictCases(adapter);
    expect(cases).toHaveLength(1);
    expect(cases[0].review).toEqual(review(a.operationId!, b.operationId!));
    expect(cases[0].local).toMatchObject({ nombre: 'Local B', ubicacion: 'Lote B' });
    expect(cases[0].central.data).toMatchObject({ nombre: 'Central v2', ubicacion: 'Lote C' });
    db.close();
  });

  it('rechaza una revisión desactualizada antes de resolver el conflicto', async () => {
    const { db, adapter, a, b } = await setup();
    await expect(readConflictReview(adapter, review(a.operationId!, b.operationId!, '1'))).rejects.toThrow(
      /revisión cambió/,
    );
    await expect(readConflictReview(adapter, review(a.operationId!, a.operationId!))).rejects.toThrow(
      /revisión cambió/,
    );
    db.close();
  });
});
