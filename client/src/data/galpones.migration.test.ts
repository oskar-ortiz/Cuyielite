import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect } from 'vitest';

import { migrateAndSeed, SCHEMA_VERSION, generateSeed } from './galpones.migration';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  const adapter = {
    exec: (sql: string) => db.exec(sql),
    run: (sql: string, params?: unknown[]) => {
      const stmt = db.prepare(sql);
      stmt.run(...((params ?? []) as any[]));
    },
    query: (sql: string, params?: unknown[]) => {
      const stmt = db.prepare(sql);
      const rows = params ? stmt.all(...(params as any[])) : stmt.all();
      return { values: rows };
    },
  };
  return { db, adapter };
}

describe('galpones.migration', () => {
  it('crea tablas, inserta seed y sube user_version a 1', async () => {
    const { db, adapter } = makeDb();
    // user_version inicial 0
    const before = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(before.user_version).toBe(0);

    await migrateAndSeed(adapter);

    const after = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(after.user_version).toBe(SCHEMA_VERSION);

    const galpones = db.prepare('SELECT COUNT(*) AS n FROM galpones').get() as { n: number };
    const pozas = db.prepare('SELECT COUNT(*) AS n FROM pozas').get() as { n: number };
    expect(galpones.n).toBe(4);
    expect(pozas.n).toBe(6);

    const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get() as { value: string };
    expect(seeded.value).toBe('1');

    // Galpón Este sin pozas
    const este = db.prepare("SELECT id FROM galpones WHERE nombre = 'Galpón Este'").get() as { id: string };
    const pozasEste = db.prepare('SELECT COUNT(*) AS n FROM pozas WHERE galpon_id = ?').get(este.id) as { n: number };
    expect(pozasEste.n).toBe(0);

    // capacidad_maxima entre 20 y 80
    const caps = db.prepare('SELECT capacidad_maxima FROM pozas').all() as { capacidad_maxima: number }[];
    for (const c of caps) {
      expect(c.capacidad_maxima).toBeGreaterThanOrEqual(20);
      expect(c.capacidad_maxima).toBeLessThanOrEqual(80);
    }

    // IDs estables: UUID v4
    const ids = db.prepare('SELECT id FROM galpones').all() as { id: string }[];
    for (const row of ids) {
      expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }

    db.close();
  });

  it('no resembrar al reabrir (user_version = 1)', async () => {
    const { db, adapter } = makeDb();
    await migrateAndSeed(adapter);
    const beforeIds = (db.prepare('SELECT id FROM galpones').all() as { id: string }[]).map((r) => r.id);
    // segunda ejecución
    await migrateAndSeed(adapter);
    const afterIds = (db.prepare('SELECT id FROM galpones').all() as { id: string }[]).map((r) => r.id);
    expect(afterIds).toEqual(beforeIds);
    const count = (db.prepare('SELECT COUNT(*) AS n FROM galpones').get() as { n: number }).n;
    expect(count).toBe(4);
    db.close();
  });

  it('rechaza versiones superiores', async () => {
    const { db, adapter } = makeDb();
    db.exec('PRAGMA user_version = 5');
    await expect(migrateAndSeed(adapter)).rejects.toThrow(/incompatible/i);
    db.close();
  });

  it('generateSeed produce UUID v4 distintos', () => {
    const a = generateSeed();
    const b = generateSeed();
    const idsA = a.galpones.map((g) => g.id);
    const idsB = b.galpones.map((g) => g.id);
    expect(new Set(idsA).size).toBe(idsA.length);
    // distintos entre instalaciones
    expect(idsA).not.toEqual(idsB);
  });

  it('conserva UUID e IDs tras cerrar y reabrir una base en disco', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite-poc-'));
    const dbPath = path.join(tmpDir, 'test.db');

    // Primera apertura: migración + seed
    const db1 = new DatabaseSync(dbPath);
    const adapter1 = {
      exec: (sql: string) => db1.exec(sql),
      run: (sql: string, params?: unknown[]) => {
        const stmt = db1.prepare(sql);
        stmt.run(...((params ?? []) as any[]));
      },
      query: (sql: string, params?: unknown[]) => {
        const stmt = db1.prepare(sql);
        const rows = params ? stmt.all(...(params as any[])) : stmt.all();
        return { values: rows };
      },
    };
    await migrateAndSeed(adapter1);
    const idsBefore = (db1.prepare('SELECT id FROM galpones').all() as { id: string }[]).map((r) => r.id);
    const pozasBefore = db1.prepare('SELECT id, galpon_id, capacidad_maxima FROM pozas').all() as {
      id: string;
      galpon_id: string;
      capacidad_maxima: number;
    }[];
    db1.close();

    // Segunda apertura: no resembrar
    const db2 = new DatabaseSync(dbPath);
    const adapter2 = {
      exec: (sql: string) => db2.exec(sql),
      run: (sql: string, params?: unknown[]) => {
        const stmt = db2.prepare(sql);
        stmt.run(...((params ?? []) as any[]));
      },
      query: (sql: string, params?: unknown[]) => {
        const stmt = db2.prepare(sql);
        const rows = params ? stmt.all(...(params as any[])) : stmt.all();
        return { values: rows };
      },
    };
    await migrateAndSeed(adapter2);
    const idsAfter = (db2.prepare('SELECT id FROM galpones').all() as { id: string }[]).map((r) => r.id);
    const pozasAfter = db2.prepare('SELECT id, galpon_id, capacidad_maxima FROM pozas').all() as {
      id: string;
      galpon_id: string;
      capacidad_maxima: number;
    }[];

    expect(idsAfter).toEqual(idsBefore);
    expect(pozasAfter).toEqual(pozasBefore);
    const count = (db2.prepare('SELECT COUNT(*) AS n FROM galpones').get() as { n: number }).n;
    expect(count).toBe(4);

    // Verificar relaciones galpon_id → galpones.id
    for (const p of pozasAfter) {
      const exists = db2.prepare('SELECT 1 FROM galpones WHERE id = ?').get(p.galpon_id);
      expect(exists).toBeTruthy();
    }

    db2.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
