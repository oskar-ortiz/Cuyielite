import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

import type { MigrationDb } from './work.migration';
import { createWorkGalpon } from './work.outbox';
import { runSyncCycle } from './work.sync.coordinator';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import type { SyncPullPage } from './work.sync.pull';
import type { SyncTransport } from './work.sync.transport';

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

function emptyPage(cursor: string): SyncPullPage {
  return { protocol_version: 1, scope_id: SCOPE, items: [], next_cursor: cursor, has_more: false };
}

describe('permisos de sincronización por rol', () => {
  it('viewer descarga pero no prepara ni envía la outbox', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    await adapter.run('UPDATE sync_context SET scope_id=? WHERE singleton=1', [SCOPE]);
    await createWorkGalpon(adapter, { nombre: 'Pendiente de admin', ubicacion: null });
    const push = vi.fn();
    const transport: SyncTransport = {
      context: async () => ({
        protocol_version: 1,
        scope_id: SCOPE,
        device_id: identity.deviceId,
        limits: { push_operations: 100, push_bytes: 1_048_576, pull_default: 50, pull_max: 100 },
      }),
      pull: async () => emptyPage('viewer-checkpoint'),
      push,
    };

    const result = await runSyncCycle(adapter, transport, 'viewer-token-abcdefghijklmnopqrstuvwxyz', {
      allowPush: false,
    });

    expect(push).not.toHaveBeenCalled();
    expect(result.pushedResults).toBe(0);
    expect(result.pending).toBe(1);
    expect(db.prepare("SELECT state FROM sync_outbox WHERE entity='galpon'").get()).toMatchObject({
      state: 'queued',
    });
    db.close();
  });

  it('el viewer también descarga el feed derivado de solo lectura', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    await adapter.run('UPDATE sync_context SET scope_id=? WHERE singleton=1', [SCOPE]);
    const cuyId = '11111111-1111-4111-8111-111111111111';
    const push = vi.fn();
    const pullDerived = vi.fn(async () => ({
      protocol_version: 3,
      scope_id: SCOPE,
      items: [
        {
          seq: '1',
          entity: 'categoria',
          record: {
            id: cuyId,
            version: '1',
            created_at: '2026-11-16T10:00:00.000Z',
            updated_at: '2026-11-16T10:00:00.000Z',
            deleted_at: null,
            last_client_edited_at: null,
            data: {
              cuy_id: cuyId,
              clase: null,
              estado_evaluacion: 'DATOS_INSUFICIENTES',
              categoria_estado: null,
              motivos: ['dato faltante o inválido: abortos'],
              faltantes: ['abortos'],
              reglas_version: 'adr0004+reglas-2026-11-16',
              evaluada_at: null,
              procedencia: { fuente: 'CENTRAL' },
              apoyo_modelo: null,
            },
          },
        },
      ],
      next_cursor: 'derived-checkpoint',
      has_more: false,
    }));
    const transport: SyncTransport = {
      context: async () => ({
        protocol_version: 1,
        scope_id: SCOPE,
        device_id: identity.deviceId,
        limits: { push_operations: 100, push_bytes: 1_048_576, pull_default: 50, pull_max: 100 },
      }),
      pull: async () => emptyPage('viewer-checkpoint'),
      push,
      pullDerived,
    };

    const result = await runSyncCycle(adapter, transport, 'viewer-token-abcdefghijklmnopqrstuvwxyz', {
      allowPush: false,
    });

    expect(push).not.toHaveBeenCalled();
    expect(pullDerived).toHaveBeenCalled();
    expect(result.derivedApplied).toBe(1);
    expect(result.derivedAvailable).toBe(true);
    const stored = db.prepare('SELECT estado_evaluacion, clase FROM categorias_animal WHERE cuy_id=?').get(cuyId);
    expect(stored).toMatchObject({ estado_evaluacion: 'DATOS_INSUFICIENTES', clase: null });
    db.close();
  });

  it('un servidor sin protocolo 3 no rompe la sincronización de dominio', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = adapterFor(db);
    const identity = await initializeWorkSyncDatabase(adapter);
    await adapter.run('UPDATE sync_context SET scope_id=? WHERE singleton=1', [SCOPE]);
    const transport: SyncTransport = {
      context: async () => ({
        protocol_version: 1,
        scope_id: SCOPE,
        device_id: identity.deviceId,
        limits: { push_operations: 100, push_bytes: 1_048_576, pull_default: 50, pull_max: 100 },
      }),
      pull: async () => emptyPage('sin-v3'),
      push: vi.fn(),
      pullDerived: async () => {
        throw new Error('HTTP 404');
      },
    };

    const result = await runSyncCycle(adapter, transport, 'viewer-token-abcdefghijklmnopqrstuvwxyz', {
      allowPush: false,
    });

    expect(result.derivedAvailable).toBe(false);
    expect(result.scopeId).toBe(SCOPE);
    db.close();
  });
});
