import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase, type WorkSyncIdentity } from './work.sync.migration.js';
import {
  ENTITY_PULL_ORDER,
  stableJson,
  SyncPullError,
  validatePullPage,
  type Entity,
  type PullRecord,
  type SyncPullItem,
} from './work.sync.pull.validation.js';

type Row = Record<string, unknown>;

const DOMAIN_ENTITIES: ReadonlySet<Entity> = new Set<Entity>(['cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias']);

const ENTITY_TABLE: Record<Entity, string> = {
  galpon: 'galpones',
  poza: 'pozas',
  cuyes: 'cuyes',
  partos: 'partos',
  pesajes: 'pesajes',
  eventos: 'eventos',
  parto_crias: 'parto_crias',
};

const BUSINESS_FIELDS: Record<Entity, string[]> = {
  galpon: ['nombre', 'ubicacion'],
  poza: ['galpon_id', 'codigo', 'tipo', 'capacidad_maxima'],
  cuyes: [
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
  ],
  partos: ['madre_id', 'fecha_parto', 'numero_parto', 'nacidos_vivos', 'nacidos_muertos', 'tamano_camada_nacida'],
  pesajes: ['cuy_id', 'fecha_pesaje', 'peso_gramos', 'etapa', 'parto_id', 'evento_id'],
  eventos: ['cuy_id', 'tipo', 'fecha', 'macho_id', 'poza_origen_id', 'poza_destino_id', 'detalle'],
  parto_crias: ['parto_id', 'cuy_id', 'rol'],
};

