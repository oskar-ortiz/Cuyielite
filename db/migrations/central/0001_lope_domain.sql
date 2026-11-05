-- Migración incremental C1: modelo Lope (dominio central).
-- Precondición: base con db/ddl/central/001-005 ya aplicados.
-- Numeración 0001 = primera migración incremental, no reemplazo del bootstrap.

-- Precondición: verificar tablas, columnas y restricciones del esquema esperado.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='galpones') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla galpones';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pozas') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla pozas';
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mortalidad') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla mortalidad';
    END IF;
    -- Columnas relevantes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cuyes' AND column_name='poza_id') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta columna cuyes.poza_id';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cuyes' AND column_name='codigo_identificacion') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta columna cuyes.codigo_identificacion';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partos' AND column_name='madre_id') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta columna partos.madre_id';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pesajes' AND column_name='cuy_id') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta columna pesajes.cuy_id';
    END IF;
    -- Restricción UNIQUE esperada
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='cuyes' AND constraint_type='UNIQUE' AND constraint_name='cuyes_codigo_identificacion_key') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta restriccion UNIQUE cuyes_codigo_identificacion_key';
    END IF;
END $$;

-- 1. Chapa sin UNIQUE; índice no único.
ALTER TABLE cuyes DROP CONSTRAINT IF EXISTS cuyes_codigo_identificacion_key;
CREATE INDEX idx_cuyes_codigo ON cuyes (codigo_identificacion);

-- 2. Nulabilidad y defaults.
ALTER TABLE cuyes ALTER COLUMN poza_id DROP NOT NULL;
ALTER TABLE partos ALTER COLUMN fecha_parto DROP NOT NULL;
ALTER TABLE pesajes ALTER COLUMN fecha_pesaje DROP NOT NULL;
ALTER TABLE cuyes ALTER COLUMN sexo DROP NOT NULL;
ALTER TABLE cuyes ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE cuyes ALTER COLUMN estado DROP NOT NULL;
ALTER TABLE partos ALTER COLUMN tamano_camada_nacida DROP NOT NULL;
ALTER TABLE partos ALTER COLUMN tamano_camada_nacida DROP DEFAULT;
ALTER TABLE partos ALTER COLUMN nacidos_vivos DROP NOT NULL;
ALTER TABLE partos ALTER COLUMN nacidos_vivos DROP DEFAULT;
ALTER TABLE partos ALTER COLUMN nacidos_muertos DROP NOT NULL;
ALTER TABLE partos ALTER COLUMN nacidos_muertos DROP DEFAULT;

-- 3. Genealogía, galpón de origen, pelaje y ojos.
ALTER TABLE cuyes ADD COLUMN galpon_origen_id UUID REFERENCES galpones(id);
ALTER TABLE cuyes ADD COLUMN padre_id UUID REFERENCES cuyes(id);
ALTER TABLE cuyes ADD COLUMN madre_id UUID REFERENCES cuyes(id);
ALTER TABLE cuyes ADD COLUMN color_codigo VARCHAR(20);
ALTER TABLE cuyes ADD COLUMN ojos_codigo VARCHAR(20);
ALTER TABLE cuyes ADD COLUMN pelaje_original VARCHAR(20);

-- 4. Partos: NUPAR.
ALTER TABLE partos ADD COLUMN numero_parto INTEGER;

-- 6. Eventos (empadre y ubicación).
CREATE TABLE eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuy_id UUID NOT NULL REFERENCES cuyes(id),
    tipo VARCHAR(30) NOT NULL,
    fecha DATE,
    macho_id UUID REFERENCES cuyes(id),
    poza_origen_id UUID REFERENCES pozas(id),
    poza_destino_id UUID REFERENCES pozas(id),
    detalle VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 5. Pesajes: etapa y referencias estructuradas.
ALTER TABLE pesajes ADD COLUMN etapa VARCHAR(20);
ALTER TABLE pesajes ADD COLUMN parto_id UUID REFERENCES partos(id);
ALTER TABLE pesajes ADD COLUMN evento_id UUID REFERENCES eventos(id);

-- 7. Relación estructurada cría-parto.
CREATE TABLE parto_crias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parto_id UUID NOT NULL REFERENCES partos(id),
    cuy_id UUID NOT NULL REFERENCES cuyes(id),
    rol VARCHAR(30) NOT NULL DEFAULT 'CRIA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parto_id, cuy_id),
    UNIQUE (cuy_id)
);

-- 8. Orígenes, lotes y correspondencias.
CREATE TABLE importacion_origenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    huella_archivo VARCHAR(64) NOT NULL,
    origen_hoja VARCHAR(100) NOT NULL,
    origen_celda VARCHAR(20) NOT NULL,
    origen_fila INTEGER NOT NULL,
    origen_rol VARCHAR(30) NOT NULL,
    entidad_tipo VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (huella_archivo, origen_hoja, origen_celda, origen_fila, origen_rol, entidad_tipo)
);

CREATE TABLE importacion_lotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    huella_archivo VARCHAR(64) NOT NULL,
    parser_version VARCHAR(20) NOT NULL,
    mapeo_version VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    aplicado_at TIMESTAMPTZ NULL,
    UNIQUE (huella_archivo, parser_version, mapeo_version)
);

CREATE TABLE importacion_correspondencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origen_id UUID NOT NULL REFERENCES importacion_origenes(id),
    lote_id UUID NOT NULL REFERENCES importacion_lotes(id),
    entidad_id UUID,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    motivo VARCHAR(255),
    evidencia VARCHAR(500),
    revisor VARCHAR(100),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    parser_version VARCHAR(20) NOT NULL,
    mapeo_version VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (origen_id, estado)
);

-- 9. Índices.
CREATE INDEX idx_cuyes_galpon_origen ON cuyes (galpon_origen_id);
CREATE INDEX idx_eventos_cuy ON eventos (cuy_id);
CREATE INDEX idx_eventos_macho ON eventos (macho_id);
CREATE INDEX idx_pesajes_parto ON pesajes (parto_id);
CREATE INDEX idx_pesajes_evento ON pesajes (evento_id);
CREATE INDEX idx_parto_crias_parto ON parto_crias (parto_id);
CREATE INDEX idx_parto_crias_cuy ON parto_crias (cuy_id);
CREATE INDEX idx_importacion_origenes_huella ON importacion_origenes (huella_archivo);
CREATE INDEX idx_importacion_correspondencias_origen ON importacion_correspondencias (origen_id);
CREATE INDEX idx_importacion_correspondencias_entidad ON importacion_correspondencias (entidad_id);
CREATE INDEX idx_importacion_lotes_huella ON importacion_lotes (huella_archivo);