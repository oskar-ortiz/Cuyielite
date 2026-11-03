import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import CrearPoza from './CrearPoza';

describe('CrearPoza', () => {
  it('renderiza el formulario de creación', () => {
    render(
      <MemoryRouter initialEntries={['/galpones/g1/pozas/nueva']}>
        <Routes>
          <Route path="/galpones/:id/pozas/nueva" element={<CrearPoza />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Nueva poza')).toBeInTheDocument();
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });
});
