import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkSyncStatus } from '../data/work.sync.status';

import SincronizacionTrabajo from './SincronizacionTrabajo';

const { status, run } = vi.hoisted(() => ({
  status: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../data/work.sync.repository', () => ({
  getWorkSyncRepository: () => ({ status, run }),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonHeader: ({ children }: any) => <header>{children}</header>,
  IonToolbar: ({ children }: any) => <div>{children}</div>,
  IonButtons: ({ children }: any) => <div>{children}</div>,
  IonBackButton: ({ text }: any) => <button>{text}</button>,
  IonTitle: ({ children }: any) => <h1>{children}</h1>,
  IonContent: ({ children }: any) => <main>{children}</main>,
  IonChip: ({ children }: any) => <span>{children}</span>,
  IonSpinner: () => <span aria-hidden="true" />,
  IonList: ({ children }: any) => <div>{children}</div>,
  IonItem: ({ children, routerLink }: any) => <a href={routerLink}>{children}</a>,
  IonLabel: ({ children }: any) => <div>{children}</div>,
  IonInput: ({ label, value, onIonInput, disabled }: any) => (
    <input
      aria-label={label}
      type="password"
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onIonInput({ detail: { value: event.target.value } })}
    />
  ),
  IonButton: ({ children, onClick, disabled, routerLink }: any) =>
    routerLink ? (
      <a href={routerLink}>{children}</a>
    ) : (
      <button onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
  useIonViewWillEnter: vi.fn(),
}));

const TOKEN = 'lab-token-sintetico-abcdefghijklmnopqrstuvwxyz';

function state(overrides: Partial<WorkSyncStatus> = {}): WorkSyncStatus {
  return { scopeId: null, cursor: null, pending: 0, prepared: 0, conflicts: 0, rejected: 0, ...overrides };
}

describe('pantalla de sincronización de trabajo', () => {
  beforeEach(() => {
    status.mockReset().mockResolvedValue(state());
    run.mockReset().mockResolvedValue({ appliedRemoteRecords: 0, pushedResults: 0 });
  });

  it('muestra el estado sin sincronizar y exige un token antes de enviar', async () => {
    render(<SincronizacionTrabajo />);
    expect(await screen.findByText('Sin sincronizar.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Sincronizar' });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(run).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Ingresa el token de laboratorio para habilitar la sincronización.'),
    ).toBeInTheDocument();
  });

  it('sincroniza desde la acción del usuario y muestra el resultado', async () => {
    status
      .mockResolvedValueOnce(state({ pending: 2 }))
      .mockResolvedValueOnce(state({ scopeId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }));
    run.mockResolvedValue({ appliedRemoteRecords: 1, pushedResults: 2 });

    render(<SincronizacionTrabajo />);
    expect(await screen.findByText('Cambios pendientes.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Token de laboratorio'), { target: { value: TOKEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' }));

    await waitFor(() => expect(run).toHaveBeenCalledWith(TOKEN));
    expect(await screen.findByText('Sincronización completada.')).toBeInTheDocument();
    expect(screen.getByText('Se recibieron 1 registro(s) y se enviaron 2 cambio(s).')).toBeInTheDocument();
    expect(screen.getByText('Galpones de trabajo')).toBeInTheDocument();
  });

  it('mantiene el uso local y ofrece reintentar tras un fallo de conexión', async () => {
    run.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce({
      appliedRemoteRecords: 0,
      pushedResults: 0,
    });

    render(<SincronizacionTrabajo />);
    await screen.findByText('Sin sincronizar.');
    fireEvent.change(screen.getByLabelText('Token de laboratorio'), { target: { value: TOKEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' }));

    expect(await screen.findByText('Sin conexión.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Galpones de trabajo/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  });

  it('expone los conflictos y enlaza a su revisión sin resolverlos automáticamente', async () => {
    status.mockResolvedValue(state({ scopeId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', conflicts: 1, pending: 1 }));

    render(<SincronizacionTrabajo />);
    expect(await screen.findByText('Conflictos pendientes.')).toBeInTheDocument();
    expect(
      screen.getByText('Hay 1 conflicto pendiente. Los cambios locales se conservan hasta que decidas.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revisar conflictos' })).toHaveAttribute('href', '/trabajo/conflictos');
  });

  it('no duplica el envío mientras la sincronización está en curso', async () => {
    let finish!: (value: { appliedRemoteRecords: number; pushedResults: number }) => void;
    run.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    render(<SincronizacionTrabajo />);
    await screen.findByText('Sin sincronizar.');
    fireEvent.change(screen.getByLabelText('Token de laboratorio'), { target: { value: TOKEN } });
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Sincronizando/ })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Sincronizando/ }));
    expect(run).toHaveBeenCalledTimes(1);

    finish({ appliedRemoteRecords: 0, pushedResults: 0 });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sincronizar' })).toBeInTheDocument());
  });

  it('informa si no puede leer el estado local', async () => {
    status.mockRejectedValue(new Error('boom'));
    render(<SincronizacionTrabajo />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo leer el estado local de sincronización.');
  });
});
