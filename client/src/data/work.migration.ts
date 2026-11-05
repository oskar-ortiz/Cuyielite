import { WORK_SCHEMA_FAMILY, WORK_SCHEMA_VERSION, WORK_SCHEMA_SQL } from './work.schema.js';

export { WORK_SCHEMA_FAMILY, WORK_SCHEMA_VERSION, WORK_SCHEMA_SQL } from './work.schema.js';

export interface MigrationDb {
  exec(sql: string): void | Promise<void>;
  run(sql: string, params?: unknown[]): void | Promise<void>;
  query(sql: string, params?: unknown[]): { values?: unknown[] } | Promise<{ values?: unknown[] }>;
}

export interface WorkDbIdentity {
  schemaFamily: string;
  schemaVersion: number;
  datasetId: string;
  checksum: string;
}

const REQUIRED_TABLES = ['galpones', 'pozas', 'cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias', 'meta'];

export class WorkMigrationError extends Error {}

export async function computeSchemaChecksum(): Promise<string> {
  const text = WORK_SCHEMA_SQL;
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new WorkMigrationError('SHA-256 no disponible (crypto.subtle requerido)');
  }
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function uuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  throw new WorkMigrationError('crypto.randomUUID no disponible; se requiere para dataset_id');
}

async function tableExists(db: MigrationDb, name: string): Promise<boolean> {
  const rows = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]);
  return (rows.values ?? []).length > 0;
}

async function readMeta(db: MigrationDb, key: string): Promise<string | null> {
  try {
    const rows = await db.query('SELECT value FROM meta WHERE key = ?', [key]);
    const r = rows.values?.[0] as { value?: string } | undefined;
    return r?.value ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('no such table')) {
      return null;
    }
    throw err;
  }
}

async function readUserVersion(db: MigrationDb): Promise<number> {
  const rows = await db.query('PRAGMA user_version');
  const r = rows.values?.[0] as { user_version?: number } | undefined;
  return Number(r?.user_version ?? 0);
}

async function listUserTables(db: MigrationDb): Promise<string[]> {
  const rows = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  return (rows.values ?? []).map((r: any) => String(r.name ?? r[0]));
}

