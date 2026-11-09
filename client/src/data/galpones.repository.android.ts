import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

import { migrateAndSeed, type MigrationDb } from './galpones.migration';
import type {
  CreateGalponInput,
  CreatePozaInput,
  Galpon,
  GalponesRepository,
  Poza,
  UpdateGalponInput,
  UpdatePozaInput,
} from './galpones.repository';
import { normalizeGalpon, normalizePoza, validateGalpon, validatePoza } from './galpones.validation';

const sqlite = new SQLiteConnection(CapacitorSQLite);

let connectionPromise: Promise<SQLiteDBConnection> | null = null;

async function createConnection(): Promise<SQLiteDBConnection> {
  try {
    return await sqlite.createConnection('cuyielite', false, 'no-encryption', 1, false);
  } catch (error) {
    // A WebView reload recreates this JS wrapper but can leave the native
    // connection registered. Close only that stale demo connection.
    if (!String(error).includes('Connection cuyielite already exists')) throw error;
    await CapacitorSQLite.closeConnection({ database: 'cuyielite', readonly: false });
    return sqlite.createConnection('cuyielite', false, 'no-encryption', 1, false);
  }
}

async function getConnection(): Promise<SQLiteDBConnection> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const c = await createConnection();
      await c.open();

      const adapter: MigrationDb = {
        exec: async (sql: string) => {
          await c.execute(sql, false);
        },
        run: async (sql: string, params?: unknown[]) => {
          await c.run(sql, params ?? [], false);
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
    async createGalpon(input: CreateGalponInput): Promise<Galpon> {
      const validation = validateGalpon(input);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const normalized = normalizeGalpon(input);
      const db = await getConnection();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.run(
        'INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, normalized.nombre, normalized.ubicacion, now, now, null],
      );
      return { id, nombre: normalized.nombre, ubicacion: normalized.ubicacion };
    },
    async createPoza(input: CreatePozaInput): Promise<Poza> {
      const validation = validatePoza(input);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const normalized = normalizePoza(input);
      const db = await getConnection();
      const exists = await db.query('SELECT 1 FROM galpones WHERE id = ?', [input.galponId]);
      if (!exists.values?.length) throw new Error('El galpón no existe');
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.run(
        'INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, input.galponId, normalized.codigo, normalized.tipo, normalized.capacidadMaxima, now, now, null],
      );
      return {
        id,
        galponId: input.galponId,
        codigo: normalized.codigo,
        tipo: normalized.tipo,
        capacidadMaxima: normalized.capacidadMaxima,
      };
    },
    async updateGalpon(id: string, input: UpdateGalponInput): Promise<Galpon> {
      const validation = validateGalpon(input);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const normalized = normalizeGalpon(input);
      const db = await getConnection();
      const exists = await db.query('SELECT nombre, ubicacion FROM galpones WHERE id = ? AND deleted_at IS NULL', [id]);
      if (!exists.values?.length) throw new Error('Galpón no encontrado');
      const row = exists.values[0] as { nombre: string; ubicacion: string | null };
      if (row.nombre === normalized.nombre && row.ubicacion === normalized.ubicacion) {
        return { id, nombre: row.nombre, ubicacion: row.ubicacion };
      }
      const now = new Date().toISOString();
      await db.run(
        'UPDATE galpones SET nombre = ?, ubicacion = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        [normalized.nombre, normalized.ubicacion, now, id],
      );
      return { id, nombre: normalized.nombre, ubicacion: normalized.ubicacion };
    },
    async updatePoza(galponId: string, pozaId: string, input: UpdatePozaInput): Promise<Poza> {
      const validation = validatePoza(input);
      if (!validation.ok) throw new Error(validation.errors.join('; '));
      const normalized = normalizePoza(input);
      const db = await getConnection();
      const exists = await db.query(
        'SELECT codigo, tipo, capacidad_maxima FROM pozas WHERE id = ? AND galpon_id = ? AND deleted_at IS NULL',
        [pozaId, galponId],
      );
      if (!exists.values?.length) throw new Error('Poza no encontrada');
      const row = exists.values[0] as { codigo: string; tipo: string; capacidad_maxima: number };
      if (
        row.codigo === normalized.codigo &&
        row.tipo === normalized.tipo &&
        row.capacidad_maxima === normalized.capacidadMaxima
      ) {
        return { id: pozaId, galponId, codigo: row.codigo, tipo: row.tipo, capacidadMaxima: row.capacidad_maxima };
      }
      const now = new Date().toISOString();
      await db.run(
        'UPDATE pozas SET codigo = ?, tipo = ?, capacidad_maxima = ?, updated_at = ? WHERE id = ? AND galpon_id = ? AND deleted_at IS NULL',
        [normalized.codigo, normalized.tipo, normalized.capacidadMaxima, now, pozaId, galponId],
      );
      return {
        id: pozaId,
        galponId,
        codigo: normalized.codigo,
        tipo: normalized.tipo,
        capacidadMaxima: normalized.capacidadMaxima,
      };
    },
  };
}
