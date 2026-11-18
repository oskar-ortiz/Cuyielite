import pytest

from rag.src.chunk import Chunk
from rag.src.index import index_chunks


@pytest.mark.parametrize("kind", ["count", "dimensions", "nan", "infinity", "zero"])
def test_invalid_embeddings_are_rejected_before_database_access(kind):
    class InvalidEmbedder:
        def embed_passages(self, texts):
            if kind == "count":
                return []
            if kind == "dimensions":
                return [[1.0]]
            return [[{"nan": float("nan"), "infinity": float("inf"), "zero": 0.0}[kind]] + [0.0] * 767]

    with pytest.raises(ValueError):
        index_chunks(None, "manual.pdf", [Chunk(page=1, text="Texto.")], InvalidEmbedder(), replace_document=True)


def test_extraction_duplicates_are_rejected_before_database_access():
    class Embedder:
        def embed_passages(self, texts):
            return [[1.0] + [0.0] * 767 for _ in texts]

    chunk = Chunk(page=1, text="Texto.")
    with pytest.raises(ValueError, match="duplicados"):
        index_chunks(None, "manual.pdf", [chunk, chunk], Embedder(), replace_document=True)


def test_cli_forwards_explicit_replacement_and_dry_run_flags(monkeypatch):
    import sys
    from rag import ask

    calls = []
    monkeypatch.setattr(sys, "argv", ["rag.ask", "index", "--pdf", "sintetico.pdf", "--replace-document", "--dry-run"])
    monkeypatch.setattr(ask, "_index", lambda path, **kwargs: calls.append((path.name, kwargs)))
    ask.main()
    assert calls == [("sintetico.pdf", {"replace_document": True, "dry_run": True})]
