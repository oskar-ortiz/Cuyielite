import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PrediccionesAnimal from './PrediccionesAnimal';

const { predictCandidata, predictHembra, getCuyo, ensureAccessToken } = vi.hoisted(() => ({
  predictCandidata: vi.fn(),
  predictHembra: vi.fn(),
  getCuyo: vi.fn(),
  ensureAccessToken: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  IonPage: ({ children }: any) => <div>{children}</div>,
  IonHeader: ({ children }: any) => <header>{children}</header>,
  IonToolbar: ({ children }: any) => <div>{children}</div>,
  IonTitle: ({ children }: any) => <h1>{children}</h1>,
  IonButtons: ({ children }: any) => <div>{children}</div>,
  IonBackButton: ({ text }: any) => <button>{text}</button>,
  IonContent: ({ children }: any) => <div>{children}</div>,
  IonInput: ({ value, onIonInput, label }: any) => (
    <input
      aria-label={label}
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
  IonList: ({ children }: any) => <div>{children}</div>,
  IonItem: ({ children }: any) => <div>{children}</div>,
  IonChip: ({ children }: any) => <span>{children}</span>,
  IonLabel: ({ children }: any) => <span>{children}</span>,
  IonIcon: () => <span />,
  IonSpinner: () => <span>...</span>,
}));

vi.mock('../data/api.config.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, AUTH_MODE: 'pilot' };
});
vi.mock('../data/auth.session.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, ensureAccessToken, snapshot: () => ({ canWrite: true, role: 'admin' }) };
});
vi.mock('../data/ml.transport', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, getMlTransport: () => ({ predictCandidata, predictHembra, evaluationContext: vi.fn() }) };
});
vi.mock('../data/work.domain.factory', () => ({ getDomainRepository: () => ({ getCuyo }) }));

const ANIMAL = '33333333-3333-4333-8333-333333333333';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/trabajo/animales/${ANIMAL}/predicciones`]}>
      <Routes>
        <Route path="/trabajo/animales/:animalId/predicciones" element={<PrediccionesAnimal />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Predicciones en modo piloto', () => {
  beforeEach(() => {
    predictCandidata.mockReset();
    predictHembra.mockReset();
    ensureAccessToken.mockReset();
    getCuyo.mockReset();
    getCuyo.mockResolvedValue({ id: ANIMAL, codigoIdentificacion: 'C-1', sexo: 'H', estado: 'ACTIVO' });
  });

  it('consulta candidata con la sesión activa, sin token manual', async () => {
    ensureAccessToken.mockResolvedValue('token-de-sesion');
    predictCandidata.mockResolvedValue({
      clase: 'NORMAL',
      motivos: ['dato faltante'],
      estado_calidad: 'REVISAR',
      apoyo_modelo: null,
    });
    renderPage();
    expect(await screen.findByText('Evaluar candidata')).toBeInTheDocument();
    expect(screen.queryByLabelText('Token de laboratorio')).toBeNull();
    fireEvent.click(screen.getByText('Evaluar candidata'));
    expect(await screen.findByText(/Sin apoyo del modelo/)).toBeInTheDocument();
    expect(ensureAccessToken).toHaveBeenCalled();
    expect(predictCandidata).toHaveBeenCalledWith('token-de-sesion', expect.objectContaining({ cuy_id: ANIMAL }));
  });

  it('pide iniciar sesión cuando la sesión no está disponible', async () => {
    ensureAccessToken.mockRejectedValue(new Error('AUTH_REQUIRED'));
    renderPage();
    expect(await screen.findByText('Evaluar candidata')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Evaluar candidata'));
    expect(await screen.findByText(/Inicia sesión para consultar/)).toBeInTheDocument();
    expect(predictCandidata).not.toHaveBeenCalled();
  });
});
