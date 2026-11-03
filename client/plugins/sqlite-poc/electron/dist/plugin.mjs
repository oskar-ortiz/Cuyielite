import { app } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// Base de prueba del paso 1 (poc.db) — no se modifica aquí.
const POC_DB_DIR = path.join(app.getPath('userData'), 'sqlite-poc');
const POC_DB_PATH = path.join(POC_DB_DIR, 'poc.db');

// Base de galpones/pozas de esta entrega (separada de poc.db).
const GALPONES_DB_DIR = path.join(app.getPath('userData'), 'cuyielite');
const GALPONES_DB_PATH = path.join(GALPONES_DB_DIR, 'cuyielite.db');

const SEED_TIMESTAMP = '2026-01-01T00:00:00Z';

function uuidV4() {
  return crypto.randomUUID();
}

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function getUserVersion(db) {
  const row = db.prepare('PRAGMA user_version').get();
  return Number(row?.user_version ?? 0);
}

function migrateAndSeedGalpones(db) {
  db.exec('PRAGMA foreign_keys = ON');
  const version = getUserVersion(db);
  if (version > 1) {
    throw new Error(`Esquema incompatible: user_version ${version} > 1`);
  }
  if (version === 1) {
    return;
  }
  // version === 0
  db.exec('BEGIN');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS galpones (
      id TEXT PRIMARY KEY NOT NULL,
      nombre TEXT NOT NULL,
      ubicacion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS pozas (
      id TEXT PRIMARY KEY NOT NULL,
      galpon_id TEXT NOT NULL,
      codigo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      capacidad_maxima INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (galpon_id) REFERENCES galpones(id)
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )`);

    const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get();
    if (!seeded) {
      const gNorte = uuidV4();
      const gSur = uuidV4();
      const gOccidente = uuidV4();
      const gEste = uuidV4();

      const insertGalpon = db.prepare(
        'INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      insertGalpon.run(gNorte, 'Galpón Norte', 'Lote 1, sector norte', SEED_TIMESTAMP, SEED_TIMESTAMP, null);
      insertGalpon.run(gSur, 'Galpón Sur', 'Lote 2, junto a la bodega', SEED_TIMESTAMP, SEED_TIMESTAMP, null);
      insertGalpon.run(gOccidente, 'Galpón Occidente', 'Lote 3, ladera oeste', SEED_TIMESTAMP, SEED_TIMESTAMP, null);
      insertGalpon.run(gEste, 'Galpón Este', 'Lote 4, en adecuación', SEED_TIMESTAMP, SEED_TIMESTAMP, null);

      const insertPoza = db.prepare(
        'INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      insertPoza.run(uuidV4(), gNorte, 'P-101', 'cría', 50, SEED_TIMESTAMP, SEED_TIMESTAMP, null);
      insertPoza.run(uuidV4(), gNorte, 'P-102', 'engorde', 30, SEED_TIMESTAMP, SEED_TIMESTAMP, null);
      insertPoza.run(uuidV4(), gNorte, 'P-103', 'reproducción', 80, SEED_TIMESTAMP, SEED_TIMESTAMP, null);
      insertPoza.run(uuidV4(), gSur, 'P-201', 'cría', 20, SEED_TIMESTAMP, SEED_TIMESTAMP, null);
      insertPoza.run(uuidV4(), gSur, 'P-202', 'engorde', 60, SEED_TIMESTAMP, SEED_TIMESTAMP, null);
      insertPoza.run(uuidV4(), gOccidente, 'P-301', 'engorde', 45, SEED_TIMESTAMP, SEED_TIMESTAMP, null);

      db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', '1')").run();
    }

    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
    db.exec('PRAGMA user_version = 1');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

class SqlitePoc {
  static __capacitorElectronPlugin = {
    name: 'SqlitePoc',
    methods: ['saveValue', 'readValue', 'initializeDatabase', 'listGalpones', 'listPozasByGalpon'],
  };

  async load() {}

  // --- PoC de persistencia (poc.db) ---
  async saveValue({ value }) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
      throw new Error('valor inválido: debe ser cadena no vacía de hasta 256 caracteres');
    }
    const db = openDb(POC_DB_PATH);
    try {
      const stmt = db.prepare('INSERT INTO poc(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      stmt.run('poc', value);
      return { ok: true };
    } finally {
      db.close();
    }
  }

  async readValue() {
    const db = openDb(POC_DB_PATH);
    try {
      db.exec('CREATE TABLE IF NOT EXISTS poc (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
      const row = db.prepare('SELECT value FROM poc WHERE key = ?').get('poc');
      return { value: row ? row.value : null };
    } finally {
      db.close();
    }
  }

  // --- Galpones/pozas (cuyielite.db) ---
  async initializeDatabase() {
    const db = openDb(GALPONES_DB_PATH);
    try {
      migrateAndSeedGalpones(db);
      return { ok: true };
    } finally {
      db.close();
    }
  }

  async listGalpones() {
    const db = openDb(GALPONES_DB_PATH);
    try {
      migrateAndSeedGalpones(db);
      const rows = db.prepare('SELECT id, nombre, ubicacion FROM galpones WHERE deleted_at IS NULL').all();
      return { galpones: rows };
    } finally {
      db.close();
    }
  }

  async listPozasByGalpon({ galponId }) {
    const db = openDb(GALPONES_DB_PATH);
    try {
      migrateAndSeedGalpones(db);
      const rows = db.prepare('SELECT id, galpon_id, codigo, tipo, capacidad_maxima FROM pozas WHERE galpon_id = ? AND deleted_at IS NULL').all(galponId);
      return { pozas: rows };
    } finally {
      db.close();
    }
  }
}

export { SqlitePoc };