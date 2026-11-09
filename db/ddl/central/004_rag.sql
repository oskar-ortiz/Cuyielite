-- Embeddings de manuales para recuperación centralizada.
CREATE TABLE embeddings_sena (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_fuente VARCHAR(255) NOT NULL,
    contenido_chunk TEXT NOT NULL,
    pagina INTEGER NOT NULL CHECK (pagina > 0),
    seccion VARCHAR(255),
    fragment_hash VARCHAR(64) NOT NULL,
    embedding VECTOR(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_embeddings_sena_fragment_hash
    ON embeddings_sena (fragment_hash);
