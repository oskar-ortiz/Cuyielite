import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

import { migrateAndSeed, type MigrationDb } from './galpones.migration';
import type { Galpon, GalponesRepository, Poza } from './galpones.repository';

const sqlite = new SQLiteConnection(CapacitorSQLite);

let connectionPromise: Promise<SQLiteDBConnection> | null = null;

async function getConnection(): Promise<SQLiteDBConnection> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const c = await sqlite.createConnection('cuyielite', false, 'no-encryption', 1, false);
      await c.open();

      const adapter: MigrationDb = {
        exec: async (sql: string) => {
          await c.execute(sql);
        },
        run: async (sql: string, params?: unknown[]) => {
          await c.run(sql, params ?? []);
        },
        query: async (sql: string, params?: unknown[]) => {
          const res = await c.query(sql, params ?? []);
          return { values: res.values ?? [] };
        },
      };

      await migrateAndSeed(adapter);
      return c;
    })().catch((err) => {
      connectionPromise = null;
      throw err;
    });
  }
  return connectionPromise;
}

export function createAndroidRepository(): GalponesRepository {
  return {
    async listGalpones(): Promise<Galpon[]> {
      const db = await getConnection();
      const res = await db.query('SELECT id, nombre, ubicacion FROM galpones WHERE deleted_at IS NULL');
      const rows = res.values ?? [];
      return rows.map((r: { id: string; nombre: string; ubicacion: string | null }) => ({
        id: r.id,
        nombre: r.nombre,
        ubicacion: r.ubicacion,
      }));
    },
    async listPozasByGalpon(galponId: string): Promise<Poza[]> {
      const db = await getConnection();
      const res = await db.query(
        'SELECT id, galpon_id, codigo, tipo, capacidad_maxima FROM pozas WHERE galpon_id = ? AND deleted_at IS NULL',
        [galponId],
      );
      const rows = res.values ?? [];
      return rows.map(
        (r: { id: string; galpon_id: string; codigo: string; tipo: string; capacidad_maxima: number }) => ({
          id: r.id,
          galponId: r.galpon_id,
          codigo: r.codigo,
          tipo: r.tipo,
          capacidadMaxima: r.capacidad_maxima,
        }),
      );
    },
  };
}
