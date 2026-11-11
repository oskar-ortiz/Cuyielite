import type {
  Cuyo,
  CuyoInput,
  Evento,
  EventoInput,
  Parto,
  PartoCria,
  PartoInput,
  Pesaje,
  PesajeInput,
} from './work.domain.validation.js';
import type { MigrationDb } from './work.migration.js';
import { initializeWorkSyncDatabase } from './work.sync.migration.js';

type Row = Record<string, unknown>;
type Entity = 'cuyes' | 'partos' | 'pesajes' | 'eventos' | 'parto_crias';

export interface DomainWriteResult {
  id: string;
  operationId: string | null;
  changed: boolean;
}

const CUYO_FIELDS = [
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
] as const;
const PARTO_FIELDS = [
  'madre_id',
  'fecha_parto',
  'numero_parto',
  'nacidos_vivos',
  'nacidos_muertos',
  'tamano_camada_nacida',
] as const;
const PESAJE_FIELDS = ['cuy_id', 'fecha_pesaje', 'peso_gramos', 'etapa', 'parto_id', 'evento_id'] as const;
const EVENTO_FIELDS = ['cuy_id', 'tipo', 'fecha', 'macho_id', 'poza_origen_id', 'poza_destino_id', 'detalle'] as const;
const VINCULO_FIELDS = ['parto_id', 'cuy_id', 'rol'] as const;

const TABLES: Record<Entity, string> = {
  cuyes: 'cuyes',
  partos: 'partos',
  pesajes: 'pesajes',
  eventos: 'eventos',
  parto_crias: 'parto_crias',
};

