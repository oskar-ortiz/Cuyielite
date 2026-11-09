import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';
import { validatePullPage, type PullRecord } from './work.sync.pull.js';

type Entity = 'galpon' | 'poza';
type Row = Record<string, unknown>;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ConflictReview {
  entity: Entity;
  recordId: string;
  conflictOperationId: string;
  expectedHeadOperationId: string;
  expectedServerVersion: string;
}

export interface ConflictCase {
  review: ConflictReview;
  central: PullRecord;
  local: Record<string, unknown>;
}

export type ConflictResolutionResult = { operationId: string | null; discarded: number };

function validateReview(review: ConflictReview): void {
  if (
    (review.entity !== 'galpon' && review.entity !== 'poza') ||
    !UUID_V4.test(review.recordId) ||
    !UUID_V4.test(review.conflictOperationId) ||
    !UUID_V4.test(review.expectedHeadOperationId) ||
    !/^[1-9][0-9]*$/.test(review.expectedServerVersion)
  ) {
    throw new Error('Datos de revisión de conflicto inválidos');
  }
}

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

export async function readConflictReview(
  db: MigrationDb,
  review: ConflictReview,
): Promise<{ scopeId: string; record: PullRecord; chain: Row[] }> {
  validateReview(review);
  if (!/^[1-9][0-9]*$/.test(review.expectedServerVersion)) throw new Error('Versión revisada inválida');
  const context = await one(db, 'SELECT scope_id FROM sync_context WHERE singleton=1');
  if (!context?.scope_id) throw new Error('Base de trabajo sin scope vinculado');
  const state = await one(
    db,
    'SELECT server_version,server_snapshot,local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?',
    [review.entity, review.recordId],
  );
  if (
    !state ||
    state.local_head_operation_id !== review.expectedHeadOperationId ||
    state.server_version !== review.expectedServerVersion
  ) {
    throw new Error('La revisión cambió; actualiza el conflicto antes de resolverlo');
  }
  const root = await one(
    db,
    'SELECT state,result_json FROM sync_outbox WHERE operation_id=? AND entity=? AND record_id=?',
    [review.conflictOperationId, review.entity, review.recordId],
  );
  const result = root?.result_json ? (JSON.parse(String(root.result_json)) as Record<string, unknown>) : null;
  if (root?.state !== 'conflict' || result?.status !== 'conflict') {
    throw new Error('La operación revisada ya no está en conflicto');
  }
  const chain = await db.query(
    `WITH RECURSIVE chain(operation_id) AS (
       SELECT ? UNION ALL
       SELECT o.operation_id FROM sync_outbox o JOIN chain c ON o.predecessor_id=c.operation_id
     )
     SELECT operation_id,state FROM sync_outbox WHERE operation_id IN (SELECT operation_id FROM chain)`,
    [review.conflictOperationId],
  );
  const operations = (chain.values ?? []) as Row[];
  if (!operations.some((row) => row.operation_id === review.expectedHeadOperationId)) {
    throw new Error('La cabeza local ya no pertenece a la cadena del conflicto');
  }
  if (operations.some((row) => row.state === 'prepared')) {
    throw new Error('Hay una solicitud preparada con resultado no reconciliado');
  }
  if (
    operations.some((row) => !['conflict', 'queued', 'rejected', 'superseded', 'discarded'].includes(String(row.state)))
  ) {
    throw new Error('La cadena de conflicto contiene operaciones no resolubles');
  }
  const raw = state.server_snapshot ? JSON.parse(String(state.server_snapshot)) : null;
  const validated = validatePullPage(
    {
      protocol_version: 1,
      scope_id: String(context.scope_id),
      items: [{ seq: '1', entity: review.entity, record: raw }],
      next_cursor: 'conflict-review',
      has_more: false,
    },
    String(context.scope_id),
    1,
  );
  const record = validated.items[0].record;
  if (record.id !== review.recordId || record.version !== review.expectedServerVersion) {
    throw new Error('Snapshot central no coincide con la revisión');
  }
  return { scopeId: String(context.scope_id), record, chain: operations };
}

export async function listConflictCases(db: MigrationDb): Promise<ConflictCase[]> {
  await initializeWorkSyncDatabase(db);
  const rows =
    (
      await db.query(
        `SELECT o.entity,o.record_id,o.operation_id,s.local_head_operation_id,s.server_version
       FROM sync_outbox o JOIN sync_record_state s
         ON s.entity=o.entity AND s.record_id=o.record_id
      WHERE o.state='conflict' ORDER BY o.local_seq`,
      )
    ).values ?? [];
  const cases: ConflictCase[] = [];
  for (const row of rows as Row[]) {
    const review: ConflictReview = {
      entity: row.entity as Entity,
      recordId: String(row.record_id),
      conflictOperationId: String(row.operation_id),
      expectedHeadOperationId: String(row.local_head_operation_id),
      expectedServerVersion: String(row.server_version),
    };
    const { record } = await readConflictReview(db, review);
    const local = await one(
      db,
      review.entity === 'galpon'
        ? 'SELECT nombre,ubicacion FROM galpones WHERE id=?'
        : 'SELECT galpon_id,codigo,tipo,capacidad_maxima FROM pozas WHERE id=?',
      [review.recordId],
    );
    if (!local) throw new Error('El registro local del conflicto no existe');
    cases.push({ review, central: record, local });
  }
  return cases;
}
