import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EditarGalpon from './EditarGalpon';

const { listGalpones, updateGalpon } = vi.hoisted(() => ({
  listGalpones: vi.fn(),
  updateGalpon: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonHeader: ({ children }: any) => <header>{children}</header>,
  IonToolbar: ({ children }: any) => <div>{children}</div>,
  IonTitle: ({ children }: any) => <h1>{children}</h1>,
  IonButtons: ({ children }: any) => <div>{children}</div>,
  IonBackButton: ({ text }: any) => <button>{text}</button>,
  IonContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  IonInput: ({ value, onIonInput, maxlength, label }: any) => (
    <input
      aria-label={label}
      value={value ?? ''}
      maxLength={maxlength}
      onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })}
    />
  ),
  IonTextarea: ({ value, onIonInput, maxlength, label }: any) => (
    <textarea
      aria-label={label}
      value={value ?? ''}
      maxLength={maxlength}
      onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })}
    />
  ),
  IonButton: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  useIonViewWillEnter: vi.fn(),
}));

vi.mock('../data/galpones.repository.factory', () => ({
  getGalponesRepository: () => ({
    listGalpones,
    listPozasByGalpon: vi.fn().mockResolvedValue([]),
    updateGalpon,
  }),
}));

const renderPage = (ruta: string) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/galpones/:id/editar" element={<EditarGalpon />} />
      </Routes>
    </MemoryRouter>,
  );

describe('EditarGalpon', () => {
  beforeEach(() => {
    listGalpones.mockReset();
    updateGalpon.mockReset();
  });

  it('precarga los valores actuales', async () => {
    listGalpones.mockResolvedValue([{ id: 'g1', nombre: 'Galpón Norte', ubicacion: 'Lote 1' }]);
    renderPage('/galpones/g1/editar');
    expect(await screen.findByDisplayValue('Galpón Norte')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lote 1')).toBeInTheDocument();
  });

  it('edita y guarda con los argumentos correctos', async () => {
    listGalpones.mockResolvedValue([{ id: 'g1', nombre: 'Galpón Norte', ubicacion: 'Lote 1' }]);
    updateGalpon.mockResolvedValue({ id: 'g1', nombre: 'Galpón Sur', ubicacion: 'Lote 2' });
    renderPage('/galpones/g1/editar');
    await screen.findByDisplayValue('Galpón Norte');
    fireEvent.change(screen.getByDisplayValue('Galpón Norte'), { target: { value: 'Galpón Sur' } });
    fireEvent.change(screen.getByDisplayValue('Lote 1'), { target: { value: 'Lote 2' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => {
      expect(updateGalpon).toHaveBeenCalledWith('g1', { nombre: 'Galpón Sur', ubicacion: 'Lote 2' });
    });
  });

  it('cancela sin escribir', async () => {
    listGalpones.mockResolvedValue([{ id: 'g1', nombre: 'Galpón Norte', ubicacion: 'Lote 1' }]);
    renderPage('/galpones/g1/editar');
    await screen.findByDisplayValue('Galpón Norte');
    fireEvent.click(screen.getByText('Cancelar'));
    expect(updateGalpon).not.toHaveBeenCalled();
  });

  it('guarda sin cambios sin llamar a update', async () => {
    listGalpones.mockResolvedValue([{ id: 'g1', nombre: 'Galpón Norte', ubicacion: 'Lote 1' }]);
    renderPage('/galpones/g1/editar');
    await screen.findByDisplayValue('Galpón Norte');
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => {
      expect(updateGalpon).not.toHaveBeenCalled();
    });
  });

  it('muestra error de guardado conservando los valores y permite reintentar', async () => {
    listGalpones.mockResolvedValue([{ id: 'g1', nombre: 'Galpón Norte', ubicacion: 'Lote 1' }]);
    updateGalpon.mockRejectedValueOnce(new Error('boom'));
    renderPage('/galpones/g1/editar');
    await screen.findByDisplayValue('Galpón Norte');
    fireEvent.change(screen.getByDisplayValue('Galpón Norte'), { target: { value: 'Galpón Sur' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Galpón Sur')).toBeInTheDocument();
    updateGalpon.mockResolvedValueOnce({ id: 'g1', nombre: 'Galpón Sur', ubicacion: 'Lote 1' });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => {
      expect(updateGalpon).toHaveBeenCalledTimes(2);
    });
  });

  it('muestra error para identificador inexistente', async () => {
    listGalpones.mockResolvedValue([]);
    renderPage('/galpones/zzz/editar');
    expect(await screen.findByText(/No existe un galpón/)).toBeInTheDocument();
  });
});
