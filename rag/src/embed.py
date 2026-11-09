"""Local multilingual E5 embeddings."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol, Sequence


DEFAULT_MODEL = "intfloat/multilingual-e5-base"
EXPECTED_DIMENSIONS = 768
_RAG_DIR = Path(__file__).resolve().parents[1]
_MODEL_CACHE = _RAG_DIR / ".cache" / "models"


class TextEmbedder(Protocol):
    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class E5Embedder:
    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or os.getenv("RAG_EMBEDDING_MODEL", DEFAULT_MODEL)
        _MODEL_CACHE.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("HF_HOME", str(_MODEL_CACHE / "huggingface"))
        os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", str(_MODEL_CACHE / "sentence-transformers"))
        os.environ.setdefault("TORCH_HOME", str(_MODEL_CACHE / "torch"))

        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self.model_name, cache_folder=str(_MODEL_CACHE))
        self.dimensions = self._model.get_sentence_embedding_dimension()
        if self.dimensions is None:
            raise RuntimeError(f"No se pudo determinar la dimensión de {self.model_name}")
        if self.dimensions != EXPECTED_DIMENSIONS:
            raise ValueError(
                f"{self.model_name} genera {self.dimensions} dimensiones; "
                f"embeddings_sena requiere {EXPECTED_DIMENSIONS}"
            )

    def embed_passages(self, texts: Sequence[str]) -> list[list[float]]:
        return self._encode([f"passage: {text}" for text in texts])

    def embed_query(self, text: str) -> list[float]:
        return self._encode([f"query: {text}"])[0]

    def _encode(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        return [[float(value) for value in vector] for vector in vectors]
