import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration.js';
import { createWorkGalpon, createWorkPoza, updateWorkGalpon } from './work.outbox.js';
import { prepareEligible } from './work.sync.client.js';
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

    // Simula el estado persistido después de que el servidor aceptó la operación anterior.
    sqlite.prepare("UPDATE sync_outbox SET state='accepted' WHERE operation_id=?").run(galpon.operationId);
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
});
