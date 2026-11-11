/* Strict pull-v1 contract validation. */
import { WORK_ENTITY_NAMES } from './work.sync.schema.js';

export type Entity = (typeof WORK_ENTITY_NAMES)[number];

export interface PullRecord {
  id: string;
  version: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_client_edited_at: string | null;
  data: Record<string, unknown>;
}

export interface SyncPullItem {
  seq: string;
  entity: Entity;
  record: PullRecord;
}

export interface SyncPullPage {
  protocol_version: number;
  scope_id: string;
  items: SyncPullItem[];
  next_cursor: string;
  has_more: boolean;
}

export class SyncPullError extends Error {}

// Orden de dependencia para aplicar una página. El orden del servidor suele
// respetarlo, pero el cliente no depende solo de eso.
export const ENTITY_PULL_ORDER: Record<Entity, number> = {
  galpon: 0,
  poza: 1,
  cuyes: 2,
  partos: 3,
  eventos: 4,
  parto_crias: 5,
  pesajes: 6,
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^[1-9][0-9]*$/;
const SEQUENCE = /^[1-9][0-9]*$/;
// El publicador central serializa timestamps con zona (`Z` o `+00:00`) y puede
// incluir microsegundos. Ambos formatos son válidos en el contrato.
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL = /^\d+(?:\.\d+)?$/;

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

function isDateOnly(value: unknown): value is string {
  return typeof value === 'string' && DATE_ONLY.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}

function isUuidOrNull(value: unknown): boolean {
  return value === null || isUuid(value);
}

function isTextOrNull(value: unknown, max: number): boolean {
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= max);
}

function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL.test(value) && Number.isFinite(Number(value));
}

function isDecimalOrNull(value: unknown): boolean {
  return value === null || isDecimal(value);
}

function isIntOrNull(value: unknown, min: number, max: number): boolean {
  return value === null || (Number.isInteger(value) && Number(value) >= min && Number(value) <= max);
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).sort().join(',') === [...expected].sort().join(',');
}

const DATA_KEYS: Record<Entity, string[]> = {
  galpon: ['nombre', 'ubicacion'],
  poza: ['galpon_id', 'codigo', 'tipo', 'capacidad_maxima'],
  cuyes: [
    'poza_id',
    'galpon_origen_id',
    'codigo_identificacion',
    'sexo',
    'fecha_nacimiento',
    'color_codigo',
    'ojos_codigo',
    'pelaje_original',
    'padre_id',
    'madre_id',
    'categoria_ml',
    'ultimo_peso_g',
    'estado',
  ],
  partos: ['madre_id', 'fecha_parto', 'numero_parto', 'nacidos_vivos', 'nacidos_muertos', 'tamano_camada_nacida'],
  pesajes: ['cuy_id', 'fecha_pesaje', 'peso_gramos', 'etapa', 'parto_id', 'evento_id'],
  eventos: ['cuy_id', 'tipo', 'fecha', 'macho_id', 'poza_origen_id', 'poza_destino_id', 'detalle'],
  parto_crias: ['parto_id', 'cuy_id', 'rol'],
};

