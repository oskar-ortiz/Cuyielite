import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { createWorkGalpon } from './work.outbox';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import { readWorkSyncStatus } from './work.sync.status';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

describe('estado de sincronización de trabajo', () => {
  it('informa una base nueva sin vínculo ni cambios', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    await initializeWorkSyncDatabase(adapter);

    await expect(readWorkSyncStatus(adapter)).resolves.toEqual({
      scopeId: null,
      cursor: null,
      pending: 0,
      prepared: 0,
      conflicts: 0,
      rejected: 0,
    });
    db.close();
  });

  it('cuenta pendientes, preparados, conflictos y rechazados por separado', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    await initializeWorkSyncDatabase(adapter);
    await createWorkGalpon(adapter, { nombre: 'Galpón pendiente', ubicacion: null });
    await createWorkGalpon(adapter, { nombre: 'Galpón en conflicto', ubicacion: null });
    await createWorkGalpon(adapter, { nombre: 'Galpón rechazado', ubicacion: null });

    expect(await readWorkSyncStatus(adapter)).toMatchObject({ pending: 3, conflicts: 0, rejected: 0 });

    db.prepare("UPDATE sync_outbox SET state='prepared', frozen_request='{}' WHERE local_seq=1").run();
    db.prepare("UPDATE sync_outbox SET state='conflict' WHERE local_seq=2").run();
    db.prepare("UPDATE sync_outbox SET state='rejected' WHERE local_seq=3").run();

    await expect(readWorkSyncStatus(adapter)).resolves.toEqual({
      scopeId: null,
      cursor: null,
      pending: 1,
      prepared: 1,
      conflicts: 1,
      rejected: 1,
    });
    db.close();
  });

  it('refleja el scope y el cursor persistidos sin modificarlos', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    await initializeWorkSyncDatabase(adapter);
    db.prepare('UPDATE sync_context SET scope_id=?, cursor=? WHERE singleton=1').run(SCOPE, 'cursor-1');

    const first = await readWorkSyncStatus(adapter);
    const second = await readWorkSyncStatus(adapter);
    expect(first).toMatchObject({ scopeId: SCOPE, cursor: 'cursor-1' });
    expect(second).toEqual(first);
    db.close();
  });
});
