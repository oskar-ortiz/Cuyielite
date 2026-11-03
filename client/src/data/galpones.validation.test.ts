import { describe, expect, it } from 'vitest';

import { normalizeGalpon, normalizePoza, validateGalpon, validatePoza } from './galpones.validation';

describe('validateGalpon', () => {
  it('rechaza nombre vacío o solo espacios', () => {
    expect(validateGalpon({ nombre: '', ubicacion: null }).ok).toBe(false);
    expect(validateGalpon({ nombre: '   ', ubicacion: null }).ok).toBe(false);
  });
  it('rechaza nombre mayor a 120', () => {
    expect(validateGalpon({ nombre: 'a'.repeat(121), ubicacion: null }).ok).toBe(false);
  });
  it('acepta nombre válido y normaliza', () => {
    const r = validateGalpon({ nombre: '  Galpón  ', ubicacion: '  Lote 1  ' });
    expect(r.ok).toBe(true);
    expect(normalizeGalpon({ nombre: '  Galpón  ', ubicacion: '  Lote 1  ' })).toEqual({
      nombre: 'Galpón',
      ubicacion: 'Lote 1',
    });
  });
  it('ubicación vacía se normaliza a null', () => {
    expect(normalizeGalpon({ nombre: 'G', ubicacion: '   ' })).toEqual({ nombre: 'G', ubicacion: null });
  });
  it('rechaza ubicación mayor a 255', () => {
    expect(validateGalpon({ nombre: 'G', ubicacion: 'a'.repeat(256) }).ok).toBe(false);
  });
});

describe('validatePoza', () => {
  it('rechaza código vacío', () => {
    expect(validatePoza({ codigo: '', tipo: 'cría', capacidadMaxima: 10 }).ok).toBe(false);
  });
  it('rechaza código mayor a 50', () => {
    expect(validatePoza({ codigo: 'a'.repeat(51), tipo: 'cría', capacidadMaxima: 10 }).ok).toBe(false);
  });
  it('rechaza tipo vacío o mayor a 50', () => {
    expect(validatePoza({ codigo: 'P', tipo: '', capacidadMaxima: 10 }).ok).toBe(false);
    expect(validatePoza({ codigo: 'P', tipo: 'a'.repeat(51), capacidadMaxima: 10 }).ok).toBe(false);
  });
  it('rechaza capacidad no entera o fuera de rango', () => {
    expect(validatePoza({ codigo: 'P', tipo: 'cría', capacidadMaxima: 1.5 }).ok).toBe(false);
    expect(validatePoza({ codigo: 'P', tipo: 'cría', capacidadMaxima: -1 }).ok).toBe(false);
    expect(validatePoza({ codigo: 'P', tipo: 'cría', capacidadMaxima: 2147483648 }).ok).toBe(false);
  });
  it('acepta capacidad 0 y máximo', () => {
    expect(validatePoza({ codigo: 'P', tipo: 'cría', capacidadMaxima: 0 }).ok).toBe(true);
    expect(validatePoza({ codigo: 'P', tipo: 'cría', capacidadMaxima: 2147483647 }).ok).toBe(true);
  });
  it('normaliza código y tipo con trim', () => {
    expect(normalizePoza({ codigo: '  P-1  ', tipo: '  cría  ', capacidadMaxima: 5 })).toEqual({
      codigo: 'P-1',
      tipo: 'cría',
      capacidadMaxima: 5,
    });
  });
});
