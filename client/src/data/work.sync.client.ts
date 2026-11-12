import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

export type SyncEntity = 'galpon' | 'poza' | 'cuyes' | 'partos' | 'pesajes' | 'eventos' | 'parto_crias';
export type SyncProtocol = 1 | 2;
type Row = Record<string, unknown>;

const V1_ENTITIES: ReadonlySet<SyncEntity> = new Set<SyncEntity>(['galpon', 'poza']);
const V2_FIELDS: Record<Exclude<SyncEntity, 'galpon' | 'poza'>, string[]> = {
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
    'estado',
  ],
  partos: ['madre_id', 'fecha_parto', 'numero_parto', 'nacidos_vivos', 'nacidos_muertos', 'tamano_camada_nacida'],
  pesajes: ['cuy_id', 'fecha_pesaje', 'peso_gramos', 'etapa', 'parto_id', 'evento_id'],
  eventos: ['cuy_id', 'tipo', 'fecha', 'macho_id', 'poza_origen_id', 'poza_destino_id', 'detalle'],
  parto_crias: ['parto_id', 'cuy_id', 'rol'],
};

export function protocolForEntity(entity: SyncEntity): SyncProtocol {
  return V1_ENTITIES.has(entity) ? 1 : 2;
}

export function freezePayload(entity: SyncEntity, snapshot: Record<string, unknown>): Record<string, unknown> {
  if (V1_ENTITIES.has(entity)) return snapshot;
  const fields = V2_FIELDS[entity as Exclude<SyncEntity, 'galpon' | 'poza'>];
  if (!fields) throw new Error(`Entidad v2 desconocida: ${entity}`);
  return Object.fromEntries(fields.map((field) => [field, snapshot[field] ?? null]));
}

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  const res = await db.query(sql, params);
  return ((res.values ?? [])[0] as Row | undefined) ?? null;
}

async function all(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row[]> {
  const res = await db.query(sql, params);
  return (res.values ?? []) as Row[];
}

async function tx<T>(db: MigrationDb, work: () => Promise<T>): Promise<T> {
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

export interface FrozenRequest {
  protocol_version: SyncProtocol;
  device_id: string;
  operations: {
    operation_id: string;
    entity: SyncEntity;
    record_id: string;
    action: 'create' | 'update';
    base_version: string | null;
    client_created_at?: string | null;
    client_edited_at?: string | null;
    data: unknown;
  }[];
}

export interface SyncRecord {
  id: string;
  version: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  last_client_edited_at: string | null;
  data: unknown;
}

export interface SyncOperationResult {
  operation_id: string;
  entity: SyncEntity;
  record_id: string;
  status: 'accepted' | 'conflict' | 'rejected';
  changed: boolean;
  code: string | null;
  record: SyncRecord | null;
}

export interface SyncPushResponse {
  protocol_version: number;
  results: SyncOperationResult[];
}

export type SendFn = (request: FrozenRequest) => Promise<SyncPushResponse>;

export class SyncReceiptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncReceiptError';
  }
}

function isSyncRecord(value: unknown, recordId: string): value is SyncRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<SyncRecord>;
  return (
    record.id === recordId &&
    typeof record.version === 'string' &&
    /^[1-9][0-9]*$/.test(record.version) &&
    typeof record.created_at === 'string' &&
    typeof record.updated_at === 'string' &&
    (record.deleted_at === null || typeof record.deleted_at === 'string') &&
    (record.last_client_edited_at === null || typeof record.last_client_edited_at === 'string') &&
    record.data !== null &&
    typeof record.data === 'object'
  );
}

