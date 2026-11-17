import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AsistenteTrabajo from './AsistenteTrabajo';

const { assistantQuery, ensureAccessToken } = vi.hoisted(() => ({
  assistantQuery: vi.fn(),
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
  IonTextarea: ({ value, onIonInput, label }: any) => (
    <textarea
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onIonInput?.({ detail: { value: event.target.value } })}
    />
  ),
  IonSelect: ({ value, onIonChange, label, children }: any) => (
    <select
      aria-label={label}
      value={value}
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
  IonList: ({ children }: any) => <div>{children}</div>,
  IonItem: ({ children }: any) => <div>{children}</div>,
  IonLabel: ({ children }: any) => <span>{children}</span>,
  IonIcon: () => <span />,
  IonSpinner: () => <span>...</span>,
}));

vi.mock('../data/api.config.js', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, AUTH_MODE: 'pilot' };
});
vi.mock('../data/auth.session.js', () => ({ ensureAccessToken }));
vi.mock('../data/ml.transport', async (importOriginal) => {
  const actual: any = await importOriginal();
  return { ...actual, getMlTransport: () => ({ assistantQuery }) };
});

describe('Asistente en modo piloto', () => {
  beforeEach(() => {
    assistantQuery.mockReset();
    ensureAccessToken.mockReset();
  });

  it('usa la sesión activa y no pide un token de laboratorio', async () => {
    ensureAccessToken.mockResolvedValue('token-de-sesion');
    assistantQuery.mockResolvedValue({ respuesta: 'Respuesta del manual', fuentes: ['produccion_cuyes.pdf, p. 12'] });
    render(
      <MemoryRouter>
        <AsistenteTrabajo />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText('Token de laboratorio')).toBeNull();
    fireEvent.change(screen.getByLabelText('Pregunta'), { target: { value: '¿Qué materiales se usan en comederos?' } });
    fireEvent.click(screen.getByText('Preguntar'));
    expect(await screen.findByText('Respuesta del manual')).toBeInTheDocument();
    expect(screen.getByText('produccion_cuyes.pdf, p. 12')).toBeInTheDocument();
    expect(ensureAccessToken).toHaveBeenCalled();
    expect(assistantQuery).toHaveBeenCalledWith(
      'token-de-sesion',
      expect.objectContaining({ pregunta: '¿Qué materiales se usan en comederos?' }),
    );
  });

  it('pide iniciar sesión cuando la sesión no está disponible', async () => {
    ensureAccessToken.mockRejectedValue(new Error('AUTH_REQUIRED'));
    render(
      <MemoryRouter>
        <AsistenteTrabajo />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Pregunta'), { target: { value: '¿Qué dice el manual de comederos?' } });
    fireEvent.click(screen.getByText('Preguntar'));
    expect(await screen.findByText(/Inicia sesión para consultar/)).toBeInTheDocument();
    expect(assistantQuery).not.toHaveBeenCalled();
  });
});
