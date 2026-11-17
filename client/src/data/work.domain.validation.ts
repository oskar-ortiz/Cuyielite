// Tipos y validación de dominio para la base de Trabajo (D4).
// Reflejan columnas reales de work.schema.ts; no agregan reglas de negocio.

export type Sexo = 'M' | 'H';
export type CategoriaMl = 'ELITE' | 'NORMAL' | 'DESCARTE';

export interface Cuyo {
  id: string;
  pozaId: string | null;
  galponOrigenId: string | null;
  codigoIdentificacion: string;
  sexo: Sexo | null;
  fechaNacimiento: string | null;
  colorCodigo: string | null;
  ojosCodigo: string | null;
  pelajeOriginal: string | null;
  padreId: string | null;
  madreId: string | null;
  categoriaMl: CategoriaMl | null;
  ultimoPesoG: string | null;
  estado: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Parto {
  id: string;
  madreId: string;
  fechaParto: string | null;
  numeroParto: number | null;
  nacidosVivos: number | null;
  nacidosMuertos: number | null;
  tamanoCamadaNacida: number | null;
}

export interface Pesaje {
  id: string;
  cuyId: string;
  fechaPesaje: string | null;
  pesoGramos: string;
  etapa: string | null;
  partoId: string | null;
  eventoId: string | null;
}

export interface Evento {
  id: string;
  cuyId: string;
  tipo: string;
  fecha: string | null;
  machoId: string | null;
  pozaOrigenId: string | null;
  pozaDestinoId: string | null;
  detalle: string | null;
}

export interface PartoCria {
  id: string;
  partoId: string;
  cuyId: string;
  rol: string;
}

export interface CuyoInput {
  pozaId: string;
  galponOrigenId: string | null;
  codigoIdentificacion: string;
  sexo: Sexo | null;
  fechaNacimiento: string | null;
  colorCodigo: string | null;
  ojosCodigo: string | null;
  pelajeOriginal: string | null;
  padreId: string | null;
  madreId: string | null;
  categoriaMl: CategoriaMl | null;
  ultimoPesoG: string | null;
  estado: string | null;
}

export interface PartoInput {
  madreId: string;
  fechaParto: string | null;
  numeroParto: number | null;
  nacidosVivos: number | null;
  nacidosMuertos: number | null;
  tamanoCamadaNacida: number | null;
  crias: string[];
}

export interface PesajeInput {
  cuyId: string;
  fechaPesaje: string | null;
  pesoGramos: string;
  etapa: string | null;
  partoId: string | null;
  eventoId: string | null;
}

export interface EventoInput {
  cuyId: string;
  tipo: string;
  fecha: string | null;
  machoId: string | null;
  pozaOrigenId: string | null;
  pozaDestinoId: string | null;
  detalle: string | null;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DECIMAL2 = /^\d{1,6}(\.\d{1,2})?$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optionalText(value: unknown, max: number, field: string, errors: string[]): string | null {
  const result = text(value);
  if (result !== null && result.length > max) errors.push(`${field} no puede superar ${max} caracteres`);
  return result;
}

function optionalUuid(value: unknown, field: string, errors: string[]): string | null {
  const result = text(value);
  if (result !== null && !UUID.test(result)) errors.push(`${field} no es un UUID válido`);
  return result;
}

function optionalDate(value: unknown, field: string, errors: string[]): string | null {
  const result = text(value);
  if (result !== null) {
    if (!DATE.test(result) || !Number.isFinite(Date.parse(`${result}T00:00:00Z`))) {
      errors.push(`${field} debe ser una fecha ISO (AAAA-MM-DD)`);
    }
  }
  return result;
}

function optionalDecimal(value: unknown, field: string, errors: string[]): string | null {
  const result = text(value);
  if (result !== null && !DECIMAL2.test(result)) errors.push(`${field} debe ser un decimal con hasta 2 decimales`);
  return result;
}

function optionalInt(value: unknown, field: string, min: number, errors: string[]): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(number) || number < min) errors.push(`${field} debe ser un entero mayor o igual a ${min}`);
  return number;
}

