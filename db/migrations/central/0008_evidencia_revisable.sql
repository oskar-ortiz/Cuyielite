-- Migración 0008: evidencia revisable y resultados provisionales.
-- Precondición: 0001-0007 aplicadas. No modifica migraciones previas.
--
-- Motivo: una declaración del cliente (abortos, peso de monta, criterios de
-- candidata) no puede autorizar por sí sola una categoría oficial. La evidencia
-- se registra, se revisa por personal autorizado y solo la revisada sustenta
-- persistencia y alertas.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cuyes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla cuyes';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sync_scopes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla sync_scopes';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='evidencias_evaluacion') THEN
        RAISE EXCEPTION 'Migracion 0008 ya aplicada';
    END IF;
END $$;

CREATE TABLE evidencias_evaluacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope_id UUID NOT NULL REFERENCES sync_scopes(id),
    cuy_id UUID NOT NULL REFERENCES cuyes(id),
    campo VARCHAR(40) NOT NULL,
    valor TEXT,
    origen VARCHAR(20) NOT NULL DEFAULT 'DECLARADA'
        CHECK (origen IN ('DECLARADA', 'IMPORTACION')),
    -- Trazabilidad mínima cuando el dato viene de una importación revisada.
    archivo_huella VARCHAR(128),
    hoja VARCHAR(80),
    fila INTEGER,
    celda VARCHAR(20),
    parser_version VARCHAR(40),
    mapeo_version VARCHAR(40),
    -- Estado de revisión. El autor de la revisión se toma de la sesión
    -- autenticada, nunca de un campo del cuerpo.
    estado VARCHAR(20) NOT NULL DEFAULT 'DECLARADA'
        CHECK (estado IN ('DECLARADA', 'REVISADA', 'RECHAZADA')),
    declarada_por UUID REFERENCES app_users(id),
    revisada_por UUID REFERENCES app_users(id),
    revisada_at TIMESTAMPTZ,
    nota TEXT,
    server_version BIGINT NOT NULL DEFAULT 1 CHECK (server_version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT evidencias_evaluacion_valor_chk
        CHECK (valor IS NOT NULL OR estado = 'RECHAZADA'),
    CONSTRAINT evidencias_evaluacion_campo_chk
        CHECK (campo IN (
            'abortos', 'peso_monta_g', 'partos_acumulados', 'nupar_madre', 'tcnv',
            'peso_nacimiento_g', 'peso_destete_g', 'dias_destete', 'ojos'
        ))
);

-- Una evidencia vigente por campo y animal; el historial queda en la auditoría.
CREATE UNIQUE INDEX evidencias_evaluacion_unica
    ON evidencias_evaluacion (scope_id, cuy_id, campo);

CREATE INDEX idx_evidencias_evaluacion_cuy ON evidencias_evaluacion (cuy_id, estado);

-- Marca de resultado provisional en la categoría derivada. La clase oficial
-- sigue siendo categoria_ml; esto solo explica el estado de la evaluación.
ALTER TABLE cuyes ADD COLUMN categoria_caracter VARCHAR(20);
ALTER TABLE cuyes ADD CONSTRAINT cuyes_categoria_caracter_chk
    CHECK (categoria_caracter IS NULL OR categoria_caracter IN ('CONFIRMADO', 'PROPUESTO'));
