-- DDL SQLite adaptado desde esquema central PostgreSQL + pgvector
-- Motor: SQLite 3.x (embebido, sin cliente-servidor)
-- Nota: SQLite no tiene tipos UUID ni TIMESTAMPTZ nativos.
-- Se usa TEXT para UUIDs y marcas de tiempo ISO8601.
-- Las FK son "advisory": se validan en la aplicación, no en el motor.

-- Tabla galpones
CREATE TABLE galpones (
    id TEXT PRIMARY KEY NOT NULL,
    nombre TEXT NOT NULL,
    ubicacion TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced_at TEXT,
    deleted_at TEXT
);

-- Tabla pozas
CREATE TABLE pozas (
    id TEXT PRIMARY KEY NOT NULL,
    galpon_id TEXT NOT NULL REFERENCES galpones(id),
    codigo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    capacidad_maxima INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced_at TEXT,
    deleted_at TEXT
);

-- Tabla cuyes
CREATE TABLE cuyes (
    id TEXT PRIMARY KEY NOT NULL,
    poza_id TEXT NOT NULL REFERENCES pozas(id),
    codigo_identificacion TEXT NOT NULL UNIQUE,
    sexo TEXT NOT NULL CHECK (sexo IN ('M', 'H')),
    fecha_nacimiento TEXT,
    categoria_ml TEXT CHECK (categoria_ml IN ('ELITE', 'NORMAL', 'DESCARTE')),
    ultimo_peso_g REAL,
    estado TEXT NOT NULL DEFAULT 'ACTIVO',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced_at TEXT,
    deleted_at TEXT
);

-- Tabla partos
CREATE TABLE partos (
    id TEXT PRIMARY KEY NOT NULL,
    madre_id TEXT NOT NULL REFERENCES cuyes(id),
    fecha_parto TEXT NOT NULL,
    tamano_camada_nacida INTEGER NOT NULL DEFAULT 0,
    nacidos_vivos INTEGER NOT NULL DEFAULT 0,
    nacidos_muertos INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced_at TEXT,
    deleted_at TEXT
);

-- Tabla pesajes
CREATE TABLE pesajes (
    id TEXT PRIMARY KEY NOT NULL,
    cuy_id TEXT NOT NULL REFERENCES cuyes(id),
    fecha_pesaje TEXT NOT NULL,
    peso_gramos REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced_at TEXT,
    deleted_at TEXT
);

-- Tabla mortalidad
CREATE TABLE mortalidad (
    id TEXT PRIMARY KEY NOT NULL,
    cuy_id TEXT NOT NULL REFERENCES cuyes(id),
    fecha_deceso TEXT NOT NULL,
    causa_presunta TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced_at TEXT,
    deleted_at TEXT
);

-- Tabla alertas (nueva para el modelo ML)
CREATE TABLE alertas (
    id TEXT PRIMARY KEY NOT NULL,
    cuy_id TEXT NOT NULL REFERENCES cuyes(id),
    tipo_alerta TEXT NOT NULL,
    severidad TEXT NOT NULL DEFAULT 'MEDIA',
    atendida INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    synced_at TEXT,
    deleted_at TEXT
);