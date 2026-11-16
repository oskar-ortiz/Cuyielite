import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AnimalDetalle from './AnimalDetalle';

const CUY = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  categoria: vi.fn(),
  alertas: vi.fn(),
  status: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ animalId: '11111111-1111-4111-8111-111111111111' }),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonHeader: ({ children }: any) => <header>{children}</header>,
  IonToolbar: ({ children }: any) => <div>{children}</div>,
  IonTitle: ({ children }: any) => <h1>{children}</h1>,
  IonContent: ({ children }: any) => <main>{children}</main>,
  IonButtons: ({ children }: any) => <div>{children}</div>,
  IonButton: ({ children }: any) => <button type="button">{children}</button>,
  IonBackButton: () => null,
  IonItem: ({ children }: any) => <li>{children}</li>,
  IonLabel: ({ children }: any) => <span>{children}</span>,
  IonList: ({ children }: any) => <ul>{children}</ul>,
  IonChip: ({ children }: any) => <span>{children}</span>,
  useIonViewWillEnter: () => undefined,
}));

vi.mock('../data/auth.session', () => ({
  snapshot: () => ({ canWrite: false, user: { username: 'consulta-lope', role: 'viewer' }, role: 'viewer' }),
}));

vi.mock('../data/work.domain.factory', () => ({
  getDomainRepository: () => ({
    getCuyo: async () => ({
      id: CUY,
      codigoIdentificacion: 'H-001',
      sexo: 'H',
      fechaNacimiento: '2025-01-10',
      estado: 'ACTIVO',
      pozaId: null,
      padreId: null,
      madreId: null,
      ultimoPesoG: null,
      categoriaMl: null,
    }),
    listAllCuyes: async () => [],
    listPartosByCuyo: async () => [],
    listPesajesByCuyo: async () => [],
    listEventosByCuyo: async () => [],
    listVinculosByCuyo: async () => [],
    listPozas: async () => [],
    listConflictKeys: async () => [],
  }),
}));

vi.mock('../data/work.sync.repository', () => ({
  getWorkSyncRepository: () => ({ status: mocks.status }),
}));

vi.mock('../data/work.derived.repository', () => ({
  getDerivedReader: () => ({ categoria: mocks.categoria, alertas: mocks.alertas }),
}));

describe('ficha de animal con evaluación derivada', () => {
  beforeEach(() => {
    mocks.status.mockResolvedValue({ pending: 0 });
    mocks.categoria.mockResolvedValue({
      cuyId: CUY,
      version: '1',
      clase: null,
      estadoEvaluacion: 'DATOS_INSUFICIENTES',
      categoriaEstado: 'HISTORICA',
      motivos: ['dato faltante o inválido: abortos'],
      faltantes: ['abortos'],
      reglasVersion: 'adr0004+reglas-2026-11-16',
      evaluadaAt: null,
      procedencia: { fuente: 'CENTRAL' },
    });
    mocks.alertas.mockResolvedValue([
      {
        id: '22222222-2222-4222-8222-222222222222',
        cuyId: CUY,
        version: '2',
        estado: 'obsoleta',
        reglaId: 'partos_reproductora_descarte',
        motivo: 'ciclo completo',
        causaTipo: 'PARTO',
        causaId: null,
        causaFecha: '2026-01-10',
        fechaLimite: null,
      },
    ]);
  });

  it('muestra faltantes como datos insuficientes y no como NORMAL', async () => {
    render(<AnimalDetalle />);
    await waitFor(() => expect(screen.getByText(/Datos insuficientes/i)).toBeTruthy());
    expect(screen.getByText(/Sin clase definitiva/i)).toBeTruthy();
    expect(screen.getByText(/Faltan datos: abortos/i)).toBeTruthy();
    expect(screen.queryByText(/^NORMAL$/)).toBeNull();
  });

  it('presenta la alerta como recomendación histórica que no ejecuta el descarte', async () => {
    render(<AnimalDetalle />);
    await waitFor(() => expect(screen.getByText(/Recomendación obsoleta/i)).toBeTruthy());
    expect(screen.getByText(/no ejecuta el descarte del animal/i)).toBeTruthy();
    expect(screen.getByText(/ciclo completo/)).toBeTruthy();
  });

  it('el viewer no ve acciones de escritura', async () => {
    render(<AnimalDetalle />);
    await waitFor(() => expect(screen.getByText(/Evaluación del servidor/i)).toBeTruthy());
    expect(screen.queryByText(/Registrar parto/i)).toBeNull();
    expect(screen.queryByText(/Registrar pesaje/i)).toBeNull();
  });
});
