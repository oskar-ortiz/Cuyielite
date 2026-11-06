import { describe, expect, it } from 'vitest';

import { validatePullPage, type SyncPullPage } from './work.sync.pull.validation';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const GALPON = '11111111-1111-4111-8111-111111111111';
const CREATED = '2026-11-06T10:00:00.000Z';

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

describe('pull-v1 contract', () => {
  it('valida ámbito, secuencia creciente y límite antes de aplicar', () => {
    const valid = page([
      { seq: '1', entity: 'galpon', record: record(GALPON, '1', { nombre: 'G1', ubicacion: null }) },
    ]);
    expect(validatePullPage(valid, SCOPE, 50)).toEqual(valid);
    expect(() => validatePullPage({ ...valid, scope_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, SCOPE, 50)).toThrow(
      /ámbito/,
    );
    expect(() =>
      validatePullPage(
        page([
          { seq: '2', entity: 'galpon', record: record(GALPON, '1', { nombre: 'G1', ubicacion: null }) },
          { seq: '1', entity: 'galpon', record: record(GALPON, '2', { nombre: 'G2', ubicacion: null }) },
        ]),
        SCOPE,
        50,
      ),
    ).toThrow(/orden/);
  });
});
