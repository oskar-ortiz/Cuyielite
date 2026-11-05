-- PROPUESTA PARA REVISIÓN, NO EJECUTADA.
-- No colocar en db/ddl/central/ ni ejecutar sobre una base existente.
-- Base: PostgreSQL 16 + pgvector. Solo para revisión de Oskar y Diery.

-- ============================================================
-- Incompatibilidad 1: UNIQUE de cuyes.codigo_identificacion vs chapas reutilizadas.
-- ============================================================
ALTER TABLE cuyes DROP CONSTRAINT IF EXISTS cuyes_codigo_identificacion_key;
CREATE INDEX idx_cuyes_codigo ON cuyes (codigo_identificacion);

-- ============================================================
-- Incompatibilidad 2: cuyes.poza_id NOT NULL vs registros históricos sin ubicación actual.
-- ============================================================
ALTER TABLE cuyes ALTER COLUMN poza_id DROP NOT NULL;

-- ============================================================
-- Incompatibilidad 3: fechas obligatorias vs datos pendientes de digitalizar.
-- ============================================================
ALTER TABLE partos ALTER COLUMN fecha_parto DROP NOT NULL;
ALTER TABLE pesajes ALTER COLUMN fecha_pesaje DROP NOT NULL;

-- ============================================================
-- Incompatibilidad 4: cuyes.sexo NOT NULL CHECK vs sexo desconocido.
-- ============================================================
ALTER TABLE cuyes ALTER COLUMN sexo DROP NOT NULL;

-- ============================================================
-- Incompatibilidad 5: cuyes.estado NOT NULL DEFAULT 'ACTIVO' vs registros históricos.
-- Política: sin DEFAULT; permitir NULL. Sin CHECK restrictivo que descarte estados existentes.
-- ============================================================
ALTER TABLE cuyes ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE cuyes ALTER COLUMN estado DROP NOT NULL;

-- ============================================================
-- Incompatibilidad 6: cantidades de parto NOT NULL + DEFAULT 0 vs datos desconocidos.
-- ============================================================
ALTER TABLE partos ALTER COLUMN tamano_camada_nacida DROP NOT NULL;
ALTER TABLE partos ALTER COLUMN tamano_camada_nacida DROP DEFAULT;
ALTER TABLE partos ALTER COLUMN nacidos_vivos DROP NOT NULL;
ALTER TABLE partos ALTER COLUMN nacidos_vivos DROP DEFAULT;
ALTER TABLE partos ALTER COLUMN nacidos_muertos DROP NOT NULL;
ALTER TABLE partos ALTER COLUMN nacidos_muertos DROP DEFAULT;

-- ============================================================
-- Paso 1: tabla eventos (debe existir antes de pesajes.evento_id)
-- Incluye macho_id y poza para empadre estructurado.
-- ============================================================
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

-- ============================================================
-- Paso 2: identidad y relaciones de animales
-- (galpón de origen ≠ ubicación actual)
-- ============================================================
ALTER TABLE cuyes ADD COLUMN galpon_origen_id UUID REFERENCES galpones(id);
ALTER TABLE cuyes ADD COLUMN padre_id UUID REFERENCES cuyes(id);
ALTER TABLE cuyes ADD COLUMN madre_id UUID REFERENCES cuyes(id);

-- ============================================================
-- Paso 3: pelaje, ojos y códigos originales
-- ============================================================
ALTER TABLE cuyes ADD COLUMN color_codigo VARCHAR(20);
ALTER TABLE cuyes ADD COLUMN ojos_codigo VARCHAR(20);
ALTER TABLE cuyes ADD COLUMN pelaje_original VARCHAR(20);

-- ============================================================
-- Paso 4: partos: número de parto (NUPAR). NO se agrega peso_madre_g.
-- ============================================================
ALTER TABLE partos ADD COLUMN numero_parto INTEGER;

-- ============================================================
-- Paso 5: pesajes: etapa y referencias estructuradas (evento_id requiere eventos)
-- ============================================================
ALTER TABLE pesajes ADD COLUMN etapa VARCHAR(20);
ALTER TABLE pesajes ADD COLUMN parto_id UUID REFERENCES partos(id);
ALTER TABLE pesajes ADD COLUMN evento_id UUID REFERENCES eventos(id);

-- ============================================================
-- Paso 6: relación estructurada cría–parto de nacimiento
-- ============================================================
CREATE TABLE parto_crias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parto_id UUID NOT NULL REFERENCES partos(id),
    cuy_id UUID NOT NULL REFERENCES cuyes(id),
    rol VARCHAR(30) NOT NULL DEFAULT 'CRIA',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parto_id, cuy_id),
    UNIQUE (cuy_id)
);

-- ============================================================
-- Paso 7: origen estable independiente de lote/versiones
-- ============================================================
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

-- ============================================================
-- Paso 8: importacion_lotes (identifica la ejecución)
-- ============================================================
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

-- ============================================================
-- Paso 9: importacion_correspondencias (vincula origen + lote, conserva UUID)
-- La correspondencia aceptada origen+rol+tipo conserva el mismo UUID entre ejecuciones.
-- ============================================================
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

-- ============================================================
-- Índices
-- ============================================================
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