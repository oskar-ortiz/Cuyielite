import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { predictionErrorMessage } from '../data/ml.errors';

import PrediccionesAnimal from './PrediccionesAnimal';

const { predictHembra, predictCandidata, assistantQuery, getCuyo } = vi.hoisted(() => ({
  predictHembra: vi.fn(),
  predictCandidata: vi.fn(),
  assistantQuery: vi.fn(),
  getCuyo: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonHeader: ({ children }: any) => <header>{children}</header>,
  IonToolbar: ({ children }: any) => <div>{children}</div>,
  IonTitle: ({ children }: any) => <h1>{children}</h1>,
  IonButtons: ({ children }: any) => <div>{children}</div>,
  IonBackButton: ({ text }: any) => <button>{text}</button>,
  IonContent: ({ children }: any) => <div>{children}</div>,
  IonInput: ({ value, onIonInput, label, inputmode }: any) => (
    <input
      aria-label={label}
      inputMode={inputmode}
      value={value ?? ''}
      onChange={(event) => onIonInput?.({ detail: { value: event.target.value } })}
    />
  ),
  IonSelect: ({ value, onIonChange, label, children }: any) => (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onIonChange?.({ detail: { value: event.target.value } })}
    >
      {children}
    </select>
  ),
  IonSelectOption: ({ value, children }: any) => <option value={value}>{children}</option>,
  IonButton: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  IonCard: ({ children }: any) => <div>{children}</div>,
  IonCardHeader: ({ children }: any) => <div>{children}</div>,
  IonCardTitle: ({ children }: any) => <h2>{children}</h2>,
  IonCardContent: ({ children }: any) => <div>{children}</div>,
  IonChip: ({ children }: any) => <span>{children}</span>,
  IonList: ({ children }: any) => <div>{children}</div>,
  IonItem: ({ children }: any) => <div>{children}</div>,
  IonLabel: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('../data/ml.transport', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('../data/ml.transport')>();
  return { ...actual, getMlTransport: () => ({ predictHembra, predictCandidata, assistantQuery }) };
});

vi.mock('../data/work.domain.factory', () => ({
  getDomainRepository: () => ({ getCuyo }),
}));

function renderPage(animalId = 'a1') {
  return render(
    <MemoryRouter initialEntries={[`/trabajo/animales/${animalId}/predicciones`]}>
      <Routes>
        <Route path="/trabajo/animales/:animalId/predicciones" element={<PrediccionesAnimal />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setToken() {
  fireEvent.change(screen.getByLabelText('Token de laboratorio'), { target: { value: 'x'.repeat(40) } });
}

describe('Predicciones del animal', () => {
  beforeEach(() => {
    predictHembra.mockReset();
    predictCandidata.mockReset();
    getCuyo.mockReset().mockResolvedValue({
      id: 'a1',
      pozaId: 'p1',
      galponOrigenId: null,
      codigoIdentificacion: 'C-1',
      sexo: 'H',
      fechaNacimiento: '2025-03-12',
      colorCodigo: null,
      ojosCodigo: null,
      pelajeOriginal: null,
      padreId: null,
      madreId: null,
      categoriaMl: null,
      ultimoPesoG: null,
      estado: 'ACTIVO',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('muestra REVISAR y ausencia de apoyo sin inventar probabilidades', async () => {
    predictCandidata.mockResolvedValue({
      cuy_id: 'a1',
      clase: 'NORMAL',
      motivos: ['dato faltante: dias_destete'],
      estado_calidad: 'REVISAR',
      apoyo_modelo: null,
    });
    renderPage();
    expect(await screen.findByText('Candidata')).toBeInTheDocument();
    setToken();
    fireEvent.click(screen.getByText('Evaluar candidata'));
    expect(await screen.findByText(/Calidad: REVISAR/)).toBeInTheDocument();
    expect(screen.getByText(/Datos insuficientes/)).toBeInTheDocument();
    expect(screen.getByText(/Sin apoyo del modelo/)).toBeInTheDocument();
  });

  it('explica el animal local no publicado y otros errores', () => {
    expect(predictionErrorMessage({ status: 404 })).toMatch(/no se publicó/);
    expect(predictionErrorMessage({ status: 401 })).toMatch(/Token/);
    expect(predictionErrorMessage({ status: 503 })).toMatch(/no está disponible/);
    expect(predictionErrorMessage(new Error('network'))).toMatch(/conexión/);
    expect(predictCandidata).not.toHaveBeenCalled();
  });

  it('no consulta sin token', async () => {
    renderPage();
    await screen.findByText('Candidata');
    fireEvent.click(screen.getByText('Evaluar candidata'));
    expect(await screen.findByText(/Ingresa el token/)).toBeInTheDocument();
    expect(predictCandidata).not.toHaveBeenCalled();
  });
});
