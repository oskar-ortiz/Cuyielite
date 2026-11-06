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
  const row = await db.query('SELECT scope_id, device_id FROM sync_context WHERE singleton=1', []);
  const existing = (row.values ?? [])[0] as { scope_id?: string; device_id?: string } | undefined;
  if (existing && existing.scope_id) {
    if (existing.scope_id !== ctx.scope_id) throw new Error('Cambio de scope no permitido');
    if (existing.device_id !== ctx.device_id) throw new Error('Dispositivo no autorizado');
    if (existing.device_id !== expectedDeviceId) throw new Error('Dispositivo local no coincide');
  } else {
    if (ctx.device_id !== expectedDeviceId) throw new Error('Dispositivo local no coincide');
    await db.run(
      'INSERT INTO sync_context(singleton, dataset_id, device_id, scope_id, protocol_version, cursor) VALUES (1, ?, ?, ?, ?, NULL)',
      ['lab', ctx.device_id, ctx.scope_id, ctx.protocol_version],
    );
  }
}

export async function getBoundScope(db: MigrationDb): Promise<string | null> {
  await initializeWorkSyncDatabase(db);
  const row = await db.query('SELECT scope_id FROM sync_context WHERE singleton=1', []);
  const r = (row.values ?? [])[0] as { scope_id?: string } | undefined;
  return r?.scope_id ?? null;
}
