import { describe, expect, it } from 'vitest';

import { validatePullPage, type SyncPullPage } from './work.sync.pull.validation';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const GALPON = '11111111-1111-4111-8111-111111111111';
const CREATED = '2026-11-06T10:00:00.000Z';

function record(id: string, version: string, data: Record<string, unknown>) {
  return {
    id,
    version,
    created_at: CREATED,
    updated_at: CREATED,
    deleted_at: null,
    last_client_edited_at: CREATED,
    data,
  };
}

function page(items: SyncPullPage['items'], nextCursor = 'opaque-next', hasMore = false): SyncPullPage {
  return { protocol_version: 1, scope_id: SCOPE, items, next_cursor: nextCursor, has_more: hasMore };
}

describe('pull-v1 contract', () => {
  it('valida ámbito, secuencia creciente y límite antes de aplicar', () => {
    const valid = page([
      { seq: '1', entity: 'galpon', record: record(GALPON, '1', { nombre: 'G1', ubicacion: null }) },
    ]);
    expect(validatePullPage(valid, SCOPE, 50)).toEqual(valid);
    expect(() => validatePullPage({ ...valid, scope_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }, SCOPE, 50)).toThrow(
      /ámbito/,
    );
    expect(() =>
      validatePullPage(
        page([
          { seq: '2', entity: 'galpon', record: record(GALPON, '1', { nombre: 'G1', ubicacion: null }) },
          { seq: '1', entity: 'galpon', record: record(GALPON, '2', { nombre: 'G2', ubicacion: null }) },
        ]),
        SCOPE,
        50,
      ),
    ).toThrow(/orden/);
  });

  it('rechaza campos extra y registros con versión o datos inválidos', () => {
    const item = {
      seq: '1',
      entity: 'galpon' as const,
      record: record(GALPON, '1', { nombre: 'G1', ubicacion: null }),
    };
    expect(() => validatePullPage({ ...page([item]), extra: true }, SCOPE, 50)).toThrow();
    expect(() => validatePullPage(page([{ ...item, record: { ...item.record, version: '0' } }]), SCOPE, 50)).toThrow();
    expect(() =>
      validatePullPage(
        page([{ ...item, record: { ...item.record, data: { nombre: 'G1', ubicacion: null, sql: 'x' } } }]),
        SCOPE,
        50,
      ),
    ).toThrow();
  });

  it('rechaza pesajes con parto y evento a la vez (paridad con 0005)', () => {
    const peso = (parto_id: string | null, evento_id: string | null) =>
      record('44444444-4444-4444-8444-444444444444', '1', {
        cuy_id: '33333333-3333-4333-8333-333333333333',
        fecha_pesaje: '2026-03-12',
        peso_gramos: '900.00',
        etapa: null,
        parto_id,
        evento_id,
      });
    const parto = '55555555-5555-4555-8555-555555555555';
    const evento = '66666666-6666-4666-8666-666666666666';
    expect(
      validatePullPage(page([{ seq: '1', entity: 'pesajes', record: peso(parto, null) }]), SCOPE, 50),
    ).toBeTruthy();
    expect(
      validatePullPage(page([{ seq: '1', entity: 'pesajes', record: peso(null, evento) }]), SCOPE, 50),
    ).toBeTruthy();
    expect(() =>
      validatePullPage(page([{ seq: '1', entity: 'pesajes', record: peso(parto, evento) }]), SCOPE, 50),
    ).toThrow(/elemento pull/);
  });

  it('rechaza una página que afirma tener más elementos sin llenar el límite', () => {
    const item = {
      seq: '1',
      entity: 'galpon' as const,
      record: record(GALPON, '1', { nombre: 'G1', ubicacion: null }),
    };
    expect(() => validatePullPage(page([item], 'next', true), SCOPE, 2)).toThrow();
  });

  it('acepta entidades de dominio, fechas con offset y rechaza entidades desconocidas', () => {
    const cuy = record('33333333-3333-4333-8333-333333333333', '1', {
      poza_id: null,
      galpon_origen_id: null,
      codigo_identificacion: 'C-1',
      sexo: 'H',
      fecha_nacimiento: '2025-03-12',
      color_codigo: null,
      ojos_codigo: null,
      pelaje_original: null,
      padre_id: null,
      madre_id: null,
      categoria_ml: 'NORMAL',
      ultimo_peso_g: '950.50',
      estado: null,
    });
    cuy.created_at = '2026-11-06T10:00:00.123456+00:00';
    const valid = page([{ seq: '1', entity: 'cuyes', record: cuy }]);
    expect(validatePullPage(valid, SCOPE, 50)).toEqual(valid);

    expect(() =>
      validatePullPage(page([{ seq: '1', entity: 'mortalidad' as unknown as 'cuyes', record: cuy }]), SCOPE, 50),
    ).toThrow(/inválido/);
    expect(() =>
      validatePullPage(
        page([
          {
            seq: '1',
            entity: 'cuyes',
            record: { ...cuy, data: { ...cuy.data, peso_gramos: 12 } },
          },
        ]),
        SCOPE,
        50,
      ),
    ).toThrow(/inválido/);
  });
});
