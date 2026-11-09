import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CrearGalpon from './CrearGalpon';

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
  IonInput: ({ value, onIonInput, label, maxlength }: any) => (
    <input
      aria-label={label}
      value={value ?? ''}
      maxLength={maxlength}
      onChange={(event) => onIonInput?.({ detail: { value: event.target.value } })}
    />
  ),
  IonTextarea: ({ value, onIonInput, label, maxlength }: any) => (
    <textarea
      aria-label={label}
      value={value ?? ''}
      maxLength={maxlength}
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
  getGalponesRepository: () => ({ createGalpon: demoCreate }),
}));

vi.mock('../data/work.galpones.repository', () => ({
  getWorkGalponesRepository: () => ({ createGalpon: workCreate }),
}));

const renderPage = (mode: 'demo' | 'trabajo') =>
  render(
    <MemoryRouter initialEntries={[mode === 'trabajo' ? '/trabajo/galpones/nuevo' : '/galpones/nuevo']}>
      <Routes>
        <Route
          path={mode === 'trabajo' ? '/trabajo/galpones/nuevo' : '/galpones/nuevo'}
          element={<CrearGalpon mode={mode} />}
        />
        <Route path={mode === 'trabajo' ? '/trabajo/galpones' : '/galpones'} element={<div>listado</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('CrearGalpon', () => {
  beforeEach(() => {
    demoCreate.mockReset().mockResolvedValue({ id: 'g1', nombre: 'Nuevo', ubicacion: null });
    workCreate.mockReset().mockResolvedValue({ id: 'g2', nombre: 'Nuevo', ubicacion: 'Lote' });
  });

  it('en demostración guarda en el repositorio de demostración', async () => {
    renderPage('demo');
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Galpón demo' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => expect(demoCreate).toHaveBeenCalledWith({ nombre: 'Galpón demo', ubicacion: null }));
    expect(workCreate).not.toHaveBeenCalled();
    expect(await screen.findByText('listado')).toBeInTheDocument();
  });

  it('en trabajo guarda por la outbox de trabajo y vuelve al listado de trabajo', async () => {
    renderPage('trabajo');
    expect(screen.getByText('Nuevo galpón · Trabajo')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Galpón trabajo' } });
    fireEvent.change(screen.getByLabelText('Ubicación (opcional)'), { target: { value: 'Lote 7' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => expect(workCreate).toHaveBeenCalledWith({ nombre: 'Galpón trabajo', ubicacion: 'Lote 7' }));
    expect(demoCreate).not.toHaveBeenCalled();
    expect(await screen.findByText('listado')).toBeInTheDocument();
  });

  it('no envía un galpón inválido', async () => {
    renderPage('trabajo');
    fireEvent.click(screen.getByText('Guardar'));
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(workCreate).not.toHaveBeenCalled();
  });
});