function uuidV4(): string {
  if (typeof crypto === 'undefined' || !crypto.randomUUID) throw new Error('UUID v4 no disponible');
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

async function one(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row | null> {
  return ((await db.query(sql, params)).values?.[0] as Row | undefined) ?? null;
}

async function all(db: MigrationDb, sql: string, params: unknown[] = []): Promise<Row[]> {
  return ((await db.query(sql, params)).values ?? []) as Row[];
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

function mapCuyo(row: Row): Cuyo {
  return {
    id: String(row.id),
    pozaId: (row.poza_id as string | null) ?? null,
    galponOrigenId: (row.galpon_origen_id as string | null) ?? null,
    codigoIdentificacion: String(row.codigo_identificacion),
    sexo: (row.sexo as Cuyo['sexo']) ?? null,
    fechaNacimiento: (row.fecha_nacimiento as string | null) ?? null,
    colorCodigo: (row.color_codigo as string | null) ?? null,
    ojosCodigo: (row.ojos_codigo as string | null) ?? null,
    pelajeOriginal: (row.pelaje_original as string | null) ?? null,
    padreId: (row.padre_id as string | null) ?? null,
    madreId: (row.madre_id as string | null) ?? null,
    categoriaMl: (row.categoria_ml as Cuyo['categoriaMl']) ?? null,
    ultimoPesoG: (row.ultimo_peso_g as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapParto(row: Row): Parto {
  return {
    id: String(row.id),
    madreId: String(row.madre_id),
    fechaParto: (row.fecha_parto as string | null) ?? null,
    numeroParto: row.numero_parto === null ? null : Number(row.numero_parto),
    nacidosVivos: row.nacidos_vivos === null ? null : Number(row.nacidos_vivos),
    nacidosMuertos: row.nacidos_muertos === null ? null : Number(row.nacidos_muertos),
    tamanoCamadaNacida: row.tamano_camada_nacida === null ? null : Number(row.tamano_camada_nacida),
  };
}

function mapPesaje(row: Row): Pesaje {
  return {
    id: String(row.id),
    cuyId: String(row.cuy_id),
    fechaPesaje: (row.fecha_pesaje as string | null) ?? null,
    pesoGramos: String(row.peso_gramos),
    etapa: (row.etapa as string | null) ?? null,
    partoId: (row.parto_id as string | null) ?? null,
    eventoId: (row.evento_id as string | null) ?? null,
  };
}

function mapEvento(row: Row): Evento {
  return {
    id: String(row.id),
    cuyId: String(row.cuy_id),
    tipo: String(row.tipo),
    fecha: (row.fecha as string | null) ?? null,
    machoId: (row.macho_id as string | null) ?? null,
    pozaOrigenId: (row.poza_origen_id as string | null) ?? null,
    pozaDestinoId: (row.poza_destino_id as string | null) ?? null,
    detalle: (row.detalle as string | null) ?? null,
  };
}

function mapVinculo(row: Row): PartoCria {
  return {
    id: String(row.id),
    partoId: String(row.parto_id),
    cuyId: String(row.cuy_id),
    rol: String(row.rol),
  };
}

export interface PozaRef {
  id: string;
  galponId: string;
  codigo: string;
  tipo: string;
}

export interface ConflictKey {
  entity: string;
  recordId: string;
}

export async function listPozas(db: MigrationDb): Promise<PozaRef[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(
    db,
    'SELECT id, galpon_id, codigo, tipo FROM pozas WHERE deleted_at IS NULL ORDER BY codigo, id',
  );
  return rows.map((row) => ({
    id: String(row.id),
    galponId: String(row.galpon_id),
    codigo: String(row.codigo),
    tipo: String(row.tipo),
  }));
}

export async function listConflictKeys(db: MigrationDb): Promise<ConflictKey[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(
    db,
    "SELECT entity, record_id FROM sync_outbox WHERE state = 'conflict' AND entity IN ('cuyes','partos','pesajes','eventos','parto_crias')",
  );
  return rows.map((row) => ({ entity: String(row.entity), recordId: String(row.record_id) }));
}

export async function listCuyesByPoza(db: MigrationDb, pozaId: string): Promise<Cuyo[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(
    db,
    'SELECT * FROM cuyes WHERE poza_id = ? AND deleted_at IS NULL ORDER BY codigo_identificacion, id',
    [pozaId],
  );
  return rows.map(mapCuyo);
}

export async function listAllCuyes(db: MigrationDb): Promise<Cuyo[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(db, 'SELECT * FROM cuyes WHERE deleted_at IS NULL ORDER BY codigo_identificacion, id');
  return rows.map(mapCuyo);
}

export async function getCuyo(db: MigrationDb, id: string): Promise<Cuyo | null> {
  await initializeWorkSyncDatabase(db);
  const row = await one(db, 'SELECT * FROM cuyes WHERE id = ? AND deleted_at IS NULL', [id]);
  return row ? mapCuyo(row) : null;
}

export async function listPartosByCuyo(db: MigrationDb, cuyId: string): Promise<Parto[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(
    db,
    'SELECT * FROM partos WHERE madre_id = ? AND deleted_at IS NULL ORDER BY fecha_parto, id',
    [cuyId],
  );
  return rows.map(mapParto);
}

export async function listPesajesByCuyo(db: MigrationDb, cuyId: string): Promise<Pesaje[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(
    db,
    'SELECT * FROM pesajes WHERE cuy_id = ? AND deleted_at IS NULL ORDER BY fecha_pesaje, id',
    [cuyId],
  );
  return rows.map(mapPesaje);
}

export async function listEventosByCuyo(db: MigrationDb, cuyId: string): Promise<Evento[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(db, 'SELECT * FROM eventos WHERE cuy_id = ? AND deleted_at IS NULL ORDER BY fecha, id', [
    cuyId,
  ]);
  return rows.map(mapEvento);
}

export async function listCriasByParto(db: MigrationDb, partoId: string): Promise<Cuyo[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(
    db,
    'SELECT c.* FROM cuyes c JOIN parto_crias pc ON pc.cuy_id = c.id WHERE pc.parto_id = ? AND c.deleted_at IS NULL ' +
      'ORDER BY c.codigo_identificacion, c.id',
    [partoId],
  );
  return rows.map(mapCuyo);
}

export async function listVinculosByCuyo(db: MigrationDb, cuyId: string): Promise<PartoCria[]> {
  await initializeWorkSyncDatabase(db);
  const rows = await all(db, 'SELECT * FROM parto_crias WHERE cuy_id = ?', [cuyId]);
  return rows.map(mapVinculo);
}

async function requireRow(db: MigrationDb, table: string, id: string, label: string): Promise<void> {
  if (!(await one(db, `SELECT 1 AS ok FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [id]))) {
    throw new Error(`${label} no existe en la base de trabajo`);
  }
}

async function pendingCreate(db: MigrationDb, entity: string, id: string): Promise<string | null> {
  const row = await one(
    db,
    "SELECT operation_id, state FROM sync_outbox WHERE entity = ? AND record_id = ? AND action = 'create' ORDER BY local_seq LIMIT 1",
    [entity, id],
  );
  if (!row) return null;
  const state = String(row.state);
  if (state === 'queued' || state === 'prepared') return String(row.operation_id);
  if (state === 'accepted') return null;
  throw new Error('El alta del registro padre requiere resolución explícita antes de continuar');
}

async function predecessor(
  db: MigrationDb,
  entity: Entity,
  id: string,
): Promise<{ id: string | null; base: string | null }> {
  const state = await one(
    db,
    'SELECT server_version, local_head_operation_id FROM sync_record_state WHERE entity = ? AND record_id = ?',
    [entity, id],
  );
  if (!state) throw new Error('El registro no tiene estado de sincronización local');
  const head = state.local_head_operation_id as string | null;
  if (head) {
    const prior = await one(db, 'SELECT state FROM sync_outbox WHERE operation_id = ?', [head]);
    if (!prior) throw new Error('Cadena de operaciones locales incoherente');
    if (prior.state === 'queued' || prior.state === 'prepared') return { id: head, base: null };
    if (prior.state !== 'accepted') throw new Error('La operación previa requiere resolución explícita');
  }
  const base = state.server_version as string | null;
  if (!base || !/^[1-9][0-9]*$/.test(base)) throw new Error('Versión central desconocida para actualizar');
  return { id: null, base };
}

async function enqueue(
  db: MigrationDb,
  entity: Entity,
  recordId: string,
  action: 'create' | 'update',
  snapshot: Record<string, unknown>,
  previous: { id: string | null; base: string | null },
  parentCreateId: string | null,
  now: string,
): Promise<string> {
  const operationId = uuidV4();
  await db.run(
    `INSERT INTO sync_outbox(operation_id,entity,record_id,action,business_snapshot,base_anchor,predecessor_id,parent_create_id,state,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      operationId,
      entity,
      recordId,
      action,
      JSON.stringify(snapshot),
      previous.base,
      previous.id,
      parentCreateId,
      'queued',
      now,
    ],
  );
  await db.run(
    `INSERT INTO sync_record_state(entity,record_id,server_version,server_snapshot,local_head_operation_id)
     VALUES(?,?,NULL,NULL,?) ON CONFLICT(entity,record_id) DO UPDATE SET local_head_operation_id=excluded.local_head_operation_id`,
    [entity, recordId, operationId],
  );
  return operationId;
}

function sameSnapshot(row: Row | null, fields: readonly string[], values: Record<string, unknown>): boolean {
  if (!row) return false;
  return fields.every((field) => {
    const left = row[field] ?? null;
    const right = values[field] ?? null;
    return left === right || (left !== null && right !== null && String(left) === String(right));
  });
}

function cuyoSnapshot(input: CuyoInput) {
  return {
    poza_id: input.pozaId,
    galpon_origen_id: input.galponOrigenId,
    codigo_identificacion: input.codigoIdentificacion,
    sexo: input.sexo,
    fecha_nacimiento: input.fechaNacimiento,
    color_codigo: input.colorCodigo,
    ojos_codigo: input.ojosCodigo,
    pelaje_original: input.pelajeOriginal,
    padre_id: input.padreId,
    madre_id: input.madreId,
    categoria_ml: input.categoriaMl,
    ultimo_peso_g: input.ultimoPesoG,
    estado: input.estado,
  };
}

export async function createCuyo(db: MigrationDb, input: CuyoInput): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    await requireRow(db, 'pozas', input.pozaId, 'La poza');
    if (input.madreId) await requireRow(db, 'cuyes', input.madreId, 'La madre');
    if (input.padreId) await requireRow(db, 'cuyes', input.padreId, 'El padre');
    const id = uuidV4();
    const now = nowIso();
    const snapshot = cuyoSnapshot(input);
    await db.run(
      'INSERT INTO cuyes(id,poza_id,galpon_origen_id,codigo_identificacion,sexo,fecha_nacimiento,color_codigo,ojos_codigo,pelaje_original,padre_id,madre_id,categoria_ml,ultimo_peso_g,estado,created_at,updated_at,deleted_at) ' +
        'VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)',
      [
        id,
        snapshot.poza_id,
        snapshot.galpon_origen_id,
        snapshot.codigo_identificacion,
        snapshot.sexo,
        snapshot.fecha_nacimiento,
        snapshot.color_codigo,
        snapshot.ojos_codigo,
        snapshot.pelaje_original,
        snapshot.padre_id,
        snapshot.madre_id,
        snapshot.categoria_ml,
        snapshot.ultimo_peso_g,
        snapshot.estado,
        now,
        now,
      ],
    );
    const parent = await pendingCreate(db, 'poza', input.pozaId);
    const operationId = await enqueue(db, 'cuyes', id, 'create', snapshot, { id: null, base: null }, parent, now);
    return { id, operationId, changed: true };
  });
}

export async function updateCuyo(db: MigrationDb, id: string, input: CuyoInput): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    const current = await one(db, 'SELECT * FROM cuyes WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!current) throw new Error('El animal no existe en la base de trabajo');
    await requireRow(db, 'pozas', input.pozaId, 'La poza');
    const snapshot = cuyoSnapshot(input);
    if (sameSnapshot(current, CUYO_FIELDS, snapshot)) return { id, operationId: null, changed: false };
    const previous = await predecessor(db, 'cuyes', id);
    const now = nowIso();
    await db.run(
      'UPDATE cuyes SET poza_id=?,galpon_origen_id=?,codigo_identificacion=?,sexo=?,fecha_nacimiento=?,color_codigo=?,ojos_codigo=?,pelaje_original=?,padre_id=?,madre_id=?,categoria_ml=?,ultimo_peso_g=?,estado=?,updated_at=? WHERE id=?',
      [
        snapshot.poza_id,
        snapshot.galpon_origen_id,
        snapshot.codigo_identificacion,
        snapshot.sexo,
        snapshot.fecha_nacimiento,
        snapshot.color_codigo,
        snapshot.ojos_codigo,
        snapshot.pelaje_original,
        snapshot.padre_id,
        snapshot.madre_id,
        snapshot.categoria_ml,
        snapshot.ultimo_peso_g,
        snapshot.estado,
        now,
        id,
      ],
    );
    const operationId = await enqueue(db, 'cuyes', id, 'update', snapshot, previous, null, now);
    return { id, operationId, changed: true };
  });
}

function partoSnapshot(input: PartoInput) {
  return {
    madre_id: input.madreId,
    fecha_parto: input.fechaParto,
    numero_parto: input.numeroParto,
    nacidos_vivos: input.nacidosVivos,
    nacidos_muertos: input.nacidosMuertos,
    tamano_camada_nacida: input.tamanoCamadaNacida,
  };
}

async function linkCrias(
  db: MigrationDb,
  partoId: string,
  madreId: string,
  crias: string[],
  partoOperationId: string | null,
  now: string,
): Promise<number> {
  let added = 0;
  for (const criaId of crias) {
    if (criaId === madreId) throw new Error('La madre no puede ser cría de su propio parto');
    await requireRow(db, 'cuyes', criaId, 'La cría');
    const existing = await one(db, 'SELECT parto_id FROM parto_crias WHERE cuy_id = ?', [criaId]);
    if (existing) {
      if (existing.parto_id === partoId) continue;
      throw new Error('La cría ya está vinculada a otro parto');
    }
    const id = uuidV4();
    const snapshot = { parto_id: partoId, cuy_id: criaId, rol: 'CRIA' };
    await db.run('INSERT INTO parto_crias(id,parto_id,cuy_id,rol,created_at) VALUES(?,?,?,?,?)', [
      id,
      partoId,
      criaId,
      'CRIA',
      now,
    ]);
    await enqueue(db, 'parto_crias', id, 'create', snapshot, { id: null, base: null }, partoOperationId, now);
    added++;
  }
  return added;
}

export async function createParto(db: MigrationDb, input: PartoInput): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    await requireRow(db, 'cuyes', input.madreId, 'La madre');
    const id = uuidV4();
    const now = nowIso();
    const snapshot = partoSnapshot(input);
    await db.run(
      'INSERT INTO partos(id,madre_id,fecha_parto,numero_parto,nacidos_vivos,nacidos_muertos,tamano_camada_nacida,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,NULL)',
      [
        id,
        snapshot.madre_id,
        snapshot.fecha_parto,
        snapshot.numero_parto,
        snapshot.nacidos_vivos,
        snapshot.nacidos_muertos,
        snapshot.tamano_camada_nacida,
        now,
        now,
      ],
    );
    const operationId = await enqueue(db, 'partos', id, 'create', snapshot, { id: null, base: null }, null, now);
    await linkCrias(db, id, input.madreId, input.crias, operationId, now);
    return { id, operationId, changed: true };
  });
}

