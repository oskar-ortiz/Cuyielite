import { app } from 'electron';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.join(app.getPath('userData'), 'sqlite-poc');
const DB_PATH = path.join(DB_DIR, 'poc.db');

function openDb() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('CREATE TABLE IF NOT EXISTS poc (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  return db;
}

class SqlitePoc {
  static __capacitorElectronPlugin = {
    name: 'SqlitePoc',
    methods: ['saveValue', 'readValue'],
  };

  async load() {}

  async saveValue({ value }) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 256) {
      throw new Error('valor inválido: debe ser cadena no vacía de hasta 256 caracteres');
    }
    const db = openDb();
    try {
      const stmt = db.prepare(
        'INSERT INTO poc(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      );
      stmt.run('poc', value);
      return { ok: true };
    } finally {
      db.close();
    }
  }

  async readValue() {
    const db = openDb();
    try {
      const row = db.prepare('SELECT value FROM poc WHERE key = ?').get('poc');
      return { value: row ? row.value : null };
    } finally {
      db.close();
    }
  }
}

export { SqlitePoc };