import {
  DERIVED_ENTITIES,
  DERIVED_PROTOCOL,
  initializeDerivedDatabase,
  type DerivedEntity,
} from './work.derived.schema.js';
import type { MigrationDb } from './work.migration.js';

// Aplicación del feed derivado de solo lectura. Nunca escribe en las tablas de
// dominio ni habilita acciones sobre alertas: solo guarda lo que el servidor ya
// calculó, con su versión, para consulta offline.

export class DerivedPullError extends Error {}

export interface DerivedRecord {
  id: string;
  version: string;
  data: Record<string, unknown>;
}

export interface DerivedItem {
  seq: string;
  entity: DerivedEntity;
  record: DerivedRecord;
}

export interface DerivedPage {
  protocol_version: number;
  scope_id: string;
  items: DerivedItem[];
  next_cursor: string;
  has_more: boolean;
}

export type DerivedPullFn = (cursor: string | null, limit: number) => Promise<unknown>;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^[1-9][0-9]*$/;
const SEQUENCE = /^[1-9][0-9]*$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTimestamp(value: unknown): boolean {
  return typeof value === 'string' && TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function isTextOrNull(value: unknown, max: number): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.length <= max);
}

function validateCategoria(data: Record<string, unknown>): void {
  if (data.clase !== null && !['ELITE', 'NORMAL', 'DESCARTE'].includes(String(data.clase))) {
    throw new DerivedPullError('categoría derivada inválida');
  }
  if (
    !['DEFINITIVA', 'DATOS_INSUFICIENTES', 'PROVISIONAL', 'EVIDENCIA_NO_VALIDADA'].includes(
      String(data.estado_evaluacion),
    )
  ) {
    throw new DerivedPullError('estado de evaluación derivado inválido');
  }
  if (data.categoria_estado !== null && !['DEFINITIVA', 'HISTORICA'].includes(String(data.categoria_estado))) {
    throw new DerivedPullError('estado de categoría derivado inválido');
  }
  if (
    data.caracter !== null &&
    data.caracter !== undefined &&
    !['CONFIRMADO', 'PROPUESTO'].includes(String(data.caracter))
  ) {
    throw new DerivedPullError('carácter derivado inválido');
  }
  if (data.evidencia_pendiente !== undefined) {
    const pendiente = data.evidencia_pendiente;
    if (!Array.isArray(pendiente) || !pendiente.every((item: unknown) => typeof item === 'string')) {
      throw new DerivedPullError('evidencia pendiente inválida');
    }
  }
  if (!Array.isArray(data.motivos) || !data.motivos.every((item) => typeof item === 'string')) {
    throw new DerivedPullError('motivos derivados inválidos');
  }
  if (!Array.isArray(data.faltantes) || !data.faltantes.every((item) => typeof item === 'string')) {
    throw new DerivedPullError('faltantes derivados inválidos');
  }
  if (!isObject(data.procedencia)) throw new DerivedPullError('procedencia derivada inválida');
}

function validateAlerta(data: Record<string, unknown>): void {
  if (data.tipo_alerta !== 'DESCARTE_REPRODUCTORA') {
    throw new DerivedPullError('tipo de alerta desconocido');
  }
  if (!['activa', 'obsoleta', 'no_confirmada'].includes(String(data.estado))) {
    throw new DerivedPullError('estado de alerta inválido');
  }
  if (!isTextOrNull(data.motivo, 400)) throw new DerivedPullError('motivo de alerta inválido');
  if (data.causa_fecha !== null && !(typeof data.causa_fecha === 'string' && DATE_ONLY.test(data.causa_fecha))) {
    throw new DerivedPullError('fecha causal inválida');
  }
  if (data.fecha_limite !== null && !(typeof data.fecha_limite === 'string' && DATE_ONLY.test(data.fecha_limite))) {
    throw new DerivedPullError('fecha límite inválida');
  }
  if (data.causa_id !== null && !UUID_V4.test(String(data.causa_id))) {
    throw new DerivedPullError('causa identificada inválida');
  }
}

