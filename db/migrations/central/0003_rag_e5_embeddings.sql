-- Migración incremental S4: dimensión y metadatos del corpus RAG.
-- Precondición: tabla embeddings_sena creada por db/ddl/central/004_rag.sql.
-- Los embeddings existentes no se pueden convertir a otra dimensión; se requiere reindexar.

DO $$
DECLARE
    embedding_type TEXT;
    has_page BOOLEAN;
    has_hash BOOLEAN;
    has_section BOOLEAN;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'embeddings_sena'
    ) THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla embeddings_sena';
    END IF;
    SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO embedding_type
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.embeddings_sena'::regclass
      AND attribute.attname = 'embedding'
      AND NOT attribute.attisdropped;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'embeddings_sena' AND column_name = 'pagina'
    ) INTO has_page;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'embeddings_sena' AND column_name = 'fragment_hash'
    ) INTO has_hash;
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'embeddings_sena' AND column_name = 'seccion'
    ) INTO has_section;

    IF EXISTS (SELECT 1 FROM embeddings_sena)
       AND (embedding_type <> 'vector(768)' OR NOT has_page OR NOT has_hash OR NOT has_section) THEN
        RAISE EXCEPTION 'embeddings_sena contiene datos incompatibles; respaldar y reindexar antes de migrar';
    END IF;

    IF embedding_type <> 'vector(768)' THEN
        ALTER TABLE embeddings_sena
            ALTER COLUMN embedding TYPE VECTOR(768) USING embedding::vector(768);
    END IF;
    IF NOT has_page THEN
        ALTER TABLE embeddings_sena ADD COLUMN pagina INTEGER NOT NULL CHECK (pagina > 0);
    END IF;
    IF NOT has_section THEN
        ALTER TABLE embeddings_sena ADD COLUMN seccion VARCHAR(255);
    END IF;
    IF NOT has_hash THEN
        ALTER TABLE embeddings_sena ADD COLUMN fragment_hash VARCHAR(64) NOT NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_sena_fragment_hash
    ON embeddings_sena (fragment_hash);
CREATE INDEX IF NOT EXISTS idx_embeddings_sena_hnsw
    ON embeddings_sena USING hnsw (embedding vector_cosine_ops);