const REQUIRED_COLUMNS: Record<string, string[]> = {
  galpones: ['id', 'nombre', 'ubicacion', 'created_at', 'updated_at', 'deleted_at'],
  pozas: ['id', 'galpon_id', 'codigo', 'tipo', 'capacidad_maxima', 'created_at', 'updated_at', 'deleted_at'],
  cuyes: [
    'id',
    'poza_id',
    'galpon_origen_id',
    'codigo_identificacion',
    'sexo',
    'fecha_nacimiento',
    'color_codigo',
    'ojos_codigo',
    'pelaje_original',
    'padre_id',
    'madre_id',
    'categoria_ml',
    'ultimo_peso_g',
    'estado',
    'created_at',
    'updated_at',
    'synced_at',
    'deleted_at',
  ],
  partos: [
    'id',
    'madre_id',
    'fecha_parto',
    'tamano_camada_nacida',
    'nacidos_vivos',
    'nacidos_muertos',
    'numero_parto',
    'created_at',
    'updated_at',
    'synced_at',
    'deleted_at',
  ],
  pesajes: [
    'id',
    'cuy_id',
    'fecha_pesaje',
    'peso_gramos',
    'etapa',
    'parto_id',
    'evento_id',
    'created_at',
    'updated_at',
    'synced_at',
    'deleted_at',
  ],
  eventos: [
    'id',
    'cuy_id',
    'tipo',
    'fecha',
    'macho_id',
    'poza_origen_id',
    'poza_destino_id',
    'detalle',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  parto_crias: ['id', 'parto_id', 'cuy_id', 'rol', 'created_at'],
  meta: ['key', 'value'],
};

const REQUIRED_FKS: Record<string, [string, string][]> = {
  pozas: [['galpon_id', 'galpones']],
  cuyes: [
    ['poza_id', 'pozas'],
    ['galpon_origen_id', 'galpones'],
    ['padre_id', 'cuyes'],
    ['madre_id', 'cuyes'],
  ],
  partos: [['madre_id', 'cuyes']],
  pesajes: [
    ['cuy_id', 'cuyes'],
    ['parto_id', 'partos'],
    ['evento_id', 'eventos'],
  ],
  eventos: [
    ['cuy_id', 'cuyes'],
    ['macho_id', 'cuyes'],
    ['poza_origen_id', 'pozas'],
    ['poza_destino_id', 'pozas'],
  ],
  parto_crias: [
    ['parto_id', 'partos'],
    ['cuy_id', 'cuyes'],
  ],
};

async function validatePhysicalSchema(db: MigrationDb): Promise<void> {
  // 1. Tablas requeridas.
  for (const t of REQUIRED_TABLES) {
    if (!(await tableExists(db, t))) {
      throw new WorkMigrationError(`Esquema incompleto: falta tabla ${t}`);
    }
  }
  // 2. Columnas esenciales por tabla.
  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    const rows = await db.query(`PRAGMA table_info(${table})`);
    const present = new Set((rows.values ?? []).map((r: any) => String(r.name ?? r[1])));
    for (const col of cols) {
      if (!present.has(col)) {
        throw new WorkMigrationError(`Esquema incompleto: falta columna ${table}.${col}`);
      }
    }
  }
  // 3. Restriccion UNIQUE(cuy_id) en parto_crias.
  const idxRows = await db.query(`PRAGMA index_list(parto_crias)`);
  const indexes = idxRows.values ?? [];
  let hasUniqueCuy = false;
  for (const idx of indexes) {
    const idxName = String((idx as any).name ?? (idx as any)[1]);
    const unique = Number((idx as any).unique ?? (idx as any)[2]);
    if (unique === 1) {
      const info = await db.query(`PRAGMA index_info(${idxName})`);
      const cols = (info.values ?? []).map((r: any) => String(r.name ?? r[2]));
      if (cols.length === 1 && cols[0] === 'cuy_id') {
        hasUniqueCuy = true;
      }
    }
  }
  if (!hasUniqueCuy) {
    throw new WorkMigrationError('Esquema incompleto: falta UNIQUE(cuy_id) en parto_crias');
  }
  // 4. foreign_key_check sin errores.
  const fkErrors = await db.query('PRAGMA foreign_key_check');
  if ((fkErrors.values ?? []).length > 0) {
    throw new WorkMigrationError('Esquema invalido: foreign_key_check con errores');
  }
  // 5. FK esperadas presentes.
  for (const [table, expected] of Object.entries(REQUIRED_FKS)) {
    const rows = await db.query('PRAGMA foreign_key_list(' + table + ')');
    const present = new Set((rows.values ?? []).map((r: any) => (r.from ?? r[3]) + '->' + (r.table ?? r[2])));
    for (const [col, ref] of expected) {
      if (!present.has(col + '->' + ref)) {
        throw new WorkMigrationError('Esquema incompleto: falta FK ' + table + '.' + col + ' -> ' + ref);
      }
    }
  }
}

async function validateIdentity(db: MigrationDb, expectedChecksum: string): Promise<WorkDbIdentity> {
  const version = await readUserVersion(db);
  const family = await readMeta(db, 'schema_family');
  const schemaVersion = await readMeta(db, 'schema_version');
  const datasetId = await readMeta(db, 'dataset_id');
  const checksum = await readMeta(db, 'schema_checksum');

  if (version !== WORK_SCHEMA_VERSION) {
    throw new WorkMigrationError(`user_version incoherente: ${version} != ${WORK_SCHEMA_VERSION}`);
  }
  if (family !== WORK_SCHEMA_FAMILY) {
    throw new WorkMigrationError(`familia incoherente: ${family}`);
  }
  if (schemaVersion !== String(WORK_SCHEMA_VERSION)) {
    throw new WorkMigrationError(`meta.schema_version incoherente: ${schemaVersion}`);
  }
  if (!datasetId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(datasetId)) {
    throw new WorkMigrationError('dataset_id invalido o ausente');
  }
  if (checksum !== expectedChecksum) {
    throw new WorkMigrationError('checksum de esquema alterado');
  }
  await validatePhysicalSchema(db);
  return { schemaFamily: family, schemaVersion: version, datasetId, checksum: expectedChecksum };
}

