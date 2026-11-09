import { initializeWorkSyncDatabase } from './work.sync.migration.js';
export async function readWorkSyncStatus(db) {
    const identity = await initializeWorkSyncDatabase(db);
    const row = (await db.query(`SELECT
         SUM(CASE WHEN state IN ('queued','prepared') THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN state = 'prepared' THEN 1 ELSE 0 END) AS prepared,
         SUM(CASE WHEN state = 'conflict' THEN 1 ELSE 0 END) AS conflicts,
         SUM(CASE WHEN state = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM sync_outbox`)).values?.[0] ?? {};
    return {
        scopeId: identity.scopeId,
        cursor: identity.cursor,
        pending: Number(row.pending ?? 0),
        prepared: Number(row.prepared ?? 0),
        conflicts: Number(row.conflicts ?? 0),
        rejected: Number(row.rejected ?? 0),
    };
}
