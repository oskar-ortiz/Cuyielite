import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWorkGalponesReader, getWorkGalponesRepository } from './work.galpones.repository';

const {
  listWorkGalpones,
  listWorkPozasByGalpon,
  query,
  createWorkGalpon,
  createWorkPoza,
  updateWorkGalpon,
  updateWorkPoza,
  androidCreateGalpon,
  androidCreatePoza,
  androidUpdateGalpon,
  androidUpdatePoza,
} = vi.hoisted(() => ({
  listWorkGalpones: vi.fn(),
  listWorkPozasByGalpon: vi.fn(),
  query: vi.fn(),
  createWorkGalpon: vi.fn(),
  createWorkPoza: vi.fn(),
  updateWorkGalpon: vi.fn(),
  updateWorkPoza: vi.fn(),
  androidCreateGalpon: vi.fn(),
  androidCreatePoza: vi.fn(),
  androidUpdateGalpon: vi.fn(),
  androidUpdatePoza: vi.fn(),
}));

vi.mock('./sqlitePocPlugin', () => ({
  SqlitePoc: {
    listWorkGalpones,
    listWorkPozasByGalpon,
    createWorkGalpon,
    createWorkPoza,
    updateWorkGalpon,
    updateWorkPoza,
  },
}));
vi.mock('./work.database.android', () => ({
  getWorkConnection: async () => ({ query }),
}));
vi.mock('./work.outbox.android', () => ({
  createAndroidWorkGalpon: androidCreateGalpon,
  createAndroidWorkPoza: androidCreatePoza,
  updateAndroidWorkGalpon: androidUpdateGalpon,
  updateAndroidWorkPoza: androidUpdatePoza,
}));