export async function updateParto(db: MigrationDb, id: string, input: PartoInput): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    const current = await one(db, 'SELECT * FROM partos WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!current) throw new Error('El parto no existe en la base de trabajo');
    await requireRow(db, 'cuyes', input.madreId, 'La madre');
    const snapshot = partoSnapshot(input);
    const changed = !sameSnapshot(current, PARTO_FIELDS, snapshot);
    let operationId: string | null = null;
    const now = nowIso();
    if (changed) {
      const previous = await predecessor(db, 'partos', id);
      await db.run(
        'UPDATE partos SET madre_id=?,fecha_parto=?,numero_parto=?,nacidos_vivos=?,nacidos_muertos=?,tamano_camada_nacida=?,updated_at=? WHERE id=?',
        [
          snapshot.madre_id,
          snapshot.fecha_parto,
          snapshot.numero_parto,
          snapshot.nacidos_vivos,
          snapshot.nacidos_muertos,
          snapshot.tamano_camada_nacida,
          now,
          id,
        ],
      );
      operationId = await enqueue(db, 'partos', id, 'update', snapshot, previous, null, now);
    }
    const added = await linkCrias(db, id, input.madreId, input.crias, operationId, now);
    return { id, operationId, changed: changed || added > 0 };
  });
}

function pesajeSnapshot(input: PesajeInput) {
  return {
    cuy_id: input.cuyId,
    fecha_pesaje: input.fechaPesaje,
    peso_gramos: input.pesoGramos,
    etapa: input.etapa,
    parto_id: input.partoId,
    evento_id: input.eventoId,
  };
}