export function validateReceipt(request: FrozenRequest, response: SyncPushResponse): void {
  if (response.protocol_version !== request.protocol_version) {
    throw new SyncReceiptError('protocol_version mismatch');
  }
  if (!Array.isArray(response.results) || response.results.length !== request.operations.length) {
    throw new SyncReceiptError('result count mismatch');
  }

  const expected = new Map(request.operations.map((operation) => [operation.operation_id, operation]));
  if (expected.size !== request.operations.length) {
    throw new SyncReceiptError('duplicate request operation_id');
  }
  const received = new Set<string>();
  for (const result of response.results) {
    if (!result || typeof result !== 'object') throw new SyncReceiptError('invalid result');
    if (received.has(result.operation_id)) throw new SyncReceiptError('duplicate result operation_id');
    received.add(result.operation_id);
    const operation = expected.get(result.operation_id);
    if (!operation) throw new SyncReceiptError('unknown result operation_id');
    if (result.entity !== operation.entity || result.record_id !== operation.record_id) {
      throw new SyncReceiptError('result record mismatch');
    }
    if (!['accepted', 'conflict', 'rejected'].includes(result.status)) {
      throw new SyncReceiptError('invalid result status');
    }
    if (typeof result.changed !== 'boolean' || (result.code !== null && typeof result.code !== 'string')) {
      throw new SyncReceiptError('invalid result fields');
    }
    if (result.status === 'accepted' && !isSyncRecord(result.record, operation.record_id)) {
      throw new SyncReceiptError('accepted result has invalid record');
    }
    if (result.record !== null && !isSyncRecord(result.record, operation.record_id)) {
      throw new SyncReceiptError('invalid result record');
    }
  }
  if (received.size !== expected.size) throw new SyncReceiptError('missing result operation_id');
}

export async function prepareOperation(
  db: MigrationDb,
  localSeq: number,
  deviceId: string,
  protocols: ReadonlySet<SyncProtocol> = new Set<SyncProtocol>([1, 2]),
): Promise<boolean> {
  return tx(db, async () => {
    const op = await one(db, 'SELECT * FROM sync_outbox WHERE local_seq=?', [localSeq]);
    if (!op || op.state !== 'queued') return false;

    const entity = op.entity as SyncEntity;
    const protocol = protocolForEntity(entity);
    if (!protocols.has(protocol)) return false;

    const predecessorId = op.predecessor_id as string | null;
    let acceptedPredecessorVersion: string | null = null;
    if (predecessorId) {
      const predecessor = await one(db, 'SELECT state,result_json FROM sync_outbox WHERE operation_id=?', [
        predecessorId,
      ]);
      if (!predecessor || predecessor.state !== 'accepted') return false;
      const receipt = JSON.parse(String(predecessor.result_json ?? 'null')) as SyncOperationResult | null;
      const version = receipt?.record?.version;
      if (
        receipt?.status !== 'accepted' ||
        receipt.operation_id !== predecessorId ||
        receipt.entity !== op.entity ||
        receipt.record_id !== op.record_id ||
        !version ||
        !/^[1-9][0-9]*$/.test(version)
      ) {
        throw new Error('Recibo aceptado de predecesora incoherente');
      }
      acceptedPredecessorVersion = version;
    }

    const parentCreateId = op.parent_create_id as string | null;
    if (parentCreateId) {
      const parent = await one(db, 'SELECT state FROM sync_outbox WHERE operation_id=?', [parentCreateId]);
      if (!parent || parent.state !== 'accepted') return false;
    }

    const recordId = op.record_id as string;
    const action = op.action as string;
    if (action !== 'create' && action !== 'update') return false;

    const baseVersion =
      action === 'create' ? null : (acceptedPredecessorVersion ?? (op.base_anchor as string | null) ?? null);
    if (action === 'update' && (!baseVersion || !/^[1-9][0-9]*$/.test(baseVersion))) return false;

    const snapshot = JSON.parse(op.business_snapshot as string) as Record<string, unknown>;
    const frozen: FrozenRequest = {
      protocol_version: protocol,
      device_id: deviceId,
      operations: [
        {
          operation_id: op.operation_id as string,
          entity,
          record_id: recordId,
          action,
          base_version: baseVersion,
          client_created_at: action === 'create' ? (op.created_at as string) : null,
          client_edited_at: op.created_at as string,
          data: freezePayload(entity, snapshot),
        },
      ],
    };
    await db.run("UPDATE sync_outbox SET state='prepared', frozen_request=? WHERE local_seq=? AND state='queued'", [
      JSON.stringify(frozen),
      localSeq,
    ]);
    return true;
  });
}

export async function prepareEligible(
  db: MigrationDb,
  deviceId: string,
  maxLocalSeq = Number.MAX_SAFE_INTEGER,
  protocols: ReadonlySet<SyncProtocol> = new Set<SyncProtocol>([1, 2]),
): Promise<number> {
  await initializeWorkSyncDatabase(db);
  const queued = await all(
    db,
    "SELECT local_seq FROM sync_outbox WHERE state='queued' AND local_seq<=? ORDER BY local_seq",
    [maxLocalSeq],
  );
  let prepared = 0;
  for (const row of queued) {
    if (await prepareOperation(db, row.local_seq as number, deviceId, protocols)) prepared++;
  }
  return prepared;
}

