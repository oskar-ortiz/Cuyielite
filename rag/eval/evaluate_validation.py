"""Evaluate a new RAG validation set using the configured threshold unchanged."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any, Protocol

from rag.eval.metrics import calculate_metrics


RAG_DIR = Path(__file__).resolve().parents[1]
VALIDATION_FILE = RAG_DIR / "eval" / "preguntas_validacion.yaml"
ORIGINAL_QUESTIONS_FILE = RAG_DIR / "eval" / "preguntas.yaml"
REPORT_FILE = RAG_DIR / "reports" / "evaluacion_validacion.md"
EXPECTED_VALID = 10
EXPECTED_OUT_OF_CORPUS = 5


class RetrievedPage(Protocol):
    pagina: int


def _read_question_list(path: Path) -> list[dict[str, Any]]:
    import yaml

    with path.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file)
    if not isinstance(data, dict) or not isinstance(data.get("preguntas"), list):
        raise ValueError(f"{path.name} debe contener una lista 'preguntas'.")
    return data["preguntas"]


def load_validation_cases(
    path: Path = VALIDATION_FILE,
    original_path: Path = ORIGINAL_QUESTIONS_FILE,
) -> list[dict[str, Any]]:
    import yaml

    with path.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file)
    if (
        not isinstance(data, dict)
        or data.get("contract") != "rag_validation_questions/v1"
        or not isinstance(data.get("preguntas"), list)
    ):
        raise ValueError("Se requiere el contrato rag_validation_questions/v1.")

    cases = data["preguntas"]
    valid = [
        item
        for item in cases
        if isinstance(item, dict) and item.get("fuera_de_corpus") is False
    ]
    out_of_corpus = [
        item for item in cases if isinstance(item, dict) and item.get("fuera_de_corpus") is True
    ]
    if len(valid) != EXPECTED_VALID or len(out_of_corpus) != EXPECTED_OUT_OF_CORPUS:
        raise ValueError(
            "La validación requiere exactamente 10 preguntas válidas y "
            "5 fuera de corpus."
        )

    original_questions = {
        str(item.get("pregunta", "")).strip().casefold()
        for item in _read_question_list(original_path)
        if isinstance(item, dict)
    }
    seen: set[str] = set()
    for index, item in enumerate(cases, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"La pregunta {index} debe ser un objeto.")
        question = item.get("pregunta")
        pages = item.get("paginas_esperadas")
        outside = item.get("fuera_de_corpus")
        if not isinstance(question, str) or not question.strip():
            raise ValueError(
                f"La pregunta {index} está vacía; completa la plantilla antes "
                "de evaluar."
            )
        normalized = question.strip().casefold()
        if normalized in seen or normalized in original_questions:
            raise ValueError(f"La pregunta {index} no es nueva o está duplicada.")
        seen.add(normalized)
        if not isinstance(pages, list) or not isinstance(outside, bool):
            raise ValueError(f"La pregunta {index} requiere páginas y fuera_de_corpus booleano.")
        if outside:
            if pages:
                raise ValueError(f"La pregunta fuera de corpus {index} debe tener páginas vacías.")
        elif not pages or any(type(page) is not int or page < 1 for page in pages):
            raise ValueError(f"La pregunta válida {index} requiere páginas esperadas positivas.")
    return cases


def _partition_cases(
    cases: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    valid = [case for case in cases if not case["fuera_de_corpus"]]
    outside = [case for case in cases if case["fuera_de_corpus"]]
    if not valid or not outside:
        raise ValueError("Se requieren ambos conjuntos de validación.")
    return valid, outside


def _unique_pages(results: list[RetrievedPage]) -> list[int]:
    return list(dict.fromkeys(result.pagina for result in results))


def calculate_validation_metrics(
    valid_cases: list[dict[str, Any]],
    valid_results: list[list[RetrievedPage]],
    out_of_corpus_results: list[list[RetrievedPage]],
) -> dict[str, Any]:
    if (
        not valid_cases
        or len(valid_cases) != len(valid_results)
        or not out_of_corpus_results
    ):
        raise ValueError("Resultados incompletos para los conjuntos de validación.")
    retrieval = calculate_metrics(
        valid_cases,
        [_unique_pages(results) for results in valid_results],
    )
    valid_abstained = sum(not results for results in valid_results)
    outside_abstained = sum(not results for results in out_of_corpus_results)
    return {
        "retrieval": retrieval,
        "abstention": {
            "valid": {
                "abstained": valid_abstained,
                "total": len(valid_results),
                "rate": valid_abstained / len(valid_results),
            },
            "out_of_corpus": {
                "abstained": outside_abstained,
                "total": len(out_of_corpus_results),
                "rate": outside_abstained / len(out_of_corpus_results),
            },
        },
    }


def run_evaluation(
    cases: list[dict[str, Any]],
    connection: Any,
    embedder: Any,
    threshold: float,
    *,
    retrieve_fn: Any = None,
) -> dict[str, Any]:
    if not 0 <= threshold <= 1:
        raise ValueError("El umbral debe estar entre 0 y 1.")
    if retrieve_fn is None:
        from rag.src.retrieve import retrieve

        retrieve_fn = retrieve
    valid, outside = _partition_cases(cases)
    valid_results = [
        retrieve_fn(
            connection,
            case["pregunta"],
            embedder,
            top_k=20,
            min_similarity=threshold,
        )
        for case in valid
    ]
    outside_results = [
        retrieve_fn(
            connection,
            case["pregunta"],
            embedder,
            top_k=20,
            min_similarity=threshold,
        )
        for case in outside
    ]
    return calculate_validation_metrics(valid, valid_results, outside_results)


def write_report(
    result: dict[str, Any],
    threshold: float,
    model_name: str,
    report_path: Path = REPORT_FILE,
) -> None:
    retrieval = result["retrieval"]
    abstention = result["abstention"]
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        "\n".join(
            [
                "# Validación RAG — preguntas nuevas",
                "",
                "- Conjunto independiente del `preguntas.yaml` original.",
                f"- Preguntas válidas: {abstention['valid']['total']}.",
                f"- Fuera de corpus: {abstention['out_of_corpus']['total']}.",
                f"- Umbral aplicado sin recalibrar: `{threshold:.12f}`.",
                f"- Embeddings: `{model_name}`.",
                "",
                "| Métrica válida | Resultado |",
                "|---|---:|",
                *(
                    f"| {name} | {retrieval[name]:.4f} |"
                    for name in ("hit@1", "hit@3", "hit@5", "MRR")
                ),
                "",
                "| Abstención | Cantidad | Tasa |",
                "|---|---:|---:|",
                f"| Válidas | {abstention['valid']['abstained']}/{abstention['valid']['total']} | {abstention['valid']['rate']:.4f} |",
                f"| Fuera de corpus | {abstention['out_of_corpus']['abstained']}/{abstention['out_of_corpus']['total']} | {abstention['out_of_corpus']['rate']:.4f} |",
                "",
                "El reporte contiene solo métricas agregadas; no registra preguntas ni fragmentos.",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--questions", type=Path, default=VALIDATION_FILE)
    parser.add_argument("--report", type=Path, default=REPORT_FILE)
    args = parser.parse_args(argv)
    cases = load_validation_cases(args.questions)
    from rag.src.retrieve import DEFAULT_MIN_SIMILARITY

    database_url = os.getenv("RAG_DATABASE_URL")
    if not database_url:
        raise RuntimeError("Configura RAG_DATABASE_URL para ejecutar la evaluación RAG.")
    threshold = float(os.getenv("RAG_MIN_SIMILARITY", str(DEFAULT_MIN_SIMILARITY)))
    import psycopg

    from rag.src.embed import E5Embedder

    embedder = E5Embedder()
    with psycopg.connect(database_url) as connection:
        result = run_evaluation(cases, connection, embedder, threshold)
    write_report(result, threshold, embedder.model_name, args.report)
    print(args.report)


if __name__ == "__main__":
    main()
