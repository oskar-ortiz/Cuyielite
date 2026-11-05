import { app } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

import { migrateAndSeed } from './galpones.migration.js';
import { initializeWorkDatabase } from './work.migration.js';
import { normalizeGalpon, normalizePoza, validateGalpon, validatePoza } from './galpones.validation.js';

// Base de prueba del paso 1 (poc.db) — no se modifica aquí.
const POC_DB_DIR = path.join(app.getPath('userData'), 'sqlite-poc');
const POC_DB_PATH = path.join(POC_DB_DIR, 'poc.db');

// Base de galpones/pozas de esta entrega (separada de poc.db).
const GALPONES_DB_DIR = path.join(app.getPath('userData'), 'cuyielite');
const GALPONES_DB_PATH = path.join(GALPONES_DB_DIR, 'cuyielite.db');

// Base de trabajo (separada de demo y galpones).
const WORK_DB_DIR = path.join(app.getPath('userData'), 'cuyielite-work');
const WORK_DB_PATH = path.join(WORK_DB_DIR, 'trabajo.db');

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function makeAdapter(db) {
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params) => {
      const stmt = db.prepare(sql);
      stmt.run(...(params ?? []));
    },
    query: (sql, params) => {
      const stmt = db.prepare(sql);
      const rows = params ? stmt.all(...params) : stmt.all();
      return { values: rows };
    },
  };
}