export async function createPesaje(db: MigrationDb, input: PesajeInput): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    await requireRow(db, 'cuyes', input.cuyId, 'El animal');
    if (input.partoId) await requireRow(db, 'partos', input.partoId, 'El parto');
    if (input.eventoId) await requireRow(db, 'eventos', input.eventoId, 'El evento');
    const id = uuidV4();
    const now = nowIso();
    const snapshot = pesajeSnapshot(input);
    await db.run(
      'INSERT INTO pesajes(id,cuy_id,fecha_pesaje,peso_gramos,etapa,parto_id,evento_id,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,NULL)',
      [
        id,
        snapshot.cuy_id,
        snapshot.fecha_pesaje,
        snapshot.peso_gramos,
        snapshot.etapa,
        snapshot.parto_id,
        snapshot.evento_id,
        now,
        now,
      ],
    );
    const parent = (await pendingCreate(db, 'cuyes', input.cuyId)) ?? null;
    const operationId = await enqueue(db, 'pesajes', id, 'create', snapshot, { id: null, base: null }, parent, now);
    return { id, operationId, changed: true };
  });
}

export async function updatePesaje(db: MigrationDb, id: string, input: PesajeInput): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    const current = await one(db, 'SELECT * FROM pesajes WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!current) throw new Error('El pesaje no existe en la base de trabajo');
    await requireRow(db, 'cuyes', input.cuyId, 'El animal');
    if (input.partoId) await requireRow(db, 'partos', input.partoId, 'El parto');
    if (input.eventoId) await requireRow(db, 'eventos', input.eventoId, 'El evento');
    const snapshot = pesajeSnapshot(input);
    if (sameSnapshot(current, PESAJE_FIELDS, snapshot)) return { id, operationId: null, changed: false };
    const previous = await predecessor(db, 'pesajes', id);
    const now = nowIso();
    await db.run(
      'UPDATE pesajes SET cuy_id=?,fecha_pesaje=?,peso_gramos=?,etapa=?,parto_id=?,evento_id=?,updated_at=? WHERE id=?',
      [
        snapshot.cuy_id,
        snapshot.fecha_pesaje,
        snapshot.peso_gramos,
        snapshot.etapa,
        snapshot.parto_id,
        snapshot.evento_id,
        now,
        id,
      ],
    );
    const operationId = await enqueue(db, 'pesajes', id, 'update', snapshot, previous, null, now);
    return { id, operationId, changed: true };
  });
}

