-- PROPUESTA PARA REVISIÓN, NO EJECUTADA.
-- No colocar en migraciones activas ni ejecutar sobre una base existente.
-- Base: SQLite (Android/Windows). Solo para revisión de Oskar y Diery.
-- Base de trabajo inicial: galpones, pozas, meta (según client/src/data/galpones.migration.ts).
-- Esta propuesta CREA las tablas nuevas necesarias antes de referenciarlas.
-- No se crea seed ni se toca la base demo.

-- ============================================================
-- Tablas base ya existentes en la migración local v1:
-- galpones(id TEXT PK, nombre TEXT NOT NULL, ubicacion TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT)
-- pozas(id TEXT PK, galpon_id TEXT NOT NULL FK, codigo TEXT NOT NULL, tipo TEXT NOT NULL,
--       capacidad_maxima INTEGER NOT NULL DEFAULT 0, created_at TEXT, updated_at TEXT, deleted_at TEXT)
-- meta(key TEXT PK, value TEXT NOT NULL)
-- ============================================================

-- ============================================================
-- Paso 1: tabla eventos (debe existir antes de pesajes.evento_id)
-- Incluye macho_id y poza para empadre estructurado.
-- ============================================================
CREATE TABLE IF NOT EXISTS eventos (
    id TEXT PRIMARY KEY NOT NULL,
    cuy_id TEXT NOT NULL REFERENCES cuyes(id),
    tipo TEXT NOT NULL,
    fecha TEXT,
    macho_id TEXT REFERENCES cuyes(id),
    poza_origen_id TEXT REFERENCES pozas(id),
    poza_destino_id TEXT REFERENCES pozas(id),
    detalle TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

-- ============================================================
-- Paso 2: tabla cuyes (ubicación actual ≠ galpón de origen)
-- Política de estado: sin DEFAULT, CHECK permite NULL/PENDIENTE_REVISION (sin catálogo restrictivo).
-- ============================================================
CREATE TABLE IF NOT EXISTS cuyes (
    id TEXT PRIMARY KEY NOT NULL,
    poza_id TEXT REFERENCES pozas(id),
    galpon_origen_id TEXT REFERENCES galpones(id),
    codigo_identificacion TEXT NOT NULL,
    sexo TEXT CHECK (sexo IS NULL OR sexo IN ('M','H')),
    fecha_nacimiento TEXT,
    color_codigo TEXT,
    ojos_codigo TEXT,
    pelaje_original TEXT,
    padre_id TEXT REFERENCES cuyes(id),
    madre_id TEXT REFERENCES cuyes(id),
    categoria_ml TEXT CHECK (categoria_ml IS NULL OR categoria_ml IN ('ELITE','NORMAL','DESCARTE')),
    ultimo_peso_g TEXT,
    estado TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced_at TEXT,
    deleted_at TEXT
);

-- ============================================================
-- Paso 3: tabla partos (cantidades nullable, sin DEFAULT)
-- ============================================================
CREATE TABLE IF NOT EXISTS partos (
    id TEXT PRIMARY KEY NOT NULL,
    madre_id TEXT NOT NULL REFERENCES cuyes(id),
    fecha_parto TEXT,
    tamano_camada_nacida INTEGER,
    nacidos_vivos INTEGER,
    nacidos_muertos INTEGER,
    numero_parto INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced_at TEXT,
    deleted_at TEXT
);

-- ============================================================
-- Paso 4: tabla pesajes (referencias estructuradas, pesos como TEXT)
-- ============================================================
CREATE TABLE IF NOT EXISTS pesajes (
    id TEXT PRIMARY KEY NOT NULL,
    cuy_id TEXT NOT NULL REFERENCES cuyes(id),
    fecha_pesaje TEXT,
    peso_gramos TEXT NOT NULL,
    etapa TEXT,
    parto_id TEXT REFERENCES partos(id),
    evento_id TEXT REFERENCES eventos(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced_at TEXT,
    deleted_at TEXT
);

-- ============================================================
-- Paso 5: relación estructurada cría–parto de nacimiento
-- ============================================================
CREATE TABLE IF NOT EXISTS parto_crias (
    id TEXT PRIMARY KEY NOT NULL,
    parto_id TEXT NOT NULL REFERENCES partos(id),
    cuy_id TEXT NOT NULL REFERENCES cuyes(id),
    rol TEXT NOT NULL DEFAULT 'CRIA',
    created_at TEXT NOT NULL,
    UNIQUE (parto_id, cuy_id),
    UNIQUE (cuy_id)
);

-- ============================================================
-- Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cuyes_codigo ON cuyes (codigo_identificacion);
CREATE INDEX IF NOT EXISTS idx_cuyes_galpon_origen ON cuyes (galpon_origen_id);
CREATE INDEX IF NOT EXISTS idx_eventos_cuy ON eventos (cuy_id);
CREATE INDEX IF NOT EXISTS idx_eventos_macho ON eventos (macho_id);
CREATE INDEX IF NOT EXISTS idx_pesajes_parto ON pesajes (parto_id);
CREATE INDEX IF NOT EXISTS idx_pesajes_evento ON pesajes (evento_id);
CREATE INDEX IF NOT EXISTS idx_parto_crias_parto ON parto_crias (parto_id);
CREATE INDEX IF NOT EXISTS idx_parto_crias_cuy ON parto_crias (cuy_id);

-- ============================================================
-- Notas de precisión
-- ============================================================
-- Pesos se almacenan como TEXT (cadena decimal) para preservar la precisión de
-- NUMERIC(8,2) central. No se usa REAL (float64).
-- UUIDs se almacenan como TEXT.
-- Fechas se almacenan como TEXT (ISO 8601).
-- importacion_origenes, importacion_lotes e importacion_correspondencias NO se crean
-- en SQLite (solo central). parto_crias sí se sincroniza.