export function validateDerivedPage(value: unknown, scopeId: string, limit: number): DerivedPage {
  if (!isObject(value)) throw new DerivedPullError('respuesta derivada inválida');
  const page = value;
  if (page.protocol_version !== DERIVED_PROTOCOL || page.scope_id !== scopeId) {
    throw new DerivedPullError('respuesta derivada de otro protocolo o ámbito');
  }
  if (!Array.isArray(page.items) || page.items.length > limit) {
    throw new DerivedPullError('página derivada inválida');
  }
  if (typeof page.next_cursor !== 'string' || !page.next_cursor || page.next_cursor.length > 4096) {
    throw new DerivedPullError('cursor derivado inválido');
  }
  if (typeof page.has_more !== 'boolean') throw new DerivedPullError('página derivada inválida');

  let previous = 0n;
  for (const item of page.items) {
    if (!isObject(item) || typeof item.seq !== 'string' || !SEQUENCE.test(item.seq)) {
      throw new DerivedPullError('elemento derivado inválido');
    }
    if (!DERIVED_ENTITIES.includes(item.entity as DerivedEntity)) {
      throw new DerivedPullError('entidad derivada desconocida');
    }
    const record = item.record;
    if (!isObject(record) || typeof record.id !== 'string' || !UUID_V4.test(record.id)) {
      throw new DerivedPullError('registro derivado inválido');
    }
    if (typeof record.version !== 'string' || !VERSION.test(record.version)) {
      throw new DerivedPullError('versión derivada inválida');
    }
    if (!isTimestamp(record.created_at) || !isTimestamp(record.updated_at)) {
      throw new DerivedPullError('timestamps derivados inválidos');
    }
    if (!isObject(record.data)) throw new DerivedPullError('datos derivados inválidos');
    if (item.entity === 'categoria') {
      if (record.id !== record.data.cuy_id) throw new DerivedPullError('categoría sin animal coherente');
      validateCategoria(record.data);
    } else {
      validateAlerta(record.data);
    }
    const sequence = BigInt(item.seq);
    if (sequence <= previous) throw new DerivedPullError('secuencia derivada fuera de orden');
    previous = sequence;
  }
  return page as unknown as DerivedPage;
}

export async function readDerivedCursor(db: MigrationDb): Promise<string | null> {
  const row =
    ((await db.query('SELECT cursor FROM sync_derived_cursor WHERE protocol=?', [DERIVED_PROTOCOL])).values?.[0] as
      { cursor?: string } | undefined) ?? null;
  return row?.cursor ?? null;
}

export async function writeDerivedCursor(db: MigrationDb, cursor: string): Promise<void> {
  await db.run(
    'INSERT INTO sync_derived_cursor(protocol, cursor) VALUES(?, ?) ' +
      'ON CONFLICT(protocol) DO UPDATE SET cursor=excluded.cursor',
    [DERIVED_PROTOCOL, cursor],
  );
}

async function applyItem(db: MigrationDb, item: DerivedItem, now: string): Promise<void> {
  const { record } = item;
  if (item.entity === 'categoria') {
    const data = record.data;
    await db.run(
      `INSERT INTO categorias_animal
         (cuy_id, version, clase, estado_evaluacion, categoria_estado, caracter, motivos, faltantes,
          evidencia_pendiente, reglas_version, evaluada_at, procedencia, server_snapshot, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(cuy_id) DO UPDATE SET
         version=excluded.version,
         clase=excluded.clase,
         estado_evaluacion=excluded.estado_evaluacion,
         categoria_estado=excluded.categoria_estado,
         caracter=excluded.caracter,
         motivos=excluded.motivos,
         faltantes=excluded.faltantes,
         evidencia_pendiente=excluded.evidencia_pendiente,
         reglas_version=excluded.reglas_version,
         evaluada_at=excluded.evaluada_at,
         procedencia=excluded.procedencia,
         server_snapshot=excluded.server_snapshot,
         updated_at=excluded.updated_at
       WHERE CAST(excluded.version AS INTEGER) > CAST(categorias_animal.version AS INTEGER)`,
      [
        record.id,
        record.version,
        data.clase ?? null,
        String(data.estado_evaluacion),
        data.categoria_estado ?? null,
        data.caracter ?? null,
        JSON.stringify(data.motivos ?? []),
        JSON.stringify(data.faltantes ?? []),
        JSON.stringify(data.evidencia_pendiente ?? []),
        data.reglas_version ?? null,
        data.evaluada_at ?? null,
        JSON.stringify(data.procedencia ?? {}),
        JSON.stringify(record),
        now,
      ],
    );
    return;
  }

  const data = record.data;
  await db.run(
    `INSERT INTO alertas_derivadas
       (id, cuy_id, version, tipo_alerta, regla_id, motivo, estado, causa_tipo, causa_id,
        causa_fecha, fecha_limite, reglas_version, server_snapshot, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       version=excluded.version,
       motivo=excluded.motivo,
       estado=excluded.estado,
       causa_tipo=excluded.causa_tipo,
       causa_id=excluded.causa_id,
       causa_fecha=excluded.causa_fecha,
       fecha_limite=excluded.fecha_limite,
       reglas_version=excluded.reglas_version,
       server_snapshot=excluded.server_snapshot,
       updated_at=excluded.updated_at
     WHERE CAST(excluded.version AS INTEGER) > CAST(alertas_derivadas.version AS INTEGER)`,
    [
      record.id,
      String(data.cuy_id),
      record.version,
      String(data.tipo_alerta),
      data.regla_id ?? null,
      data.motivo ?? null,
      String(data.estado),
      data.causa_tipo ?? null,
      data.causa_id ?? null,
      data.causa_fecha ?? null,
      data.fecha_limite ?? null,
      data.reglas_version ?? null,
      JSON.stringify(record),
      now,
    ],
  );
}