const DATA_VALIDATORS: Record<Entity, (data: Record<string, unknown>) => boolean> = {
  galpon: (data) =>
    typeof data.nombre === 'string' &&
    data.nombre.length > 0 &&
    data.nombre.length <= 120 &&
    (data.ubicacion === null || (typeof data.ubicacion === 'string' && data.ubicacion.length <= 255)),
  poza: (data) =>
    isUuid(data.galpon_id) &&
    typeof data.codigo === 'string' &&
    data.codigo.length > 0 &&
    data.codigo.length <= 50 &&
    typeof data.tipo === 'string' &&
    data.tipo.length > 0 &&
    data.tipo.length <= 50 &&
    Number.isInteger(data.capacidad_maxima) &&
    Number(data.capacidad_maxima) >= 0 &&
    Number(data.capacidad_maxima) <= 2147483647,
  cuyes: (data) =>
    isUuidOrNull(data.poza_id) &&
    isUuidOrNull(data.galpon_origen_id) &&
    typeof data.codigo_identificacion === 'string' &&
    data.codigo_identificacion.length > 0 &&
    data.codigo_identificacion.length <= 50 &&
    (data.sexo === null || data.sexo === 'M' || data.sexo === 'H') &&
    (data.fecha_nacimiento === null || isDateOnly(data.fecha_nacimiento)) &&
    isTextOrNull(data.color_codigo, 20) &&
    isTextOrNull(data.ojos_codigo, 20) &&
    isTextOrNull(data.pelaje_original, 20) &&
    isUuidOrNull(data.padre_id) &&
    isUuidOrNull(data.madre_id) &&
    (data.categoria_ml === null ||
      data.categoria_ml === 'ELITE' ||
      data.categoria_ml === 'NORMAL' ||
      data.categoria_ml === 'DESCARTE') &&
    isDecimalOrNull(data.ultimo_peso_g) &&
    isTextOrNull(data.estado, 20),
  partos: (data) =>
    isUuid(data.madre_id) &&
    (data.fecha_parto === null || isDateOnly(data.fecha_parto)) &&
    isIntOrNull(data.numero_parto, 0, 2147483647) &&
    isIntOrNull(data.nacidos_vivos, 0, 2147483647) &&
    isIntOrNull(data.nacidos_muertos, 0, 2147483647) &&
    isIntOrNull(data.tamano_camada_nacida, 0, 2147483647),
  pesajes: (data) =>
    isUuid(data.cuy_id) &&
    (data.fecha_pesaje === null || isDateOnly(data.fecha_pesaje)) &&
    isDecimal(data.peso_gramos) &&
    isTextOrNull(data.etapa, 20) &&
    isUuidOrNull(data.parto_id) &&
    isUuidOrNull(data.evento_id),
  eventos: (data) =>
    isUuid(data.cuy_id) &&
    typeof data.tipo === 'string' &&
    data.tipo.length > 0 &&
    data.tipo.length <= 30 &&
    (data.fecha === null || isDateOnly(data.fecha)) &&
    isUuidOrNull(data.macho_id) &&
    isUuidOrNull(data.poza_origen_id) &&
    isUuidOrNull(data.poza_destino_id) &&
    isTextOrNull(data.detalle, 255),
  parto_crias: (data) =>
    isUuid(data.parto_id) &&
    isUuid(data.cuy_id) &&
    typeof data.rol === 'string' &&
    data.rol.length > 0 &&
    data.rol.length <= 30,
};

function validateRecord(entity: Entity, value: unknown): value is PullRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (
    !exactKeys(record, ['id', 'version', 'created_at', 'updated_at', 'deleted_at', 'last_client_edited_at', 'data']) ||
    typeof record.id !== 'string' ||
    !UUID_V4.test(record.id) ||
    typeof record.version !== 'string' ||
    !VERSION.test(record.version) ||
    !isTimestamp(record.created_at) ||
    !isTimestamp(record.updated_at) ||
    (record.deleted_at !== null && !isTimestamp(record.deleted_at)) ||
    (record.last_client_edited_at !== null && !isTimestamp(record.last_client_edited_at)) ||
    !record.data ||
    typeof record.data !== 'object' ||
    Array.isArray(record.data)
  ) {
    return false;
  }
  const data = record.data as Record<string, unknown>;
  return exactKeys(data, DATA_KEYS[entity]) && DATA_VALIDATORS[entity](data);
}

export function validatePullPage(value: unknown, expectedScopeId: string, limit: number): SyncPullPage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyncPullError('respuesta pull inválida');
  const page = value as Record<string, unknown>;
  if (
    !exactKeys(page, ['protocol_version', 'scope_id', 'items', 'next_cursor', 'has_more']) ||
    page.protocol_version !== 1 ||
    page.scope_id !== expectedScopeId ||
    !Array.isArray(page.items) ||
    page.items.length > limit ||
    typeof page.next_cursor !== 'string' ||
    page.next_cursor.length === 0 ||
    page.next_cursor.length > 4096 ||
    typeof page.has_more !== 'boolean' ||
    (page.has_more && page.items.length !== limit)
  ) {
    throw new SyncPullError('respuesta pull incompatible con protocolo/ámbito');
  }
  let previous = 0n;
  for (const itemValue of page.items) {
    if (!itemValue || typeof itemValue !== 'object' || Array.isArray(itemValue)) {
      throw new SyncPullError('elemento pull inválido');
    }
    const item = itemValue as Record<string, unknown>;
    if (
      !exactKeys(item, ['seq', 'entity', 'record']) ||
      typeof item.seq !== 'string' ||
      !SEQUENCE.test(item.seq) ||
      !WORK_ENTITY_NAMES.includes(item.entity as Entity) ||
      !validateRecord(item.entity as Entity, item.record) ||
      (item.record as PullRecord).id.length === 0
    ) {
      throw new SyncPullError('elemento pull inválido');
    }
    const sequence = BigInt(item.seq);
    if (sequence <= previous) throw new SyncPullError('secuencia pull fuera de orden');
    previous = sequence;
  }
  if (page.has_more && page.items.length === 0) throw new SyncPullError('pull sin avance de cursor');
  return page as unknown as SyncPullPage;
}
