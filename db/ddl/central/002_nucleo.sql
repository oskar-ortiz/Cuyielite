-- Entidades productivas y sus relaciones.
CREATE TABLE galpones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(120) NOT NULL,
    ubicacion VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE pozas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    galpon_id UUID NOT NULL REFERENCES galpones(id),
    codigo VARCHAR(50) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    capacidad_maxima INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE cuyes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    poza_id UUID NOT NULL REFERENCES pozas(id),
    codigo_identificacion VARCHAR(50) NOT NULL UNIQUE,
    sexo VARCHAR(1) NOT NULL CHECK (sexo IN ('M','H')),
    fecha_nacimiento DATE,
    categoria_ml VARCHAR(20) CHECK (categoria_ml IN ('ELITE','NORMAL','DESCARTE')),
    ultimo_peso_g NUMERIC(8,2),
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE partos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    madre_id UUID NOT NULL REFERENCES cuyes(id),
    fecha_parto DATE NOT NULL,
    tamano_camada_nacida INTEGER NOT NULL,
    nacidos_vivos INTEGER NOT NULL DEFAULT 0,
    nacidos_muertos INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE pesajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuy_id UUID NOT NULL REFERENCES cuyes(id),
    fecha_pesaje DATE NOT NULL,
    peso_gramos NUMERIC(8,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE TABLE mortalidad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuy_id UUID NOT NULL REFERENCES cuyes(id),
    fecha_deceso DATE NOT NULL,
    causa_presunta VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    synced_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);
