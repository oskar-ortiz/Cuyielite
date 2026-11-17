-- Migración 0007: evaluación persistente, alertas y feed derivado de solo lectura.
-- Precondición: bootstrap central y migraciones 0001-0006 aplicadas.
-- No modifica migraciones previas. La 0005 sigue reservada para el CHECK de
-- pesajes de Diery: esta entrega usa 0007 porque la 0006 ya está aplicada.
--
-- Decisiones de dominio (confirmadas por Diery el 2026-11-16):
--   * Faltantes devuelven NORMAL + estado REVISAR; eso NO es clase definitiva.
--   * Solo se persiste categoria_ml desde una evaluación definitiva.
--   * Una recomendación de descarte no ejecuta el descarte.
--
-- Las alertas no entran en sync_changes: los clientes v1/v2 fallan de forma
-- determinista ante una entidad desconocida y no deben recibir esta extensión.
-- Su feed es propio (sync_derived_changes) y de solo lectura.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sync_scopes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla sync_scopes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='alertas') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla alertas';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cuyes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla cuyes';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sync_scopes' AND column_name='derived_sequence') THEN
        RAISE EXCEPTION 'Migracion 0007 ya aplicada';
    END IF;
END $$;

-- Contador independiente del feed derivado. No toca last_sequence: los cursores
-- v1/v2 de los clientes desplegados siguen siendo válidos.
ALTER TABLE sync_scopes ADD COLUMN derived_sequence BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sync_scopes ADD CONSTRAINT sync_scopes_derived_sequence_nonnegative CHECK (derived_sequence >= 0);

CREATE TABLE sync_derived_changes (
    scope_id UUID NOT NULL REFERENCES sync_scopes(id),
    sequence BIGINT NOT NULL CHECK (sequence > 0),
    entity VARCHAR(30) NOT NULL CHECK (entity IN ('categoria', 'alerta')),
    record_id UUID NOT NULL,
    record_version BIGINT NOT NULL CHECK (record_version > 0),
    snapshot JSONB NOT NULL,
    committed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (scope_id, sequence)
);

CREATE INDEX idx_derived_changes_record
    ON sync_derived_changes (scope_id, entity, record_id, record_version);

-- Procedencia de la categoría persistida. No se agrega a PUBLISHABLE_FIELDS:
-- el snapshot de v2 no cambia y los clientes desplegados no se ven afectados.
ALTER TABLE cuyes ADD COLUMN categoria_estado VARCHAR(20);
ALTER TABLE cuyes ADD CONSTRAINT cuyes_categoria_estado_chk
    CHECK (categoria_estado IS NULL OR categoria_estado IN ('DEFINITIVA', 'HISTORICA'));
ALTER TABLE cuyes ADD COLUMN categoria_motivos JSONB;
ALTER TABLE cuyes ADD COLUMN categoria_faltantes JSONB;
ALTER TABLE cuyes ADD COLUMN categoria_reglas_version VARCHAR(40);
ALTER TABLE cuyes ADD COLUMN categoria_evaluada_at TIMESTAMPTZ;
ALTER TABLE cuyes ADD COLUMN categoria_procedencia JSONB;
ALTER TABLE cuyes ADD COLUMN categoria_server_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE cuyes ADD CONSTRAINT cuyes_categoria_server_version_nonnegative
    CHECK (categoria_server_version >= 0);

-- Alertas: identidad idempotente y ciclo de vida explícito.
ALTER TABLE alertas ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);
ALTER TABLE alertas ADD COLUMN regla_id VARCHAR(60);
ALTER TABLE alertas ADD COLUMN causa_tipo VARCHAR(30);
ALTER TABLE alertas ADD CONSTRAINT alertas_causa_tipo_chk
    CHECK (causa_tipo IS NULL OR causa_tipo IN ('PARTO', 'HISTORIA_REPRODUCTIVA', 'SIN_EVENTO'));
ALTER TABLE alertas ADD COLUMN causa_id UUID;
ALTER TABLE alertas ADD COLUMN causa_fecha DATE;
ALTER TABLE alertas ADD COLUMN fecha_limite DATE;
ALTER TABLE alertas ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'activa';
ALTER TABLE alertas ADD CONSTRAINT alertas_estado_chk
    CHECK (estado IN ('activa', 'obsoleta', 'no_confirmada'));
ALTER TABLE alertas ADD COLUMN motivo TEXT;
ALTER TABLE alertas ADD COLUMN reglas_version VARCHAR(40);
ALTER TABLE alertas ADD COLUMN server_version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE alertas ADD COLUMN derived_sequence BIGINT;
ALTER TABLE alertas ADD COLUMN closed_at TIMESTAMPTZ;
ALTER TABLE alertas ADD COLUMN closed_reason VARCHAR(60);

-- Una sola alerta activa por ámbito + animal + tipo + regla + causa.
-- La expresión con COALESCE permite indexar causas sin evento identificable.
CREATE UNIQUE INDEX alertas_activa_unica ON alertas (
    scope_id,
    cuy_id,
    tipo_alerta,
    regla_id,
    causa_tipo,
    COALESCE(causa_id, '00000000-0000-0000-0000-000000000000'::uuid)
) WHERE estado = 'activa' AND deleted_at IS NULL;

CREATE INDEX idx_alertas_scope_sequence ON alertas (scope_id, derived_sequence);
CREATE INDEX idx_alertas_cuy_estado ON alertas (cuy_id, estado);
