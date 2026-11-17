import {
  normalizeGalpon,
  normalizePoza,
  validateGalpon,
  validatePoza,
  type GalponInput,
  type PozaInput,
} from './galpones.validation.js';
import {
  validateCuyo,
  validateEvento,
  validateParto,
  validatePesaje,
  type CuyoInput,
  type EventoInput,
  type PartoInput,
  type PesajeInput,
} from './work.domain.validation.js';
import type { PullRecord } from './work.sync.pull.validation.js';

export type ConflictEntity = 'galpon' | 'poza' | 'cuyes' | 'partos' | 'pesajes' | 'eventos' | 'parto_crias';
export type ReferenceEntity = 'galpones' | 'pozas' | 'cuyes' | 'partos' | 'eventos';
export type ConflictFieldKind =
  'text' | 'textarea' | 'date' | 'decimal' | 'integer' | 'select' | 'reference' | 'derived';

export interface ConflictField {
  key: string;
  label: string;
  kind: ConflictFieldKind;
  reference?: ReferenceEntity;
  maxLength?: number;
  min?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  editable?: boolean;
}

export interface ConflictEntityConfig {
  entity: ConflictEntity;
  table: string;
  singular: string;
  protocol: 1 | 2;
  fields: ConflictField[];
}

export type ReferenceCatalog = Record<ReferenceEntity, { id: string; label: string }[]>;

const TEXT = (key: string, label: string, maxLength: number): ConflictField => ({
  key,
  label,
  kind: 'text',
  maxLength,
});
const DATE = (key: string, label: string): ConflictField => ({ key, label, kind: 'date' });
const REFERENCE = (key: string, label: string, reference: ReferenceEntity, editable = true): ConflictField => ({
  key,
  label,
  kind: 'reference',
  reference,
  editable,
});
const INTEGER = (key: string, label: string, min: number): ConflictField => ({
  key,
  label,
  kind: 'integer',
  min,
});
const DERIVED = (key: string, label: string): ConflictField => ({ key, label, kind: 'derived', editable: false });

