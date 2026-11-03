import { describe, it, expect, vi } from 'vitest';

import { createElectronRepository } from './galpones.repository.electron';

describe('ElectronGalponesRepository', () => {
  it('mapea galpones y pozas del plugin', async () => {
    const plugin = {
      initializeDatabase: vi.fn().mockResolvedValue({ ok: true }),
      listGalpones: vi.fn().mockResolvedValue({
        galpones: [
          { id: 'g1', nombre: 'Galpón Norte', ubicacion: 'Lote 1' },
          { id: 'g2', nombre: 'Galpón Sur', ubicacion: null },
        ],
      }),
      listPozasByGalpon: vi.fn().mockResolvedValue({
        pozas: [{ id: 'p1', galpon_id: 'g1', codigo: 'P-101', tipo: 'cría', capacidad_maxima: 50 }],
      }),
      createGalpon: vi.fn().mockResolvedValue({ galpon: { id: 'g3', nombre: 'Nuevo', ubicacion: null } }),
      createPoza: vi
        .fn()
        .mockResolvedValue({ poza: { id: 'p2', galpon_id: 'g1', codigo: 'P-X', tipo: 'cría', capacidad_maxima: 10 } }),
      updateGalpon: vi.fn().mockResolvedValue({ galpon: { id: 'g1', nombre: 'Editado', ubicacion: 'Lote X' } }),
      updatePoza: vi.fn().mockResolvedValue({
        poza: { id: 'p1', galpon_id: 'g1', codigo: 'P-101E', tipo: 'engorde', capacidad_maxima: 99 },
      }),
    };

    const repo = createElectronRepository(plugin);
    const galpones = await repo.listGalpones();
    expect(galpones).toEqual([
      { id: 'g1', nombre: 'Galpón Norte', ubicacion: 'Lote 1' },
      { id: 'g2', nombre: 'Galpón Sur', ubicacion: null },
    ]);
    expect(plugin.initializeDatabase).toHaveBeenCalled();

    const pozas = await repo.listPozasByGalpon('g1');
    expect(pozas).toEqual([{ id: 'p1', galponId: 'g1', codigo: 'P-101', tipo: 'cría', capacidadMaxima: 50 }]);
    expect(plugin.listPozasByGalpon).toHaveBeenCalledWith({ galponId: 'g1' });
  });
});
