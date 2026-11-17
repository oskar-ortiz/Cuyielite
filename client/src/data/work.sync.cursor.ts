import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

export type SyncProtocol = 1 | 2;

type Row = Record<string, unknown>;

export function cursorColumn(protocol: SyncProtocol): 'cursor' | 'cursor_v2' {
  return protocol === 2 ? 'cursor_v2' : 'cursor';
}

export async function readSyncCursor(db: MigrationDb, protocol: SyncProtocol): Promise<string | null> {
  await initializeWorkSyncDatabase(db);
  const column = cursorColumn(protocol);
  const row = ((await db.query(`SELECT ${column} FROM sync_context WHERE singleton=1`)).values?.[0] ??
    null) as Row | null;
  const value = row?.[column];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function writeSyncCursor(
  db: MigrationDb,
  protocol: SyncProtocol,
  scopeId: string,
  expected: string | null,
  next: string,
): Promise<void> {
  await initializeWorkSyncDatabase(db);
  const column = cursorColumn(protocol);
  await db.run(`UPDATE sync_context SET ${column}=? WHERE singleton=1 AND scope_id=? AND ${column} IS ?`, [
    next,
    scopeId,
    expected,
  ]);
  const row = ((await db.query(`SELECT ${column} FROM sync_context WHERE singleton=1`)).values?.[0] ??
    null) as Row | null;
  if (row?.[column] !== next) throw new Error('no se pudo confirmar el cursor de sincronización');
}
