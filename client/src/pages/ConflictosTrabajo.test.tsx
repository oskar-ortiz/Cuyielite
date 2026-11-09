import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConflictosTrabajo from './ConflictosTrabajo';

const { list, keepCentral, retry } = vi.hoisted(() => ({
  list: vi.fn(),
  keepCentral: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('../data/work.sync.conflict.repository', () => ({
  getConflictRepository: () => ({ list, keepCentral, retry }),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonHeader: ({ children }: any) => <header>{children}</header>,
  IonToolbar: ({ children }: any) => <div>{children}</div>,
  IonButtons: ({ children }: any) => <div>{children}</div>,
  IonBackButton: ({ text }: any) => <button>{text}</button>,
  IonTitle: ({ children }: any) => <h1>{children}</h1>,
  IonContent: ({ children }: any) => <main>{children}</main>,
  IonList: ({ children }: any) => <div>{children}</div>,
  IonItem: ({ children }: any) => <div>{children}</div>,
  IonLabel: ({ children }: any) => <div>{children}</div>,
  IonInput: ({ label, value, onIonInput }: any) => (
    <input
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onIonInput({ detail: { value: event.target.value } })}
    />
  ),
  IonButton: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  useIonViewWillEnter: vi.fn(),
}));

const review = {
  entity: 'galpon' as const,
  recordId: '11111111-1111-4111-8111-111111111111',
  conflictOperationId: '22222222-2222-4222-8222-222222222222',
  expectedHeadOperationId: '33333333-3333-4333-8333-333333333333',
  expectedServerVersion: '2',
};
const item = {
  review,
  local: { nombre: 'Galpón local', ubicacion: 'Lote local' },
  central: {
    id: review.recordId,
    version: '2',
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T11:00:00.000Z',
    deleted_at: null,
    last_client_edited_at: null,
    data: { nombre: 'Galpón central', ubicacion: 'Lote central' },
  },
};

describe('revisión de conflictos de trabajo', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue([item]);
    keepCentral.mockReset().mockResolvedValue({ operationId: null, discarded: 2 });
    retry.mockReset().mockResolvedValue({ operationId: '44444444-4444-4444-8444-444444444444', discarded: 2 });
  });

  it('compara las versiones y solo descarta cambios tras confirmación', async () => {
    render(<ConflictosTrabajo />);
    fireEvent.click(await screen.findByText('Revisar'));
    expect(screen.getByText(/servidor: Galpón central · dispositivo: Galpón local/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Conservar versión central'));
    expect(keepCentral).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirmar decisión'));
    await waitFor(() => expect(keepCentral).toHaveBeenCalledWith(review));
    expect(retry).not.toHaveBeenCalled();
  });

  it('permite revisar los valores antes de crear un reintento local', async () => {
    render(<ConflictosTrabajo />);
    fireEvent.click(await screen.findByText('Revisar'));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nombre revisado' } });
    fireEvent.click(screen.getByText('Reintentar cambio local'));
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Confirmar decisión'));
    await waitFor(() =>
      expect(retry).toHaveBeenCalledWith(review, {
        nombre: 'Nombre revisado',
        ubicacion: 'Lote local',
      }),
    );
  });

  it('ofrece solo conservar central si el registro fue eliminado en el servidor', async () => {
    list.mockResolvedValue([{ ...item, central: { ...item.central, deleted_at: '2026-11-06T12:00:00.000Z' } }]);
    render(<ConflictosTrabajo />);
    fireEvent.click(await screen.findByText('Revisar'));
    expect(screen.queryByText('Reintentar cambio local')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancelar'));
    expect(keepCentral).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });
});
