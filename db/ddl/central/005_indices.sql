-- Índices para recuperación vectorial y consultas por relaciones.
CREATE INDEX idx_embeddings_sena_hnsw
    ON embeddings_sena USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_cuyes_poza ON cuyes(poza_id);
CREATE INDEX idx_partos_madre ON partos(madre_id);
CREATE INDEX idx_pesajes_cuy ON pesajes(cuy_id);
