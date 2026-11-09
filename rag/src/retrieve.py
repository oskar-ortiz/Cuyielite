"""Cosine retrieval and AssistantQueryResponse-compatible formatting."""

from __future__ import annotations

import os
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import psycopg
from psycopg import Connection

from rag.src.embed import E5Embedder, TextEmbedder
from rag.src.index import vector_literal


DEFAULT_MIN_SIMILARITY = 0.807566308073


@dataclass(frozen=True)
class SearchResult:
    documento_fuente: str
    contenido_chunk: str
    pagina: int
    seccion: str | None
    similitud: float


class AnswerGenerator(Protocol):
    def generate(self, question: str, results: Sequence[SearchResult]) -> str: ...


class ExtractiveGenerator:
    def generate(self, question: str, results: Sequence[SearchResult]) -> str:
        if not results:
            return "No encontré información en los manuales."
        return "\n\n".join(
            f"{result.contenido_chunk}\n[{format_citation(result.documento_fuente, result.pagina)}]"
            for result in results
        )


def validate_top_k(top_k: int) -> int:
    if isinstance(top_k, bool) or not isinstance(top_k, int) or not 1 <= top_k <= 20:
        raise ValueError("top_k debe ser un entero entre 1 y 20")
    return top_k


def format_citation(document_source: str, page: int) -> str:
    if not document_source.strip():
        raise ValueError("document_source no puede estar vacío")
    if isinstance(page, bool) or not isinstance(page, int) or page < 1:
        raise ValueError("page debe ser un entero positivo")
    return f"{document_source}, p. {page}"


def retrieve(
    connection: Connection,
    question: str,
    embedder: TextEmbedder,
    top_k: int = 5,
    min_similarity: float = DEFAULT_MIN_SIMILARITY,
) -> list[SearchResult]:
    validate_top_k(top_k)
    if not question.strip():
        raise ValueError("La pregunta no puede estar vacía")
    if not 0 <= min_similarity <= 1:
        raise ValueError("min_similarity debe estar entre 0 y 1")

    vector = vector_literal(embedder.embed_query(question))
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT documento_fuente, contenido_chunk, pagina, seccion,
                   1 - (embedding <=> %s::vector) AS similitud
            FROM embeddings_sena
            WHERE 1 - (embedding <=> %s::vector) >= %s
            ORDER BY embedding <=> %s::vector
            LIMIT %s
            """,
            (vector, vector, min_similarity, vector, top_k),
        )
        return [
            SearchResult(
                documento_fuente=row[0],
                contenido_chunk=row[1],
                pagina=row[2],
                seccion=row[3],
                similitud=float(row[4]),
            )
            for row in cursor.fetchall()
        ]


def build_response(
    question: str,
    results: Sequence[SearchResult],
    generator: AnswerGenerator | None = None,
) -> dict[str, str | list[str]]:
    selected_generator = generator or ExtractiveGenerator()
    citations = list(
        dict.fromkeys(format_citation(item.documento_fuente, item.pagina) for item in results)
    )
    return {
        "respuesta": selected_generator.generate(question, results),
        "fuentes": citations,
    }


def consultar(
    pregunta: str,
    top_k: int = 5,
    *,
    dsn: str | None = None,
    embedder: TextEmbedder | None = None,
    generator: AnswerGenerator | None = None,
) -> dict[str, str | list[str]]:
    validate_top_k(top_k)
    if not 3 <= len(pregunta.strip()) <= 500:
        raise ValueError("pregunta debe tener entre 3 y 500 caracteres")
    database_url = dsn or os.getenv("RAG_DATABASE_URL")
    if not database_url:
        raise RuntimeError("Configura RAG_DATABASE_URL para consultar PostgreSQL")
    selected_embedder = embedder or E5Embedder()
    min_similarity = float(os.getenv("RAG_MIN_SIMILARITY", str(DEFAULT_MIN_SIMILARITY)))
    with psycopg.connect(database_url) as connection:
        results = retrieve(connection, pregunta, selected_embedder, top_k, min_similarity)
    if generator is not None:
        return build_response(pregunta, results, generator)

    from rag.src.generate import generar

    generated = generar(pregunta, results)
    return {
        "respuesta": generated["respuesta"],
        "fuentes": generated["citas"],
        "modo": generated["modo"],
        "citas": generated["citas"],
    }
