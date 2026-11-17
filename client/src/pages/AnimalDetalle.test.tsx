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
  IonList: ({ children }: any) => <ul>{children}</ul>,
  IonIcon: ({ icon: _icon }: any) => <span data-icon={_icon} />,
  IonSpinner: () => <span>...</span>,
  IonChip: ({ children }: any) => <span>{children}</span>,
  IonLabel: ({ children }: any) => <span>{children}</span>,
  useIonViewWillEnter: () => undefined,
}));

vi.mock('../data/auth.session', () => ({
  snapshot: () => ({ canWrite: false, user: { username: 'consulta-lope', role: 'viewer' }, role: 'viewer' }),

  IonLabel: ({ children }: any) => <span>{children}</span>,
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
      caracter: null,
      motivos: ['dato faltante o inválido: abortos'],
      faltantes: ['abortos'],
      evidenciaPendiente: ['abortos'],
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

  it('presenta el descarte provisional como propuesta y no como decisión', async () => {
    mocks.categoria.mockResolvedValue({
      cuyId: CUY,
      version: '3',
      clase: 'DESCARTE',
      estadoEvaluacion: 'PROVISIONAL',
      categoriaEstado: 'HISTORICA',
      caracter: 'PROPUESTO',
      motivos: ['problema repetido (se dejó un parto más)'],
      faltantes: [],
      evidenciaPendiente: [],
      reglasVersion: 'adr0004+reglas-2026-11-16+oficial-1',
      evaluadaAt: '2026-11-16T10:00:00Z',
      procedencia: { fuente: 'CENTRAL+EVIDENCIA_REVISADA' },
    });
    mocks.alertas.mockResolvedValue([]);

    render(<AnimalDetalle />);
    await waitFor(() => expect(screen.getByText(/Propuesta pendiente de validación/i)).toBeTruthy());
    expect(screen.getByText(/Resultado provisional/i)).toBeTruthy();
    expect(screen.getByText(/No reemplaza la categoría anterior ni genera una alerta oficial/i)).toBeTruthy();
    expect(screen.getByText(/Sin recomendaciones sincronizadas/i)).toBeTruthy();
  });

  it('avisa cuando falta la fecha del cuarto parto sin inventar vencimiento', async () => {
    mocks.categoria.mockResolvedValue({
      cuyId: CUY,
      version: '4',
      clase: 'DESCARTE',
      estadoEvaluacion: 'DEFINITIVA',
      categoriaEstado: 'DEFINITIVA',
      caracter: 'CONFIRMADO',
      motivos: ['ciclo completo'],
      faltantes: [],
      evidenciaPendiente: [],
      reglasVersion: 'adr0004+reglas-2026-11-16+oficial-1',
      evaluadaAt: '2026-11-16T10:00:00Z',
      procedencia: { fuente: 'CENTRAL+EVIDENCIA_REVISADA' },
    });
    mocks.alertas.mockResolvedValue([
      {
        id: '44444444-4444-4444-8444-444444444444',
        cuyId: CUY,
        version: '1',
        estado: 'activa',
        reglaId: 'partos_reproductora_descarte',
        motivo: 'ciclo completo',
        causaTipo: 'PARTO',
        causaId: '55555555-5555-4555-8555-555555555555',
        causaFecha: null,
        fechaLimite: null,
      },
    ]);

    render(<AnimalDetalle />);
    await waitFor(() => expect(screen.getByText(/Descarte recomendado/i)).toBeTruthy());
    expect(screen.getByText(/Fecha del cuarto parto pendiente de validar/i)).toBeTruthy();
    expect(screen.queryByText(/Fecha límite sugerida/i)).toBeNull();
    expect(screen.getByText(/Confirmada/)).toBeTruthy();
  });

  it('muestra la evidencia pendiente como bloqueo de la categoría oficial', async () => {
    mocks.categoria.mockResolvedValue({
      cuyId: CUY,
      version: '5',
      clase: null,
      estadoEvaluacion: 'EVIDENCIA_NO_VALIDADA',
      categoriaEstado: null,
      caracter: null,
      motivos: ['sin criterio de descarte'],
      faltantes: [],
      evidenciaPendiente: ['abortos', 'peso_monta_g'],
      reglasVersion: 'adr0004+reglas-2026-11-16+oficial-1',
      evaluadaAt: null,
      procedencia: { fuente: 'CENTRAL+EVIDENCIA_REVISADA' },
    });
    mocks.alertas.mockResolvedValue([]);

    render(<AnimalDetalle />);
    await waitFor(() => expect(screen.getByText(/Evidencia sin revisar/i)).toBeTruthy());
    expect(screen.getByText(/Evidencia pendiente de revisión: abortos, peso_monta_g/i)).toBeTruthy();
    expect(screen.getByText(/No se guardó como categoría oficial/i)).toBeTruthy();
  });
});
