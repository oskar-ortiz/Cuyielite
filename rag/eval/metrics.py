"""Lightweight metrics shared by the RAG evaluation modes."""

from __future__ import annotations

from typing import Any


def calculate_metrics(
    cases: list[dict[str, Any]],
    retrieved_pages: list[list[int]],
) -> dict[str, float]:
    if len(cases) != len(retrieved_pages) or not cases:
        raise ValueError("Se requiere una lista no vacía de resultados, uno por pregunta")
    expected = [set(case["paginas_esperadas"]) for case in cases]
    metrics: dict[str, float] = {}
    for cutoff in (1, 3, 5):
        hits = sum(
            bool(expected_pages.intersection(pages[:cutoff]))
            for expected_pages, pages in zip(expected, retrieved_pages)
        )
        metrics[f"hit@{cutoff}"] = hits / len(cases)
    reciprocal_ranks = []
    for expected_pages, pages in zip(expected, retrieved_pages):
        rank = next(
            (
                position
                for position, page in enumerate(pages, start=1)
                if page in expected_pages
            ),
            None,
        )
        reciprocal_ranks.append(1 / rank if rank is not None else 0.0)
    metrics["MRR"] = sum(reciprocal_ranks) / len(reciprocal_ranks)
    return metrics
