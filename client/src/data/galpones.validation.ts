export interface GalponInput {
  nombre: string;
  ubicacion: string | null;
}

export interface PozaInput {
  codigo: string;
  tipo: string;
  capacidadMaxima: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateGalpon(input: GalponInput): ValidationResult {
  const errors: string[] = [];
  const nombre = (input.nombre ?? '').trim();
  if (!nombre) errors.push('El nombre es obligatorio');
  if (nombre.length > 120) errors.push('El nombre no puede superar 120 caracteres');
  const ubicacion = input.ubicacion === null ? null : (input.ubicacion ?? '').trim();
  if (ubicacion !== null && ubicacion.length > 255) {
    errors.push('La ubicación no puede superar 255 caracteres');
  }
  return { ok: errors.length === 0, errors };
}

export function validatePoza(input: PozaInput): ValidationResult {
  const errors: string[] = [];
  const codigo = (input.codigo ?? '').trim();
  if (!codigo) errors.push('El código es obligatorio');
  if (codigo.length > 50) errors.push('El código no puede superar 50 caracteres');
  const tipo = (input.tipo ?? '').trim();
  if (!tipo) errors.push('El tipo es obligatorio');
  if (tipo.length > 50) errors.push('El tipo no puede superar 50 caracteres');
  if (!Number.isInteger(input.capacidadMaxima) || input.capacidadMaxima < 0 || input.capacidadMaxima > 2147483647) {
    errors.push('La capacidad debe ser un entero entre 0 y 2147483647');
  }
  return { ok: errors.length === 0, errors };
}

export function normalizeGalpon(input: GalponInput): { nombre: string; ubicacion: string | null } {
  return {
    nombre: (input.nombre ?? '').trim(),
    ubicacion: input.ubicacion === null ? null : (input.ubicacion ?? '').trim() || null,
  };
}

export function normalizePoza(input: PozaInput): { codigo: string; tipo: string; capacidadMaxima: number } {
  return {
    codigo: (input.codigo ?? '').trim(),
    tipo: (input.tipo ?? '').trim(),
    capacidadMaxima: input.capacidadMaxima,
  };
}
