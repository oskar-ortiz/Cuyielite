import { describe, expect, it } from 'vitest';

import type { WorkSyncStatus } from './work.sync.status';
import { classifySyncError, describeSyncState } from './work.sync.ui';

function status(overrides: Partial<WorkSyncStatus> = {}): WorkSyncStatus {
  return { scopeId: null, cursor: null, pending: 0, prepared: 0, conflicts: 0, rejected: 0, ...overrides };
}

describe('estado visible de sincronización', () => {
  it('prioriza la sincronización en curso sin ocultar los conflictos', () => {
    const view = describeSyncState({
      status: status({ conflicts: 2 }),
      syncing: true,
    });
    expect(view).toMatchObject({ phase: 'syncing', tone: 'primary' });
    expect(view.detail).toContain('Puedes seguir consultando');
  });

  it('muestra los conflictos antes que los cambios pendientes', () => {
    const view = describeSyncState({
      status: status({ pending: 3, conflicts: 1, scopeId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }),
      syncing: false,
    });
    expect(view).toMatchObject({ phase: 'conflict', title: 'Conflictos pendientes', tone: 'warning' });
    expect(view.detail).toContain('1 conflicto espera');
    expect(view.detail).toContain('se conservan');
  });

  it('distingue un fallo recuperable de uno de configuración', () => {
    expect(describeSyncState({ status: status(), syncing: false, outcome: { kind: 'offline' } })).toMatchObject({
      phase: 'offline',
      title: 'Sin conexión',
      tone: 'warning',
    });
    expect(describeSyncState({ status: status(), syncing: false, outcome: { kind: 'error' } })).toMatchObject({
      phase: 'error',
      tone: 'danger',
    });
  });

  it('muestra cambios pendientes y luego el resultado completado', () => {
    expect(describeSyncState({ status: status({ pending: 2 }), syncing: false })).toMatchObject({
      phase: 'pending',
      title: 'Cambios pendientes',
    });
    expect(
      describeSyncState({
        status: status({ scopeId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }),
        syncing: false,
        outcome: { kind: 'done' },
      }),
    ).toMatchObject({ phase: 'done', title: 'Sincronización completada', tone: 'success' });
  });

  it('informa la base vinculada sin cambios y la base sin sincronizar', () => {
    expect(
      describeSyncState({ status: status({ scopeId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }), syncing: false }),
    ).toMatchObject({ phase: 'done', title: 'Sin cambios pendientes' });
    expect(describeSyncState({ status: status(), syncing: false })).toMatchObject({
      phase: 'unsynced',
      title: 'Sin sincronizar',
      tone: 'medium',
    });
  });

  it('advierte los cambios rechazados sin inventar una resolución', () => {
    const view = describeSyncState({ status: status({ rejected: 1 }), syncing: false });
    expect(view.detail).toContain('1 cambio');
    expect(view.detail).toContain('requiere revisión');
  });

  it('concuerda en singular y plural para pendientes, conflictos y rechazos', () => {
    expect(describeSyncState({ status: status({ pending: 1 }), syncing: false }).detail).toBe(
      '1 cambio local espera envío.',
    );
    expect(describeSyncState({ status: status({ pending: 2 }), syncing: false }).detail).toBe(
      '2 cambios locales esperan envío.',
    );
    expect(describeSyncState({ status: status({ conflicts: 1 }), syncing: false }).detail).toBe(
      '1 conflicto espera tu decisión. Los cambios locales se conservan.',
    );
    expect(describeSyncState({ status: status({ conflicts: 2 }), syncing: false }).detail).toBe(
      '2 conflictos esperan tu decisión. Los cambios locales se conservan.',
    );
    expect(describeSyncState({ status: status({ rejected: 2 }), syncing: false }).detail).toContain(
      '2 cambios; requieren revisión',
    );
  });
});

describe('clasificación de errores de sincronización', () => {
  it('trata red, timeout y 503 como recuperables', () => {
    expect(classifySyncError(new TypeError('fetch failed'))).toBe('offline');
    expect(classifySyncError(new Error('network request timed out'))).toBe('offline');
    expect(classifySyncError(new Error('HTTP 503'))).toBe('offline');
    expect(classifySyncError(new Error('Failed to connect to /127.0.0.1:8000'))).toBe('offline');
    expect(classifySyncError(new Error('net::ERR_CONNECTION_REFUSED'))).toBe('offline');
  });

  it('trata token, ámbito y plataforma inválidos como configuración', () => {
    expect(classifySyncError(new Error('HTTP 401'))).toBe('error');
    expect(classifySyncError(new Error('HTTP 403'))).toBe('error');
    expect(classifySyncError(new Error('Token de sincronizacion invalido'))).toBe('error');
    expect(classifySyncError(new Error('Contexto central incompatible con sync-v1'))).toBe('error');
    expect(classifySyncError(new Error('Sincronizacion no disponible: se requiere Android o Windows instalado'))).toBe(
      'error',
    );
  });

  it('no oculta un error inesperado como recuperable', () => {
    expect(classifySyncError(new Error('fallo desconocido'))).toBe('error');
  });
});
