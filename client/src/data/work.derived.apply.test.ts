import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';

import {
  DerivedPullError,
  pullDerivedUntilCheckpoint,
  readAlertasDerivadas,
  readCategoriaDerivada,
  readDerivedCursor,
  validateDerivedPage,
} from './work.derived.apply';
import { DERIVED_PROTOCOL, initializeDerivedDatabase } from './work.derived.schema';
import type { MigrationDb } from './work.migration';
import { initializeWorkSyncDatabase } from './work.sync.migration';

const SCOPE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CUY = '11111111-1111-4111-8111-111111111111';
const ALERT = '22222222-2222-4222-8222-222222222222';
const PART = '33333333-3333-4333-8333-333333333333';

function adapterFor(db: DatabaseSync): MigrationDb {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      db.prepare(sql).run(...((params ?? []) as any[]));
    },
    query: (sql, params) => ({ values: db.prepare(sql).all(...((params ?? []) as any[])) }),
  };
}

async function fresh() {
  const db = new DatabaseSync(':memory:');
  const adapter = adapterFor(db);
  await initializeWorkSyncDatabase(adapter);
  await initializeDerivedDatabase(adapter);
  return { db, adapter };
}

function categoriaRecord(version = 1, clase: string | null = 'DESCARTE') {
  return {
    id: CUY,
    version: String(version),
    created_at: '2026-11-16T10:00:00.000Z',
    updated_at: '2026-11-16T10:00:00.000Z',
    deleted_at: null,
    last_client_edited_at: null,
    data: {
      cuy_id: CUY,
      clase,
      estado_evaluacion: clase ? 'DEFINITIVA' : 'DATOS_INSUFICIENTES',
      categoria_estado: clase ? 'DEFINITIVA' : 'HISTORICA',
      motivos: clase ? ['ciclo completo'] : [],
      faltantes: clase ? [] : ['abortos'],
      reglas_version: 'adr0004+reglas-2026-11-16',
      evaluada_at: '2026-11-16T10:00:00.000Z',
      procedencia: { fuente: 'CENTRAL', partos: { total: 4 } },
      apoyo_modelo: null,
    },
  };
}

function alertaRecord(version = 1, estado = 'activa') {
  return {
    id: ALERT,
    version: String(version),
    created_at: '2026-11-16T10:00:00.000Z',
    updated_at: '2026-11-16T10:00:00.000Z',
    deleted_at: null,
    last_client_edited_at: null,
    data: {
      cuy_id: CUY,
      tipo_alerta: 'DESCARTE_REPRODUCTORA',
      regla_id: 'partos_reproductora_descarte',
      motivo: 'ciclo completo',
      estado,
      causa_tipo: 'PARTO',
      causa_id: PART,
      causa_fecha: '2026-01-10',
      fecha_limite: '2026-01-30',
      reglas_version: 'adr0004+reglas-2026-11-16',
      atendida: false,
    },
  };
}

function page(items: { seq: string; entity: string; record: any }[], next: string, hasMore = false) {
  return { protocol_version: DERIVED_PROTOCOL, scope_id: SCOPE, items, next_cursor: next, has_more: hasMore };
}

describe('feed derivado de solo lectura', () => {
  it('crea las tablas una vez y conserva el identificador de migración', async () => {
    const { db, adapter } = await fresh();
    await initializeDerivedDatabase(adapter);
    const migration = db.prepare("SELECT value FROM meta WHERE key='derived_migration_id'").get() as {
      value: string;
    };
    expect(migration.value).toBe('0005_work_derived_readonly');
    expect(db.prepare('SELECT COUNT(*) AS total FROM sync_derived_cursor').get()).toMatchObject({ total: 0 });
    db.close();
  });

  it('aplica categoría y alerta y las deja legibles offline', async () => {
    const { db, adapter } = await fresh();
    const receive = async () =>
      page(
        [
          { seq: '1', entity: 'categoria', record: categoriaRecord() },
          { seq: '2', entity: 'alerta', record: alertaRecord() },
        ],
        'cursor-2',
      );

    const result = await pullDerivedUntilCheckpoint(adapter, SCOPE, receive);
    expect(result).toEqual({ pages: 1, applied: 2 });
    expect(await readDerivedCursor(adapter)).toBe('cursor-2');

    const categoria = await readCategoriaDerivada(adapter, CUY);
    expect(categoria).toMatchObject({ clase: 'DESCARTE', estadoEvaluacion: 'DEFINITIVA', version: '1' });
    expect(categoria?.motivos).toEqual(['ciclo completo']);

    const alertas = await readAlertasDerivadas(adapter, CUY);
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({
      estado: 'activa',
      reglaId: 'partos_reproductora_descarte',
      causaFecha: '2026-01-10',
      fechaLimite: '2026-01-30',
    });
    db.close();
  });

  it('un replay con la misma versión no duplica ni retrocede', async () => {
    const { db, adapter } = await fresh();
    const first = async () => page([{ seq: '1', entity: 'alerta', record: alertaRecord(2, 'obsoleta') }], 'c1');
    await pullDerivedUntilCheckpoint(adapter, SCOPE, first);

    const replay = async () => page([{ seq: '1', entity: 'alerta', record: alertaRecord(1, 'activa') }], 'c2');
    await pullDerivedUntilCheckpoint(adapter, SCOPE, replay);

    const alertas = await readAlertasDerivadas(adapter, CUY);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].estado).toBe('obsoleta');
    expect(alertas[0].version).toBe('2');
    db.close();
  });

  it('un cursor repetido sin avance corta el ciclo', async () => {
    const { db, adapter } = await fresh();
    const receive = async () => page([], 'same', true);
    await expect(pullDerivedUntilCheckpoint(adapter, SCOPE, receive)).rejects.toThrow(DerivedPullError);
    db.close();
  });

  it('rechaza ámbito, protocolo y entidades desconocidas sin escribir cursor', async () => {
    const { db, adapter } = await fresh();
    const good = page([{ seq: '1', entity: 'categoria', record: categoriaRecord() }], 'ok');
    expect(() => validateDerivedPage({ ...good, scope_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }, SCOPE, 50)).toThrow(
      DerivedPullError,
    );
    expect(() => validateDerivedPage({ ...good, protocol_version: 2 }, SCOPE, 50)).toThrow(DerivedPullError);
    expect(() =>
      validateDerivedPage(page([{ seq: '1', entity: 'alerta', record: categoriaRecord() }], 'ok'), SCOPE, 50),
    ).toThrow(DerivedPullError);
    expect(await readDerivedCursor(adapter)).toBeNull();
    db.close();
  });

  it('un cliente anterior que solo usa dominio no toca el feed derivado', async () => {
    const { db, adapter } = await fresh();
    const receive = vi.fn(async () => page([], 'sin-cambios'));
    await pullDerivedUntilCheckpoint(adapter, SCOPE, receive);
    expect(receive).toHaveBeenCalledWith(null, 50);
    expect(await readDerivedCursor(adapter)).toBe('sin-cambios');
    db.close();
  });
});
