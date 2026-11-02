import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import GalponDetalle from './GalponDetalle';

const renderDetalle = (ruta: string) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/galpones/:id" element={<GalponDetalle />} />
      </Routes>
    </MemoryRouter>,
  );

describe('GalponDetalle', () => {
  it('muestra solo las pozas del galpón seleccionado', () => {
    renderDetalle('/galpones/00000000-0000-4000-8000-000000000001');

    expect(screen.getByText('P-101')).toBeInTheDocument();
    expect(screen.getByText('P-102')).toBeInTheDocument();
    expect(screen.getByText('P-103')).toBeInTheDocument();
    expect(screen.queryByText('P-201')).not.toBeInTheDocument();
  });

  it('muestra el estado vacío cuando el galpón no tiene pozas', () => {
    renderDetalle('/galpones/00000000-0000-4000-8000-000000000004');

    expect(screen.getByText(/todavía no tiene pozas/)).toBeInTheDocument();
  });

  it('muestra el mensaje para un identificador inexistente', () => {
    renderDetalle('/galpones/00000000-0000-4000-8000-ffffffffffff');

    expect(screen.getByText(/No existe un galpón/)).toBeInTheDocument();
  });
});
