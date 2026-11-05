// Esquema compartido de la base de TRABAJO (SQLite). Una sola definicion ejecutable
// para Android y Windows. NO contiene seed ni datos de demostracion.
// Familia de esquema: cuyielite-work. Version inicial: user_version = 2.

export const WORK_SCHEMA_FAMILY = 'cuyielite-work';
export const WORK_SCHEMA_VERSION = 2;

// DDL canonico (texto). El checksum se deriva de este contenido.
export const WORK_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS galpones (
  id TEXT PRIMARY KEY NOT NULL,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS pozas (
  id TEXT PRIMARY KEY NOT NULL,
  galpon_id TEXT NOT NULL REFERENCES galpones(id),
  codigo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  capacidad_maxima INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

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

CREATE TABLE IF NOT EXISTS parto_crias (
  id TEXT PRIMARY KEY NOT NULL,
  parto_id TEXT NOT NULL REFERENCES partos(id),
  cuy_id TEXT NOT NULL REFERENCES cuyes(id),
  rol TEXT NOT NULL DEFAULT 'CRIA',
  created_at TEXT NOT NULL,
  UNIQUE (parto_id, cuy_id),
  UNIQUE (cuy_id)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
