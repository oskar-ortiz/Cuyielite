import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Galpones from './Galpones';

const { listGalpones, listPozasByGalpon, listWorkGalpones } = vi.hoisted(() => ({
  listGalpones: vi.fn(),
  listPozasByGalpon: vi.fn(),
  listWorkGalpones: vi.fn(),
}));

vi.mock('../data/galpones.repository.factory', () => ({
  getGalponesRepository: () => ({ listGalpones, listPozasByGalpon }),
}));

vi.mock('../data/work.galpones.repository', () => ({
  getWorkGalponesReader: () => ({ listGalpones: listWorkGalpones }),
}));

describe('Galpones', () => {
  beforeEach(() => {
    listGalpones.mockReset();
    listPozasByGalpon.mockReset();
    listWorkGalpones.mockReset();
  });

  it('muestra todos los galpones con su marcado', async () => {
    listGalpones.mockResolvedValue([
      { id: 'g1', nombre: 'Galpón Norte', ubicacion: 'Lote 1, sector norte' },
      { id: 'g2', nombre: 'Galpón Sur', ubicacion: 'Lote 2, junto a la bodega' },
      { id: 'g3', nombre: 'Galpón Occidente', ubicacion: 'Lote 3, ladera oeste' },
      { id: 'g4', nombre: 'Galpón Este', ubicacion: 'Lote 4, en adecuación' },
    ]);
    render(
      <MemoryRouter>
        <Galpones />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Galpón Norte')).toBeInTheDocument();
    expect(screen.getByText('Galpón Sur')).toBeInTheDocument();
    expect(screen.getByText('Galpón Occidente')).toBeInTheDocument();
    expect(screen.getByText('Galpón Este')).toBeInTheDocument();
    expect(screen.getByText('Datos de demostración')).toBeInTheDocument();
  });

  it('muestra estado de error si falla la lectura', async () => {
    listGalpones.mockRejectedValue(new Error('boom'));
    render(
      <MemoryRouter>
        <Galpones />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Error al cargar galpones/)).toBeInTheDocument();
  });

  it('consulta solo trabajo y deshabilita las altas antes de la outbox', async () => {
    listWorkGalpones.mockResolvedValue([]);
    render(
      <MemoryRouter>
        <Galpones mode="trabajo" />
      </MemoryRouter>,
    );
    expect(await screen.findByText('La base de trabajo todavía no tiene galpones.')).toBeInTheDocument();
    expect(screen.getByText('Base de trabajo · solo consulta')).toBeInTheDocument();
    expect(screen.queryByText('Datos de demostración')).not.toBeInTheDocument();
    expect(screen.queryByText('Nuevo')).not.toBeInTheDocument();
    expect(listGalpones).not.toHaveBeenCalled();
  });
});
