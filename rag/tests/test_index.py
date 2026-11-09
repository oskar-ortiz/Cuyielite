import os
from urllib.parse import urlparse

import pytest

from rag.src.chunk import Chunk
from rag.src.index import index_chunks


pytestmark = pytest.mark.db


class FixedEmbedder:
    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        return [[1.0] + [0.0] * 767 for _ in texts]


def test_index_is_idempotent_in_dedicated_test_database() -> None:
    dsn = os.getenv("RAG_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("Requiere RAG_TEST_DATABASE_URL y pgvector en una base temporal")
    database_name = urlparse(dsn).path.lstrip("/").split("?")[0]
    if "rag_test" not in database_name.lower():
        pytest.fail("RAG_TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga 'rag_test'")

    import psycopg

    with psycopg.connect(dsn) as connection:
        with connection.transaction():
            connection.execute("CREATE EXTENSION IF NOT EXISTS vector")
            connection.execute(
                """
                CREATE TEMP TABLE embeddings_sena (
                    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    documento_fuente VARCHAR(255) NOT NULL,
                    contenido_chunk TEXT NOT NULL,
                    pagina INTEGER NOT NULL,
                    seccion VARCHAR(255),
                    fragment_hash VARCHAR(64) NOT NULL UNIQUE,
                    embedding VECTOR(768) NOT NULL
                )
                """
            )
        chunk = Chunk(page=7, section="Manejo", text="Texto de prueba.")
        assert index_chunks(connection, "manual.pdf", [chunk], FixedEmbedder()) == 1
        assert index_chunks(connection, "manual.pdf", [chunk], FixedEmbedder()) == 1
        count = connection.execute("SELECT count(*) FROM embeddings_sena").fetchone()[0]

    assert count == 1
