import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FormularioCuyo from './FormularioCuyo';

const { listPozas, listAllCuyes, getCuyo, createCuyo, updateCuyo } = vi.hoisted(() => ({
  listPozas: vi.fn(),
  listAllCuyes: vi.fn(),
  getCuyo: vi.fn(),
  createCuyo: vi.fn(),
  updateCuyo: vi.fn(),
}));

vi.mock('../data/work.domain.factory', () => ({
  getDomainRepository: async () => ({ listPozas, listAllCuyes, getCuyo, createCuyo, updateCuyo }),
}));

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/trabajo/galpones/g1/pozas/p1/animales/nuevo']}>
      <Routes>
        <Route path="/trabajo/galpones/:galponId/pozas/:pozaId/animales/nuevo" element={<FormularioCuyo />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={['/trabajo/animales/a1/editar']}>
      <Routes>
        <Route path="/trabajo/animales/:animalId/editar" element={<FormularioCuyo />} />
      </Routes>
    </MemoryRouter>,
  );
}

const cuy = {
  id: 'a1',
  pozaId: 'p1',
  galponOrigenId: null,
  codigoIdentificacion: 'C-100',
  sexo: 'H' as const,
  fechaNacimiento: '2025-03-12',
  colorCodigo: null,
  ojosCodigo: null,
  pelajeOriginal: null,
  padreId: null,
  madreId: null,
  categoriaMl: 'ELITE' as const,
  ultimoPesoG: '950.50',
  estado: 'ACTIVO',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('formulario de animal', () => {
  beforeEach(() => {
    listPozas.mockReset().mockResolvedValue([{ id: 'p1', galponId: 'g1', codigo: 'P-1', tipo: 'cría' }]);
    listAllCuyes.mockReset().mockResolvedValue([]);
    getCuyo.mockReset().mockResolvedValue(cuy);
    createCuyo.mockReset();
    updateCuyo.mockReset();
  });

  it('no muestra campos editables para categoría ni último peso', async () => {
    renderNew();
    expect(await screen.findByText(/La categoría y el último peso son valores derivados/)).toBeInTheDocument();
    expect(screen.queryByText('Categoría')).toBeNull();
    expect(screen.queryByText('Último peso (g)')).toBeNull();
  });

  it('en edición no expone los valores derivados como campos editables', async () => {
    renderEdit();
    expect(await screen.findByText(/La categoría y el último peso son valores derivados/)).toBeInTheDocument();
    expect(screen.queryByText('Categoría')).toBeNull();
    expect(screen.queryByText('Último peso (g)')).toBeNull();
    expect(screen.queryByDisplayValue('ELITE')).toBeNull();
    expect(screen.queryByDisplayValue('950.50')).toBeNull();
  });
});