export function validateCuyo(input: CuyoInput): Validation<CuyoInput> {
  const errors: string[] = [];
  const codigo = text(input.codigoIdentificacion);
  if (!codigo) errors.push('La chapa es obligatoria');
  else if (codigo.length > 50) errors.push('La chapa no puede superar 50 caracteres');
  if (!isUuid(input.pozaId)) errors.push('La poza es obligatoria');
  const sexo = input.sexo;
  if (sexo !== null && sexo !== 'M' && sexo !== 'H') errors.push('El sexo debe ser M, H o quedar vacío');
  const categoria = input.categoriaMl;
  if (categoria !== null && !['ELITE', 'NORMAL', 'DESCARTE'].includes(categoria)) {
    errors.push('La categoría no es válida');
  }
  const value: CuyoInput = {
    pozaId: input.pozaId,
    galponOrigenId: optionalUuid(input.galponOrigenId, 'Galpón de origen', errors),
    codigoIdentificacion: codigo ?? '',
    sexo: sexo ?? null,
    fechaNacimiento: optionalDate(input.fechaNacimiento, 'Fecha de nacimiento', errors),
    colorCodigo: optionalText(input.colorCodigo, 20, 'Color', errors),
    ojosCodigo: optionalText(input.ojosCodigo, 20, 'Ojos', errors),
    pelajeOriginal: optionalText(input.pelajeOriginal, 20, 'Pelaje', errors),
    padreId: optionalUuid(input.padreId, 'Padre', errors),
    madreId: optionalUuid(input.madreId, 'Madre', errors),
    categoriaMl: categoria ?? null,
    ultimoPesoG: optionalDecimal(input.ultimoPesoG, 'Último peso', errors),
    estado: optionalText(input.estado, 20, 'Estado', errors),
  };
  if (value.padreId && value.padreId === value.madreId) errors.push('Padre y madre no pueden ser el mismo animal');
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateParto(input: PartoInput): Validation<PartoInput> {
  const errors: string[] = [];
  if (!isUuid(input.madreId)) errors.push('La madre es obligatoria');
  const value: PartoInput = {
    madreId: input.madreId,
    fechaParto: optionalDate(input.fechaParto, 'Fecha de parto', errors),
    numeroParto: optionalInt(input.numeroParto, 'Número de parto', 1, errors),
    nacidosVivos: optionalInt(input.nacidosVivos, 'Nacidos vivos', 0, errors),
    nacidosMuertos: optionalInt(input.nacidosMuertos, 'Nacidos muertos', 0, errors),
    tamanoCamadaNacida: optionalInt(input.tamanoCamadaNacida, 'Tamaño de camada', 0, errors),
    crias: [...new Set(input.crias)],
  };
  for (const cria of value.crias) {
    if (!isUuid(cria)) errors.push('Una cría seleccionada no es válida');
  }
  if (value.crias.includes(value.madreId)) errors.push('La madre no puede ser cría de su propio parto');
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validatePesaje(input: PesajeInput): Validation<PesajeInput> {
  const errors: string[] = [];
  if (!isUuid(input.cuyId)) errors.push('El animal es obligatorio');
  const peso = text(input.pesoGramos);
  if (!peso || !DECIMAL2.test(peso)) errors.push('El peso debe ser un decimal en gramos con hasta 2 decimales');
  if (input.partoId && input.eventoId) errors.push('Un pesaje admite a lo sumo parto o evento, no ambos');
  const value: PesajeInput = {
    cuyId: input.cuyId,
    fechaPesaje: optionalDate(input.fechaPesaje, 'Fecha de pesaje', errors),
    pesoGramos: peso ?? '',
    etapa: optionalText(input.etapa, 20, 'Etapa', errors),
    partoId: optionalUuid(input.partoId, 'Parto', errors),
    eventoId: optionalUuid(input.eventoId, 'Evento', errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function validateEvento(input: EventoInput): Validation<EventoInput> {
  const errors: string[] = [];
  if (!isUuid(input.cuyId)) errors.push('El animal es obligatorio');
  const tipo = text(input.tipo);
  if (!tipo) errors.push('El tipo de evento es obligatorio');
  else if (tipo.length > 30) errors.push('El tipo no puede superar 30 caracteres');
  const value: EventoInput = {
    cuyId: input.cuyId,
    tipo: tipo ?? '',
    fecha: optionalDate(input.fecha, 'Fecha', errors),
    machoId: optionalUuid(input.machoId, 'Macho', errors),
    pozaOrigenId: optionalUuid(input.pozaOrigenId, 'Poza de origen', errors),
    pozaDestinoId: optionalUuid(input.pozaDestinoId, 'Poza de destino', errors),
    detalle: optionalText(input.detalle, 255, 'Detalle', errors),
  };
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
