"""BM25 lexical retrieval for a model-free evaluation baseline."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Sequence

from rank_bm25 import BM25Okapi

from rag.src.chunk import Chunk
from rag.src.retrieve import SearchResult, validate_top_k


_TOKEN = re.compile(r"[a-z0-9]+")
_STOPWORDS = frozenset(
    """
    a al algo algun alguna algunas algunos ante antes como con contra cual cuales
    cuando cuanto de del desde donde durante e el ella ellas ellos en entre era
    es esa esas ese eso esos esta estaba estaban estas este esto estos fue ha
    habia han hasta hay la las le les lo los mas me mi mientras mismo mucha
    muchas mucho muchos muy nada ni no nos o otra otras otro otros para pero
    poca pocas poco pocos por porque que quien quienes se sea ser si sin sobre
    son su sus te tener tiene tienen toda todas todo todos tu un una unas uno
    unos y ya
    """.split()
)


def tokenize(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    ascii_text = "".join(character for character in normalized if not unicodedata.combining(character))
    return [token for token in _TOKEN.findall(ascii_text) if token not in _STOPWORDS and len(token) > 1]


class BM25Retriever:
    def __init__(self, chunks: Sequence[Chunk], document_source: str = "produccion_cuyes.pdf") -> None:
        if not chunks:
            raise ValueError("Se requiere al menos un fragmento para construir el índice BM25")
        self._chunks = list(chunks)
        self._corpus = [tokenize(chunk.text) for chunk in self._chunks]
        self._index = BM25Okapi(self._corpus)
        self._document_source = document_source

    def search(self, question: str, top_k: int = 5) -> list[SearchResult]:
        validate_top_k(top_k)
        query = tokenize(question)
        if not query:
            return []
        scores = self._index.get_scores(query)
        ranked = sorted(enumerate(scores), key=lambda item: (-item[1], item[0]))
        best_by_page: dict[int, tuple[float, Chunk]] = {}
        for index, score in ranked:
            if not set(query).intersection(self._corpus[index]):
                continue
            chunk = self._chunks[index]
            if chunk.page not in best_by_page:
                best_by_page[chunk.page] = (float(score), chunk)
        return [
            SearchResult(
                documento_fuente=self._document_source,
                contenido_chunk=chunk.text,
                pagina=page,
                seccion=chunk.section,
                similitud=score,
            )
            for page, (score, chunk) in list(best_by_page.items())[:top_k]
        ]
