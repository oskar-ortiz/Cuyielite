import os
from urllib.parse import urlparse

import pytest

from rag.src.chunk import Chunk
from rag.src.index import index_chunks


pytestmark = pytest.mark.db


class FixedEmbedder:
    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        return [[1.0] + [0.0] * 767 for _ in texts]


@pytest.fixture
def connection():
    dsn = os.getenv("RAG_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("Requiere RAG_TEST_DATABASE_URL y pgvector en una base temporal")
    database_name = urlparse(dsn).path.lstrip("/").split("?")[0]
    if "rag_test" not in database_name.lower():
        pytest.fail("RAG_TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga 'rag_test'")

    import psycopg

    with psycopg.connect(dsn, autocommit=True) as connection:
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
        yield connection


def snapshot(connection):
    return connection.execute(
        "SELECT id, documento_fuente, contenido_chunk, fragment_hash, embedding::text "
        "FROM embeddings_sena ORDER BY id"
    ).fetchall()


def test_index_is_idempotent_in_dedicated_test_database(connection):
    chunk = Chunk(page=7, section="Manejo", text="Texto de prueba.")
    assert index_chunks(connection, "manual.pdf", [chunk], FixedEmbedder()) == 1
    assert index_chunks(connection, "manual.pdf", [chunk], FixedEmbedder()) == 1
    assert len(snapshot(connection)) == 1


def test_replacement_removes_old_text_preserves_other_document_and_replays(connection):
    kept = Chunk(page=1, text="Texto que se conserva.")
    old = Chunk(page=2, text="Texto anterior.")
    new = Chunk(page=2, text="Texto corregido.")
    index_chunks(connection, "manual.pdf", [kept, old], FixedEmbedder())
    index_chunks(connection, "otro.pdf", [old], FixedEmbedder())
    before = snapshot(connection)

    index_chunks(connection, "manual.pdf", [kept, new], FixedEmbedder(), replace_document=True)
    after = snapshot(connection)
    assert len(after) == 3
    assert before[0] in after  # Unchanged fragment retains its identity.
    assert before[2] in after  # Other source retains all its fields.
    assert before[1] not in after
    assert {row[2] for row in after if row[1] == "manual.pdf"} == {kept.text, new.text}
    index_chunks(connection, "manual.pdf", [kept, new], FixedEmbedder(), replace_document=True)
    assert snapshot(connection) == after


def test_dry_run_executes_replacement_without_persisting_and_can_then_commit(connection):
    old = Chunk(page=1, text="Anterior.")
    new = Chunk(page=2, text="Nuevo.")
    index_chunks(connection, "manual.pdf", [old], FixedEmbedder())
    before = snapshot(connection)
    assert index_chunks(
        connection, "manual.pdf", [new], FixedEmbedder(), replace_document=True, dry_run=True
    ) == 1
    assert snapshot(connection) == before
    index_chunks(connection, "manual.pdf", [new], FixedEmbedder(), replace_document=True)
    assert snapshot(connection)[0][2] == new.text


def test_failure_after_insertion_rolls_back_new_rows_and_preserves_previous_index(connection):
    import psycopg

    index_chunks(connection, "manual.pdf", [Chunk(page=1, text="Anterior.")], FixedEmbedder())
    before = snapshot(connection)
    connection.execute(
        "CREATE FUNCTION pg_temp.reject_delete() RETURNS trigger LANGUAGE plpgsql AS "
        "$$ BEGIN RAISE EXCEPTION 'fallo sintetico despues de insertar'; END $$"
    )
    connection.execute(
        "CREATE TRIGGER reject_delete BEFORE DELETE ON embeddings_sena "
        "FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_delete()"
    )
    with pytest.raises(psycopg.errors.RaiseException, match="fallo sintetico"):
        index_chunks(
            connection, "manual.pdf", [Chunk(page=2, text="Nuevo.")],
            FixedEmbedder(), replace_document=True,
        )
    assert snapshot(connection) == before


def test_borrowed_transaction_remains_under_callers_control(connection):
    index_chunks(connection, "manual.pdf", [Chunk(page=1, text="Anterior.")], FixedEmbedder())
    before = snapshot(connection)
    with connection.transaction(force_rollback=True):
        index_chunks(
            connection, "manual.pdf", [Chunk(page=2, text="Nuevo.")],
            FixedEmbedder(), replace_document=True,
        )
        assert snapshot(connection) != before
    assert snapshot(connection) == before


def test_empty_replacement_cannot_purge_document(connection):
    index_chunks(connection, "manual.pdf", [Chunk(page=1, text="Anterior.")], FixedEmbedder())
    before = snapshot(connection)
    with pytest.raises(ValueError, match="cero fragmentos"):
        index_chunks(connection, "manual.pdf", [], FixedEmbedder(), replace_document=True)
    assert snapshot(connection) == before


def test_document_lock_is_held_until_callers_transaction_finishes(connection):
    import psycopg

    with psycopg.connect(os.environ["RAG_TEST_DATABASE_URL"], autocommit=True) as observer:
        query = "SELECT pg_try_advisory_xact_lock(hashtextextended(%s, 0))"
        with connection.transaction():
            index_chunks(connection, "manual.pdf", [Chunk(page=1, text="Texto.")], FixedEmbedder())
            assert observer.execute(query, ("manual.pdf",)).fetchone()[0] is False
            assert observer.execute(query, ("otro.pdf",)).fetchone()[0] is True
        assert observer.execute(query, ("manual.pdf",)).fetchone()[0] is True
