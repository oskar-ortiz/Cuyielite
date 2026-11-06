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
