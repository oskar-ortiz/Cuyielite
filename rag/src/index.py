"""Idempotent persistence of text chunks and embeddings in pgvector."""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from typing import Protocol

from psycopg import Connection

from rag.src.chunk import Chunk


class PassageEmbedder(Protocol):
    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]: ...


def fragment_hash(document_source: str, chunk: Chunk) -> str:
    material = "\0".join(
        (document_source, str(chunk.page), chunk.section or "", chunk.text)
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def vector_literal(vector: Sequence[float]) -> str:
    if not vector:
        raise ValueError("El embedding no puede estar vacío")
    return "[" + ",".join(format(float(value), ".9g") for value in vector) + "]"


def index_chunks(
    connection: Connection,
    document_source: str,
    chunks: Sequence[Chunk],
    embedder: PassageEmbedder,
) -> int:
    if not document_source.strip():
        raise ValueError("document_source no puede estar vacío")
    if not chunks:
        return 0

    vectors = embedder.embed_passages([chunk.text for chunk in chunks])
    if len(vectors) != len(chunks):
        raise ValueError("El modelo devolvió una cantidad de embeddings distinta a los fragmentos")
    if any(len(vector) != 768 for vector in vectors):
        raise ValueError("Cada embedding debe tener 768 dimensiones")

    records = [
        (
            document_source,
            chunk.text,
            chunk.page,
            chunk.section,
            fragment_hash(document_source, chunk),
            vector_literal(vector),
        )
        for chunk, vector in zip(chunks, vectors, strict=True)
    ]
    with connection.transaction():
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO embeddings_sena
                    (documento_fuente, contenido_chunk, pagina, seccion, fragment_hash, embedding)
                VALUES (%s, %s, %s, %s, %s, %s::vector)
                ON CONFLICT (fragment_hash) DO UPDATE SET
                    documento_fuente = EXCLUDED.documento_fuente,
                    contenido_chunk = EXCLUDED.contenido_chunk,
                    pagina = EXCLUDED.pagina,
                    seccion = EXCLUDED.seccion,
                    embedding = EXCLUDED.embedding
                """,
                records,
            )
    return len(records)