const CONFIG: Record<ConflictEntity, ConflictEntityConfig> = {
  galpon: {
    entity: 'galpon',
    table: 'galpones',
    singular: 'Galpón',
    protocol: 1,
    fields: [TEXT('nombre', 'Nombre', 120), TEXT('ubicacion', 'Ubicación', 255)],
  },
  poza: {
    entity: 'poza',
    table: 'pozas',
    singular: 'Poza',
    protocol: 1,
    fields: [
      REFERENCE('galpon_id', 'Galpón', 'galpones', false),
      TEXT('codigo', 'Código', 50),
      TEXT('tipo', 'Tipo', 50),
      INTEGER('capacidad_maxima', 'Capacidad máxima', 0),
    ],
  },
  cuyes: {
    entity: 'cuyes',
    table: 'cuyes',
    singular: 'Animal',
    protocol: 2,
    fields: [
      REFERENCE('poza_id', 'Poza actual', 'pozas'),
      REFERENCE('galpon_origen_id', 'Galpón de origen', 'galpones'),
      TEXT('codigo_identificacion', 'Chapa', 50),
      {
        key: 'sexo',
        label: 'Sexo',
        kind: 'select',
        options: [
          { value: 'M', label: 'Macho' },
          { value: 'H', label: 'Hembra' },
        ],
      },
      DATE('fecha_nacimiento', 'Fecha de nacimiento'),
      TEXT('color_codigo', 'Color', 20),
      TEXT('ojos_codigo', 'Ojos', 20),
      TEXT('pelaje_original', 'Pelaje', 20),
      REFERENCE('padre_id', 'Padre', 'cuyes'),
      REFERENCE('madre_id', 'Madre', 'cuyes'),
      TEXT('estado', 'Estado', 20),
      DERIVED('categoria_ml', 'Categoría (derivada del servidor)'),
      DERIVED('ultimo_peso_g', 'Último peso (derivado del servidor)'),
    ],
  },
  partos: {
    entity: 'partos',
    table: 'partos',
    singular: 'Parto',
    protocol: 2,
    fields: [
      REFERENCE('madre_id', 'Madre', 'cuyes'),
      DATE('fecha_parto', 'Fecha de parto'),
      INTEGER('numero_parto', 'Número de parto', 1),
      INTEGER('nacidos_vivos', 'Nacidos vivos', 0),
      INTEGER('nacidos_muertos', 'Nacidos muertos', 0),
      INTEGER('tamano_camada_nacida', 'Tamaño de camada', 0),
    ],
  },
  pesajes: {
    entity: 'pesajes',
    table: 'pesajes',
    singular: 'Pesaje',
    protocol: 2,
    fields: [
      REFERENCE('cuy_id', 'Animal', 'cuyes'),
      DATE('fecha_pesaje', 'Fecha de pesaje'),
      { key: 'peso_gramos', label: 'Peso', kind: 'decimal', unit: 'g' },
      TEXT('etapa', 'Etapa', 20),
      REFERENCE('parto_id', 'Parto', 'partos'),
      REFERENCE('evento_id', 'Evento', 'eventos'),
    ],
  },
  eventos: {
    entity: 'eventos',
    table: 'eventos',
    singular: 'Evento',
    protocol: 2,
    fields: [
      REFERENCE('cuy_id', 'Animal', 'cuyes'),
      TEXT('tipo', 'Tipo', 30),
      DATE('fecha', 'Fecha'),
      REFERENCE('macho_id', 'Macho', 'cuyes'),
      REFERENCE('poza_origen_id', 'Poza de origen', 'pozas'),
      REFERENCE('poza_destino_id', 'Poza de destino', 'pozas'),
      { key: 'detalle', label: 'Detalle', kind: 'textarea', maxLength: 255 },
    ],
  },
  parto_crias: {
    entity: 'parto_crias',
    table: 'parto_crias',
    singular: 'Vínculo cría–parto',
    protocol: 2,
    fields: [
      REFERENCE('parto_id', 'Parto', 'partos', false),
      REFERENCE('cuy_id', 'Cría', 'cuyes', false),
      TEXT('rol', 'Rol', 30),
    ],
  },
};

export const CONFLICT_ENTITIES = Object.keys(CONFIG) as ConflictEntity[];

export function isConflictEntity(value: unknown): value is ConflictEntity {
  return typeof value === 'string' && value in CONFIG;
}

export function conflictConfig(entity: ConflictEntity): ConflictEntityConfig {
  return CONFIG[entity];
}

export function conflictFields(entity: ConflictEntity): ConflictField[] {
  return CONFIG[entity].fields;
}

export function editableFields(entity: ConflictEntity): ConflictField[] {
  return CONFIG[entity].fields.filter((field) => field.kind !== 'derived' && field.editable !== false);
}

export function businessFields(entity: ConflictEntity): string[] {
  return CONFIG[entity].fields.map((field) => field.key);
}

export function isServerOwned(entity: ConflictEntity, key: string): boolean {
  return entity === 'cuyes' && (key === 'categoria_ml' || key === 'ultimo_peso_g');
}

export function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8);
}

export function referenceLabel(
  references: ReferenceCatalog,
  reference: ReferenceEntity,
  value: unknown,
): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const match = references[reference]?.find((item) => item.id === value);
  return match?.label ?? `Referencia ${shortId(value)}`;
}