class SqlitePoc {
  static __capacitorElectronPlugin = {
    name: 'SqlitePoc',
    methods: ['saveValue', 'readValue', 'initializeDatabase', 'listGalpones', 'listPozasByGalpon', 'createGalpon', 'createPoza', 'updateGalpon', 'updatePoza', 'initializeWorkDatabase', 'getWorkDatabaseStatus', 'closeWorkDatabase'],
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
      await migrateAndSeed(makeAdapter(db));
      return { ok: true };
    } finally {
      db.close();
    }
  }

  async listGalpones() {
    const db = openDb(GALPONES_DB_PATH);
    try {
      await migrateAndSeed(makeAdapter(db));
      const rows = db.prepare('SELECT id, nombre, ubicacion FROM galpones WHERE deleted_at IS NULL').all();
      return { galpones: rows };
    } finally {
      db.close();
    }
  }

  async listPozasByGalpon({ galponId }) {
    const db = openDb(GALPONES_DB_PATH);
    try {
      await migrateAndSeed(makeAdapter(db));
      const rows = db.prepare('SELECT id, galpon_id, codigo, tipo, capacidad_maxima FROM pozas WHERE galpon_id = ? AND deleted_at IS NULL').all(galponId);
      return { pozas: rows };
    } finally {
      db.close();
    }
  }

  async createGalpon({ nombre, ubicacion }) {
    const validation = validateGalpon({ nombre, ubicacion });
    if (!validation.ok) throw new Error(validation.errors.join('; '));
    const normalized = normalizeGalpon({ nombre, ubicacion });

    const db = openDb(GALPONES_DB_PATH);
    try {
      await migrateAndSeed(makeAdapter(db));
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, normalized.nombre, normalized.ubicacion, now, now, null);
      return { galpon: { id, nombre: normalized.nombre, ubicacion: normalized.ubicacion } };
    } finally {
      db.close();
    }
  }

  async createPoza({ galponId, codigo, tipo, capacidadMaxima }) {
    const validation = validatePoza({ codigo, tipo, capacidadMaxima });
    if (!validation.ok) throw new Error(validation.errors.join('; '));
    const normalized = normalizePoza({ codigo, tipo, capacidadMaxima });

    const db = openDb(GALPONES_DB_PATH);
    try {
      await migrateAndSeed(makeAdapter(db));
      const exists = db.prepare('SELECT 1 FROM galpones WHERE id = ?').get(galponId);
      if (!exists) throw new Error('El galpón no existe');
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare('INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, galponId, normalized.codigo, normalized.tipo, normalized.capacidadMaxima, now, now, null);
      return { poza: { id, galpon_id: galponId, codigo: normalized.codigo, tipo: normalized.tipo, capacidad_maxima: normalized.capacidadMaxima } };
    } finally {
      db.close();
    }
  }

  async updateGalpon({ id, nombre, ubicacion }) {
    const validation = validateGalpon({ nombre, ubicacion });
    if (!validation.ok) throw new Error(validation.errors.join('; '));
    const normalized = normalizeGalpon({ nombre, ubicacion });

    const db = openDb(GALPONES_DB_PATH);
    try {
      await migrateAndSeed(makeAdapter(db));
      const existing = db.prepare('SELECT nombre, ubicacion FROM galpones WHERE id = ? AND deleted_at IS NULL').get(id);
      if (!existing) throw new Error('Galpón no encontrado');
      if (existing.nombre === normalized.nombre && existing.ubicacion === normalized.ubicacion) {
        return { galpon: { id, nombre: existing.nombre, ubicacion: existing.ubicacion } };
      }
      const now = new Date().toISOString();
      db.prepare('UPDATE galpones SET nombre = ?, ubicacion = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(normalized.nombre, normalized.ubicacion, now, id);
      return { galpon: { id, nombre: normalized.nombre, ubicacion: normalized.ubicacion } };
    } finally {
      db.close();
    }
  }

  async updatePoza({ galponId, pozaId, codigo, tipo, capacidadMaxima }) {
    const validation = validatePoza({ codigo, tipo, capacidadMaxima });
    if (!validation.ok) throw new Error(validation.errors.join('; '));
    const normalized = normalizePoza({ codigo, tipo, capacidadMaxima });

    const db = openDb(GALPONES_DB_PATH);
    try {
      await migrateAndSeed(makeAdapter(db));
      const existing = db.prepare('SELECT codigo, tipo, capacidad_maxima FROM pozas WHERE id = ? AND galpon_id = ? AND deleted_at IS NULL').get(pozaId, galponId);
      if (!existing) throw new Error('Poza no encontrada');
      if (existing.codigo === normalized.codigo && existing.tipo === normalized.tipo && existing.capacidad_maxima === normalized.capacidadMaxima) {
        return { poza: { id: pozaId, galpon_id: galponId, codigo: existing.codigo, tipo: existing.tipo, capacidad_maxima: existing.capacidad_maxima } };
      }
      const now = new Date().toISOString();
      db.prepare('UPDATE pozas SET codigo = ?, tipo = ?, capacidad_maxima = ?, updated_at = ? WHERE id = ? AND galpon_id = ? AND deleted_at IS NULL').run(normalized.codigo, normalized.tipo, normalized.capacidadMaxima, now, pozaId, galponId);
      return { poza: { id: pozaId, galpon_id: galponId, codigo: normalized.codigo, tipo: normalized.tipo, capacidad_maxima: normalized.capacidadMaxima } };
    } finally {
      db.close();
    }
  }
  // --- Base de trabajo (trabajo.db) ---
  async initializeWorkDatabase() {
    const db = openDb(WORK_DB_PATH);
    try {
      const identity = await initializeWorkDatabase(makeAdapter(db));
      // contar filas
      const counts = {};
      for (const t of ['galpones', 'pozas', 'cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias']) {
        counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
      }
      return { ok: true, status: { schemaFamily: identity.schemaFamily, schemaVersion: identity.schemaVersion, datasetId: identity.datasetId, checksum: identity.checksum, counts } };
    } finally {
      db.close();
    }
  }

  async getWorkDatabaseStatus() {
    const db = openDb(WORK_DB_PATH);
    try {
      // leer meta
      const metaRows = db.prepare('SELECT key, value FROM meta').all();
      const meta = Object.fromEntries(metaRows.map((r) => [r.key, r.value]));
      const counts = {};
      for (const t of ['galpones', 'pozas', 'cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias']) {
        try {
          counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
        } catch {
          counts[t] = -1;
        }
      }
      return {
        schemaFamily: meta.schema_family ?? '',
        schemaVersion: Number(meta.schema_version ?? 0),
        datasetId: meta.dataset_id ?? '',
        checksum: meta.schema_checksum ?? '',
        counts,
      };
    } finally {
      db.close();
    }
  }

  async closeWorkDatabase() {
    // No hay conexion persistente en este plugin; cada operacion abre/cierra.
    return { ok: true };
  }
}

export { SqlitePoc };