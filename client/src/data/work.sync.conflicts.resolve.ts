import type { MigrationDb } from './work.migration.js';
import {
  conflictConfig,
  sameEditableData,
  validateRetryValues,
  type ConflictEntity,
} from './work.sync.conflicts.config.js';
import {
  readConflictReview,
  type ConflictResolutionResult,
  type ConflictReview,
} from './work.sync.conflicts.review.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';
import { applyCentralBusinessRecord } from './work.sync.pull.js';
import type { PullRecord } from './work.sync.pull.validation.js';

type Row = Record<string, unknown>;

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

async function transaction<T>(db: MigrationDb, work: () => Promise<T>): Promise<T> {
  await initializeWorkSyncDatabase(db);
  await db.exec('BEGIN IMMEDIATE');
  try {
    await initializeWorkSyncDatabase(db);
    const result = await work();
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

function operationId(): string {
  if (!crypto?.randomUUID) throw new Error('crypto.randomUUID no disponible');
  return crypto.randomUUID();
}

async function discardReviewedChain(db: MigrationDb, operationId: string): Promise<number> {
  const count = await one(
    db,
    `WITH RECURSIVE chain(operation_id) AS (
       SELECT ? UNION ALL
       SELECT o.operation_id FROM sync_outbox o JOIN chain c ON o.predecessor_id=c.operation_id
     ) SELECT COUNT(*) AS count FROM sync_outbox
       WHERE operation_id IN (SELECT operation_id FROM chain) AND state IN ('conflict','queued','rejected')`,
    [operationId],
  );
  await db.run(
    `WITH RECURSIVE chain(operation_id) AS (
       SELECT ? UNION ALL
       SELECT o.operation_id FROM sync_outbox o JOIN chain c ON o.predecessor_id=c.operation_id
     )
     UPDATE sync_outbox SET state='discarded'
     WHERE operation_id IN (SELECT operation_id FROM chain)
       AND state IN ('conflict','queued','rejected')`,
    [operationId],
  );
  return Number(count?.count ?? 0);
}

async function requireActive(db: MigrationDb, table: string, id: unknown, label: string): Promise<void> {
  if (typeof id !== 'string' || id.length === 0) throw new Error(`${label} es obligatorio`);
  const row = await one(db, `SELECT 1 AS ok FROM ${table} WHERE id=? AND deleted_at IS NULL`, [id]);
  if (!row) throw new Error(`${label} no existe en la base de trabajo`);
}

async function validateLocalReferences(
  db: MigrationDb,
  entity: ConflictEntity,
  data: Record<string, unknown>,
  recordId: string,
): Promise<void> {
  if (entity === 'cuyes') {
    await requireActive(db, 'pozas', data.poza_id, 'La poza actual');
    if (data.galpon_origen_id) await requireActive(db, 'galpones', data.galpon_origen_id, 'El galpón de origen');
    if (data.padre_id) await requireActive(db, 'cuyes', data.padre_id, 'El padre');
    if (data.madre_id) await requireActive(db, 'cuyes', data.madre_id, 'La madre');
    if (data.padre_id === recordId || data.madre_id === recordId) {
      throw new Error('Un animal no puede ser su propio padre o madre');
    }
    return;
  }
  if (entity === 'partos') {
    await requireActive(db, 'cuyes', data.madre_id, 'La madre');
    return;
  }
  if (entity === 'pesajes') {
    await requireActive(db, 'cuyes', data.cuy_id, 'El animal');
    if (data.parto_id) await requireActive(db, 'partos', data.parto_id, 'El parto');
    if (data.evento_id) await requireActive(db, 'eventos', data.evento_id, 'El evento');
    return;
  }
  if (entity === 'eventos') {
    await requireActive(db, 'cuyes', data.cuy_id, 'El animal');
    if (data.macho_id) await requireActive(db, 'cuyes', data.macho_id, 'El macho');
    if (data.poza_origen_id) await requireActive(db, 'pozas', data.poza_origen_id, 'La poza de origen');
    if (data.poza_destino_id) await requireActive(db, 'pozas', data.poza_destino_id, 'La poza de destino');
    return;
  }
  if (entity === 'parto_crias') {
    await requireActive(db, 'partos', data.parto_id, 'El parto');
    await requireActive(db, 'cuyes', data.cuy_id, 'La cría');
    const parto = await one(db, 'SELECT madre_id FROM partos WHERE id=?', [data.parto_id]);
    if (parto?.madre_id === data.cuy_id) throw new Error('La madre no puede ser cría de su propio parto');
    const other = await one(db, 'SELECT 1 AS ok FROM parto_crias WHERE cuy_id=? AND id<>?', [data.cuy_id, recordId]);
    if (other) throw new Error('La cría ya está vinculada a otro parto');
  }
}

async function updateLocalBusinessRow(
  db: MigrationDb,
  entity: ConflictEntity,
  recordId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const config = conflictConfig(entity);
  const keys = Object.keys(data);
  if (keys.length === 0) return;
  const assignments = keys.map((key) => `${key}=?`).join(',');
  const values = keys.map((key) => data[key] ?? null);
  if (entity === 'parto_crias') {
    await db.run(`UPDATE ${config.table} SET ${assignments} WHERE id=?`, [...values, recordId]);
    return;
  }
  await db.run(`UPDATE ${config.table} SET ${assignments},updated_at=? WHERE id=?`, [
    ...values,
    new Date().toISOString(),
    recordId,
  ]);
}

async function applyCentralForConflict(
  db: MigrationDb,
  entity: ConflictEntity,
  record: PullRecord,
  missingServerFields: string[],
): Promise<void> {
  if (entity !== 'cuyes' || missingServerFields.length === 0) {
    await applyCentralBusinessRecord(db, entity, record);
    return;
  }
  const local = await one(db, 'SELECT categoria_ml,ultimo_peso_g FROM cuyes WHERE id=?', [record.id]);
  const data = { ...record.data };
  for (const field of missingServerFields) data[field] = local?.[field] ?? null;
  await applyCentralBusinessRecord(db, entity, { ...record, data });
}

export async function resolveConflictKeepCentral(
  db: MigrationDb,
  review: ConflictReview,
): Promise<ConflictResolutionResult> {
  return transaction(db, async () => {
    const { record, missingServerFields } = await readConflictReview(db, review);
    const discarded = await discardReviewedChain(db, review.conflictOperationId);
    await applyCentralForConflict(db, review.entity, record, missingServerFields);
    await db.run(
      'UPDATE sync_record_state SET local_head_operation_id=NULL WHERE entity=? AND record_id=? AND local_head_operation_id=?',
      [review.entity, review.recordId, review.expectedHeadOperationId],
    );
    return { operationId: null, discarded };
  });
}

export async function resolveConflictRetry(
  db: MigrationDb,
  review: ConflictReview,
  input: Record<string, unknown>,
): Promise<ConflictResolutionResult> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Datos para reintento inválidos');
  }
  return transaction(db, async () => {
    const { record, missingServerFields } = await readConflictReview(db, review);
    if (record.deleted_at !== null) throw new Error('El registro central fue eliminado; conserva la versión central');
    const validation = validateRetryValues(review.entity, input, record);
    if (validation.ok === false) throw new Error(validation.errors.join('; '));
    const data = validation.data;
    await validateLocalReferences(db, review.entity, data, review.recordId);

    if (sameEditableData(review.entity, data, record.data)) {
      const discarded = await discardReviewedChain(db, review.conflictOperationId);
      await applyCentralForConflict(db, review.entity, record, missingServerFields);
      await db.run(
        'UPDATE sync_record_state SET local_head_operation_id=NULL WHERE entity=? AND record_id=? AND local_head_operation_id=?',
        [review.entity, review.recordId, review.expectedHeadOperationId],
      );
      return { operationId: null, discarded };
    }

    const discarded = await discardReviewedChain(db, review.conflictOperationId);
    await applyCentralForConflict(db, review.entity, record, missingServerFields);
    await updateLocalBusinessRow(db, review.entity, review.recordId, data);
    const now = new Date().toISOString();
    const newOperationId = operationId();
    await db.run(
      `INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,base_anchor,
        predecessor_id,parent_create_id,state,created_at)
       VALUES(?,?,?,'update',?,?,NULL,NULL,'queued',?)`,
      [newOperationId, review.entity, review.recordId, JSON.stringify(data), review.expectedServerVersion, now],
    );
    await db.run(
      'UPDATE sync_record_state SET local_head_operation_id=? WHERE entity=? AND record_id=? AND server_version=?',
      [newOperationId, review.entity, review.recordId, review.expectedServerVersion],
    );
    const check = await one(
      db,
      'SELECT local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?',
      [review.entity, review.recordId],
    );
    if (check?.local_head_operation_id !== newOperationId) throw new Error('La base cambió durante la resolución');
    return { operationId: newOperationId, discarded };
  });
}
