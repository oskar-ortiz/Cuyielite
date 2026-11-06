/* Strict pull-v1 contract validation. */
export type Entity = 'galpon' | 'poza';

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

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^[1-9][0-9]*$/;
const SEQUENCE = /^[1-9][0-9]*$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
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
  if (entity === 'galpon') {
    return (
      exactKeys(data, ['nombre', 'ubicacion']) &&
      typeof data.nombre === 'string' &&
      data.nombre.length > 0 &&
      data.nombre.length <= 120 &&
      (data.ubicacion === null || (typeof data.ubicacion === 'string' && data.ubicacion.length <= 255))
    );
  }
  return (
    exactKeys(data, ['galpon_id', 'codigo', 'tipo', 'capacidad_maxima']) &&
    typeof data.galpon_id === 'string' &&
    UUID_V4.test(data.galpon_id) &&
    typeof data.codigo === 'string' &&
    data.codigo.length > 0 &&
    data.codigo.length <= 50 &&
    typeof data.tipo === 'string' &&
    data.tipo.length > 0 &&
    data.tipo.length <= 50 &&
    Number.isInteger(data.capacidad_maxima) &&
    Number(data.capacidad_maxima) >= 0 &&
    Number(data.capacidad_maxima) <= 2147483647
  );
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
      (item.entity !== 'galpon' && item.entity !== 'poza') ||
      !validateRecord(item.entity, item.record) ||
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