function eventoSnapshot(input: EventoInput) {
  return {
    cuy_id: input.cuyId,
    tipo: input.tipo,
    fecha: input.fecha,
    macho_id: input.machoId,
    poza_origen_id: input.pozaOrigenId,
    poza_destino_id: input.pozaDestinoId,
    detalle: input.detalle,
  };
}

export async function createEvento(db: MigrationDb, input: EventoInput): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    await requireRow(db, 'cuyes', input.cuyId, 'El animal');
    if (input.machoId) await requireRow(db, 'cuyes', input.machoId, 'El macho');
    if (input.pozaOrigenId) await requireRow(db, 'pozas', input.pozaOrigenId, 'La poza de origen');
    if (input.pozaDestinoId) await requireRow(db, 'pozas', input.pozaDestinoId, 'La poza de destino');
    const id = uuidV4();
    const now = nowIso();
    const snapshot = eventoSnapshot(input);
    await db.run(
      'INSERT INTO eventos(id,cuy_id,tipo,fecha,macho_id,poza_origen_id,poza_destino_id,detalle,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,NULL)',
      [
        id,
        snapshot.cuy_id,
        snapshot.tipo,
        snapshot.fecha,
        snapshot.macho_id,
        snapshot.poza_origen_id,
        snapshot.poza_destino_id,
        snapshot.detalle,
        now,
        now,
      ],
    );
    const parent = (await pendingCreate(db, 'cuyes', input.cuyId)) ?? null;
    const operationId = await enqueue(db, 'eventos', id, 'create', snapshot, { id: null, base: null }, parent, now);
    return { id, operationId, changed: true };
  });
}

