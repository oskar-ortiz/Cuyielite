import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWorkGalponesReader } from './work.galpones.repository';

const { listWorkGalpones, listWorkPozasByGalpon, query } = vi.hoisted(() => ({
  listWorkGalpones: vi.fn(),
  listWorkPozasByGalpon: vi.fn(),
  query: vi.fn(),
}));

vi.mock('./sqlitePocPlugin', () => ({
  SqlitePoc: { listWorkGalpones, listWorkPozasByGalpon },
}));
vi.mock('./work.database.android', () => ({
  getWorkConnection: async () => ({ query }),
}));

describe('lector de galpones de trabajo', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    listWorkGalpones.mockReset();
    listWorkPozasByGalpon.mockReset();
    query.mockReset();
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
  });
});