export async function initializeWorkDatabase(db: MigrationDb): Promise<WorkDbIdentity> {
  await db.exec('PRAGMA foreign_keys = ON');

  const expectedChecksum = await computeSchemaChecksum();

  // Lectura inicial (fuera de transaccion).
  const version0 = await readUserVersion(db);
  const family0 = await readMeta(db, 'schema_family');

  // Version futura: informar incompatibilidad sin degradar.
  if (version0 > WORK_SCHEMA_VERSION) {
    throw new WorkMigrationError(`Esquema incompatible: user_version ${version0} > ${WORK_SCHEMA_VERSION}`);
  }

  // Version demo (1) u otra identidad no reconocida: rechazar conversion.
  if (version0 !== 0 && !(version0 === WORK_SCHEMA_VERSION && family0 === WORK_SCHEMA_FAMILY)) {
    throw new WorkMigrationError(
      `Base existente no reconocida como trabajo (user_version=${version0}, familia=${family0 ?? 'desconocida'}). No se convierte automaticamente.`,
    );
  }

  // Caso: trabajo v2 reconocido -> validar identidad y checksum; no-op.
  if (version0 === WORK_SCHEMA_VERSION && family0 === WORK_SCHEMA_FAMILY) {
    return validateIdentity(db, expectedChecksum);
  }

  // v0: rechazar si hay cualquier tabla de usuario ajena.
  const existingTables = await listUserTables(db);
  if (existingTables.length > 0) {
    throw new WorkMigrationError(
      `Base existente con tablas de usuario (${existingTables.join(', ')}): identidad desconocida, no se reinicializa`,
    );
  }

  // Transaccion unica.
  await db.exec('BEGIN');
  try {
    // Releer version e identidad dentro de la transaccion.
    const versionTx = await readUserVersion(db);
    const familyTx = await readMeta(db, 'schema_family');
    if (versionTx !== 0 || familyTx !== null) {
      throw new WorkMigrationError('Estado cambiado durante inicializacion; se rechaza');
    }
    // Re-verificar tablas de usuario dentro de la transaccion.
    const tablesTx = await listUserTables(db);
    if (tablesTx.length > 0) {
      throw new WorkMigrationError('Tablas de usuario aparecieron durante inicializacion');
    }

    const statements = WORK_SCHEMA_SQL.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await db.exec(stmt + ';');
    }

    const newDatasetId = uuidV4();
    await db.run("INSERT INTO meta (key, value) VALUES ('schema_family', ?)", [WORK_SCHEMA_FAMILY]);
    await db.run("INSERT INTO meta (key, value) VALUES ('schema_version', ?)", [String(WORK_SCHEMA_VERSION)]);
    await db.run("INSERT INTO meta (key, value) VALUES ('dataset_id', ?)", [newDatasetId]);
    await db.run("INSERT INTO meta (key, value) VALUES ('schema_checksum', ?)", [expectedChecksum]);
    // Registro de migracion (idempotente, una sola).
    await db.run("INSERT INTO meta (key, value) VALUES ('migration_id', ?)", ['0001_work_schema']);

    await db.exec(`PRAGMA user_version = ${WORK_SCHEMA_VERSION}`);

    await db.exec('COMMIT');
    return {
      schemaFamily: WORK_SCHEMA_FAMILY,
      schemaVersion: WORK_SCHEMA_VERSION,
      datasetId: newDatasetId,
      checksum: expectedChecksum,
    };
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

// Promesa compartida por base. Invalida al fallar; permite reintento.
const _initPromises = new Map<string, Promise<WorkDbIdentity>>();

export function getSharedInitPromise(key: string, factory: () => Promise<WorkDbIdentity>): Promise<WorkDbIdentity> {
  const existing = _initPromises.get(key);
  if (existing) {
    return existing;
  }
  const p = factory();
  _initPromises.set(key, p);
  p.then(
    () => {},
    () => {
      if (_initPromises.get(key) === p) {
        _initPromises.delete(key);
      }
    },
  );
  return p;
}

export function clearSharedInitPromise(key: string): void {
  _initPromises.delete(key);
}
