-- Migración incremental S3: esquema de sincronización de laboratorio.
-- Precondición: base con 0001_lope_domain.sql ya aplicado.

-- Precondición
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='galpones') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla galpones';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cuyes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla cuyes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pozas') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla pozas';
    END IF;
END $$;

-- Ámbito de sincronización
CREATE TABLE sync_scopes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    last_sequence BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Entidades sincronizables (galpones, pozas) con version y scope
ALTER TABLE galpones ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);
ALTER TABLE galpones ADD COLUMN server_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE galpones ADD COLUMN last_client_edited_at TIMESTAMPTZ;

ALTER TABLE pozas ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);
ALTER TABLE pozas ADD COLUMN server_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pozas ADD COLUMN last_client_edited_at TIMESTAMPTZ;

-- Historial inmutable de cambios
CREATE TABLE sync_changes (
    scope_id UUID NOT NULL REFERENCES sync_scopes(id),
    sequence BIGINT NOT NULL,
    entity VARCHAR(20) NOT NULL,
    record_id UUID NOT NULL,
    record_version BIGINT NOT NULL,
    snapshot JSONB NOT NULL,
    committed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scope_id, sequence)
);

-- Recibos idempotentes
CREATE TABLE sync_receipts (
    scope_id UUID NOT NULL REFERENCES sync_scopes(id),
    device_id UUID NOT NULL,
    operation_id UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scope_id, device_id, operation_id)
);

-- Dispositivos autorizados por ámbito
CREATE TABLE sync_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope_id UUID NOT NULL REFERENCES sync_scopes(id),
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (scope_id, token_hash)
);

-- Índices
CREATE INDEX idx_sync_changes_scope_seq ON sync_changes (scope_id, sequence);
CREATE INDEX idx_sync_receipts_scope ON sync_receipts (scope_id, device_id);
CREATE INDEX idx_galpones_scope ON galpones (scope_id);
CREATE INDEX idx_pozas_scope ON pozas (scope_id);