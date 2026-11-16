import type { MigrationDb } from './work.migration.js';

// Migración local propia para el feed derivado de solo lectura (alertas y
// categoría persistida). No altera la cadena de checksums de la base de Trabajo:
// estas tablas son una extensión auditada por su propio identificador.
export const DERIVED_SCHEMA_VERSION = 2;
export const DERIVED_MIGRATION_ID = '0005_work_derived_readonly';
export const DERIVED_PROTOCOL = 3;

export const DERIVED_ENTITIES = ['categoria', 'alerta'] as const;
export type DerivedEntity = (typeof DERIVED_ENTITIES)[number];

const DERIVED_SQL = `
CREATE TABLE IF NOT EXISTS categorias_animal (
  cuy_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  clase TEXT,
  estado_evaluacion TEXT NOT NULL,
  categoria_estado TEXT,
  caracter TEXT,
  motivos TEXT NOT NULL,
  evidencia_pendiente TEXT NOT NULL DEFAULT '[]',
  faltantes TEXT NOT NULL,
  reglas_version TEXT,
  evaluada_at TEXT,
  procedencia TEXT NOT NULL,
  server_snapshot TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alertas_derivadas (
  id TEXT PRIMARY KEY,
  cuy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  tipo_alerta TEXT NOT NULL,
  regla_id TEXT,
  motivo TEXT,
  estado TEXT NOT NULL,
  causa_tipo TEXT,
  causa_id TEXT,
  causa_fecha TEXT,
  fecha_limite TEXT,
  reglas_version TEXT,
  server_snapshot TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alertas_derivadas_cuy
  ON alertas_derivadas (cuy_id, estado);

CREATE TABLE IF NOT EXISTS sync_derived_cursor (
  protocol INTEGER PRIMARY KEY,
  cursor TEXT NOT NULL
);
`;

const REQUIRED_TABLES = ['categorias_animal', 'alertas_derivadas', 'sync_derived_cursor'];

async function one(db: MigrationDb, sql: string, params: unknown[] = []) {
  return ((await db.query(sql, params)).values?.[0] as Record<string, unknown> | undefined) ?? null;
}

async function version(db: MigrationDb): Promise<number> {
  const row = await one(db, "SELECT value FROM meta WHERE key='derived_schema_version'");
  return row ? Number(row.value) : 0;
}

export async function initializeDerivedDatabase(db: MigrationDb): Promise<void> {
  const current = await version(db);
  if (current > DERIVED_SCHEMA_VERSION) {
    throw new Error(`Versión futura del feed derivado: ${current}`);
  }
  if (current === 1) {
    // v1 -> v2: caracter del resultado y evidencia pendiente en la categoría.
    await db.exec('ALTER TABLE categorias_animal ADD COLUMN caracter TEXT');
    await db.exec("ALTER TABLE categorias_animal ADD COLUMN evidencia_pendiente TEXT NOT NULL DEFAULT '[]'");
    await db.run("UPDATE meta SET value=? WHERE key='derived_schema_version'", [String(DERIVED_SCHEMA_VERSION)]);
  } else if (current === 0) {
    await db.exec(DERIVED_SQL);
    await db.run(
      "INSERT INTO meta (key, value) VALUES ('derived_schema_version', ?) " +
        'ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [String(DERIVED_SCHEMA_VERSION)],
    );
    await db.run(
      "INSERT INTO meta (key, value) VALUES ('derived_migration_id', ?) " +
        'ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [DERIVED_MIGRATION_ID],
    );
    return;
  }
  const migration = await one(db, "SELECT value FROM meta WHERE key='derived_migration_id'");
  if (!migration || migration.value !== DERIVED_MIGRATION_ID) {
    throw new Error('Identificador de migración derivada desconocido');
  }
  const tables = (await db.query("SELECT name FROM sqlite_master WHERE type='table'")).values ?? [];
  const names = new Set(tables.map((row) => String((row as { name?: string }).name)));
  for (const table of REQUIRED_TABLES) {
    if (!names.has(table)) throw new Error(`Esquema derivado incompleto: falta ${table}`);
  }
  const columns = (await db.query('PRAGMA table_info(alertas_derivadas)')).values ?? [];
  const columnNames = new Set(columns.map((row) => String((row as { name?: string }).name)));
  for (const column of ['estado', 'regla_id', 'causa_tipo', 'fecha_limite']) {
    if (!columnNames.has(column)) throw new Error(`Esquema derivado incompleto: falta alertas_derivadas.${column}`);
  }
  const categoryColumns = (await db.query('PRAGMA table_info(categorias_animal)')).values ?? [];
  const categoryNames = new Set(categoryColumns.map((row) => String((row as { name?: string }).name)));
  for (const column of ['caracter', 'evidencia_pendiente']) {
    if (!categoryNames.has(column)) throw new Error(`Esquema derivado incompleto: falta categorias_animal.${column}`);
  }
}