const DEPENDENCIES: Record<Entity, [string, string][]> = {
  galpon: [],
  poza: [['galpon_id', 'galpones']],
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

export interface ApplyPageResult {
  applied: number;
  preservedLocal: number;
  ignoredOlder: number;
  staged: number;
  reconciled: number;
  conflicts: number;
  cursor: string;
}

export interface InboxEntry {
  inboxId: number;
  entity: Entity;
  recordId: string;
  serverVersion: string;
  seq: string;
  state: 'staged' | 'applied' | 'incomplete';
  code: string | null;
  missingRefs: string[];
  payload: PullRecord;
}

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

async function transaction<T>(db: MigrationDb, work: () => Promise<T>): Promise<T> {
  await initializeWorkSyncDatabase(db);
  await db.exec('BEGIN IMMEDIATE');
  try {
    await initializeWorkSyncDatabase(db);
    const result = await work();
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function isUniqueFailure(error: unknown): boolean {
  return /UNIQUE constraint failed/i.test(error instanceof Error ? error.message : String(error));
}

function isForeignKeyFailure(error: unknown): boolean {
  return /FOREIGN KEY constraint failed/i.test(error instanceof Error ? error.message : String(error));
}

async function exists(db: MigrationDb, table: string, id: unknown): Promise<boolean> {
  if (typeof id !== 'string' || id.length === 0) return false;
  return (await one(db, `SELECT 1 AS ok FROM ${table} WHERE id=?`, [id])) !== null;
}

export async function missingDependencies(db: MigrationDb, entity: Entity, record: PullRecord): Promise<string[]> {
  const missing: string[] = [];
  for (const [field, table] of DEPENDENCIES[entity]) {
    const value = record.data[field];
    if (value === null || value === undefined) continue;
    if (!(await exists(db, table, value))) missing.push(`${field}->${table}`);
  }
  return missing;
}

async function hasPendingLocalHead(db: MigrationDb, entity: Entity, recordId: string): Promise<string | null> {
  const row = await one(
    db,
    "SELECT operation_id FROM sync_outbox WHERE entity=? AND record_id=? AND state IN ('queued','prepared') LIMIT 1",
    [entity, recordId],
  );
  return row ? String(row.operation_id) : null;
}

async function recordState(db: MigrationDb, entity: Entity, recordId: string): Promise<Row | null> {
  return one(
    db,
    'SELECT server_version,server_snapshot,local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?',
    [entity, recordId],
  );
}

export async function applyCentralBusinessRecord(db: MigrationDb, entity: Entity, record: PullRecord): Promise<void> {
  if (entity === 'poza') {
    const current = await one(db, 'SELECT galpon_id FROM pozas WHERE id=?', [record.id]);
    if (current && current.galpon_id !== record.data.galpon_id) {
      throw new SyncPullError('pull no puede cambiar el galpón padre de una poza');
    }
  }
  const fields = BUSINESS_FIELDS[entity];
  // parto_crias no tiene updated_at ni deleted_at en el esquema de trabajo.
  const timestamps = entity === 'parto_crias' ? ['created_at'] : ['created_at', 'updated_at', 'deleted_at'];
  const columns = ['id', ...fields, ...timestamps];
  const placeholders = columns.map(() => '?').join(',');
  const updates = [...fields, ...timestamps].map((field) => `${field}=excluded.${field}`).join(',');
  const values = [record.id, ...fields.map((field) => record.data[field] ?? null)];
  for (const column of timestamps)
    values.push(column === 'created_at' ? record.created_at : record[column as 'updated_at' | 'deleted_at']);
  await db.run(
    `INSERT INTO ${ENTITY_TABLE[entity]}(${columns.join(',')}) VALUES(${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
    values,
  );
}

async function storeServerState(
  db: MigrationDb,
  entity: Entity,
  record: PullRecord,
  localHead: string | null,
): Promise<void> {
  await db.run(
    'INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id) VALUES(?,?,?,?,?) ' +
      'ON CONFLICT(entity,record_id) DO UPDATE SET server_version=excluded.server_version,' +
      'server_snapshot=excluded.server_snapshot,local_head_operation_id=excluded.local_head_operation_id',
    [entity, record.id, record.version, JSON.stringify(record), localHead],
  );
}

async function markLocalConflict(
  db: MigrationDb,
  entity: Entity,
  record: PullRecord,
  operationId: string,
): Promise<void> {
  const receipt = {
    operation_id: operationId,
    entity,
    record_id: record.id,
    status: 'conflict',
    changed: false,
    code: 'VERSION_CONFLICT',
    record,
  };
  await db.run(
    "UPDATE sync_outbox SET state='conflict', result_json=? WHERE operation_id=? AND state IN ('queued','prepared')",
    [JSON.stringify(receipt), operationId],
  );
}

async function stageInbox(
  db: MigrationDb,
  identity: WorkSyncIdentity,
  scopeId: string,
  item: SyncPullItem,
  missing: string[],
  errorCode: string | null,
): Promise<void> {
  const state = errorCode ? 'incomplete' : 'staged';
  const existing = await one(
    db,
    'SELECT inbox_id,server_version FROM sync_inbox WHERE dataset_id=? AND scope_id=? AND entity=? AND record_id=?',
    [identity.datasetId, scopeId, item.entity, item.record.id],
  );
  if (existing && BigInt(String(existing.server_version)) > BigInt(item.record.version)) return;
  if (existing) {
    await db.run(
      'UPDATE sync_inbox SET seq=?,server_version=?,payload=?,missing_refs=?,state=?,code=?,received_at=?,applied_at=NULL ' +
        'WHERE inbox_id=?',
      [
        item.seq,
        item.record.version,
        JSON.stringify(item.record),
        JSON.stringify(missing),
        state,
        errorCode,
        nowIso(),
        existing.inbox_id,
      ],
    );
    return;
  }
  await db.run(
    'INSERT INTO sync_inbox(dataset_id,scope_id,seq,entity,record_id,server_version,payload,missing_refs,state,code,received_at,applied_at) ' +
      'VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)',
    [
      identity.datasetId,
      scopeId,
      item.seq,
      item.entity,
      item.record.id,
      item.record.version,
      JSON.stringify(item.record),
      JSON.stringify(missing),
      state,
      errorCode,
      nowIso(),
    ],
  );
}

async function applyItem(
  db: MigrationDb,
  identity: WorkSyncIdentity,
  scopeId: string,
  item: SyncPullItem,
  counts: ApplyPageResult,
): Promise<void> {
  const { entity, record } = item;
  const current = await recordState(db, entity, record.id);
  const currentVersion = (current?.server_version as string | null) ?? null;

  if (currentVersion && BigInt(currentVersion) > BigInt(record.version)) {
    counts.ignoredOlder++;
    return;
  }
  if (currentVersion && BigInt(currentVersion) === BigInt(record.version)) {
    const existingSnapshot = current?.server_snapshot ? JSON.parse(String(current.server_snapshot)) : null;
    if (!existingSnapshot || stableJson(existingSnapshot) !== stableJson(record)) {
      throw new SyncPullError('misma versión central con snapshots diferentes');
    }
    return;
  }

  const headOperationId = await hasPendingLocalHead(db, entity, record.id);
  if (headOperationId) {
    counts.preservedLocal++;
    const diverged = currentVersion !== null && BigInt(record.version) > BigInt(currentVersion);
    if (DOMAIN_ENTITIES.has(entity) && diverged) {
      await markLocalConflict(db, entity, record, headOperationId);
      await storeServerState(db, entity, record, headOperationId);
      counts.conflicts++;
      return;
    }
    // Entidades v1 conservan su comportamiento histórico: se preserva el
    // contenido local y el tombstone central solo marca el borrado lógico.
    if (!DOMAIN_ENTITIES.has(entity) && record.deleted_at !== null) {
      await db.run(`UPDATE ${entity === 'galpon' ? 'galpones' : 'pozas'} SET deleted_at=? WHERE id=?`, [
        record.deleted_at,
        record.id,
      ]);
    }
    await storeServerState(db, entity, record, headOperationId);
    return;
  }

  if (DOMAIN_ENTITIES.has(entity)) {
    const missing = await missingDependencies(db, entity, record);
    if (missing.length > 0) {
      await stageInbox(db, identity, scopeId, item, missing, null);
      counts.staged++;
      return;
    }
    try {
      await applyCentralBusinessRecord(db, entity, record);
    } catch (error) {
      if (isUniqueFailure(error)) {
        await stageInbox(db, identity, scopeId, item, [], 'UNIQUE_CONFLICT');
        counts.staged++;
        return;
      }
      if (isForeignKeyFailure(error)) {
        await stageInbox(db, identity, scopeId, item, await missingDependencies(db, entity, record), null);
        counts.staged++;
        return;
      }
      throw error;
    }
    await storeServerState(db, entity, record, null);
    counts.applied++;
    return;
  }

  await applyCentralBusinessRecord(db, entity, record);
  await storeServerState(db, entity, record, null);
  counts.applied++;
}

interface InboxRow extends Row {
  inbox_id: number;
  entity: string;
  record_id: string;
  server_version: string;
  seq: string;
  state: string;
  payload: string;
}

async function pendingInbox(db: MigrationDb): Promise<InboxRow[]> {
  const rows = (await db.query("SELECT * FROM sync_inbox WHERE state IN ('staged','incomplete')")).values ?? [];
  return (rows as InboxRow[]).sort((left, right) => {
    const order = ENTITY_PULL_ORDER[left.entity as Entity] - ENTITY_PULL_ORDER[right.entity as Entity];
    if (order !== 0) return order;
    return BigInt(left.seq) < BigInt(right.seq) ? -1 : BigInt(left.seq) > BigInt(right.seq) ? 1 : 0;
  });
}

async function reconcileInboxInTx(
  db: MigrationDb,
): Promise<{ applied: number; staged: number; incomplete: number; conflicts: number }> {
  let applied = 0;
  let staged = 0;
  let incomplete = 0;
  let conflicts = 0;

  for (let pass = 0; pass < 3; pass++) {
    let progress = false;
    for (const row of await pendingInbox(db)) {
      const entity = row.entity as Entity;
      const record = JSON.parse(String(row.payload)) as PullRecord;
      const current = await recordState(db, entity, record.id);
      const currentVersion = (current?.server_version as string | null) ?? null;
      if (currentVersion && BigInt(currentVersion) >= BigInt(record.version)) {
        await db.run(
          "UPDATE sync_inbox SET state='applied', code=NULL, missing_refs='[]', applied_at=? WHERE inbox_id=?",
          [nowIso(), row.inbox_id],
        );
        applied++;
        progress = true;
        continue;
      }

      const headOperationId = await hasPendingLocalHead(db, entity, record.id);
      if (headOperationId) {
        if (currentVersion !== null && BigInt(record.version) > BigInt(currentVersion)) {
          await markLocalConflict(db, entity, record, headOperationId);
          await storeServerState(db, entity, record, headOperationId);
          await db.run(
            "UPDATE sync_inbox SET state='incomplete', code='LOCAL_CONFLICT', applied_at=NULL WHERE inbox_id=?",
            [row.inbox_id],
          );
          conflicts++;
          incomplete++;
          progress = true;
        }
        continue;
      }

      const missing = await missingDependencies(db, entity, record);
      if (missing.length > 0) {
        await db.run('UPDATE sync_inbox SET missing_refs=?, code=NULL WHERE inbox_id=?', [
          JSON.stringify(missing),
          row.inbox_id,
        ]);
        staged++;
        continue;
      }

      try {
        await applyCentralBusinessRecord(db, entity, record);
        await storeServerState(db, entity, record, null);
        await db.run(
          "UPDATE sync_inbox SET state='applied', code=NULL, missing_refs='[]', applied_at=? WHERE inbox_id=?",
          [nowIso(), row.inbox_id],
        );
        applied++;
        progress = true;
      } catch (error) {
        if (isUniqueFailure(error)) {
          await db.run("UPDATE sync_inbox SET state='incomplete', code='UNIQUE_CONFLICT' WHERE inbox_id=?", [
            row.inbox_id,
          ]);
          incomplete++;
          progress = true;
          continue;
        }
        if (isForeignKeyFailure(error)) {
          await db.run('UPDATE sync_inbox SET missing_refs=? WHERE inbox_id=?', [
            JSON.stringify(await missingDependencies(db, entity, record)),
            row.inbox_id,
          ]);
          staged++;
          continue;
        }
        throw error;
      }
    }
    if (!progress) break;
  }
  return { applied, staged, incomplete, conflicts };
}

export async function applyPullPage(
  db: MigrationDb,
  expectedScopeId: string,
  expectedCursor: string | null,
  response: unknown,
  limit: number,
): Promise<ApplyPageResult> {
  const page = validatePullPage(response, expectedScopeId, limit);
  return transaction(db, async () => {
    const identity = await initializeWorkSyncDatabase(db);
    const context = await one(db, 'SELECT scope_id,cursor FROM sync_context WHERE singleton=1');
    if (!context || context.scope_id !== expectedScopeId) throw new SyncPullError('scope local no coincide');
    const storedCursor = (context.cursor as string | null) ?? null;
    if (storedCursor !== expectedCursor) {
      // Reintento de una página ya confirmada: no duplica ni altera nada.
      if (storedCursor === page.next_cursor) {
        return {
          applied: 0,
          preservedLocal: 0,
          ignoredOlder: 0,
          staged: 0,
          reconciled: 0,
          conflicts: 0,
          cursor: storedCursor,
        };
      }
      throw new SyncPullError('cursor local cambió durante el pull');
    }

    const items = [...page.items].sort((left, right) => {
      const order = ENTITY_PULL_ORDER[left.entity] - ENTITY_PULL_ORDER[right.entity];
      if (order !== 0) return order;
      return BigInt(left.seq) < BigInt(right.seq) ? -1 : BigInt(left.seq) > BigInt(right.seq) ? 1 : 0;
    });

    const counts: ApplyPageResult = {
      applied: 0,
      preservedLocal: 0,
      ignoredOlder: 0,
      staged: 0,
      reconciled: 0,
      conflicts: 0,
      cursor: page.next_cursor,
    };
    for (const item of items) await applyItem(db, identity, expectedScopeId, item, counts);

    const reconciled = await reconcileInboxInTx(db);
    counts.reconciled = reconciled.applied;
    counts.conflicts += reconciled.conflicts;

    await db.run('UPDATE sync_context SET cursor=? WHERE singleton=1 AND scope_id=? AND cursor IS ?', [
      page.next_cursor,
      expectedScopeId,
      expectedCursor,
    ]);
    const check = await one(db, 'SELECT cursor FROM sync_context WHERE singleton=1');
    if (check?.cursor !== page.next_cursor) throw new SyncPullError('no se pudo confirmar cursor pull');
    return counts;
  });
}

// Reintenta el staging durable. Se invoca al iniciar un pull (reapertura) y puede
// llamarse explícitamente para diagnóstico.
export async function reconcileInbox(
  db: MigrationDb,
): Promise<{ applied: number; staged: number; incomplete: number; conflicts: number }> {
  return transaction(db, async () => {
    const context = await one(db, 'SELECT scope_id FROM sync_context WHERE singleton=1');
    if (!context?.scope_id) return { applied: 0, staged: 0, incomplete: 0, conflicts: 0 };
    return reconcileInboxInTx(db);
  });
}

export async function listInboxEntries(
  db: MigrationDb,
  state?: 'staged' | 'applied' | 'incomplete',
): Promise<InboxEntry[]> {
  await initializeWorkSyncDatabase(db);
  const rows =
    (
      await db.query(
        state ? 'SELECT * FROM sync_inbox WHERE state=? ORDER BY seq' : 'SELECT * FROM sync_inbox ORDER BY inbox_id',
        state ? [state] : [],
      )
    ).values ?? [];
  return (rows as InboxRow[]).map((row) => ({
    inboxId: Number(row.inbox_id),
    entity: row.entity as Entity,
    recordId: String(row.record_id),
    serverVersion: String(row.server_version),
    seq: String(row.seq),
    state: row.state as InboxEntry['state'],
    code: (row.code as string | null) ?? null,
    missingRefs: JSON.parse(String(row.missing_refs ?? '[]')) as string[],
    payload: JSON.parse(String(row.payload)) as PullRecord,
  }));
}
