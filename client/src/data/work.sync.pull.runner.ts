import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';
import { applyPullPage } from './work.sync.pull.apply.js';
import { validatePullPage, type SyncPullPage, SyncPullError } from './work.sync.pull.validation.js';

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
): Promise<{ pages: number; applied: number; preservedLocal: number; ignoredOlder: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('limit pull fuera de rango');
  await initializeWorkSyncDatabase(db);
  const cursorRow = await one(db, 'SELECT scope_id,cursor FROM sync_context WHERE singleton=1');
  if (!cursorRow || cursorRow.scope_id !== scopeId) throw new SyncPullError('scope local no coincide');
  let cursor = (cursorRow.cursor as string | null) ?? null;
  const seen = new Set<string>();
  let pages = 0;
  let applied = 0;
  let preservedLocal = 0;
  let ignoredOlder = 0;
  while (true) {
    const page = validatePullPage(await receive(cursor, limit), scopeId, limit);
    if (seen.has(page.next_cursor) || (page.has_more && page.next_cursor === cursor)) {
      throw new SyncPullError('cursor pull repetido sin avance');
    }
    seen.add(page.next_cursor);
    const result = await applyPullPage(db, scopeId, cursor, page, limit);
    cursor = result.cursor;
    pages++;
    applied += result.applied;
    preservedLocal += result.preservedLocal;
    ignoredOlder += result.ignoredOlder;
    if (!page.has_more) break;
  }
  return { pages, applied, preservedLocal, ignoredOlder };
}
