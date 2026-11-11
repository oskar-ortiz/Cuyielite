// Upgrade incremental de trabajo v2 a v3. No modificar el DDL ni el checksum de C2.
export const WORK_SYNC_VERSION = 3;

export const WORK_SYNC_SQL = `
CREATE TABLE sync_context (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  dataset_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  scope_id TEXT,
  protocol_version INTEGER NOT NULL CHECK (protocol_version = 1),
  cursor TEXT
);

CREATE TABLE sync_record_state (
  entity TEXT NOT NULL CHECK (entity IN ('galpon', 'poza')),
  record_id TEXT NOT NULL,
  server_version TEXT CHECK (server_version IS NULL OR (server_version NOT GLOB '*[^0-9]*' AND length(server_version) > 0 AND server_version NOT GLOB '0*')),
  server_snapshot TEXT,
  local_head_operation_id TEXT,
  PRIMARY KEY (entity, record_id)
);

CREATE TABLE sync_outbox (
  local_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  entity TEXT NOT NULL CHECK (entity IN ('galpon', 'poza')),
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  business_snapshot TEXT NOT NULL,
  base_anchor TEXT,
  predecessor_id TEXT REFERENCES sync_outbox(operation_id),
  parent_create_id TEXT REFERENCES sync_outbox(operation_id),
  state TEXT NOT NULL CHECK (state IN ('queued', 'prepared', 'accepted', 'conflict', 'rejected', 'superseded', 'discarded')),
  frozen_request TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  CHECK ((state = 'prepared' AND frozen_request IS NOT NULL) OR state <> 'prepared')
);

CREATE UNIQUE INDEX sync_outbox_one_prepared
  ON sync_outbox(entity, record_id) WHERE state = 'prepared';

CREATE INDEX sync_outbox_record ON sync_outbox(entity, record_id, local_seq);
`;

// Upgrade incremental de sync v3 a dominio v4. No modificar WORK_SYNC_SQL ni su
// checksum: las bases v3 ya publicadas se validan con ese texto histórico.
export const WORK_DOMAIN_SYNC_VERSION = 4;

export const WORK_ENTITY_NAMES = ['galpon', 'poza', 'cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias'] as const;

const ENTITY_CHECK = '(' + WORK_ENTITY_NAMES.map((name) => `'${name}'`).join(', ') + ')';
const VERSION_CHECK =
  "server_version IS NULL OR (server_version NOT GLOB '*[^0-9]*' AND length(server_version) > 0 AND server_version NOT GLOB '0*')";

export const WORK_DOMAIN_SYNC_SQL = `
CREATE TABLE sync_record_state (
  entity TEXT NOT NULL CHECK (entity IN ${ENTITY_CHECK}),
  record_id TEXT NOT NULL,
  server_version TEXT CHECK (${VERSION_CHECK}),
  server_snapshot TEXT,
  local_head_operation_id TEXT,
  PRIMARY KEY (entity, record_id)
);

CREATE TABLE sync_outbox (
  local_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL UNIQUE,
  entity TEXT NOT NULL CHECK (entity IN ${ENTITY_CHECK}),
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  business_snapshot TEXT NOT NULL,
  base_anchor TEXT,
  predecessor_id TEXT REFERENCES sync_outbox(operation_id),
  parent_create_id TEXT REFERENCES sync_outbox(operation_id),
  state TEXT NOT NULL CHECK (state IN ('queued', 'prepared', 'accepted', 'conflict', 'rejected', 'superseded', 'discarded')),
  frozen_request TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  CHECK ((state = 'prepared' AND frozen_request IS NOT NULL) OR state <> 'prepared')
);

CREATE UNIQUE INDEX sync_outbox_one_prepared
  ON sync_outbox(entity, record_id) WHERE state = 'prepared';

CREATE INDEX sync_outbox_record ON sync_outbox(entity, record_id, local_seq);

CREATE TABLE sync_inbox (
  inbox_id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  seq TEXT NOT NULL CHECK (seq NOT GLOB '*[^0-9]*' AND length(seq) > 0 AND seq NOT GLOB '0*'),
  entity TEXT NOT NULL CHECK (entity IN ${ENTITY_CHECK}),
  record_id TEXT NOT NULL,
  server_version TEXT NOT NULL CHECK (server_version NOT GLOB '*[^0-9]*' AND length(server_version) > 0 AND server_version NOT GLOB '0*'),
  payload TEXT NOT NULL,
  missing_refs TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK (state IN ('staged', 'applied', 'incomplete')),
  code TEXT,
  received_at TEXT NOT NULL,
  applied_at TEXT,
  UNIQUE (dataset_id, scope_id, entity, record_id)
);

CREATE INDEX sync_inbox_pending ON sync_inbox(state, seq);
`;
