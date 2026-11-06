import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

export interface BoundContext {
  scope_id: string;
  device_id: string;
  protocol_version: number;
}

export async function bindContext(
  db: MigrationDb,
  ctx: { scope_id: string; device_id: string; protocol_version: number },
  expectedDeviceId: string,
): Promise<void> {
  await initializeWorkSyncDatabase(db);
  // S2 already created the singleton row with dataset_id and device_id.
  // Bind scope_id conditionally: only if NULL and device matches.
  const row = await db.query('SELECT scope_id, device_id FROM sync_context WHERE singleton=1', []);
  const existing = (row.values ?? [])[0] as { scope_id?: string | null; device_id?: string } | undefined;
  if (!existing) throw new Error('sync_context no inicializado');
  if (existing.device_id !== expectedDeviceId) throw new Error('Dispositivo local no coincide');
  if (existing.device_id !== ctx.device_id) throw new Error('Dispositivo autorizado no coincide');
  if (existing.scope_id && existing.scope_id !== ctx.scope_id) throw new Error('Cambio de scope no permitido');
  if (existing.scope_id === ctx.scope_id) {
    // already bound, no-op
    return;
  }
  // scope_id is NULL -> assign
  await db.run(
    'UPDATE sync_context SET scope_id=? WHERE singleton=1 AND scope_id IS NULL AND device_id=?',
    [ctx.scope_id, expectedDeviceId],
  );
  const check = await db.query('SELECT scope_id FROM sync_context WHERE singleton=1', []);
  const sc = (check.values ?? [])[0] as { scope_id?: string | null } | undefined;
  if (sc?.scope_id !== ctx.scope_id) throw new Error('No se pudo vincular el scope');
}

export async function getBoundScope(db: MigrationDb): Promise<string | null> {
  await initializeWorkSyncDatabase(db);
  const row = await db.query('SELECT scope_id FROM sync_context WHERE singleton=1', []);
  const r = (row.values ?? [])[0] as { scope_id?: string | null } | undefined;
  return r?.scope_id ?? null;
}
