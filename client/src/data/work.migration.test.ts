import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect } from 'vitest';

import {
  initializeWorkDatabase,
  computeSchemaChecksum,
  WORK_SCHEMA_VERSION,
  WORK_SCHEMA_FAMILY,
  WORK_SCHEMA_SQL,
} from './work.migration';

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

describe('work.migration', () => {
  it('inicializa desde cero: esquema completo y cero filas de negocio', async () => {
    const { db, adapter } = makeDb();
    const before = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(before.user_version).toBe(0);

    const identity = await initializeWorkDatabase(adapter);
    expect(identity.schemaFamily).toBe(WORK_SCHEMA_FAMILY);
    expect(identity.schemaVersion).toBe(WORK_SCHEMA_VERSION);

    const after = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(after.user_version).toBe(WORK_SCHEMA_VERSION);

    for (const t of ['galpones', 'pozas', 'cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias', 'meta']) {
      const row = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(t);
      expect(row).toBeTruthy();
    }
    for (const t of ['galpones', 'pozas', 'cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias']) {
      const r = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number };
      expect(r.n).toBe(0);
    }

    // metadatos
    const family = db.prepare("SELECT value FROM meta WHERE key='schema_family'").get() as { value: string };
    expect(family.value).toBe(WORK_SCHEMA_FAMILY);
    const datasetId = db.prepare("SELECT value FROM meta WHERE key='dataset_id'").get() as { value: string };
    expect(datasetId.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    const checksum = db.prepare("SELECT value FROM meta WHERE key='schema_checksum'").get() as { value: string };
    const expected = await computeSchemaChecksum();
    expect(checksum.value).toBe(expected);

    db.close();
  });

  it('FK activas: foreign_key_check sin errores', async () => {
    const { db, adapter } = makeDb();
    await initializeWorkDatabase(adapter);
    const fk = db.prepare('PRAGMA foreign_key_check').all();
    expect(fk).toHaveLength(0);
    const fkOn = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
    expect(fkOn.foreign_keys).toBe(1);
    db.close();
  });

  it('segundo inicio: mismo dataset_id, version y checksum (no-op)', async () => {
    const { db, adapter } = makeDb();
    const id1 = await initializeWorkDatabase(adapter);
    const id2 = await initializeWorkDatabase(adapter);
    expect(id2.datasetId).toBe(id1.datasetId);
    expect(id2.schemaVersion).toBe(id1.schemaVersion);
    expect(id2.checksum).toBe(id1.checksum);
    const count = (db.prepare('SELECT COUNT(*) AS n FROM meta').get() as { n: number }).n;
    expect(count).toBe(5);
    db.close();
  });

  it('rechaza version futura sin degradar', async () => {
    const { db, adapter } = makeDb();
    db.exec('PRAGMA user_version = 99');
    await db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_family','cuyielite-work')");
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow(/incompatible/i);
    db.close();
  });

  it('rechaza base demo (version 1) sin convertirla', async () => {
    const { db, adapter } = makeDb();
    db.exec('PRAGMA user_version = 1');
    await db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_family','demo')");
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow(/no se convierte/i);
    db.close();
  });

  it('rechaza identidad desconocida (tablas existentes)', async () => {
    const { db, adapter } = makeDb();
    await db.exec('CREATE TABLE galpones (id TEXT PRIMARY KEY)');
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow(/identidad desconocida/i);
    db.close();
  });

  it('error intermedio revierte esquema, version y metadatos', async () => {
    const { db } = makeDb();
    // Adapter que falla al ejecutar un CREATE TABLE especifico (no en BEGIN/ROLLBACK).
    const adapter = {
      exec: (sql: string) => {
        if (sql.trim().toUpperCase().startsWith('CREATE TABLE') && sql.includes('partos')) {
          throw new Error('fallo inyectado');
        }
        db.exec(sql);
      },
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
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow(/fallo inyectado/i);
    // Verificar rollback: sin tablas de usuario, sin metadatos, version 0.
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    expect(tables).toHaveLength(0);
    const v = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(v.user_version).toBe(0);
    // Reintento debe funcionar.
    const adapter2 = {
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
    const identity = await initializeWorkDatabase(adapter2);
    expect(identity.schemaFamily).toBe(WORK_SCHEMA_FAMILY);
    db.close();
  });

  it('chapa duplicada permitida', async () => {
    const { db, adapter } = makeDb();
    await initializeWorkDatabase(adapter);
    const g = crypto.randomUUID();
    const p = crypto.randomUUID();
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare('INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (?,?,?,?)').run(
      g,
      'G',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    db.prepare(
      'INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run(p, g, 'P', 'cria', 5, new Date().toISOString(), new Date().toISOString());
    const c1 = crypto.randomUUID();
    const c2 = crypto.randomUUID();
    db.prepare('INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (?,?,?,?,?)').run(
      c1,
      p,
      'CHAPA1',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    db.prepare('INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (?,?,?,?,?)').run(
      c2,
      p,
      'CHAPA1',
      new Date().toISOString(),
      new Date().toISOString(),
    );
    const count = (
      db.prepare('SELECT COUNT(*) AS n FROM cuyes WHERE codigo_identificacion=?').get('CHAPA1') as { n: number }
    ).n;
    expect(count).toBe(2);
    db.close();
  });

  it('NULL se distingue de cero', async () => {
    const { db, adapter } = makeDb();
    await initializeWorkDatabase(adapter);
    const g = crypto.randomUUID();
    const p = crypto.randomUUID();
    const now = new Date().toISOString();
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare('INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (?,?,?,?)').run(g, 'G', now, now);
    db.prepare(
      'INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run(p, g, 'P', 'cria', 5, now, now);
    const m = crypto.randomUUID();
    db.prepare('INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (?,?,?,?,?)').run(
      m,
      p,
      'M',
      now,
      now,
    );
    const parto = crypto.randomUUID();
    db.prepare(
      'INSERT INTO partos (id,madre_id,tamano_camada_nacida,nacidos_vivos,nacidos_muertos,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run(parto, m, null, null, null, now, now);
    const row = db
      .prepare('SELECT tamano_camada_nacida, nacidos_vivos, nacidos_muertos FROM partos WHERE id=?')
      .get(parto) as {
      tamano_camada_nacida: number | null;
      nacidos_vivos: number | null;
      nacidos_muertos: number | null;
    };
    expect(row.tamano_camada_nacida).toBeNull();
    expect(row.nacidos_vivos).toBeNull();
    expect(row.nacidos_muertos).toBeNull();
    db.close();
  });

  it('pesos decimales se conservan exactamente', async () => {
    const { db, adapter } = makeDb();
    await initializeWorkDatabase(adapter);
    const g = crypto.randomUUID();
    const p = crypto.randomUUID();
    const c = crypto.randomUUID();
    const now = new Date().toISOString();
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare('INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (?,?,?,?)').run(g, 'G', now, now);
    db.prepare(
      'INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run(p, g, 'P', 'cria', 5, now, now);
    db.prepare('INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (?,?,?,?,?)').run(
      c,
      p,
      'C',
      now,
      now,
    );
    const pesaje = crypto.randomUUID();
    db.prepare(
      'INSERT INTO pesajes (id,cuy_id,fecha_pesaje,peso_gramos,created_at,updated_at) VALUES (?,?,?,?,?,?)',
    ).run(pesaje, c, '2026-01-05', '123.45', now, now);
    const row = db.prepare('SELECT peso_gramos FROM pesajes WHERE id=?').get(pesaje) as { peso_gramos: string };
    expect(row.peso_gramos).toBe('123.45');
    db.close();
  });

  it('un parto admite varias crias; una cria no admite dos partos', async () => {
    const { db, adapter } = makeDb();
    await initializeWorkDatabase(adapter);
    const g = crypto.randomUUID();
    const p = crypto.randomUUID();
    const m = crypto.randomUUID();
    const now = new Date().toISOString();
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare('INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (?,?,?,?)').run(g, 'G', now, now);
    db.prepare(
      'INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    ).run(p, g, 'P', 'cria', 5, now, now);
    db.prepare('INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (?,?,?,?,?)').run(
      m,
      p,
      'M',
      now,
      now,
    );
    const parto = crypto.randomUUID();
    db.prepare('INSERT INTO partos (id,madre_id,created_at,updated_at) VALUES (?,?,?,?)').run(parto, m, now, now);
    const c1 = crypto.randomUUID();
    const c2 = crypto.randomUUID();
    db.prepare('INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (?,?,?,?,?)').run(
      c1,
      p,
      'C1',
      now,
      now,
    );
    db.prepare('INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (?,?,?,?,?)').run(
      c2,
      p,
      'C2',
      now,
      now,
    );
    db.prepare('INSERT INTO parto_crias (id,parto_id,cuy_id,created_at) VALUES (?,?,?,?)').run(
      crypto.randomUUID(),
      parto,
      c1,
      now,
    );
    db.prepare('INSERT INTO parto_crias (id,parto_id,cuy_id,created_at) VALUES (?,?,?,?)').run(
      crypto.randomUUID(),
      parto,
      c2,
      now,
    );
    const count = (db.prepare('SELECT COUNT(*) AS n FROM parto_crias WHERE parto_id=?').get(parto) as { n: number }).n;
    expect(count).toBe(2);
    const parto2 = crypto.randomUUID();
    db.prepare('INSERT INTO partos (id,madre_id,created_at,updated_at) VALUES (?,?,?,?)').run(parto2, m, now, now);
    expect(() => {
      db.prepare('INSERT INTO parto_crias (id,parto_id,cuy_id,created_at) VALUES (?,?,?,?)').run(
        crypto.randomUUID(),
        parto2,
        c1,
        now,
      );
    }).toThrow();
    db.close();
  });

  it('checksum alterado se rechaza', async () => {
    const { db, adapter } = makeDb();
    await initializeWorkDatabase(adapter);
    // alterar checksum
    db.prepare("UPDATE meta SET value='deadbeef' WHERE key='schema_checksum'").run();
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow(/checksum.*alterado/i);
    db.close();
  });

  it('esquema incompleto se rechaza', async () => {
    const { db, adapter } = makeDb();
    const checksum = await computeSchemaChecksum();
    await db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_family','cuyielite-work')");
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_version','2')");
    await db.exec("INSERT INTO meta (key,value) VALUES ('dataset_id','11111111-1111-4111-8111-111111111111')");
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_checksum','" + checksum + "')");
    // Create all tables but remove a required column from cuyes
    const stmts = WORK_SCHEMA_SQL.split(';')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    for (const st of stmts) {
      if (st.toUpperCase().includes('CREATE TABLE') && st.toUpperCase().includes('CUYES')) {
        // Create cuyes without color_codigo
        await db.exec(st.replace('color_codigo TEXT,', '').replace('color_codigo TEXT', ''));
      } else {
        await db.exec(st + ';');
      }
    }
    db.exec('PRAGMA user_version = 2');
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow(/incompleto/i);
    db.close();
  });

  it('esquema incompleto por columna faltante (Codex)', async () => {
    const { db, adapter } = makeDb();
    // Primero inicializar correctamente
    await initializeWorkDatabase(adapter);
    // Eliminar columna color_codigo simulando esquema alterado
    // SQLite no soporta DROP COLUMN en versiones antiguas; recrear tabla sin la columna.
    db.exec('ALTER TABLE cuyes RENAME TO cuyes_backup');
    const cols =
      'id, poza_id, galpon_origen_id, codigo_identificacion, sexo, fecha_nacimiento, ojos_codigo, pelaje_original, padre_id, madre_id, categoria_ml, ultimo_peso_g, estado, created_at, updated_at, synced_at, deleted_at';
    db.exec(
      `CREATE TABLE cuyes (${cols.replace(/, /g, ' TEXT, ')} TEXT)`.replace('id TEXT', 'id TEXT PRIMARY KEY NOT NULL'),
    );
    db.exec(`INSERT INTO cuyes (${cols}) SELECT ${cols} FROM cuyes_backup`);
    db.exec('DROP TABLE cuyes_backup');
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow(/incompleto/i);
    db.close();
  });

  it('esquema incompleto por FK faltante se rechaza', async () => {
    const { db, adapter } = makeDb();
    const checksum = await computeSchemaChecksum();
    // Create all tables but without FK on partos.madre_id
    const stmts = WORK_SCHEMA_SQL.split(';')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
    for (const st of stmts) {
      if (st.toUpperCase().includes('CREATE TABLE') && st.toUpperCase().includes('PARTOS')) {
        await db.exec(st.replace('madre_id TEXT NOT NULL REFERENCES cuyes(id),', 'madre_id TEXT NOT NULL,') + ';');
      } else {
        await db.exec(st + ';');
      }
    }
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_family','cuyielite-work')");
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_version','2')");
    await db.exec("INSERT INTO meta (key,value) VALUES ('dataset_id','11111111-1111-4111-8111-111111111111')");
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_checksum','" + checksum + "')");
    db.exec('PRAGMA user_version = 2');
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow(/FK|incompleto/i);
    db.close();
  });

  it('inicializacion concurrente sin duplicacion', async () => {
    const { db, adapter } = makeDb();
    const [a, b] = await Promise.all([initializeWorkDatabase(adapter), initializeWorkDatabase(adapter)]);
    expect(a.datasetId).toBe(b.datasetId);
    const count = (db.prepare('SELECT COUNT(*) AS n FROM meta').get() as { n: number }).n;
    expect(count).toBe(5);
    db.close();
  });

  it('base rechazada no se altera', async () => {
    const { db, adapter } = makeDb();
    db.exec('PRAGMA user_version = 1');
    await db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    await db.exec("INSERT INTO meta (key,value) VALUES ('schema_family','demo')");
    const before = db.prepare('PRAGMA user_version').get() as { user_version: number };
    await expect(initializeWorkDatabase(adapter)).rejects.toThrow();
    const after = db.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(after.user_version).toBe(before.user_version);
    db.close();
  });

  it('recovery tras fallo permite reintento', async () => {
    const { db } = makeDb();
    // adapter que falla
    const badAdapter = {
      exec: (sql: string) => {
        if (sql.includes('cuyes')) throw new Error('boom');
        db.exec(sql);
      },
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
    await expect(initializeWorkDatabase(badAdapter)).rejects.toThrow(/boom/i);
    // reintento con adapter bueno
    const goodAdapter = {
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
    const identity = await initializeWorkDatabase(goodAdapter);
    expect(identity.schemaFamily).toBe(WORK_SCHEMA_FAMILY);
    db.close();
  });

  it('reapertura conserva dataset_id y checksum', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-db-'));
    const dbPath = path.join(tmpDir, 'trabajo.db');

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
    const id1 = await initializeWorkDatabase(adapter1);
    db1.close();

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
    const id2 = await initializeWorkDatabase(adapter2);
    expect(id2.datasetId).toBe(id1.datasetId);
    expect(id2.schemaVersion).toBe(id1.schemaVersion);
    expect(id2.checksum).toBe(id1.checksum);
    const v = db2.prepare('PRAGMA user_version').get() as { user_version: number };
    expect(v.user_version).toBe(WORK_SCHEMA_VERSION);
    db2.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
