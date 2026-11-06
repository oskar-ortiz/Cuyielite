import {
  normalizeGalpon,
  normalizePoza,
  validateGalpon,
  validatePoza,
  type GalponInput,
  type PozaInput,
} from './galpones.validation.js';
import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

type Entity = 'galpon' | 'poza';
type Action = 'create' | 'update';
type Row = Record<string, unknown>;

export interface LocalWriteResult {
  id: string;
  operationId: string | null;
  changed: boolean;
}

function uuidV4(): string {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) throw new Error('UUID v4 no disponible');
  return crypto.randomUUID();
}

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

async function transaction<T>(db: MigrationDb, work: () => Promise<T>): Promise<T> {
  await initializeWorkSyncDatabase(db);
  await db.exec('BEGIN IMMEDIATE');
  try {
    // La identidad se relee bajo el bloqueo de escritura, antes de modificar filas.
    await initializeWorkSyncDatabase(db);
    const result = await work();
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

async function predecessor(
  db: MigrationDb,
  entity: Entity,
  id: string,
): Promise<{ id: string | null; base: string | null }> {
  const state = await one(
    db,
    'SELECT server_version, local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?',
    [entity, id],
  );
  if (!state) throw new Error('Registro sin estado de sincronización; requiere vinculación central');
  const head = state.local_head_operation_id as string | null;
  if (head) {
    const prior = await one(db, 'SELECT state FROM sync_outbox WHERE operation_id=? AND entity=? AND record_id=?', [
      head,
      entity,
      id,
    ]);
    if (!prior) throw new Error('Cadena de operaciones locales incoherente');
    if (prior.state === 'queued' || prior.state === 'prepared') return { id: head, base: null };
    if (prior.state !== 'accepted') throw new Error('Operación previa requiere resolución explícita');
  }
  const base = state.server_version as string | null;
  if (!base || !/^[1-9][0-9]*$/.test(base)) throw new Error('Versión central desconocida para actualizar');
  return { id: null, base };
}

async function queue(
  db: MigrationDb,
  entity: Entity,
  recordId: string,
  action: Action,
  snapshot: object,
  previous: { id: string | null; base: string | null },
  parentCreateId: string | null,
  now: string,
): Promise<string> {
  const operationId = uuidV4();
  await db.run(
    `INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,base_anchor,predecessor_id,parent_create_id,state,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      operationId,
      entity,
      recordId,
      action,
      JSON.stringify(snapshot),
      previous.base,
      previous.id,
      parentCreateId,
      'queued',
      now,
    ],
  );
  await db.run(
    `INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id)
     VALUES(?,?,NULL,NULL,?) ON CONFLICT(entity,record_id) DO UPDATE SET local_head_operation_id=excluded.local_head_operation_id`,
    [entity, recordId, operationId],
  );
  return operationId;
}

async function pendingParentCreate(db: MigrationDb, galponId: string): Promise<string | null> {
  const row = await one(
    db,
    "SELECT operation_id,state FROM sync_outbox WHERE entity='galpon' AND record_id=? AND action='create' ORDER BY local_seq LIMIT 1",
    [galponId],
  );
  if (!row || row.state === 'accepted') return null;
  if (row.state === 'queued' || row.state === 'prepared') return String(row.operation_id);
  throw new Error('Alta del galpón padre requiere resolución explícita');
}

export async function createWorkGalpon(db: MigrationDb, input: GalponInput): Promise<LocalWriteResult> {
  const validation = validateGalpon(input);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const data = normalizeGalpon(input);
  return transaction(db, async () => {
    const id = uuidV4();
    const now = new Date().toISOString();
    await db.run('INSERT INTO galpones(id,nombre,ubicacion,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,NULL)', [
      id,
      data.nombre,
      data.ubicacion,
      now,
      now,
    ]);
    const operationId = await queue(db, 'galpon', id, 'create', data, { id: null, base: null }, null, now);
    return { id, operationId, changed: true };
  });
}

export async function updateWorkGalpon(db: MigrationDb, id: string, input: GalponInput): Promise<LocalWriteResult> {
  const validation = validateGalpon(input);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const data = normalizeGalpon(input);
  return transaction(db, async () => {
    const current = await one(db, 'SELECT nombre,ubicacion FROM galpones WHERE id=? AND deleted_at IS NULL', [id]);
    if (!current) throw new Error('Galpón no encontrado');
    if (current.nombre === data.nombre && current.ubicacion === data.ubicacion)
      return { id, operationId: null, changed: false };
    const previous = await predecessor(db, 'galpon', id);
    const now = new Date().toISOString();
    await db.run('UPDATE galpones SET nombre=?,ubicacion=?,updated_at=? WHERE id=?', [
      data.nombre,
      data.ubicacion,
      now,
      id,
    ]);
    const operationId = await queue(db, 'galpon', id, 'update', data, previous, null, now);
    return { id, operationId, changed: true };
  });
}

export async function createWorkPoza(db: MigrationDb, galponId: string, input: PozaInput): Promise<LocalWriteResult> {
  const validation = validatePoza(input);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const data = normalizePoza(input);
  return transaction(db, async () => {
    const galpon = await one(db, 'SELECT id FROM galpones WHERE id=? AND deleted_at IS NULL', [galponId]);
    if (!galpon) throw new Error('Galpón padre no encontrado');
    const parentCreateId = await pendingParentCreate(db, galponId);
    const id = uuidV4();
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO pozas(id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,NULL)',
      [id, galponId, data.codigo, data.tipo, data.capacidadMaxima, now, now],
    );
    const operationId = await queue(
      db,
      'poza',
      id,
      'create',
      { galpon_id: galponId, codigo: data.codigo, tipo: data.tipo, capacidad_maxima: data.capacidadMaxima },
      { id: null, base: null },
      parentCreateId,
      now,
    );
    return { id, operationId, changed: true };
  });
}

export async function updateWorkPoza(
  db: MigrationDb,
  galponId: string,
  id: string,
  input: PozaInput,
): Promise<LocalWriteResult> {
  const validation = validatePoza(input);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const data = normalizePoza(input);
  return transaction(db, async () => {
    const current = await one(
      db,
      'SELECT codigo,tipo,capacidad_maxima FROM pozas WHERE id=? AND galpon_id=? AND deleted_at IS NULL',
      [id, galponId],
    );
    if (!current) throw new Error('Poza no encontrada en el galpón');
    if (
      current.codigo === data.codigo &&
      current.tipo === data.tipo &&
      current.capacidad_maxima === data.capacidadMaxima
    ) {
      return { id, operationId: null, changed: false };
    }
    const previous = await predecessor(db, 'poza', id);
    const now = new Date().toISOString();
    await db.run('UPDATE pozas SET codigo=?,tipo=?,capacidad_maxima=?,updated_at=? WHERE id=? AND galpon_id=?', [
      data.codigo,
      data.tipo,
      data.capacidadMaxima,
      now,
      id,
      galponId,
    ]);
    const operationId = await queue(
      db,
      'poza',
      id,
      'update',
      { galpon_id: galponId, codigo: data.codigo, tipo: data.tipo, capacidad_maxima: data.capacidadMaxima },
      previous,
      null,
      now,
    );
    return { id, operationId, changed: true };
  });
}
