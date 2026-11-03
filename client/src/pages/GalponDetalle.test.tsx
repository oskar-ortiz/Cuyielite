import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GalponDetalle from './GalponDetalle';

const { listGalpones, listPozasByGalpon } = vi.hoisted(() => ({
  listGalpones: vi.fn(),
  listPozasByGalpon: vi.fn(),
}));

vi.mock('../data/galpones.repository.electron', () => ({
  getElectronRepository: () => ({ listGalpones, listPozasByGalpon }),
}));

const renderDetalle = (ruta: string) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/galpones/:id" element={<GalponDetalle />} />
      </Routes>
    </MemoryRouter>,
  );

describe('GalponDetalle', () => {
  beforeEach(() => {
    listGalpones.mockReset();
    listPozasByGalpon.mockReset();
  });

  it('muestra solo las pozas del galpón seleccionado', async () => {
    listGalpones.mockResolvedValue([
      { id: '00000000-0000-4000-8000-000000000001', nombre: 'Galpón Norte', ubicacion: 'Lote 1, sector norte' },
    ]);
    listPozasByGalpon.mockResolvedValue([
      {
        id: 'p1',
        galponId: '00000000-0000-4000-8000-000000000001',
        codigo: 'P-101',
        tipo: 'cría',
        capacidadMaxima: 50,
      },
      {
        id: 'p2',
        galponId: '00000000-0000-4000-8000-000000000001',
        codigo: 'P-102',
        tipo: 'engorde',
        capacidadMaxima: 30,
      },
      {
        id: 'p3',
        galponId: '00000000-0000-4000-8000-000000000001',
        codigo: 'P-103',
        tipo: 'reproducción',
        capacidadMaxima: 80,
      },
    ]);
    renderDetalle('/galpones/00000000-0000-4000-8000-000000000001');
    expect(await screen.findByText('P-101')).toBeInTheDocument();
    expect(screen.getByText('P-102')).toBeInTheDocument();
    expect(screen.getByText('P-103')).toBeInTheDocument();
    expect(screen.queryByText('P-201')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando el galpón no tiene pozas', async () => {
    listGalpones.mockResolvedValue([
      { id: '00000000-0000-4000-8000-000000000004', nombre: 'Galpón Este', ubicacion: 'Lote 4, en adecuación' },
    ]);
    listPozasByGalpon.mockResolvedValue([]);
    renderDetalle('/galpones/00000000-0000-4000-8000-000000000004');
    expect(await screen.findByText(/todavía no tiene pozas/)).toBeInTheDocument();
  });

  it('muestra el mensaje para un identificador inexistente', async () => {
    listGalpones.mockResolvedValue([]);
    listPozasByGalpon.mockResolvedValue([]);
    renderDetalle('/galpones/00000000-0000-4000-8000-ffffffffffff');
    expect(await screen.findByText(/No existe un galpón/)).toBeInTheDocument();
  });

  it('muestra estado de error si falla la lectura', async () => {
    listGalpones.mockRejectedValue(new Error('boom'));
    listPozasByGalpon.mockRejectedValue(new Error('boom'));
    renderDetalle('/galpones/00000000-0000-4000-8000-000000000001');
    expect(await screen.findByText(/Error al cargar el galpón/)).toBeInTheDocument();
  });
});
