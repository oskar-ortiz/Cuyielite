import requests

from rag.src import generate
from rag.src.retrieve import SearchResult


def _fragment(page: int = 3, similarity: float = 0.9) -> SearchResult:
    return SearchResult(
        documento_fuente="manual.pdf",
        contenido_chunk="El galpón protege a los cuyes.",
        pagina=page,
        seccion="Instalaciones",
        similitud=similarity,
    )


class _Response:
    def __init__(self, content: str) -> None:
        self.content = content

    def raise_for_status(self) -> None:
        pass

    def json(self) -> dict[str, dict[str, str]]:
        return {"message": {"content": self.content}}


def test_provider_none_uses_extractive_answer_without_http(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "none")
    monkeypatch.setattr(
        generate.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("unexpected HTTP call")),
    )

    result = generate.generar("¿Para qué sirve el galpón?", [_fragment()])

    assert result["modo"] == "extractivo"
    assert "El galpón protege" in result["respuesta"]
    assert result["citas"] == ["manual.pdf, p. 3"]


def test_ollama_answer_uses_chat_api_and_metadata_citation(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    captured: dict[str, object] = {}

    def fake_post(url: str, *, json: dict[str, object], timeout: float) -> _Response:
        captured.update(url=url, json=json, timeout=timeout)
        return _Response("El galpón protege a los cuyes [1].")

    monkeypatch.setattr(generate.requests, "post", fake_post)

    result = generate.generar("¿Para qué sirve?", [_fragment()])

    assert result == {
        "respuesta": "El galpón protege a los cuyes [1].",
        "modo": "ollama",
        "citas": ["manual.pdf, p. 3"],
    }
    assert captured["url"] == "http://localhost:11434/api/chat"
    assert captured["timeout"] == 60.0
    payload = captured["json"]
    assert isinstance(payload, dict)
    assert payload["model"] == "qwen2.5:7b-instruct"
    assert payload["stream"] is False
    assert payload["options"] == {"temperature": 0.1, "num_predict": 128}


def test_timeout_falls_back_to_extractive(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")

    def timeout(*args, **kwargs):
        raise requests.Timeout("timed out")

    monkeypatch.setattr(generate.requests, "post", timeout)

    result = generate.generar("¿Para qué sirve?", [_fragment()])

    assert result["modo"] == "extractivo"
    assert "El galpón protege" in result["respuesta"]


def test_unavailable_ollama_falls_back_to_extractive(monkeypatch, caplog) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    caplog.set_level("INFO", logger=generate.LOGGER.name)

    def unavailable(*args, **kwargs):
        raise requests.ConnectionError("unavailable")

    monkeypatch.setattr(generate.requests, "post", unavailable)

    result = generate.generar("¿Para qué sirve?", [_fragment()])

    assert result["modo"] == "extractivo"
    assert result["citas"] == ["manual.pdf, p. 3"]
    assert "Ollama falló (ConnectionError)" in caplog.text


def test_nonexistent_citation_index_is_removed(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setattr(
        generate.requests,
        "post",
        lambda *args, **kwargs: _Response("Respuesta basada en contexto [1] [9]."),
    )

    result = generate.generar("¿Para qué sirve?", [_fragment()])

    assert result["respuesta"] == "Respuesta basada en contexto [1]."
    assert result["citas"] == ["manual.pdf, p. 3"]


def test_empty_context_abstains_without_http(monkeypatch) -> None:
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setattr(
        generate.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("unexpected HTTP call")),
    )

    result = generate.generar("Pregunta sin contexto", [])

    assert result == {
        "respuesta": generate.ABSTENTION_ANSWER,
        "modo": "abstencion",
        "citas": [],
    }


def test_consultar_below_threshold_abstains_without_http(monkeypatch) -> None:
    from rag.src import retrieve

    class _Connection:
        def __enter__(self):
            return self

        def __exit__(self, *args) -> None:
            pass

    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setattr(retrieve.psycopg, "connect", lambda _: _Connection())
    monkeypatch.setattr(retrieve, "retrieve", lambda *args: [])
    monkeypatch.setattr(
        generate.requests,
        "post",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("unexpected HTTP call")),
    )

    result = retrieve.consultar("Pregunta fuera del umbral", dsn="postgresql://test", embedder=object())

    assert result["respuesta"] == generate.ABSTENTION_ANSWER
    assert result["modo"] == "abstencion"
