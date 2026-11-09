"""Aggregate page-retrieval metrics for the reviewable evaluation questions."""

from __future__ import annotations

import os
import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import psycopg
import yaml

from rag.src.embed import E5Embedder
from rag.src.chunk import chunk_pages
from rag.src.extract import extract_pages
from rag.src.lexical import BM25Retriever
from rag.src.retrieve import retrieve, validate_top_k


RAG_DIR = Path(__file__).resolve().parents[1]
QUESTIONS_FILE = RAG_DIR / "eval" / "preguntas.yaml"
REPORT_FILE = RAG_DIR / "reports" / "evaluacion.md"


@dataclass(frozen=True)
class ThresholdCalibration:
    threshold: float
    out_of_corpus_abstained: int
    out_of_corpus_total: int
    valid_questions_lost: int
    valid_questions_total: int
    balanced_accuracy: float


def _partition_cases(
    cases: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    valid_cases = []
    out_of_corpus_cases = []
    for case in cases:
        expected_pages = case.get("paginas_esperadas")
        out_of_corpus = case.get("fuera_de_corpus", False)
        if not isinstance(out_of_corpus, bool) or not isinstance(expected_pages, list):
            raise ValueError("Cada caso requiere 'paginas_esperadas' y 'fuera_de_corpus' booleano")
        if out_of_corpus:
            if expected_pages:
                raise ValueError("Las preguntas fuera de corpus deben tener paginas_esperadas vacías")
            out_of_corpus_cases.append(case)
        else:
            if not expected_pages:
                raise ValueError("Cada pregunta válida requiere paginas_esperadas")
            valid_cases.append(case)
    if not valid_cases or not out_of_corpus_cases:
        raise ValueError("Se requieren preguntas válidas y preguntas fuera de corpus")
    return valid_cases, out_of_corpus_cases


def calculate_metrics(
    cases: list[dict[str, Any]],
    retrieved_pages: list[list[int]],
) -> dict[str, float]:
    if len(cases) != len(retrieved_pages) or not cases:
        raise ValueError("Se requiere una lista no vacía de resultados, uno por pregunta")
    expected = [set(case["paginas_esperadas"]) for case in cases]
    metrics: dict[str, float] = {}
    for cutoff in (1, 3, 5):
        hits = sum(bool(expected_pages.intersection(pages[:cutoff])) for expected_pages, pages in zip(expected, retrieved_pages))
        metrics[f"hit@{cutoff}"] = hits / len(cases)
    reciprocal_ranks = []
    for expected_pages, pages in zip(expected, retrieved_pages):
        rank = next((position for position, page in enumerate(pages, start=1) if page in expected_pages), None)
        reciprocal_ranks.append(1 / rank if rank is not None else 0.0)
    metrics["MRR"] = sum(reciprocal_ranks) / len(reciprocal_ranks)
    return metrics


def calibrate_threshold(
    valid_cases: list[dict[str, Any]],
    out_of_corpus_cases: list[dict[str, Any]],
    valid_results: list[list[Any]],
    out_of_corpus_results: list[list[Any]],
) -> ThresholdCalibration:
    if (
        not valid_cases
        or not out_of_corpus_cases
        or len(valid_cases) != len(valid_results)
        or len(out_of_corpus_cases) != len(out_of_corpus_results)
    ):
        raise ValueError("Los casos y resultados de calibración deben ser no vacíos y coincidir")

    scores = {
        max(0.0, min(1.0, result.similitud))
        for result_list in (*valid_results, *out_of_corpus_results)
        for result in result_list
    }
    candidates = sorted({0.0, 1.0, *scores})
    best: tuple[tuple[float, int, int, float], float, int, int] | None = None

    for threshold in candidates:
        valid_hits = sum(
            bool(
                set(case["paginas_esperadas"])
                .intersection(_unique_pages(_above_threshold(results, threshold)))
            )
            for case, results in zip(valid_cases, valid_results)
        )
        out_of_corpus_abstained = sum(
            not _above_threshold(results, threshold)
            for results in out_of_corpus_results
        )
        balanced_accuracy = 0.5 * (
            valid_hits / len(valid_cases)
            + out_of_corpus_abstained / len(out_of_corpus_cases)
        )
        score = (
            balanced_accuracy,
            valid_hits,
            out_of_corpus_abstained,
            threshold,
        )
        if best is None or score > best[0]:
            best = (score, threshold, valid_hits, out_of_corpus_abstained)

    assert best is not None
    _, threshold, valid_hits, out_of_corpus_abstained = best
    baseline_hits = sum(
        bool(
            set(case["paginas_esperadas"]).intersection(_unique_pages(results))
        )
        for case, results in zip(valid_cases, valid_results)
    )
    return ThresholdCalibration(
        threshold=threshold,
        out_of_corpus_abstained=out_of_corpus_abstained,
        out_of_corpus_total=len(out_of_corpus_cases),
        valid_questions_lost=baseline_hits - valid_hits,
        valid_questions_total=len(valid_cases),
        balanced_accuracy=best[0][0],
    )


def _above_threshold(results: list[Any], threshold: float) -> list[Any]:
    return [result for result in results if result.similitud >= threshold]


def _unique_pages(results: list[Any]) -> list[int]:
    return list(dict.fromkeys(result.pagina for result in results))


def _load_cases() -> list[dict[str, Any]]:
    with QUESTIONS_FILE.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file)
    if not isinstance(data, dict) or not isinstance(data.get("preguntas"), list):
        raise ValueError("preguntas.yaml debe contener una lista 'preguntas'")
    for item in data["preguntas"]:
        if (
            not isinstance(item, dict)
            or not isinstance(item.get("pregunta"), str)
            or not isinstance(item.get("paginas_esperadas"), list)
        ):
            raise ValueError("Cada caso requiere 'pregunta' y una lista 'paginas_esperadas'")
    _partition_cases(data["preguntas"])
    return data["preguntas"]


