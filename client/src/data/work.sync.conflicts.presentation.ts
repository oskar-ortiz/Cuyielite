import type { MigrationDb } from './work.migration.js';
import {
  businessFields,
  conflictConfig,
  formatDate,
  referenceLabel,
  shortId,
  type ConflictEntity,
  type ReferenceCatalog,
} from './work.sync.conflicts.config.js';
import type { PullRecord } from './work.sync.pull.validation.js';

type Row = Record<string, unknown>;

async function all(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row[]> {
  return ((await db.query(sql, params)).values ?? []) as Row[];
}

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

function label(value: unknown, id: string, deleted: unknown): string {
  const base = `${String(value)} · ${shortId(id)}`;
  return deleted ? `${base} · eliminado` : base;
}

export async function loadReferenceCatalog(db: MigrationDb): Promise<ReferenceCatalog> {
  const galpones = await all(db, 'SELECT id,nombre,deleted_at FROM galpones ORDER BY nombre,id');
  const pozas = await all(
    db,
    'SELECT p.id,p.codigo,p.deleted_at,g.nombre AS galpon_nombre FROM pozas p LEFT JOIN galpones g ON g.id=p.galpon_id ORDER BY p.codigo,p.id',
  );
  const cuyes = await all(
    db,
    'SELECT id,codigo_identificacion,deleted_at FROM cuyes ORDER BY codigo_identificacion,id',
  );
  const cuyLabels = new Map(
    cuyes.map((row) => [String(row.id), label(row.codigo_identificacion, String(row.id), row.deleted_at)]),
  );
  const partos = await all(
    db,
    'SELECT p.id,p.fecha_parto,p.madre_id,p.deleted_at,c.codigo_identificacion FROM partos p LEFT JOIN cuyes c ON c.id=p.madre_id ORDER BY p.fecha_parto,p.id',
  );
  const eventos = await all(
    db,
    'SELECT e.id,e.tipo,e.fecha,e.cuy_id,e.deleted_at,c.codigo_identificacion FROM eventos e LEFT JOIN cuyes c ON c.id=e.cuy_id ORDER BY e.fecha,e.id',
  );

  return {
    galpones: galpones.map((row) => ({
      id: String(row.id),
      label: label(row.nombre, String(row.id), row.deleted_at),
    })),
    pozas: pozas.map((row) => ({
      id: String(row.id),
      label: `${label(row.codigo, String(row.id), row.deleted_at)}${row.galpon_nombre ? ` · ${row.galpon_nombre}` : ''}`,
    })),
    cuyes: cuyes.map((row) => ({
      id: String(row.id),
      label: cuyLabels.get(String(row.id)) ?? shortId(String(row.id)),
    })),
    partos: partos.map((row) => ({
      id: String(row.id),
      label: `Parto ${row.fecha_parto ? formatDate(row.fecha_parto) : 'sin fecha'} · ${
        cuyLabels.get(String(row.madre_id)) ?? 'madre sin etiqueta'
      } · ${shortId(String(row.id))}${row.deleted_at ? ' · eliminado' : ''}`,
    })),
    eventos: eventos.map((row) => ({
      id: String(row.id),
      label: `Evento ${row.tipo}${row.fecha ? ` · ${formatDate(row.fecha)}` : ''} · ${shortId(String(row.id))}${
        row.deleted_at ? ' · eliminado' : ''
      }`,
    })),
  };
}

export async function readLocalConflictRow(
  db: MigrationDb,
  entity: ConflictEntity,
  recordId: string,
): Promise<Record<string, unknown>> {
  const config = conflictConfig(entity);
  const fields = businessFields(entity);
  const row = await one(db, `SELECT ${fields.join(',')} FROM ${config.table} WHERE id=?`, [recordId]);
  if (!row) throw new Error('El registro local del conflicto no existe');
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
}

export function conflictSummary(
  entity: ConflictEntity,
  local: Record<string, unknown>,
  references: ReferenceCatalog,
): string {
  if (entity === 'galpon') return `Galpón ${String(local.nombre ?? 'sin nombre')} · ${shortId(String(local.id ?? ''))}`;
  if (entity === 'poza') return `Poza ${String(local.codigo ?? 'sin código')} · ${shortId(String(local.id ?? ''))}`;
  if (entity === 'cuyes') {
    return `Animal ${String(local.codigo_identificacion ?? 'sin chapa')} · ${shortId(String(local.id ?? ''))}`;
  }
  if (entity === 'partos') {
    return `Parto ${local.fecha_parto ? formatDate(local.fecha_parto) : 'sin fecha'} · ${
      referenceLabel(references, 'cuyes', local.madre_id) ?? 'madre sin etiqueta'
    }`;
  }
  if (entity === 'pesajes') {
    return `Pesaje ${String(local.peso_gramos ?? 'sin peso')} g${
      local.fecha_pesaje ? ` · ${formatDate(local.fecha_pesaje)}` : ''
    }`;
  }
  if (entity === 'eventos') {
    return `Evento ${String(local.tipo ?? 'sin tipo')}${local.fecha ? ` · ${formatDate(local.fecha)}` : ''}`;
  }
  return `Vínculo ${String(local.rol ?? 'sin rol')} · ${
    referenceLabel(references, 'partos', local.parto_id) ?? 'parto sin etiqueta'
  } · ${referenceLabel(references, 'cuyes', local.cuy_id) ?? 'cría sin etiqueta'}`;
}

export async function buildConflictView(
  db: MigrationDb,
  entity: ConflictEntity,
  recordId: string,
  central: PullRecord,
  references?: ReferenceCatalog,
): Promise<{
  local: Record<string, unknown>;
  summary: string;
  references: ReferenceCatalog;
}> {
  const catalog = references ?? (await loadReferenceCatalog(db));
  const local = { ...(await readLocalConflictRow(db, entity, recordId)), id: recordId };
  return { local, summary: conflictSummary(entity, local, catalog), references: catalog };
}
