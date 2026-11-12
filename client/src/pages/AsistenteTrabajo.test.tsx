import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assistantErrorMessage } from '../data/ml.errors';

import AsistenteTrabajo from './AsistenteTrabajo';

const { assistantQuery } = vi.hoisted(() => ({ assistantQuery: vi.fn() }));

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
  IonCard: ({ children }: any) => <div>{children}</div>,
  IonCardContent: ({ children }: any) => <div>{children}</div>,
  IonList: ({ children }: any) => <div>{children}</div>,
  IonItem: ({ children }: any) => <div>{children}</div>,
  IonLabel: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('../data/ml.transport', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('../data/ml.transport')>();
  return { ...actual, getMlTransport: () => ({ assistantQuery, predictHembra: vi.fn(), predictCandidata: vi.fn() }) };
});

function fill(question: string) {
  fireEvent.change(screen.getByLabelText('Token de laboratorio'), { target: { value: 'x'.repeat(40) } });
  fireEvent.change(screen.getByLabelText('Pregunta'), { target: { value: question } });
}

describe('Asistente de Trabajo', () => {
  beforeEach(() => assistantQuery.mockReset());

  it('muestra respuesta y fuentes reales sin interpretar HTML', async () => {
    assistantQuery.mockResolvedValue({ respuesta: 'Texto <b>seguro</b>', fuentes: ['manual.pdf, p. 1'] });
    const { container } = render(
      <MemoryRouter>
        <AsistenteTrabajo />
      </MemoryRouter>,
    );
    fill('temperatura recomendada');
    fireEvent.click(screen.getByText('Preguntar'));
    expect(await screen.findByText('Texto <b>seguro</b>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(screen.getByText('manual.pdf, p. 1')).toBeInTheDocument();
  });

  it('clasifica errores de servicio y autorización', () => {
    expect(assistantErrorMessage({ status: 401 })).toMatch(/Token/);
    expect(assistantErrorMessage({ status: 503 })).toMatch(/no está disponible/);
    expect(assistantErrorMessage({ status: 422 })).toMatch(/formato/);
    expect(assistantErrorMessage(new Error('network'))).toMatch(/conexión/);
  });

  it('no envía sin token', async () => {
    render(
      <MemoryRouter>
        <AsistenteTrabajo />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Preguntar'));
    expect(await screen.findByText(/Ingresa el token/)).toBeInTheDocument();
    expect(assistantQuery).not.toHaveBeenCalled();
  });
});
