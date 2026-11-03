import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import CrearGalpon from './CrearGalpon';

describe('CrearGalpon', () => {
  it('renderiza el formulario de creación', () => {
    render(
      <MemoryRouter>
        <CrearGalpon />
      </MemoryRouter>,
    );
    expect(screen.getByText('Nuevo galpón')).toBeInTheDocument();
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });
});
