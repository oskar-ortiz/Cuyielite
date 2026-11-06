import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import type { MigrationDb } from './work.migration';
import { initializeWorkSyncDatabase } from './work.sync.migration';
import { pullUntilCheckpoint } from './work.sync.pull.runner';
import type { SyncPullPage } from './work.sync.pull.validation';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const GALPON = '11111111-1111-4111-8111-111111111111';
const CREATED = '2026-11-06T10:00:00.000Z';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

function record(id: string, version: string, data: Record<string, unknown>) {
  return {
    id,
    version,
    created_at: CREATED,
    updated_at: CREATED,
    deleted_at: null,
    last_client_edited_at: CREATED,
    data,
  };
}

function page(items: SyncPullPage['items'], nextCursor = 'opaque-next', hasMore = false): SyncPullPage {
  return { protocol_version: 1, scope_id: SCOPE, items, next_cursor: nextCursor, has_more: hasMore };
}

async function makeDb() {
  const db = new DatabaseSync(':memory:');
  const adapter = adapterFor(db);
  const identity = await initializeWorkSyncDatabase(adapter);
  db.prepare('UPDATE sync_context SET scope_id=? WHERE singleton=1').run(SCOPE);
  return { db, adapter, identity };
}

describe('pull-v1 checkpoint runner', () => {
  it('descarga todas las páginas y trata el cursor como valor opaco', async () => {
    const { db, adapter } = await makeDb();
    const received: (string | null)[] = [];
    const result = await pullUntilCheckpoint(
      adapter,
      SCOPE,
      async (cursor) => {
        received.push(cursor);
        if (cursor === null)
          return page(
            [{ seq: '1', entity: 'galpon', record: record(GALPON, '1', { nombre: 'A', ubicacion: null }) }],
            'opaque/page/one',
            true,
          );
        return page([], 'opaque/checkpoint', false);
      },
      1,
    );
    expect(received).toEqual([null, 'opaque/page/one']);
    expect(result).toMatchObject({ pages: 2, applied: 1, preservedLocal: 0 });
    expect(db.prepare('SELECT cursor FROM sync_context WHERE singleton=1').get()).toMatchObject({
      cursor: 'opaque/checkpoint',
    });
    db.close();
  });

  it('reanuda desde la última página confirmada si la siguiente falla', async () => {
    const { db, adapter } = await makeDb();
    const first = page(
      [{ seq: '1', entity: 'galpon', record: record(GALPON, '1', { nombre: 'A', ubicacion: null }) }],
      'opaque/page/one',
      true,
    );
    await expect(
      pullUntilCheckpoint(
        adapter,
        SCOPE,
        async (cursor) => {
          if (cursor === null) return first;
          throw new Error('red interrumpida');
        },
        1,
      ),
    ).rejects.toThrow('red interrumpida');
    expect(db.prepare('SELECT cursor FROM sync_context WHERE singleton=1').get()).toMatchObject({
      cursor: 'opaque/page/one',
    });

    const received: (string | null)[] = [];
    const resumed = await pullUntilCheckpoint(
      adapter,
      SCOPE,
      async (cursor) => {
        received.push(cursor);
        return page([], 'opaque/checkpoint', false);
      },
      1,
    );
    expect(received).toEqual(['opaque/page/one']);
    expect(resumed).toMatchObject({ pages: 1, applied: 0 });
    expect(db.prepare('SELECT COUNT(*) AS n FROM galpones').get()).toEqual({ n: 1 });
    db.close();
  });

  it('rechaza un cursor repetido en una página con más resultados', async () => {
    const { db, adapter } = await makeDb();
    await expect(
      pullUntilCheckpoint(
        adapter,
        SCOPE,
        async () =>
          page(
            [{ seq: '1', entity: 'galpon', record: record(GALPON, '1', { nombre: 'A', ubicacion: null }) }],
            'same-cursor',
            true,
          ),
        1,
      ),
    ).rejects.toThrow(/cursor pull repetido/);
    expect(db.prepare('SELECT cursor FROM sync_context WHERE singleton=1').get()).toMatchObject({
      cursor: 'same-cursor',
    });
    db.close();
  });
});
