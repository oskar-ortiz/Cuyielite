import {
  computeSchemaChecksum,
  initializeWorkDatabase,
  validatePhysicalSchema,
  type MigrationDb,
  type WorkDbIdentity,
  WorkMigrationError,
} from './work.migration.js';
import {
  WORK_DOMAIN_SYNC_SQL,
  WORK_DOMAIN_SYNC_VERSION,
  WORK_ENTITY_NAMES,
  WORK_SYNC_SQL,
  WORK_SYNC_VERSION,
} from './work.sync.schema.js';

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

export async function computeDomainSyncChecksum(): Promise<string> {
  if (!crypto?.subtle) throw new WorkMigrationError('SHA-256 no disponible para esquema de dominio');
  const bytes = new TextEncoder().encode(WORK_DOMAIN_SYNC_SQL);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

async function tableSql(db: MigrationDb, table: string): Promise<string> {
  return String((await scalar(db, "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", [table])) ?? '');
}

async function readIndexSql(db: MigrationDb, index: string): Promise<string> {
  return String((await scalar(db, "SELECT sql FROM sqlite_master WHERE type='index' AND name=?", [index])) ?? '');
}

async function assertOutboxIndexes(db: MigrationDb): Promise<void> {
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
  if (!/WHERE\s+state\s*=\s*'prepared'/i.test(await readIndexSql(db, 'sync_outbox_one_prepared'))) {
    throw new WorkMigrationError('Esquema sync incoherente: filtro del índice preparado');
  }
  if (!(await readIndexSql(db, 'sync_outbox_record'))) {
    throw new WorkMigrationError('Esquema sync incompleto: falta índice sync_outbox_record');
  }
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

async function validateDomainSyncSchema(db: MigrationDb): Promise<void> {
  await validatePhysicalSchema(db);
  const required: Record<string, string[]> = {
    ...REQUIRED_SYNC_COLUMNS,
    sync_inbox: [
      'inbox_id',
      'dataset_id',
      'scope_id',
      'seq',
      'entity',
      'record_id',
      'server_version',
      'payload',
      'missing_refs',
      'state',
      'code',
      'received_at',
      'applied_at',
    ],
  };
  for (const [table, columns] of Object.entries(required)) {
    const exists = await scalar(db, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
    if (!exists) throw new WorkMigrationError(`Esquema sync incompleto: falta ${table}`);
    const rows = (await db.query(`PRAGMA table_info(${table})`)).values ?? [];
    const present = new Set(rows.map((row: any) => String(row.name ?? row[1])));
    for (const column of columns) {
      if (!present.has(column)) throw new WorkMigrationError(`Esquema sync incompleto: falta ${table}.${column}`);
    }
  }
  for (const table of ['sync_record_state', 'sync_outbox']) {
    const ddl = await tableSql(db, table);
    for (const entity of WORK_ENTITY_NAMES) {
      if (!ddl.includes(`'${entity}'`)) {
        throw new WorkMigrationError(`Esquema sync v4 incompleto: ${table} no admite ${entity}`);
      }
    }
  }
  await assertOutboxIndexes(db);
  const outboxFks = (await db.query('PRAGMA foreign_key_list(sync_outbox)')).values ?? [];
  const presentFks = new Set(
    outboxFks.map((row: any) => String(row.from ?? row[3]) + '->' + String(row.table ?? row[2])),
  );
  for (const column of ['predecessor_id', 'parent_create_id']) {
    if (!presentFks.has(column + '->sync_outbox')) throw new WorkMigrationError(`Falta FK sync_outbox.${column}`);
  }
  const inboxDdl = await tableSql(db, 'sync_inbox');
  for (const state of ['staged', 'applied', 'incomplete']) {
    if (!inboxDdl.includes(`'${state}'`)) {
      throw new WorkMigrationError(`Esquema sync v4 incompleto: sync_inbox sin estado ${state}`);
    }
  }
  const inboxIndexes = (await db.query('PRAGMA index_list(sync_inbox)')).values ?? [];
  const uniqueInbox = inboxIndexes.find((row: any) => Number(row.unique ?? row[2]) === 1) as
    Record<string, unknown> | undefined;
  const inboxColumns = uniqueInbox
    ? ((await db.query(`PRAGMA index_info(${String(uniqueInbox.name ?? uniqueInbox[1])})`)).values ?? []).map(
        (row: any) => String(row.name ?? row[2]),
      )
    : [];
  if (inboxColumns.join(',') !== 'dataset_id,scope_id,entity,record_id') {
    throw new WorkMigrationError('Esquema sync v4 incoherente: unicidad de sync_inbox');
  }
  const fkErrors = (await db.query('PRAGMA foreign_key_check')).values ?? [];
  if (fkErrors.length) throw new WorkMigrationError('Esquema sync v4 inválido: foreign_key_check');
}

async function validateV4(db: MigrationDb): Promise<WorkSyncIdentity> {
  if ((await userVersion(db)) !== WORK_DOMAIN_SYNC_VERSION)
    throw new WorkMigrationError('Versión de dominio sync incoherente');
  if ((await meta(db, 'schema_family')) !== 'cuyielite-work')
    throw new WorkMigrationError('Familia de base de trabajo incoherente');
  if ((await meta(db, 'schema_version')) !== String(WORK_DOMAIN_SYNC_VERSION))
    throw new WorkMigrationError('Meta.schema_version incoherente');
  const checksum = await computeSchemaChecksum();
  if ((await meta(db, 'schema_checksum')) !== checksum)
    throw new WorkMigrationError('Checksum histórico de C2 alterado');
  const syncChecksum = await computeDomainSyncChecksum();
  if ((await meta(db, 'sync_schema_checksum')) !== syncChecksum)
    throw new WorkMigrationError('Checksum de dominio sync alterado');
  if ((await meta(db, 'sync_migration_id')) !== '0003_work_domain_sync')
    throw new WorkMigrationError('Migración de dominio sync desconocida');
  const datasetId = await meta(db, 'dataset_id');
  if (!datasetId || !UUID_V4.test(datasetId)) throw new WorkMigrationError('dataset_id inválido');
  await validateDomainSyncSchema(db);
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
    schemaVersion: WORK_DOMAIN_SYNC_VERSION,
    datasetId,
    checksum,
    deviceId: String(context.device_id),
    scopeId: context.scope_id as string | null,
    cursor: context.cursor as string | null,
    syncChecksum,
  };
}

// Migración v2 -> v3. Exportada para pruebas y para reutilizar la cadena histórica.
export async function migrateWorkSyncV2ToV3(db: MigrationDb): Promise<void> {
  await initializeWorkDatabase(db); // valida identidad, checksum y esquema C2 antes de cambiarlo

  await db.exec('BEGIN IMMEDIATE');
  try {
    const current = await userVersion(db);
    if (current === WORK_SYNC_VERSION) {
      await db.exec('COMMIT');
      return;
    }
    if (current !== 2) throw new WorkMigrationError('La base cambió durante el upgrade');
    await initializeWorkDatabase(db); // revalida dentro de la transacción
    for (const statement of sqlStatements(WORK_SYNC_SQL)) await db.exec(`${statement};`);
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
}

// Migración v3 -> v4: copia conservadora de outbox/record_state con CHECK ampliado
// y creación de sync_inbox. No toca el checksum histórico de C2 ni filas de dominio.
export async function migrateWorkSyncV3ToV4(db: MigrationDb): Promise<void> {
  await validateV3(db);
  await db.exec('BEGIN IMMEDIATE');
  try {
    if ((await userVersion(db)) !== WORK_SYNC_VERSION) {
      throw new WorkMigrationError('La base cambió durante el upgrade a dominio');
    }
    await validateV3(db); // revalida bajo el bloqueo de escritura
    const previousChecksum = String(await meta(db, 'sync_schema_checksum'));
    const outboxBefore = Number(await scalar(db, 'SELECT COUNT(*) FROM sync_outbox'));
    const stateBefore = Number(await scalar(db, 'SELECT COUNT(*) FROM sync_record_state'));

    await db.exec('PRAGMA defer_foreign_keys = ON');
    await db.exec('DROP INDEX IF EXISTS sync_outbox_one_prepared');
    await db.exec('DROP INDEX IF EXISTS sync_outbox_record');
    await db.exec('ALTER TABLE sync_record_state RENAME TO sync_record_state_v3');
    await db.exec('ALTER TABLE sync_outbox RENAME TO sync_outbox_v3');
    for (const statement of sqlStatements(WORK_DOMAIN_SYNC_SQL)) await db.exec(`${statement};`);

    await db.exec(
      'INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id) ' +
        'SELECT entity,record_id,server_version,server_snapshot,local_head_operation_id FROM sync_record_state_v3',
    );
    await db.exec(
      'INSERT INTO sync_outbox(local_seq,operation_id,entity,record_id,action,business_snapshot,base_anchor,' +
        'predecessor_id,parent_create_id,state,frozen_request,result_json,created_at) ' +
        'SELECT local_seq,operation_id,entity,record_id,action,business_snapshot,base_anchor,' +
        'predecessor_id,parent_create_id,state,frozen_request,result_json,created_at FROM sync_outbox_v3',
    );

    if (
      Number(await scalar(db, 'SELECT COUNT(*) FROM sync_outbox')) !== outboxBefore ||
      Number(await scalar(db, 'SELECT COUNT(*) FROM sync_record_state')) !== stateBefore
    ) {
      throw new WorkMigrationError('La copia de tablas sync perdió filas');
    }

    await db.exec('DROP TABLE sync_record_state_v3');
    await db.exec('DROP TABLE sync_outbox_v3');

    await db.run("UPDATE meta SET value=? WHERE key='schema_version'", [String(WORK_DOMAIN_SYNC_VERSION)]);
    await db.run(
      "INSERT INTO meta(key,value) VALUES('previous_sync_checksum',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [previousChecksum],
    );
    await db.run(
      "INSERT INTO meta(key,value) VALUES('previous_sync_migration_id','0002_work_sync') " +
        'ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    );
    await db.run("UPDATE meta SET value=? WHERE key='sync_schema_checksum'", [await computeDomainSyncChecksum()]);
    await db.run("UPDATE meta SET value='0003_work_domain_sync' WHERE key='sync_migration_id'");
    await db.exec(`PRAGMA user_version = ${WORK_DOMAIN_SYNC_VERSION}`);

    const fkErrors = (await db.query('PRAGMA foreign_key_check')).values ?? [];
    if (fkErrors.length) throw new WorkMigrationError('Esquema sync v4 inválido: foreign_key_check');
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

export async function initializeWorkSyncDatabase(db: MigrationDb): Promise<WorkSyncIdentity> {
  await db.exec('PRAGMA foreign_keys = ON');
  let version = await userVersion(db);
  if (version > WORK_DOMAIN_SYNC_VERSION) throw new WorkMigrationError(`Versión futura de trabajo: ${version}`);
  if (version === WORK_DOMAIN_SYNC_VERSION) return validateV4(db);
  if (version === 0) {
    await initializeWorkDatabase(db);
    version = await userVersion(db);
  }
  if (version === 2) {
    await migrateWorkSyncV2ToV3(db);
    version = await userVersion(db);
  }
  if (version !== WORK_SYNC_VERSION) throw new WorkMigrationError(`Base no reconocida como trabajo v3: ${version}`);
  await migrateWorkSyncV3ToV4(db);
  return validateV4(db);
}