describe('lector de galpones de trabajo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    listWorkGalpones.mockReset();
    listWorkPozasByGalpon.mockReset();
    query.mockReset();
    createWorkGalpon.mockReset();
    createWorkPoza.mockReset();
    updateWorkGalpon.mockReset();
    updateWorkPoza.mockReset();
    androidCreateGalpon.mockReset();
    androidCreatePoza.mockReset();
    androidUpdateGalpon.mockReset();
    androidUpdatePoza.mockReset();
  });

  it('en Electron consulta las operaciones acotadas de trabajo', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('electron');
    listWorkGalpones.mockResolvedValue({ galpones: [{ id: 'g1', nombre: 'Trabajo', ubicacion: null }] });
    listWorkPozasByGalpon.mockResolvedValue({
      pozas: [{ id: 'p1', galpon_id: 'g1', codigo: 'T-1', tipo: 'cría', capacidad_maxima: 20 }],
    });
    const reader = getWorkGalponesReader();
    expect(await reader.listGalpones()).toEqual([{ id: 'g1', nombre: 'Trabajo', ubicacion: null }]);
    expect(await reader.listPozasByGalpon('g1')).toEqual([
      { id: 'p1', galponId: 'g1', codigo: 'T-1', tipo: 'cría', capacidadMaxima: 20 },
    ]);
    expect(listWorkPozasByGalpon).toHaveBeenCalledWith({ galponId: 'g1' });
    expect(query).not.toHaveBeenCalled();
  });

  it('en Android lee exclusivamente la conexión de trabajo', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    query.mockResolvedValueOnce({ values: [{ id: 'g1', nombre: 'Trabajo', ubicacion: null }] }).mockResolvedValueOnce({
      values: [{ id: 'p1', galpon_id: 'g1', codigo: 'T-1', tipo: 'cría', capacidad_maxima: 20 }],
    });
    const reader = getWorkGalponesReader();
    expect(await reader.listGalpones()).toHaveLength(1);
    expect(await reader.listPozasByGalpon('g1')).toEqual([
      { id: 'p1', galponId: 'g1', codigo: 'T-1', tipo: 'cría', capacidadMaxima: 20 },
    ]);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('WHERE galpon_id = ?'), ['g1']);
    expect(listWorkGalpones).not.toHaveBeenCalled();
  });

  it('rechaza el modo trabajo en un navegador sin SQLite nativo', () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    expect(() => getWorkGalponesReader()).toThrow(/requiere Android o Windows/);
    expect(() => getWorkGalponesRepository()).toThrow(/requiere Android o Windows/);
  });

  it('en Electron escribe mediante las operaciones outbox acotadas', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('electron');
    createWorkGalpon.mockResolvedValue({ id: 'g1', operationId: 'op-1', changed: true });
    createWorkPoza.mockResolvedValue({ id: 'p1', operationId: 'op-2', changed: true });
    updateWorkGalpon.mockResolvedValue({ id: 'g1', operationId: 'op-3', changed: true });
    updateWorkPoza.mockResolvedValue({ id: 'p1', operationId: 'op-4', changed: true });
    const repository = getWorkGalponesRepository();

    await expect(repository.createGalpon({ nombre: 'Nuevo', ubicacion: 'Lote' })).resolves.toEqual({
      id: 'g1',
      nombre: 'Nuevo',
      ubicacion: 'Lote',
    });
    await expect(
      repository.createPoza({ galponId: 'g1', codigo: 'P-1', tipo: 'cría', capacidadMaxima: 20 }),
    ).resolves.toEqual({ id: 'p1', galponId: 'g1', codigo: 'P-1', tipo: 'cría', capacidadMaxima: 20 });
    await expect(repository.updateGalpon('g1', { nombre: 'Editado', ubicacion: null })).resolves.toEqual({
      id: 'g1',
      nombre: 'Editado',
      ubicacion: null,
    });
    await expect(
      repository.updatePoza('g1', 'p1', { codigo: 'P-2', tipo: 'engorde', capacidadMaxima: 30 }),
    ).resolves.toEqual({ id: 'p1', galponId: 'g1', codigo: 'P-2', tipo: 'engorde', capacidadMaxima: 30 });

    expect(createWorkGalpon).toHaveBeenCalledWith({ nombre: 'Nuevo', ubicacion: 'Lote' });
    expect(createWorkPoza).toHaveBeenCalledWith({
      galponId: 'g1',
      codigo: 'P-1',
      tipo: 'cría',
      capacidadMaxima: 20,
    });
    expect(updateWorkGalpon).toHaveBeenCalledWith({ id: 'g1', nombre: 'Editado', ubicacion: null });
    expect(updateWorkPoza).toHaveBeenCalledWith({
      galponId: 'g1',
      id: 'p1',
      codigo: 'P-2',
      tipo: 'engorde',
      capacidadMaxima: 30,
    });
  });

  it('en Android escribe mediante la conexión y la outbox de trabajo', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    androidCreateGalpon.mockResolvedValue({ id: 'g2', operationId: 'op-1', changed: true });
    androidCreatePoza.mockResolvedValue({ id: 'p2', operationId: 'op-2', changed: true });
    androidUpdateGalpon.mockResolvedValue({ id: 'g2', operationId: 'op-3', changed: true });
    androidUpdatePoza.mockResolvedValue({ id: 'p2', operationId: 'op-4', changed: true });
    const repository = getWorkGalponesRepository();

    await repository.createGalpon({ nombre: 'Nuevo', ubicacion: null });
    await repository.createPoza({ galponId: 'g2', codigo: 'P-1', tipo: 'cría', capacidadMaxima: 20 });
    await repository.updateGalpon('g2', { nombre: 'Editado', ubicacion: null });
    await repository.updatePoza('g2', 'p2', { codigo: 'P-2', tipo: 'engorde', capacidadMaxima: 30 });

    expect(androidCreateGalpon).toHaveBeenCalledWith({ nombre: 'Nuevo', ubicacion: null });
    expect(androidCreatePoza).toHaveBeenCalledWith('g2', {
      galponId: 'g2',
      codigo: 'P-1',
      tipo: 'cría',
      capacidadMaxima: 20,
    });
    expect(androidUpdateGalpon).toHaveBeenCalledWith('g2', { nombre: 'Editado', ubicacion: null });
    expect(androidUpdatePoza).toHaveBeenCalledWith('g2', 'p2', {
      codigo: 'P-2',
      tipo: 'engorde',
      capacidadMaxima: 30,
    });
  });
});
