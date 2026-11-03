import { app } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

import { migrateAndSeed } from './galpones.migration.js';
import { normalizeGalpon, normalizePoza, validateGalpon, validatePoza } from './galpones.validation.js';

// Base de prueba del paso 1 (poc.db) — no se modifica aquí.
const POC_DB_DIR = path.join(app.getPath('userData'), 'sqlite-poc');
const POC_DB_PATH = path.join(POC_DB_DIR, 'poc.db');

// Base de galpones/pozas de esta entrega (separada de poc.db).
const GALPONES_DB_DIR = path.join(app.getPath('userData'), 'cuyielite');
const GALPONES_DB_PATH = path.join(GALPONES_DB_DIR, 'cuyielite.db');

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
    methods: ['saveValue', 'readValue', 'initializeDatabase', 'listGalpones', 'listPozasByGalpon', 'createGalpon', 'createPoza'],
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
}

export { SqlitePoc };