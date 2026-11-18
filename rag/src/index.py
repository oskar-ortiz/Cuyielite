"""Idempotent persistence of text chunks and embeddings in pgvector."""

from __future__ import annotations

import hashlib
import math
from collections.abc import Sequence
from typing import TYPE_CHECKING, Protocol

from psycopg import Connection

if TYPE_CHECKING:
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
    *,
    replace_document: bool = False,
    dry_run: bool = False,
) -> int:
    """Upsert chunks, optionally replacing one document's complete snapshot.

    Embeddings are prepared before any write. A dry run executes the same SQL
    but rolls back its transaction/savepoint; it never commits the caller's
    transaction. Replacement refuses an empty extraction rather than purging
    the previous index accidentally.
    """
    if not document_source.strip():
        raise ValueError("document_source no puede estar vacío")
    if not chunks:
        if replace_document:
            raise ValueError("No se puede reemplazar un documento con cero fragmentos")
        return 0
    if any(not chunk.text.strip() or chunk.page < 1 for chunk in chunks):
        raise ValueError("Cada fragmento requiere texto y una página positiva")

    vectors = embedder.embed_passages([chunk.text for chunk in chunks])
    if len(vectors) != len(chunks):
        raise ValueError("El modelo devolvió una cantidad de embeddings distinta a los fragmentos")
    if any(len(vector) != 768 for vector in vectors):
        raise ValueError("Cada embedding debe tener 768 dimensiones")
    if any(
        not all(math.isfinite(float(value)) for value in vector)
        or not any(float(value) != 0 for value in vector)
        for vector in vectors
    ):
        raise ValueError("Cada embedding debe ser finito y distinto del vector cero")

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
    hashes = [record[4] for record in records]
    if len(set(hashes)) != len(hashes):
        raise ValueError("El conjunto contiene fragmentos duplicados")

    with connection.transaction(force_rollback=dry_run):
        with connection.cursor() as cursor:
            # Serialize both incremental and replacement writers of this source.
            # The lock belongs to the transaction and is released on rollback.
            cursor.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                (document_source,),
            )
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
            if replace_document:
                cursor.execute(
                    """
                    DELETE FROM embeddings_sena
                    WHERE documento_fuente = %s
                      AND NOT (fragment_hash = ANY(%s))
                    """,
                    (document_source, hashes),
                )
    return len(records)
