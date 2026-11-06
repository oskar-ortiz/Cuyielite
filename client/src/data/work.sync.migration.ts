import {
  computeSchemaChecksum,
  initializeWorkDatabase,
  validatePhysicalSchema,
  type MigrationDb,
  type WorkDbIdentity,
  WorkMigrationError,
} from './work.migration.js';
import { WORK_SYNC_SQL, WORK_SYNC_VERSION } from './work.sync.schema.js';

export interface WorkSyncIdentity extends WorkDbIdentity {
  deviceId: string;
  scopeId: string | null;
  cursor: string | null;
  syncChecksum: string;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_SYNC_COLUMNS: Record<string, string[]> = {
  sync_context: ['singleton', 'dataset_id', 'device_id', 'scope_id', 'protocol_version', 'cursor'],
  sync_record_state: ['entity', 'record_id', 'server_version', 'server_snapshot', 'local_head_operation_id'],
  sync_outbox: [
    'local_seq',
    'operation_id',
    'entity',
    'record_id',
    'action',
    'business_snapshot',
    'base_anchor',
    'predecessor_id',
    'parent_create_id',
    'state',
    'frozen_request',
    'result_json',
    'created_at',
  ],
};

async function scalar(db: MigrationDb, sql: string, params?: unknown[]): Promise<unknown> {
  const row = (await db.query(sql, params)).values?.[0] as Record<string, unknown> | undefined;
  return row ? Object.values(row)[0] : null;
}

async function meta(db: MigrationDb, key: string): Promise<string | null> {
  return (await scalar(db, 'SELECT value FROM meta WHERE key = ?', [key])) as string | null;
}

async function userVersion(db: MigrationDb): Promise<number> {
  return Number(await scalar(db, 'PRAGMA user_version'));
}

export async function computeSyncChecksum(): Promise<string> {
  if (!crypto?.subtle) throw new WorkMigrationError('SHA-256 no disponible para esquema de sync');
  const bytes = new TextEncoder().encode(WORK_SYNC_SQL);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validateSyncSchema(db: MigrationDb): Promise<void> {
  await validatePhysicalSchema(db);
  for (const [table, columns] of Object.entries(REQUIRED_SYNC_COLUMNS)) {
    const exists = await scalar(db, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
    if (!exists) throw new WorkMigrationError(`Esquema sync incompleto: falta ${table}`);
    const rows = (await db.query(`PRAGMA table_info(${table})`)).values ?? [];
    const present = new Set(rows.map((row: any) => String(row.name ?? row[1])));
    for (const column of columns) {
      if (!present.has(column)) throw new WorkMigrationError(`Esquema sync incompleto: falta ${table}.${column}`);
    }
  }
  const indexes = (await db.query('PRAGMA index_list(sync_outbox)')).values ?? [];
  const prepared = indexes.find((row: any) => String(row.name ?? row[1]) === 'sync_outbox_one_prepared') as
    Record<string, unknown> | undefined;
  if (!prepared || Number(prepared.unique ?? prepared[2]) !== 1 || Number(prepared.partial ?? prepared[4]) !== 1) {
    throw new WorkMigrationError('Esquema sync incompleto: falta índice único parcial de operación preparada');
  }
  const indexColumns = (await db.query('PRAGMA index_info(sync_outbox_one_prepared)')).values ?? [];
  if (indexColumns.map((row: any) => String(row.name ?? row[2])).join(',') !== 'entity,record_id') {
    throw new WorkMigrationError('Esquema sync incoherente: columnas del índice preparado');
  }
  const indexSql = String(
    await scalar(db, "SELECT sql FROM sqlite_master WHERE type='index' AND name='sync_outbox_one_prepared'"),
  );
  if (!/WHERE\s+state\s*=\s*'prepared'/i.test(indexSql)) {
    throw new WorkMigrationError('Esquema sync incoherente: filtro del índice preparado');
  }
  const outboxFks = (await db.query('PRAGMA foreign_key_list(sync_outbox)')).values ?? [];
  const presentFks = new Set(
    outboxFks.map((row: any) => String(row.from ?? row[3]) + '->' + String(row.table ?? row[2])),
  );
  for (const column of ['predecessor_id', 'parent_create_id']) {
    if (!presentFks.has(column + '->sync_outbox')) throw new WorkMigrationError(`Falta FK sync_outbox.${column}`);
  }
  const fkErrors = (await db.query('PRAGMA foreign_key_check')).values ?? [];
  if (fkErrors.length) throw new WorkMigrationError('Esquema sync inválido: foreign_key_check');
}

async function validateV3(db: MigrationDb): Promise<WorkSyncIdentity> {
  if ((await userVersion(db)) !== WORK_SYNC_VERSION) throw new WorkMigrationError('Versión de sync incoherente');
  if ((await meta(db, 'schema_family')) !== 'cuyielite-work')
    throw new WorkMigrationError('Familia de base de trabajo incoherente');
  if ((await meta(db, 'schema_version')) !== String(WORK_SYNC_VERSION))
    throw new WorkMigrationError('Meta.schema_version incoherente');
  const checksum = await computeSchemaChecksum();
  if ((await meta(db, 'schema_checksum')) !== checksum)
    throw new WorkMigrationError('Checksum histórico de C2 alterado');
  const syncChecksum = await computeSyncChecksum();
  if ((await meta(db, 'sync_schema_checksum')) !== syncChecksum)
    throw new WorkMigrationError('Checksum de sync alterado');
  if ((await meta(db, 'sync_migration_id')) !== '0002_work_sync')
    throw new WorkMigrationError('Migración de sync desconocida');
  const datasetId = await meta(db, 'dataset_id');
  if (!datasetId || !UUID_V4.test(datasetId)) throw new WorkMigrationError('dataset_id inválido');
  await validateSyncSchema(db);
  const rows =
    (await db.query('SELECT singleton, dataset_id, device_id, scope_id, protocol_version, cursor FROM sync_context'))
      .values ?? [];
  if (rows.length !== 1) throw new WorkMigrationError('Contexto sync ausente o duplicado');
  const context = rows[0] as Record<string, unknown>;
  if (
    context.singleton !== 1 ||
    context.dataset_id !== datasetId ||
    !UUID_V4.test(String(context.device_id)) ||
    context.protocol_version !== 1
  ) {
    throw new WorkMigrationError('Identidad de contexto sync incoherente');
  }
  return {
    schemaFamily: 'cuyielite-work',
    schemaVersion: WORK_SYNC_VERSION,
    datasetId,
    checksum,
    deviceId: String(context.device_id),
    scopeId: context.scope_id as string | null,
    cursor: context.cursor as string | null,
    syncChecksum,
  };
}

export async function initializeWorkSyncDatabase(db: MigrationDb): Promise<WorkSyncIdentity> {
  await db.exec('PRAGMA foreign_keys = ON');
  let version = await userVersion(db);
  if (version > WORK_SYNC_VERSION) throw new WorkMigrationError(`Versión futura de trabajo: ${version}`);
  if (version === WORK_SYNC_VERSION) return validateV3(db);
  if (version === 0) {
    await initializeWorkDatabase(db);
    version = await userVersion(db);
  }
  if (version !== 2) throw new WorkMigrationError(`Base no reconocida como trabajo v2: ${version}`);
  await initializeWorkDatabase(db); // valida identidad, checksum y esquema C2 antes de cambiarlo

  await db.exec('BEGIN IMMEDIATE');
  try {
    const current = await userVersion(db);
    if (current === WORK_SYNC_VERSION) {
      await db.exec('COMMIT');
      return validateV3(db);
    }
    if (current !== 2) throw new WorkMigrationError('La base cambió durante el upgrade');
    await initializeWorkDatabase(db); // revalida dentro de la transacción
    const statements = WORK_SYNC_SQL.split(';')
      .map((part) => part.trim())
      .filter(Boolean);
    for (const statement of statements) await db.exec(`${statement};`);
    const datasetId = await meta(db, 'dataset_id');
    if (!datasetId) throw new WorkMigrationError('dataset_id ausente');
    if (!crypto?.randomUUID) throw new WorkMigrationError('crypto.randomUUID no disponible');
    await db.run(
      'INSERT INTO sync_context(singleton,dataset_id,device_id,scope_id,protocol_version,cursor) VALUES(1,?,?,NULL,1,NULL)',
      [datasetId, crypto.randomUUID()],
    );
    await db.run("INSERT INTO meta(key,value) VALUES('sync_schema_checksum',?)", [await computeSyncChecksum()]);
    await db.run("INSERT INTO meta(key,value) VALUES('sync_migration_id','0002_work_sync')");
    await db.run("UPDATE meta SET value=? WHERE key='schema_version'", [String(WORK_SYNC_VERSION)]);
    await db.exec(`PRAGMA user_version = ${WORK_SYNC_VERSION}`);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
  return validateV3(db);
}
