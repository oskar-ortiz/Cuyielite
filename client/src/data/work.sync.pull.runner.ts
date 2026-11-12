import type { MigrationDb } from './work.migration.js';
import { readSyncCursor, type SyncProtocol } from './work.sync.cursor.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';
import { applyPullPage, reconcileInbox } from './work.sync.pull.apply.js';
import { validatePullPage, SyncPullError } from './work.sync.pull.validation.js';

type Row = Record<string, unknown>;

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

export type PullPageFn = (cursor: string | null, limit: number) => Promise<unknown>;

export async function pullUntilCheckpoint(
  db: MigrationDb,
  scopeId: string,
  receive: PullPageFn,
  limit = 50,
  protocol: SyncProtocol = 1,
): Promise<{
  pages: number;
  applied: number;
  preservedLocal: number;
  ignoredOlder: number;
  staged: number;
  reconciled: number;
  conflicts: number;
}> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('limit pull fuera de rango');
  await initializeWorkSyncDatabase(db);
  // Reintenta staging persistido antes de pedir páginas nuevas (reapertura).
  await reconcileInbox(db);
  const context = await one(db, 'SELECT scope_id FROM sync_context WHERE singleton=1');
  if (!context || context.scope_id !== scopeId) throw new SyncPullError('scope local no coincide');
  let cursor = await readSyncCursor(db, protocol);
  const seen = new Set<string>();
  let pages = 0;
  let applied = 0;
  let preservedLocal = 0;
  let ignoredOlder = 0;
  let staged = 0;
  let reconciled = 0;
  let conflicts = 0;
  while (true) {
    const page = validatePullPage(await receive(cursor, limit), scopeId, limit, protocol);
    if (seen.has(page.next_cursor) || (page.has_more && page.next_cursor === cursor)) {
      throw new SyncPullError('cursor pull repetido sin avance');
    }
    seen.add(page.next_cursor);
    const result = await applyPullPage(db, scopeId, cursor, page, limit, protocol);
    cursor = result.cursor;
    pages++;
    applied += result.applied;
    preservedLocal += result.preservedLocal;
    ignoredOlder += result.ignoredOlder;
    staged += result.staged;
    reconciled += result.reconciled;
    conflicts += result.conflicts;
    if (!page.has_more) break;
  }
  return { pages, applied, preservedLocal, ignoredOlder, staged, reconciled, conflicts };
}
