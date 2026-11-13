import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConflictosTrabajo from './ConflictosTrabajo';

const { list, keepCentral, retry, params } = vi.hoisted(() => ({
  list: vi.fn(),
  keepCentral: vi.fn(),
  retry: vi.fn(),
  params: { entity: undefined as string | undefined, recordId: undefined as string | undefined },
}));

vi.mock('../data/work.sync.conflict.repository', () => ({
  getConflictRepository: () => ({ list, keepCentral, retry }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => params,
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
  IonList: ({ children }: any) => <div>{children}</div>,
  IonItem: ({ children }: any) => <div>{children}</div>,
  IonLabel: ({ children }: any) => <div>{children}</div>,
  IonSelect: ({ label, value, onIonChange, children }: any) => (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onIonChange({ detail: { value: event.target.value } })}
    >
      {children}
    </select>
  ),
  IonSelectOption: ({ value, children }: any) => <option value={value}>{children}</option>,
  IonTextarea: ({ label, value, onIonInput }: any) => (
    <textarea
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onIonInput({ detail: { value: event.target.value } })}
    />
  ),
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
  summary: 'Galpón central · 11111111',
  references: { galpones: [], pozas: [], cuyes: [], partos: [], eventos: [] },
  missingServerFields: [],
};

const pesajeReview = {
  entity: 'pesajes' as const,
  recordId: '55555555-5555-4555-8555-555555555555',
  conflictOperationId: '66666666-6666-4666-8666-666666666666',
  expectedHeadOperationId: '77777777-7777-4777-8777-777777777777',
  expectedServerVersion: '4',
};
const pesajeItem = {
  review: pesajeReview,
  local: {
    cuy_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    fecha_pesaje: '2026-02-01',
    peso_gramos: '1234.50',
    etapa: 'DESTETE',
    parto_id: null,
    evento_id: null,
  },
  central: {
    id: pesajeReview.recordId,
    version: '4',
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T11:00:00.000Z',
    deleted_at: null,
    last_client_edited_at: null,
    data: {
      cuy_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      fecha_pesaje: '2026-02-02',
      peso_gramos: '1200.00',
      etapa: 'DESTETE',
      parto_id: null,
      evento_id: null,
    },
  },
  summary: 'Pesaje 1234.50 g · 01/02/2026',
  references: {
    galpones: [],
    pozas: [],
    cuyes: [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', label: 'C-AND-V2 · aaaaaaaa' },
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', label: 'C-AND-V2 · bbbbbbbb' },
    ],
    partos: [],
    eventos: [],
  },
  missingServerFields: [],
};

describe('revisión de conflictos de trabajo', () => {
  beforeEach(() => {
    params.entity = undefined;
    params.recordId = undefined;
    list.mockReset().mockResolvedValue([item]);
    keepCentral.mockReset().mockResolvedValue({ operationId: null, discarded: 2 });
    retry.mockReset().mockResolvedValue({ operationId: '44444444-4444-4444-8444-444444444444', discarded: 2 });
  });

  it('compara las versiones y solo descarta cambios tras confirmación', async () => {
    render(<ConflictosTrabajo />);
    fireEvent.click(await screen.findByText('Revisar'));
    expect(screen.getByText(/Servidor: Galpón central/)).toBeInTheDocument();
    expect(screen.getByText(/Dispositivo: Galpón local/)).toBeInTheDocument();
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

  it('abre desde la ficha y muestra referencias sin confundir chapas repetidas', async () => {
    params.entity = 'pesajes';
    params.recordId = pesajeReview.recordId;
    list.mockResolvedValue([pesajeItem]);
    render(<ConflictosTrabajo />);
    expect(await screen.findByText('Pesaje 1234.50 g · 01/02/2026')).toBeInTheDocument();
    expect(screen.getByText(/Servidor: C-AND-V2 · bbbbbbbb/)).toBeInTheDocument();
    expect(screen.getByText(/Dispositivo: C-AND-V2 · aaaaaaaa/)).toBeInTheDocument();
    expect(screen.getByText(/Servidor: 1200.00 g/)).toBeInTheDocument();
    expect(screen.getByText(/Dispositivo: 1234.50 g/)).toBeInTheDocument();
    expect(screen.getAllByText(/Sin dato/).length).toBeGreaterThan(0);
  });

  it('cancela la revisión sin resolver ni perder la lista', async () => {
    render(<ConflictosTrabajo />);
    fireEvent.click(await screen.findByText('Revisar'));
    fireEvent.click(screen.getByText('Cancelar'));
    expect(keepCentral).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(screen.queryByText('Comparar Galpón central · 11111111')).not.toBeInTheDocument();
    expect(screen.getByText('Revisar')).toBeInTheDocument();
  });

  it('evita el doble envío y muestra el fallo de red sin cerrar la revisión', async () => {
    let rejectRetry: (error: Error) => void = () => undefined;
    retry.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRetry = reject;
        }),
    );
    render(<ConflictosTrabajo />);
    fireEvent.click(await screen.findByText('Revisar'));
    fireEvent.click(screen.getByText('Reintentar cambio local'));
    const confirmButton = screen.getByText('Confirmar decisión');
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    expect(retry).toHaveBeenCalledTimes(1);
    rejectRetry(new Error('Sin conexión con el servidor'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión con el servidor');
    expect(screen.getByText('Revisar')).toBeInTheDocument();
  });
});
