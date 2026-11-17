import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Animales from './Animales';

const { listCuyesByPoza, status } = vi.hoisted(() => ({
  listCuyesByPoza: vi.fn(),
  status: vi.fn(),
}));

vi.mock('../data/work.domain.factory', () => ({
  getDomainRepository: () => ({ listCuyesByPoza }),
}));

vi.mock('../data/work.sync.repository', () => ({
  getWorkSyncRepository: () => ({ status }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/trabajo/galpones/g1/pozas/p1/animales']}>
      <Routes>
        <Route path="/trabajo/galpones/:galponId/pozas/:pozaId/animales" element={<Animales mode="trabajo" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Animales de trabajo', () => {
  beforeEach(() => {
    listCuyesByPoza.mockReset();
    status.mockReset().mockResolvedValue({ pending: 0, prepared: 0, conflicts: 0 });
  });

  it('muestra estado vacío cuando la poza no tiene animales', async () => {
    listCuyesByPoza.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/todavía no tiene animales/)).toBeInTheDocument();
  });

  it('lista animales con chapa y estado de sincronización pendiente', async () => {
    listCuyesByPoza.mockResolvedValue([
      {
        id: 'a1',
        pozaId: 'p1',
        galponOrigenId: null,
        codigoIdentificacion: 'C-100',
        sexo: 'H',
        fechaNacimiento: '2025-03-12',
        colorCodigo: null,
        ojosCodigo: null,
        pelajeOriginal: null,
        padreId: null,
        madreId: null,
        categoriaMl: null,
        ultimoPesoG: '950.50',
        estado: 'ACTIVO',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
    status.mockResolvedValue({ pending: 2, prepared: 0, conflicts: 1 });
    renderPage();
    expect(await screen.findByText('C-100')).toBeInTheDocument();
    expect(screen.getByText(/2 cambios pendientes/)).toBeInTheDocument();
    expect(screen.getByText('1 conflicto')).toBeInTheDocument();
  });

  it('muestra error de lectura sin perder la pantalla', async () => {
    listCuyesByPoza.mockRejectedValue(new Error('base no disponible'));
    renderPage();
    expect(await screen.findByText(/Error al cargar animales/)).toBeInTheDocument();
  });
});