export function formatDate(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  const part = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(part);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function formatConflictValue(field: ConflictField, value: unknown, references: ReferenceCatalog): string {
  if (value === null || value === undefined) return 'Sin dato';
  if (field.kind === 'reference' && field.reference) {
    return referenceLabel(references, field.reference, value) ?? 'Sin dato';
  }
  if (field.kind === 'date') return formatDate(value) || 'Sin dato';
  if (field.kind === 'select' && field.key === 'sexo') {
    if (value === 'M') return 'Macho';
    if (value === 'H') return 'Hembra';
  }
  if (field.kind === 'decimal' && field.unit) return `${String(value)} ${field.unit}`;
  if (field.kind === 'derived' && field.key === 'ultimo_peso_g') return `${String(value)} g`;
  const text = String(value);
  return text.length === 0 ? 'Sin dato' : text;
}

export function inputValue(field: ConflictField, value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function optionalInteger(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return Number(String(value).trim());
}

function requiredKeysMatch(input: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(input).sort().join(',') === [...keys].sort().join(',');
}

export type RetryValidation = { ok: true; data: Record<string, unknown> } | { ok: false; errors: string[] };

export function validateRetryValues(
  entity: ConflictEntity,
  input: Record<string, unknown>,
  central: PullRecord,
): RetryValidation {
  const fields = editableFields(entity);
  const keys = fields.map((field) => field.key);
  if (!requiredKeysMatch(input, keys)) return { ok: false, errors: ['Datos para reintento inválidos'] };

  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = input[field.key];
    switch (field.kind) {
      case 'date':
        values[field.key] = optionalText(raw);
        break;
      case 'decimal':
        values[field.key] = optionalText(raw);
        break;
      case 'integer':
        values[field.key] = optionalInteger(raw);
        break;
      case 'reference':
        values[field.key] = optionalText(raw);
        break;
      case 'select':
        values[field.key] = optionalText(raw);
        break;
      default:
        values[field.key] = optionalText(raw);
    }
  }

  if (entity === 'galpon') {
    const validation = validateGalpon(values as unknown as GalponInput);
    if (!validation.ok) return { ok: false, errors: (validation as { errors: string[] }).errors };
    const normalized = normalizeGalpon(values as unknown as GalponInput);
    return { ok: true, data: { nombre: normalized.nombre, ubicacion: normalized.ubicacion } };
  }
  if (entity === 'poza') {
    const validation = validatePoza({
      codigo: values.codigo,
      tipo: values.tipo,
      capacidadMaxima: values.capacidad_maxima,
    } as unknown as PozaInput);
    if (!validation.ok) return { ok: false, errors: (validation as { errors: string[] }).errors };
    const normalized = normalizePoza({
      codigo: values.codigo,
      tipo: values.tipo,
      capacidadMaxima: values.capacidad_maxima,
    } as unknown as PozaInput);
    return {
      ok: true,
      data: {
        galpon_id: central.data.galpon_id,
        codigo: normalized.codigo,
        tipo: normalized.tipo,
        capacidad_maxima: normalized.capacidadMaxima,
      },
    };
  }
  if (entity === 'cuyes') {
    const validation = validateCuyo({
      pozaId: values.poza_id,
      galponOrigenId: values.galpon_origen_id,
      codigoIdentificacion: values.codigo_identificacion,
      sexo: values.sexo,
      fechaNacimiento: values.fecha_nacimiento,
      colorCodigo: values.color_codigo,
      ojosCodigo: values.ojos_codigo,
      pelajeOriginal: values.pelaje_original,
      padreId: values.padre_id,
      madreId: values.madre_id,
      categoriaMl: null,
      ultimoPesoG: null,
      estado: values.estado,
    } as CuyoInput);
    if (!validation.ok) return { ok: false, errors: (validation as { errors: string[] }).errors };
    const value = validation.value;
    return {
      ok: true,
      data: {
        poza_id: value.pozaId,
        galpon_origen_id: value.galponOrigenId,
        codigo_identificacion: value.codigoIdentificacion,
        sexo: value.sexo,
        fecha_nacimiento: value.fechaNacimiento,
        color_codigo: value.colorCodigo,
        ojos_codigo: value.ojosCodigo,
        pelaje_original: value.pelajeOriginal,
        padre_id: value.padreId,
        madre_id: value.madreId,
        estado: value.estado,
      },
    };
  }
  if (entity === 'partos') {
    const validation = validateParto({
      madreId: values.madre_id,
      fechaParto: values.fecha_parto,
      numeroParto: values.numero_parto,
      nacidosVivos: values.nacidos_vivos,
      nacidosMuertos: values.nacidos_muertos,
      tamanoCamadaNacida: values.tamano_camada_nacida,
      crias: [],
    } as PartoInput);
    if (!validation.ok) return { ok: false, errors: (validation as { errors: string[] }).errors };
    const value = validation.value;
    return {
      ok: true,
      data: {
        madre_id: value.madreId,
        fecha_parto: value.fechaParto,
        numero_parto: value.numeroParto,
        nacidos_vivos: value.nacidosVivos,
        nacidos_muertos: value.nacidosMuertos,
        tamano_camada_nacida: value.tamanoCamadaNacida,
      },
    };
  }
  if (entity === 'pesajes') {
    const validation = validatePesaje({
      cuyId: values.cuy_id,
      fechaPesaje: values.fecha_pesaje,
      pesoGramos: values.peso_gramos,
      etapa: values.etapa,
      partoId: values.parto_id,
      eventoId: values.evento_id,
    } as PesajeInput);
    if (!validation.ok) return { ok: false, errors: (validation as { errors: string[] }).errors };
    const value = validation.value;
    return {
      ok: true,
      data: {
        cuy_id: value.cuyId,
        fecha_pesaje: value.fechaPesaje,
        peso_gramos: value.pesoGramos,
        etapa: value.etapa,
        parto_id: value.partoId,
        evento_id: value.eventoId,
      },
    };
  }
  if (entity === 'eventos') {
    const validation = validateEvento({
      cuyId: values.cuy_id,
      tipo: values.tipo,
      fecha: values.fecha,
      machoId: values.macho_id,
      pozaOrigenId: values.poza_origen_id,
      pozaDestinoId: values.poza_destino_id,
      detalle: values.detalle,
    } as EventoInput);
    if (!validation.ok) return { ok: false, errors: (validation as { errors: string[] }).errors };
    const value = validation.value;
    return {
      ok: true,
      data: {
        cuy_id: value.cuyId,
        tipo: value.tipo,
        fecha: value.fecha,
        macho_id: value.machoId,
        poza_origen_id: value.pozaOrigenId,
        poza_destino_id: value.pozaDestinoId,
        detalle: value.detalle,
      },
    };
  }
  const rol = optionalText(values.rol);
  if (!rol) return { ok: false, errors: ['El rol del vínculo es obligatorio'] };
  if (rol.length > 30) return { ok: false, errors: ['El rol no puede superar 30 caracteres'] };
  return {
    ok: true,
    data: {
      parto_id: central.data.parto_id,
      cuy_id: central.data.cuy_id,
      rol,
    },
  };
}

export function sameEditableData(
  entity: ConflictEntity,
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return editableFields(entity).every((field) => {
    const a = left[field.key] ?? null;
    const b = right[field.key] ?? null;
    if (a === null || b === null) return a === b;
    return String(a) === String(b);
  });
}

// Algunos recibos v2 de conflicto incluyen solo los campos del cliente. Los
// campos derivados del servidor se completan como nulos para validar el sobre;
// la UI los marca como no incluidos en el recibo.
export function normalizeConflictRecord(entity: ConflictEntity, value: unknown): PullRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Snapshot central inválido');
  const record = value as Record<string, unknown>;
  if (!record.data || typeof record.data !== 'object' || Array.isArray(record.data)) {
    throw new Error('Snapshot central sin datos');
  }
  const data = { ...(record.data as Record<string, unknown>) };
  if (entity === 'cuyes') {
    if (!('categoria_ml' in data)) data.categoria_ml = null;
    if (!('ultimo_peso_g' in data)) data.ultimo_peso_g = null;
  }
  return { ...record, data } as unknown as PullRecord;
}
