-- Migración 0006: acceso de piloto (usuarios, sesiones y dispositivos compartidos).
-- No modifica 0001-0004 ni la 0005 reservada para el CHECK de pesajes de Diery.
-- No crea cuentas ni secretos: el alta se hace con un procedimiento explícito.

CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'viewer')),
    scope_id UUID NOT NULL REFERENCES sync_scopes(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    auth_version BIGINT NOT NULL DEFAULT 1 CHECK (auth_version > 0),
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_app_users_scope ON app_users(scope_id);

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES app_users(id),
    device_id UUID NOT NULL REFERENCES sync_devices(id),
    scope_id UUID NOT NULL REFERENCES sync_scopes(id),
    refresh_hash CHAR(64) NOT NULL UNIQUE,
    family_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by UUID,
    reuse_grace_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_device ON auth_sessions(device_id);
CREATE INDEX idx_auth_sessions_family ON auth_sessions(family_id);

CREATE TABLE auth_audit (
    id BIGSERIAL PRIMARY KEY,
    event VARCHAR(60) NOT NULL,
    user_id UUID,
    device_id UUID,
    scope_id UUID,
    ip TEXT,
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_audit_created ON auth_audit(created_at);

CREATE TABLE auth_login_attempts (
    attempt_key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
    blocked_until TIMESTAMPTZ
);

-- El dispositivo es la instalación compartida; no pertenece a un usuario.
ALTER TABLE sync_devices
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
    ADD COLUMN revoked_at TIMESTAMPTZ,
    ADD COLUMN last_seen_at TIMESTAMPTZ,
    ADD COLUMN platform VARCHAR(20),
    ADD COLUMN name VARCHAR(120),
    ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 1 CHECK (auth_version > 0);

CREATE INDEX idx_sync_devices_scope_status ON sync_devices(scope_id, status);
