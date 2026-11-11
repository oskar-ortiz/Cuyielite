-- Migración D1: metadatos de publicación para entidades de dominio.
-- Número 0004 coordinado con Diery el 2026-11-10. Su CHECK de pesajes
-- independiente se entregará como 0005_*. No editar migraciones ya aplicadas.
--
-- Precondición: base con bootstrap central y migraciones 0001-0003 aplicadas.
-- No asigna ámbito a filas históricas: scope_id queda NULL hasta un backfill
-- revisado y explícito. server_version=0 significa "no publicado".

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sync_scopes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla sync_scopes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cuyes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla cuyes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='partos') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla partos';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pesajes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla pesajes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='eventos') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla eventos';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='parto_crias') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla parto_crias';
    END IF;
END $$;

-- cuyes
ALTER TABLE cuyes ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);
ALTER TABLE cuyes ADD COLUMN server_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE cuyes ADD COLUMN last_client_edited_at TIMESTAMPTZ;
ALTER TABLE cuyes ADD CONSTRAINT cuyes_server_version_nonnegative CHECK (server_version >= 0);

-- partos
ALTER TABLE partos ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);
ALTER TABLE partos ADD COLUMN server_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE partos ADD COLUMN last_client_edited_at TIMESTAMPTZ;
ALTER TABLE partos ADD CONSTRAINT partos_server_version_nonnegative CHECK (server_version >= 0);

-- pesajes
ALTER TABLE pesajes ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);
ALTER TABLE pesajes ADD COLUMN server_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE pesajes ADD COLUMN last_client_edited_at TIMESTAMPTZ;
ALTER TABLE pesajes ADD CONSTRAINT pesajes_server_version_nonnegative CHECK (server_version >= 0);

-- eventos
ALTER TABLE eventos ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);
ALTER TABLE eventos ADD COLUMN server_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE eventos ADD COLUMN last_client_edited_at TIMESTAMPTZ;
ALTER TABLE eventos ADD CONSTRAINT eventos_server_version_nonnegative CHECK (server_version >= 0);

-- parto_crias
ALTER TABLE parto_crias ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);
ALTER TABLE parto_crias ADD COLUMN server_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE parto_crias ADD COLUMN last_client_edited_at TIMESTAMPTZ;
ALTER TABLE parto_crias ADD CONSTRAINT parto_crias_server_version_nonnegative CHECK (server_version >= 0);

CREATE INDEX idx_cuyes_scope ON cuyes (scope_id);
CREATE INDEX idx_partos_scope ON partos (scope_id);
CREATE INDEX idx_pesajes_scope ON pesajes (scope_id);
CREATE INDEX idx_eventos_scope ON eventos (scope_id);
CREATE INDEX idx_parto_crias_scope ON parto_crias (scope_id);