export async function pullDerivedUntilCheckpoint(
  db: MigrationDb,
  scopeId: string,
  receive: DerivedPullFn,
  limit = 50,
): Promise<{ pages: number; applied: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('limit derivado fuera de rango');
  await initializeDerivedDatabase(db);
  let cursor = await readDerivedCursor(db);
  const seen = new Set<string>();
  let pages = 0;
  let applied = 0;
  while (true) {
    const page = validateDerivedPage(await receive(cursor, limit), scopeId, limit);
    if (seen.has(page.next_cursor) || (page.has_more && page.next_cursor === cursor)) {
      throw new DerivedPullError('cursor derivado repetido sin avance');
    }
    seen.add(page.next_cursor);
    const now = new Date().toISOString();
    for (const item of page.items) {
      await applyItem(db, item, now);
      applied++;
    }
    await writeDerivedCursor(db, page.next_cursor);
    cursor = page.next_cursor;
    pages++;
    if (!page.has_more) break;
  }
  return { pages, applied };
}

export interface CategoriaDerivada {
  cuyId: string;
  version: string;
  clase: string | null;
  estadoEvaluacion: string;
  categoriaEstado: string | null;
  caracter: string | null;
  motivos: string[];
  faltantes: string[];
  evidenciaPendiente: string[];
  reglasVersion: string | null;
  evaluadaAt: string | null;
  procedencia: Record<string, unknown>;
}

export interface AlertaDerivada {
  id: string;
  cuyId: string;
  version: string;
  estado: string;
  reglaId: string | null;
  motivo: string | null;
  causaTipo: string | null;
  causaId: string | null;
  causaFecha: string | null;
  fechaLimite: string | null;
}

export async function readCategoriaDerivada(db: MigrationDb, cuyId: string): Promise<CategoriaDerivada | null> {
  await initializeDerivedDatabase(db);
  const row =
    ((await db.query('SELECT * FROM categorias_animal WHERE cuy_id=?', [cuyId])).values?.[0] as
      Record<string, unknown> | undefined) ?? null;
  if (!row) return null;
  return {
    cuyId: String(row.cuy_id),
    version: String(row.version),
    clase: (row.clase as string | null) ?? null,
    estadoEvaluacion: String(row.estado_evaluacion),
    categoriaEstado: (row.categoria_estado as string | null) ?? null,
    caracter: (row.caracter as string | null) ?? null,
    motivos: JSON.parse(String(row.motivos ?? '[]')) as string[],
    faltantes: JSON.parse(String(row.faltantes ?? '[]')) as string[],
    evidenciaPendiente: JSON.parse(String(row.evidencia_pendiente ?? '[]')) as string[],
    reglasVersion: (row.reglas_version as string | null) ?? null,
    evaluadaAt: (row.evaluada_at as string | null) ?? null,
    procedencia: JSON.parse(String(row.procedencia ?? '{}')) as Record<string, unknown>,
  };
}

export async function readAlertasDerivadas(db: MigrationDb, cuyId: string): Promise<AlertaDerivada[]> {
  await initializeDerivedDatabase(db);
  const rows =
    (await db.query('SELECT * FROM alertas_derivadas WHERE cuy_id=? ORDER BY causa_fecha, updated_at', [cuyId]))
      .values ?? [];
  return rows.map((value) => {
    const row = value as Record<string, unknown>;
    return {
      id: String(row.id),
      cuyId: String(row.cuy_id),
      version: String(row.version),
      estado: String(row.estado),
      reglaId: (row.regla_id as string | null) ?? null,
      motivo: (row.motivo as string | null) ?? null,
      causaTipo: (row.causa_tipo as string | null) ?? null,
      causaId: (row.causa_id as string | null) ?? null,
      causaFecha: (row.causa_fecha as string | null) ?? null,
      fechaLimite: (row.fecha_limite as string | null) ?? null,
    };
  });
}
