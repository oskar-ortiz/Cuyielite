import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

type Row = Record<string, unknown>;

// Lectura de solo lectura sobre el estado durable de la outbox y el contexto.
// No modifica filas ni avanza cursores: la UI puede consultarla en cualquier momento.
export interface WorkSyncStatus {
  scopeId: string | null;
  cursor: string | null;
  pending: number;
  prepared: number;
  conflicts: number;
  rejected: number;
}

export async function readWorkSyncStatus(db: MigrationDb): Promise<WorkSyncStatus> {
  const identity = await initializeWorkSyncDatabase(db);
  const row =
    ((
      await db.query(
        `SELECT
         SUM(CASE WHEN state IN ('queued','prepared') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN state = 'prepared' THEN 1 ELSE 0 END) AS prepared,
         SUM(CASE WHEN state = 'conflict' THEN 1 ELSE 0 END) AS conflicts,
         SUM(CASE WHEN state = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM sync_outbox`,
      )
    ).values?.[0] as Row | undefined) ?? {};
  return {
    scopeId: identity.scopeId,
    cursor: identity.cursor,
    pending: Number(row.pending ?? 0),
    prepared: Number(row.prepared ?? 0),
    conflicts: Number(row.conflicts ?? 0),
    rejected: Number(row.rejected ?? 0),
  };
}
