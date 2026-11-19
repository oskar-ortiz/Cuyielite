"""Generic extractive selection over already retrieved fragments."""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

from rag.src.retrieve import SearchResult, format_citation


_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")
_WORD = re.compile(r"[a-z0-9]+")
_STOPWORDS = frozenset(
    """
    a al algo algun alguna algunos ante antes como con contra cual cuales
    cuando cuanto de del desde donde durante e el ella ellas ellos en entre era
    es esa esas ese eso esos esta estaba estaban estas este esto estos fue ha
    habia han hasta hay la las le les lo los mas me mi mientras mismo mucha
    muchas mucho muchos muy nada ni no nos o otra otras otro otros para pero
    poca pocas poco pocos por porque que quien quienes se sea ser si sin sobre
    son su sus te tener tiene tienen toda todas todo todos tu un una unas uno
    unos y ya
    """.split()
)
DEFAULT_MAX_SENTENCES = 2


@dataclass(frozen=True)
class SelectedSentence:
    result_index: int
    sentence_index: int
    texto: str
    documento_fuente: str
    pagina: int
    score: float


def _tokens(text: str) -> frozenset[str]:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    ascii_text = "".join(character for character in normalized if not unicodedata.combining(character))
    return frozenset(
        token for token in _WORD.findall(ascii_text)
        if token not in _STOPWORDS
    )


def _sentence_spans(text: str) -> list[tuple[int, int]]:
    spans: list[tuple[int, int]] = []
    start = 0
    for match in _SENTENCE_BOUNDARY.finditer(text):
        end = match.start()
        segment = text[start:end]
        if segment.strip():
            leading = len(segment) - len(segment.lstrip())
            trailing = len(segment) - len(segment.rstrip())
            spans.append((start + leading, end - trailing))
        start = match.end()
    segment = text[start:]
    if segment.strip():
        leading = len(segment) - len(segment.lstrip())
        trailing = len(segment) - len(segment.rstrip())
        spans.append((start + leading, len(text) - trailing))
    return spans


def _idf(document_frequency: Counter[str], total: int) -> dict[str, float]:
    return {
        token: math.log((1 + total) / (1 + frequency)) + 1
        for token, frequency in document_frequency.items()
    }


def select_sentences(
    question: str,
    results: Sequence[SearchResult],
    *,
    max_sentences: int = DEFAULT_MAX_SENTENCES,
) -> list[SelectedSentence]:
    if max_sentences < 1:
        raise ValueError("max_sentences debe ser al menos 1")
    if not results:
        return []

    question_tokens = _tokens(question)
    candidates: list[tuple[int, int, str, frozenset[str]]] = []
    for result_index, result in enumerate(results):
        for sentence_index, (start, end) in enumerate(_sentence_spans(result.contenido_chunk)):
            text = result.contenido_chunk[start:end]
            candidates.append((result_index, sentence_index, text, _tokens(text)))

    if not candidates:
        return []

    document_frequency: Counter[str] = Counter()
    for _, _, _, tokens in candidates:
        document_frequency.update(tokens)
    weights = _idf(document_frequency, len(candidates))

    scored: dict[int, list[tuple[float, SelectedSentence]]] = {}
    for result_index, sentence_index, text, tokens in candidates:
        shared = question_tokens & tokens
        if shared:
            denominator = math.sqrt(len(question_tokens) * len(tokens))
            lexical = sum(weights[token] for token in shared) / denominator
            coverage = len(shared) / len(question_tokens)
            score = lexical * (0.5 + 0.5 * coverage)
        else:
            score = 0.0
        result = results[result_index]
        scored.setdefault(result_index, []).append(
            (
                score,
                SelectedSentence(
                    result_index=result_index,
                    sentence_index=sentence_index,
                    texto=text,
                    documento_fuente=result.documento_fuente,
                    pagina=result.pagina,
                    score=score,
                ),
            )
        )

    best_by_result: list[tuple[float, SelectedSentence]] = []
    for result_index, items in scored.items():
        best_by_result.append(
            min(items, key=lambda item: (-item[0], item[1].sentence_index))
        )

    chosen = sorted(
        best_by_result,
        key=lambda item: (-item[0], item[1].result_index, item[1].sentence_index),
    )[:max_sentences]
    chosen.sort(key=lambda item: (item[1].result_index, item[1].sentence_index))
    return [sentence for _, sentence in chosen]


def format_extract(question: str, results: Sequence[SearchResult]) -> str:
    if not results:
        return "No encontré información en los manuales."
    selected = select_sentences(question, results)
    if not selected:
        first = results[0]
        spans = _sentence_spans(first.contenido_chunk)
        if spans:
            start, end = spans[0]
            text = first.contenido_chunk[start:end]
        else:
            text = first.contenido_chunk
        selected = [
            SelectedSentence(
                result_index=0,
                sentence_index=0,
                texto=text,
                documento_fuente=first.documento_fuente,
                pagina=first.pagina,
                score=0.0,
            )
        ]
    return "\n\n".join(
        f"{item.texto}\n[{format_citation(item.documento_fuente, item.pagina)}]"
        for item in selected
    )
