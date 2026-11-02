import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import Galpones from './Galpones';

describe('Galpones', () => {
  it('muestra todos los galpones de demostración con su marcado', () => {
    render(
      <MemoryRouter>
        <Galpones />
      </MemoryRouter>,
    );

    expect(screen.getByText('Galpón Norte')).toBeInTheDocument();
    expect(screen.getByText('Galpón Sur')).toBeInTheDocument();
    expect(screen.getByText('Galpón Occidente')).toBeInTheDocument();
    expect(screen.getByText('Galpón Este')).toBeInTheDocument();
    expect(screen.getByText('Datos de demostración')).toBeInTheDocument();
  });
});
