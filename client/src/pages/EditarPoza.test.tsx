import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EditarPoza from './EditarPoza';

const { listPozasByGalpon, updatePoza } = vi.hoisted(() => ({
  listPozasByGalpon: vi.fn(),
  updatePoza: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonHeader: ({ children }: any) => <header>{children}</header>,
  IonToolbar: ({ children }: any) => <div>{children}</div>,
  IonTitle: ({ children }: any) => <h1>{children}</h1>,
  IonButtons: ({ children }: any) => <div>{children}</div>,
  IonBackButton: ({ text }: any) => <button>{text}</button>,
  IonContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  IonInput: ({ value, onIonInput, maxlength, label, type }: any) => (
    <input
      aria-label={label}
      value={value ?? ''}
      maxLength={maxlength}
      type={type || 'text'}
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
    listGalpones: vi.fn().mockResolvedValue([]),
    listPozasByGalpon,
    updatePoza,
  }),
}));

const renderPage = (ruta: string) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/galpones/:id/pozas/:pozaId/editar" element={<EditarPoza />} />
      </Routes>
    </MemoryRouter>,
  );

describe('EditarPoza', () => {
  beforeEach(() => {
    listPozasByGalpon.mockReset();
    updatePoza.mockReset();
  });

  it('precarga los valores actuales', async () => {
    listPozasByGalpon.mockResolvedValue([
      { id: 'p1', galponId: 'g1', codigo: 'P-101', tipo: 'cría', capacidadMaxima: 50 },
    ]);
    renderPage('/galpones/g1/pozas/p1/editar');
    expect(await screen.findByDisplayValue('P-101')).toBeInTheDocument();
    expect(screen.getByDisplayValue('cría')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
  });

  it('edita y guarda con los argumentos correctos', async () => {
    listPozasByGalpon.mockResolvedValue([
      { id: 'p1', galponId: 'g1', codigo: 'P-101', tipo: 'cría', capacidadMaxima: 50 },
    ]);
    updatePoza.mockResolvedValue({ id: 'p1', galponId: 'g1', codigo: 'P-202', tipo: 'engorde', capacidadMaxima: 80 });
    renderPage('/galpones/g1/pozas/p1/editar');
    await screen.findByDisplayValue('P-101');
    fireEvent.change(screen.getByDisplayValue('P-101'), { target: { value: 'P-202' } });
    fireEvent.change(screen.getByDisplayValue('cría'), { target: { value: 'engorde' } });
    fireEvent.change(screen.getByDisplayValue('50'), { target: { value: '80' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => {
      expect(updatePoza).toHaveBeenCalledWith('g1', 'p1', { codigo: 'P-202', tipo: 'engorde', capacidadMaxima: 80 });
    });
  });

  it('cancela sin escribir', async () => {
    listPozasByGalpon.mockResolvedValue([
      { id: 'p1', galponId: 'g1', codigo: 'P-101', tipo: 'cría', capacidadMaxima: 50 },
    ]);
    renderPage('/galpones/g1/pozas/p1/editar');
    await screen.findByDisplayValue('P-101');
    fireEvent.click(screen.getByText('Cancelar'));
    expect(updatePoza).not.toHaveBeenCalled();
  });

  it('guarda sin cambios sin llamar a update', async () => {
    listPozasByGalpon.mockResolvedValue([
      { id: 'p1', galponId: 'g1', codigo: 'P-101', tipo: 'cría', capacidadMaxima: 50 },
    ]);
    renderPage('/galpones/g1/pozas/p1/editar');
    await screen.findByDisplayValue('P-101');
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => {
      expect(updatePoza).not.toHaveBeenCalled();
    });
  });

  it('muestra error de guardado conservando los valores y permite reintentar', async () => {
    listPozasByGalpon.mockResolvedValue([
      { id: 'p1', galponId: 'g1', codigo: 'P-101', tipo: 'cría', capacidadMaxima: 50 },
    ]);
    updatePoza.mockRejectedValueOnce(new Error('boom'));
    renderPage('/galpones/g1/pozas/p1/editar');
    await screen.findByDisplayValue('P-101');
    fireEvent.change(screen.getByDisplayValue('P-101'), { target: { value: 'P-202' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('P-202')).toBeInTheDocument();
    updatePoza.mockResolvedValueOnce({ id: 'p1', galponId: 'g1', codigo: 'P-202', tipo: 'cría', capacidadMaxima: 50 });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => {
      expect(updatePoza).toHaveBeenCalledTimes(2);
    });
  });

  it('muestra error para poza inexistente', async () => {
    listPozasByGalpon.mockResolvedValue([]);
    renderPage('/galpones/g1/pozas/zzz/editar');
    expect(await screen.findByText(/No existe una poza/)).toBeInTheDocument();
  });
});