function isRetryableDependency(result: SyncOperationResult): boolean {
  return (
    result.status === 'rejected' && (result.code === 'DEPENDENCY_PENDING' || result.code === 'DEPENDENCY_REJECTED')
  );
}

async function requeueDependency(db: MigrationDb, result: SyncOperationResult): Promise<void> {
  const operation = await one(db, 'SELECT * FROM sync_outbox WHERE operation_id=?', [result.operation_id]);
  if (!operation) throw new Error('La operación con dependencia ya no existe');
  const newOperationId = crypto.randomUUID();
  await db.run("UPDATE sync_outbox SET state='superseded', result_json=? WHERE operation_id=? AND state='prepared'", [
    JSON.stringify(result),
    result.operation_id,
  ]);
  await db.run(
    'INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,base_anchor,predecessor_id,' +
      'parent_create_id,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [
      newOperationId,
      operation.entity,
      operation.record_id,
      operation.action,
      operation.business_snapshot,
      operation.base_anchor ?? null,
      operation.predecessor_id ?? null,
      operation.parent_create_id ?? null,
      'queued',
      operation.created_at,
    ],
  );
  // Las ediciones posteriores del mismo registro y las altas hijas deben
  // encadenarse a la operación reintentada, no a la supersedida.
  await db.run('UPDATE sync_outbox SET predecessor_id=? WHERE predecessor_id=?', [newOperationId, result.operation_id]);
  await db.run('UPDATE sync_outbox SET parent_create_id=? WHERE parent_create_id=?', [
    newOperationId,
    result.operation_id,
  ]);
  await db.run(
    'UPDATE sync_record_state SET local_head_operation_id=? WHERE entity=? AND record_id=? AND local_head_operation_id=?',
    [newOperationId, operation.entity, operation.record_id, operation.operation_id],
  );
}

export async function sendPrepared(
  db: MigrationDb,
  send: SendFn,
  protocols: ReadonlySet<SyncProtocol> = new Set<SyncProtocol>([1, 2]),
): Promise<{ sent: number; failed: number; errors: string[] }> {
  await initializeWorkSyncDatabase(db);
  const prepared = await all(
    db,
    "SELECT local_seq, frozen_request FROM sync_outbox WHERE state='prepared' ORDER BY local_seq",
  );
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of prepared) {
    try {
      const frozen = JSON.parse(String(row.frozen_request)) as FrozenRequest;
      if (!protocols.has(frozen.protocol_version)) continue;
      const response = await send(frozen);
      validateReceipt(frozen, response);

      await tx(db, async () => {
        for (const result of response.results) {
          const outbox = await one(db, 'SELECT state FROM sync_outbox WHERE operation_id=?', [result.operation_id]);
          if (!outbox || outbox.state !== 'prepared') {
            throw new Error('La operaciÃ³n preparada cambiÃ³ antes de aplicar el recibo');
          }
          const retryableDependency = isRetryableDependency(result);
          if (retryableDependency) {
            await requeueDependency(db, result);
            continue;
          }
          await db.run("UPDATE sync_outbox SET state=?, result_json=? WHERE operation_id=? AND state='prepared'", [
            result.status,
            JSON.stringify(result),
            result.operation_id,
          ]);
          if (result.record) {
            const current = await one(
              db,
              'SELECT server_version,local_head_operation_id FROM sync_record_state WHERE entity=? AND record_id=?',
              [result.entity, result.record_id],
            );
            const currentVersion = current?.server_version as string | null;
            if (!currentVersion || BigInt(result.record.version) >= BigInt(currentVersion)) {
              await db.run(
                'INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id) VALUES(?,?,?,?,?) ' +
                  'ON CONFLICT(entity,record_id) DO UPDATE SET server_version=excluded.server_version, server_snapshot=excluded.server_snapshot',
                [
                  result.entity,
                  result.record_id,
                  result.record.version,
                  JSON.stringify(result.record),
                  (current?.local_head_operation_id as string | null) ?? null,
                ],
              );
            }
          }
        }
      });
      sent++;
    } catch (error) {
      failed++;
      errors.push(error instanceof Error ? error.message : String(error));
      // No se alteran frozen_request ni state; el mismo cuerpo queda disponible para reintento.
    }
  }
  return { sent, failed, errors };
}
