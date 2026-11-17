"""El embedder compartido se carga una vez por proceso y modelo."""

from rag.src import embed as embed_module


class FakeEmbedder:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        embed_module._LOADS.append(model_name)

    def embed_passages(self, texts):
        return [[0.0] * 768 for _ in texts]

    def embed_query(self, text):
        return [0.0] * 768


def test_get_embedder_reutiliza_la_instancia(monkeypatch):
    monkeypatch.setattr(embed_module, "_LOADS", [], raising=False)
    monkeypatch.setattr(embed_module, "E5Embedder", FakeEmbedder)
    monkeypatch.delenv("RAG_EMBEDDING_MODEL", raising=False)
    embed_module.reset_embedder_for_tests()

    first = embed_module.get_embedder()
    second = embed_module.get_embedder()

    assert first is second
    assert embed_module._LOADS == ["intfloat/multilingual-e5-base"]


def test_get_embedder_separa_por_modelo(monkeypatch):
    monkeypatch.setattr(embed_module, "_LOADS", [], raising=False)
    monkeypatch.setattr(embed_module, "E5Embedder", FakeEmbedder)
    monkeypatch.setenv("RAG_EMBEDDING_MODEL", "otro-modelo")
    embed_module.reset_embedder_for_tests()

    embed_module.get_embedder()
    embed_module.get_embedder()

    assert embed_module._LOADS == ["otro-modelo"]
    embed_module.reset_embedder_for_tests()


def test_reset_permite_recargar(monkeypatch):
    monkeypatch.setattr(embed_module, "_LOADS", [], raising=False)
    monkeypatch.setattr(embed_module, "E5Embedder", FakeEmbedder)
    monkeypatch.delenv("RAG_EMBEDDING_MODEL", raising=False)
    embed_module.reset_embedder_for_tests()

    first = embed_module.get_embedder()
    embed_module.reset_embedder_for_tests()
    second = embed_module.get_embedder()

    assert first is not second
    assert len(embed_module._LOADS) == 2


