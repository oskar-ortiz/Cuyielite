import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CrearPoza from './CrearPoza';

const { demoCreate, workCreate } = vi.hoisted(() => ({
  demoCreate: vi.fn(),
  workCreate: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonHeader: ({ children }: any) => <header>{children}</header>,
  IonToolbar: ({ children }: any) => <div>{children}</div>,
  IonTitle: ({ children }: any) => <h1>{children}</h1>,
  IonButtons: ({ children }: any) => <div>{children}</div>,
  IonBackButton: ({ text }: any) => <button>{text}</button>,
  IonContent: ({ children }: any) => <div>{children}</div>,
  IonInput: ({ value, onIonInput, label, maxlength, type }: any) => (
    <input
      aria-label={label}
      value={value ?? ''}
      maxLength={maxlength}
      type={type || 'text'}
      onChange={(event) => onIonInput?.({ detail: { value: event.target.value } })}
    />
  ),
  IonButton: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../data/galpones.repository.factory', () => ({
  getGalponesRepository: () => ({ createPoza: demoCreate }),
}));

vi.mock('../data/work.galpones.repository', () => ({
  getWorkGalponesRepository: () => ({ createPoza: workCreate }),
}));

const renderPage = (mode: 'demo' | 'trabajo') =>
  render(
    <MemoryRouter
      initialEntries={[mode === 'trabajo' ? '/trabajo/galpones/g1/pozas/nueva' : '/galpones/g1/pozas/nueva']}
    >
      <Routes>
        <Route
          path={mode === 'trabajo' ? '/trabajo/galpones/:id/pozas/nueva' : '/galpones/:id/pozas/nueva'}
          element={<CrearPoza mode={mode} />}
        />
        <Route path={mode === 'trabajo' ? '/trabajo/galpones/:id' : '/galpones/:id'} element={<div>detalle</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('CrearPoza', () => {
  beforeEach(() => {
    demoCreate.mockReset().mockResolvedValue({ id: 'p1', galponId: 'g1' });
    workCreate.mockReset().mockResolvedValue({ id: 'p2', galponId: 'g1' });
  });

  it('en trabajo guarda la poza en la outbox y vuelve al detalle de trabajo', async () => {
    renderPage('trabajo');
    expect(screen.getByText('Nueva poza · Trabajo')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'P-9' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Engorde' } });
    fireEvent.change(screen.getByLabelText('Capacidad máxima'), { target: { value: '25' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(workCreate).toHaveBeenCalledWith({
        galponId: 'g1',
        codigo: 'P-9',
        tipo: 'Engorde',
        capacidadMaxima: 25,
      }),
    );
    expect(demoCreate).not.toHaveBeenCalled();
    expect(await screen.findByText('detalle')).toBeInTheDocument();
  });

  it('en demostración usa el repositorio de demostración', async () => {
    renderPage('demo');
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'P-1' } });
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'Cría' } });
    fireEvent.change(screen.getByLabelText('Capacidad máxima'), { target: { value: '10' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => expect(demoCreate).toHaveBeenCalled());
    expect(workCreate).not.toHaveBeenCalled();
  });

  it('no envía una poza inválida', async () => {
    renderPage('trabajo');
    fireEvent.change(screen.getByLabelText('Capacidad máxima'), { target: { value: '-1' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(await screen.findByText('El código es obligatorio')).toBeInTheDocument();
    expect(workCreate).not.toHaveBeenCalled();
  });
});
