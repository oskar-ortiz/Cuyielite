import { normalizeGalpon, normalizePoza, validateGalpon, validatePoza } from './galpones.validation.js';
import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';
import { applyCentralBusinessRecord, type PullRecord } from './work.sync.pull.js';
import { readConflictReview, type ConflictReview } from './work.sync.conflicts.review.js';

type Row = Record<string, unknown>;

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

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

export async function resolveConflictKeepCentral(
  db: MigrationDb,
  review: ConflictReview,
): Promise<ConflictResolutionResult> {
  return transaction(db, async () => {
    const { record } = await readConflictReview(db, review);
    const discarded = await discardReviewedChain(db, review.conflictOperationId);
    await applyCentralBusinessRecord(db, review.entity, record);
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
  const expectedKeys = review.entity === 'galpon' ? ['nombre', 'ubicacion'] : ['codigo', 'tipo', 'capacidad_maxima'];
  if (!exactKeys(input, expectedKeys)) throw new Error('Datos para reintento inválidos');
  return transaction(db, async () => {
    const { record } = await readConflictReview(db, review);
    if (record.deleted_at !== null) throw new Error('El registro central fue eliminado; conserva la versión central');
    let data: Record<string, unknown>;
    if (review.entity === 'galpon') {
      const galponInput = { nombre: input.nombre, ubicacion: input.ubicacion } as {
        nombre: string;
        ubicacion: string | null;
      };
      const validation = validateGalpon(galponInput);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      data = normalizeGalpon(galponInput);
    } else {
      const pozaInput = {
        codigo: input.codigo,
        tipo: input.tipo,
        capacidadMaxima: input.capacidad_maxima,
      } as { codigo: string; tipo: string; capacidadMaxima: number };
      const validation = validatePoza(pozaInput);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const normalized = normalizePoza(pozaInput);
      data = {
        galpon_id: record.data.galpon_id,
        codigo: normalized.codigo,
        tipo: normalized.tipo,
        capacidad_maxima: normalized.capacidadMaxima,
      };
    }
    const centralData = record.data;
    if (Object.keys(data).every((key) => data[key] === centralData[key])) {
      const discarded = await discardReviewedChain(db, review.conflictOperationId);
      await applyCentralBusinessRecord(db, review.entity, record);
      await db.run(
        'UPDATE sync_record_state SET local_head_operation_id=NULL WHERE entity=? AND record_id=? AND local_head_operation_id=?',
        [review.entity, review.recordId, review.expectedHeadOperationId],
      );
      return { operationId: null, discarded };
    }

    const discarded = await discardReviewedChain(db, review.conflictOperationId);
    await applyCentralBusinessRecord(db, review.entity, record);
    const now = new Date().toISOString();
    const newOperationId = operationId();
    if (review.entity === 'galpon') {
      await db.run('UPDATE galpones SET nombre=?,ubicacion=?,updated_at=? WHERE id=?', [
        data.nombre,
        data.ubicacion,
        now,
        review.recordId,
      ]);
    } else {
      await db.run('UPDATE pozas SET codigo=?,tipo=?,capacidad_maxima=?,updated_at=? WHERE id=?', [
        data.codigo,
        data.tipo,
        data.capacidad_maxima,
        now,
        review.recordId,
      ]);
    }
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
