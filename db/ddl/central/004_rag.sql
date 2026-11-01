-- Embeddings de manuales para recuperación centralizada.
CREATE TABLE embeddings_sena (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_fuente VARCHAR(255) NOT NULL,
    contenido_chunk TEXT NOT NULL,
    -- Dimensión provisional; fijar al elegir el modelo de embeddings (ver docs/decisiones/).
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
