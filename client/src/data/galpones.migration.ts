// Módulo compartido de migración y seed para la PoC de galpones/pozas.
// No depende de una plataforma: recibe una conexión con la interfaz MigrationDb.

export const SCHEMA_VERSION = 1;

export interface MigrationDb {
  exec(sql: string): void | Promise<void>;
  run(sql: string, params?: unknown[]): void | Promise<void>;
  query(sql: string, params?: unknown[]): { values?: unknown[] } | Promise<{ values?: unknown[] }>;
}

export interface GalponSeed {
  id: string;
  nombre: string;
  ubicacion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PozaSeed {
  id: string;
  galponId: string;
  codigo: string;
  tipo: string;
  capacidadMaxima: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeedData {
  galpones: GalponSeed[];
  pozas: PozaSeed[];
}

const SEED_TIMESTAMP = '2026-01-01T00:00:00Z';

function uuidV4(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('crypto.randomUUID no está disponible en este entorno; se requiere para generar UUID v4');
  }
  return crypto.randomUUID();
}

export function generateSeed(): SeedData {
  const gNorte = uuidV4();
  const gSur = uuidV4();
  const gOccidente = uuidV4();
  const gEste = uuidV4();

  const galpones: GalponSeed[] = [
    {
      id: gNorte,
      nombre: 'Galpón Norte',
      ubicacion: 'Lote 1, sector norte',
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: gSur,
      nombre: 'Galpón Sur',
      ubicacion: 'Lote 2, junto a la bodega',
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: gOccidente,
      nombre: 'Galpón Occidente',
      ubicacion: 'Lote 3, ladera oeste',
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: gEste,
      nombre: 'Galpón Este',
      ubicacion: 'Lote 4, en adecuación',
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
  ];

  const pozas: PozaSeed[] = [
    {
      id: uuidV4(),
      galponId: gNorte,
      codigo: 'P-101',
      tipo: 'cría',
      capacidadMaxima: 50,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: uuidV4(),
      galponId: gNorte,
      codigo: 'P-102',
      tipo: 'engorde',
      capacidadMaxima: 30,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: uuidV4(),
      galponId: gNorte,
      codigo: 'P-103',
      tipo: 'reproducción',
      capacidadMaxima: 80,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: uuidV4(),
      galponId: gSur,
      codigo: 'P-201',
      tipo: 'cría',
      capacidadMaxima: 20,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: uuidV4(),
      galponId: gSur,
      codigo: 'P-202',
      tipo: 'engorde',
      capacidadMaxima: 60,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
    {
      id: uuidV4(),
      galponId: gOccidente,
      codigo: 'P-301',
      tipo: 'engorde',
      capacidadMaxima: 45,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    },
  ];

  return { galpones, pozas };
}

export async function migrateAndSeed(db: MigrationDb): Promise<void> {
  // Habilitar claves foráneas por conexión.
  await db.exec('PRAGMA foreign_keys = ON');

  // Leer user_version.
  const versionRows = await db.query('PRAGMA user_version');
  const version = Number(versionRows.values?.[0]?.user_version ?? 0);

  if (version > SCHEMA_VERSION) {
    throw new Error(`Esquema incompatible: user_version ${version} > ${SCHEMA_VERSION}`);
  }
  if (version === SCHEMA_VERSION) {
    return; // omitir inicialización
  }

  // version === 0: migración + seed + user_version en una transacción.
  await db.exec('BEGIN');
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS galpones (
      id TEXT PRIMARY KEY NOT NULL,
      nombre TEXT NOT NULL,
      ubicacion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS pozas (
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

    await db.exec(`CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )`);

    // Seed solo si no existe la bandera 'seeded'.
    const seededRows = await db.query("SELECT value FROM meta WHERE key = 'seeded'");
    const alreadySeeded = (seededRows.values?.length ?? 0) > 0;

    if (!alreadySeeded) {
      const seed = generateSeed();
      for (const g of seed.galpones) {
        await db.run(
          'INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)',
          [g.id, g.nombre, g.ubicacion, g.createdAt, g.updatedAt, null],
        );
      }
      for (const p of seed.pozas) {
        await db.run(
          'INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [p.id, p.galponId, p.codigo, p.tipo, p.capacidadMaxima, p.createdAt, p.updatedAt, null],
        );
      }
      await db.run("INSERT INTO meta (key, value) VALUES ('seeded', '1')");
    }

    await db.run(
      "INSERT INTO meta (key, value) VALUES ('schema_version', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    );

    await db.exec('PRAGMA user_version = 1');

    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
