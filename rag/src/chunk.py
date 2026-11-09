"""Paragraph-aware text chunking with token-count overlap."""

from __future__ import annotations

from dataclasses import dataclass

from rag.src.extract import PageText


@dataclass(frozen=True)
class Chunk:
    page: int
    text: str
    section: str | None = None


def _join(words: list[str]) -> str:
    return " ".join(words).strip()


def chunk_pages(
    pages: list[PageText],
    target_tokens: int = 400,
    overlap_ratio: float = 0.15,
) -> list[Chunk]:
    """Pack paragraphs to a target size; split only oversized paragraphs."""
    if target_tokens < 2:
        raise ValueError("target_tokens debe ser al menos 2")
    if not 0 <= overlap_ratio < 1:
        raise ValueError("overlap_ratio debe estar entre 0 y 1")
    overlap = min(int(round(target_tokens * overlap_ratio)), target_tokens - 1)
    chunks: list[Chunk] = []

    for page in pages:
        paragraphs = [paragraph.split() for paragraph in page.text.split("\n\n") if paragraph.strip()]
        current: list[str] = []

        def emit(words: list[str]) -> None:
            text = _join(words)
            if text:
                chunks.append(Chunk(page=page.page, section=page.section, text=text))

        for paragraph in paragraphs:
            if len(paragraph) > target_tokens:
                if current:
                    emit(current)
                    current = []
                step = target_tokens - overlap
                for start in range(0, len(paragraph), step):
                    segment = paragraph[start : start + target_tokens]
                    emit(segment)
                    if start + target_tokens >= len(paragraph):
                        break
                continue

            if current and len(current) + len(paragraph) > target_tokens:
                previous = current
                emit(previous)
                tail = previous[-overlap:] if overlap else []
                current = tail + paragraph
                if len(current) > target_tokens:
                    current = paragraph[:]
            else:
                if current:
                    current.append("")
                current.extend(paragraph)

        if current:
            emit(current)

    return chunks