export async function updateEvento(db: MigrationDb, id: string, input: EventoInput): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    const current = await one(db, 'SELECT * FROM eventos WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!current) throw new Error('El evento no existe en la base de trabajo');
    await requireRow(db, 'cuyes', input.cuyId, 'El animal');
    if (input.machoId) await requireRow(db, 'cuyes', input.machoId, 'El macho');
    const snapshot = eventoSnapshot(input);
    if (sameSnapshot(current, EVENTO_FIELDS, snapshot)) return { id, operationId: null, changed: false };
    const previous = await predecessor(db, 'eventos', id);
    const now = nowIso();
    await db.run(
      'UPDATE eventos SET cuy_id=?,tipo=?,fecha=?,macho_id=?,poza_origen_id=?,poza_destino_id=?,detalle=?,updated_at=? WHERE id=?',
      [
        snapshot.cuy_id,
        snapshot.tipo,
        snapshot.fecha,
        snapshot.macho_id,
        snapshot.poza_origen_id,
        snapshot.poza_destino_id,
        snapshot.detalle,
        now,
        id,
      ],
    );
    const operationId = await enqueue(db, 'eventos', id, 'update', snapshot, previous, null, now);
    return { id, operationId, changed: true };
  });
}

export async function getParto(db: MigrationDb, id: string): Promise<Parto | null> {
  await initializeWorkSyncDatabase(db);
  const row = await one(db, 'SELECT * FROM partos WHERE id = ? AND deleted_at IS NULL', [id]);
  return row ? mapParto(row) : null;
}

export async function getPesaje(db: MigrationDb, id: string): Promise<Pesaje | null> {
  await initializeWorkSyncDatabase(db);
  const row = await one(db, 'SELECT * FROM pesajes WHERE id = ? AND deleted_at IS NULL', [id]);
  return row ? mapPesaje(row) : null;
}

export async function getEvento(db: MigrationDb, id: string): Promise<Evento | null> {
  await initializeWorkSyncDatabase(db);
  const row = await one(db, 'SELECT * FROM eventos WHERE id = ? AND deleted_at IS NULL', [id]);
  return row ? mapEvento(row) : null;
}

// Corrección de un vínculo existente. No se elimina: solo se actualiza el rol y se
// publica como corrección de parto_crias.
export async function updateVinculoRol(db: MigrationDb, id: string, rol: string): Promise<DomainWriteResult> {
  return transaction(db, async () => {
    const current = await one(db, 'SELECT * FROM parto_crias WHERE id = ?', [id]);
    if (!current) throw new Error('El vínculo no existe en la base de trabajo');
    const value = rol.trim();
    if (!value || value.length > 30) throw new Error('El rol del vínculo no es válido');
    if (String(current.rol) === value) return { id, operationId: null, changed: false };
    const previous = await predecessor(db, 'parto_crias', id);
    const now = nowIso();
    await db.run('UPDATE parto_crias SET rol=? WHERE id=?', [value, id]);
    const snapshot = { parto_id: String(current.parto_id), cuy_id: String(current.cuy_id), rol: value };
    const operationId = await enqueue(db, 'parto_crias', id, 'update', snapshot, previous, null, now);
    return { id, operationId, changed: true };
  });
}

export const DOMAIN_TABLES = TABLES;
export const DOMAIN_FIELDS = {
  cuyes: CUYO_FIELDS,
  partos: PARTO_FIELDS,
  pesajes: PESAJE_FIELDS,
  eventos: EVENTO_FIELDS,
  parto_crias: VINCULO_FIELDS,
} as const;