def run_evaluation(
    cases: list[dict[str, Any]],
    connection: psycopg.Connection[Any],
    embedder: E5Embedder,
) -> tuple[dict[str, float], ThresholdCalibration]:
    valid_cases, out_of_corpus_cases = _partition_cases(cases)
    valid_results = [
        retrieve(
            connection,
            case["pregunta"],
            embedder,
            top_k=20,
            min_similarity=0.0,
        )
        for case in valid_cases
    ]
    out_of_corpus_results = [
        retrieve(
            connection,
            case["pregunta"],
            embedder,
            top_k=20,
            min_similarity=0.0,
        )
        for case in out_of_corpus_cases
    ]
    calibration = calibrate_threshold(
        valid_cases,
        out_of_corpus_cases,
        valid_results,
        out_of_corpus_results,
    )
    filtered_results = [
        _above_threshold(results, calibration.threshold) for results in valid_results
    ]
    metrics = calculate_metrics(
        valid_cases,
        [_unique_pages(results) for results in filtered_results],
    )
    return metrics, calibration


def write_report(
    metrics: dict[str, float],
    sample_count: int,
    out_of_corpus_count: int,
    model_name: str,
    lexical_metrics: dict[str, float] | None = None,
    embedding_note: str | None = None,
    calibration: ThresholdCalibration | None = None,
) -> None:
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    metric_names = ("hit@1", "hit@3", "hit@5", "MRR")
    metric_rows = [
        "| "
        + name
        + " | "
        + (f"{lexical_metrics[name]:.4f}" if lexical_metrics is not None else "Pendiente")
        + " | "
        + (f"{metrics[name]:.4f}" if name in metrics else "Pendiente")
        + " |"
        for name in metric_names
    ]
    lines = [
        "# Evaluación de recuperación RAG",
        "",
        f"- Preguntas válidas evaluadas: {sample_count}",
        f"- Preguntas fuera de corpus: {out_of_corpus_count}; usadas solo para calibrar abstención.",
        "- Se excluyeron del corpus las páginas PDF 1–11 (portada, licencia, créditos, índice y agradecimientos).",
        "- Relevancia: coincidencia entre páginas recuperadas y páginas esperadas.",
        "",
        "| Métrica | Léxico (BM25) | Embeddings |",
        "|---|---:|---:|",
        *metric_rows,
        "",
        f"- Modelo de embeddings: `{model_name}`.",
        "- BM25: tokenización léxica en español, sin embeddings ni stemming.",
        *(
            [
                f"- Umbral semántico calibrado: `{calibration.threshold:.12f}`; se eligió maximizando la exactitud balanceada entre recuperar páginas esperadas en preguntas válidas y abstenerse en preguntas fuera de corpus (desempate: más aciertos válidos, más abstenciones y luego mayor umbral).",
                f"- Abstención fuera de corpus: {calibration.out_of_corpus_abstained}/{calibration.out_of_corpus_total}.",
                f"- Preguntas válidas perdidas por el umbral: {calibration.valid_questions_lost}/{calibration.valid_questions_total} (página esperada presente antes del umbral y ausente después).",
                f"- Exactitud balanceada de calibración: {calibration.balanced_accuracy:.4f}.",
            ]
            if calibration
            else []
        ),
        "- Limitaciones: corpus de un solo manual; muestra pequeña y umbral calibrado con las mismas preguntas reportadas. Diery debe revisar las preguntas y páginas esperadas.",
        *(
            [f"- Limitación embeddings: {embedding_note}"] if embedding_note else []
        ),
        "",
    ]
    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")


def run_lexical_evaluation(cases: list[dict[str, Any]]) -> dict[str, float]:
    repository_root = RAG_DIR.parent
    pdf_path = repository_root / "db" / "raw_Lope" / "produccion_cuyes.pdf"
    chunks = chunk_pages(extract_pages(pdf_path))
    retriever = BM25Retriever(chunks, pdf_path.name)
    valid_cases, _ = _partition_cases(cases)
    retrieved_pages = [
        [result.pagina for result in retriever.search(case["pregunta"], top_k=5)]
        for case in valid_cases
    ]
    return calculate_metrics(valid_cases, retrieved_pages)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("lexical", "embeddings", "all"), default="all")
    args = parser.parse_args()
    cases = _load_cases()
    lexical_metrics = run_lexical_evaluation(cases) if args.mode in ("lexical", "all") else None
    metrics: dict[str, float] = {}
    model_name = "No ejecutado"
    embedding_note: str | None = None
    calibration: ThresholdCalibration | None = None
    if args.mode in ("embeddings", "all"):
        url = os.getenv("RAG_DATABASE_URL")
        if not url:
            if args.mode == "embeddings":
                raise RuntimeError("Configura RAG_DATABASE_URL para evaluar PostgreSQL")
            embedding_note = "no se configuró RAG_DATABASE_URL."
        else:
            validate_top_k(5)
            embedder = E5Embedder()
            with psycopg.connect(url) as connection:
                metrics, calibration = run_evaluation(cases, connection, embedder)
            model_name = embedder.model_name
    valid_cases, out_of_corpus_cases = _partition_cases(cases)
    write_report(
        metrics,
        len(valid_cases),
        len(out_of_corpus_cases),
        model_name,
        lexical_metrics,
        embedding_note,
        calibration,
    )
    print(REPORT_FILE)


if __name__ == "__main__":
    main()
