"""Evaluate a new RAG validation set using the configured threshold unchanged."""

from __future__ import annotations

import argparse
import os
from datetime import date
from pathlib import Path
from typing import Any, Protocol

from rag.eval.metrics import calculate_metrics


RAG_DIR = Path(__file__).resolve().parents[1]
VALIDATION_FILE = RAG_DIR / "eval" / "preguntas_validacion.yaml"
ORIGINAL_QUESTIONS_FILE = RAG_DIR / "eval" / "preguntas.yaml"
REPORT_FILE = RAG_DIR / "reports" / "evaluacion_validacion.md"
MINIMUM_VALID = 10
MINIMUM_OUT_OF_CORPUS = 5


class RetrievedPage(Protocol):
    pagina: int
    similitud: float


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
    group_counts = {
        group: sum(
            isinstance(item, dict) and item.get("grupo") == group
            for item in cases
        )
        for group in ("valida", "fuera_de_corpus", "en_dominio_sin_respuesta")
    }
    if (
        group_counts["valida"] < MINIMUM_VALID
        or group_counts["fuera_de_corpus"] < MINIMUM_OUT_OF_CORPUS
    ):
        raise ValueError(
            "La validación requiere al menos 10 preguntas válidas y "
            "5 fuera de corpus."
        )

    original_questions = {
        str(item.get("pregunta", "")).strip().casefold()
        for item in _read_question_list(original_path)
        if isinstance(item, dict)
    }
    seen_questions: set[str] = set()
    seen_ids: set[str] = set()
    allowed_groups = {"valida", "fuera_de_corpus", "en_dominio_sin_respuesta"}
    for index, item in enumerate(cases, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"La pregunta {index} debe ser un objeto.")
        question = item.get("pregunta")
        question_id = item.get("id")
        group = item.get("grupo")
        pages = item.get("paginas_esperadas")
        outside = item.get("fuera_de_corpus")
        if not isinstance(question, str) or not question.strip():
            raise ValueError(
                f"La pregunta {index} está vacía; completa la plantilla antes "
                "de evaluar."
            )
        if not isinstance(question_id, str) or not question_id.strip():
            raise ValueError(f"La pregunta {index} requiere un id no vacío.")
        if question_id in seen_ids:
            raise ValueError(f"El id {question_id} está duplicado.")
        seen_ids.add(question_id)
        if group not in allowed_groups:
            raise ValueError(f"La pregunta {index} tiene un grupo no permitido.")
        normalized = question.strip().casefold()
        if normalized in seen_questions or normalized in original_questions:
            raise ValueError(f"La pregunta {index} no es nueva o está duplicada.")
        seen_questions.add(normalized)
        if not isinstance(pages, list) or not isinstance(outside, bool):
            raise ValueError(f"La pregunta {index} requiere páginas y fuera_de_corpus booleano.")
        if group == "valida":
            if outside or not pages or any(type(page) is not int or page < 1 for page in pages):
                raise ValueError(f"La pregunta válida {index} requiere páginas esperadas positivas.")
        elif group == "fuera_de_corpus":
            if not outside or pages:
                raise ValueError(
                    f"La pregunta fuera de corpus {index} debe marcarse fuera y tener páginas vacías."
                )
        elif outside or pages:
            raise ValueError(
                f"La pregunta en dominio sin respuesta {index} debe tener páginas vacías y no ser externa."
            )
    return cases


def _partition_cases(
    cases: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    valid = [case for case in cases if case["grupo"] == "valida"]
    outside = [case for case in cases if case["grupo"] == "fuera_de_corpus"]
    in_domain_no_answer = [
        case for case in cases if case["grupo"] == "en_dominio_sin_respuesta"
    ]
    if not valid or not outside:
        raise ValueError("Se requieren preguntas válidas y fuera de corpus.")
    return valid, outside, in_domain_no_answer


def _unique_page_results(results: list[RetrievedPage]) -> list[RetrievedPage]:
    pages: dict[int, RetrievedPage] = {}
    for result in results:
        pages.setdefault(result.pagina, result)
    return list(pages.values())


def _question_metrics(
    group: str,
    cases: list[dict[str, Any]],
    results_by_case: list[list[RetrievedPage]],
) -> list[dict[str, Any]]:
    details = []
    for case, results in zip(cases, results_by_case):
        unique_results = _unique_page_results(results)
        expected_pages = case["paginas_esperadas"]
        expected_match = next(
            (
                (position, result)
                for position, result in enumerate(unique_results, start=1)
                if result.pagina in expected_pages
            ),
            (None, None),
        )
        first_result = unique_results[0] if unique_results else None
        details.append(
            {
                "grupo": group,
                "numero": case["id"],
                "paginas_esperadas": expected_pages,
                "posicion_esperada": expected_match[0],
                "similitud_esperada": (
                    expected_match[1].similitud if expected_match[1] else None
                ),
                "primera_pagina": first_result.pagina if first_result else None,
                "similitud_primera": first_result.similitud if first_result else None,
                "abstencion": not unique_results,
            }
        )
    return details


def _abstention_metrics(results: list[list[RetrievedPage]]) -> dict[str, int | float]:
    abstained = sum(not _unique_page_results(case_results) for case_results in results)
    return {
        "abstained": abstained,
        "total": len(results),
        "rate": abstained / len(results) if results else 0.0,
    }


def calculate_validation_metrics(
    valid_cases: list[dict[str, Any]],
    valid_results: list[list[RetrievedPage]],
    out_of_corpus_results: list[list[RetrievedPage]],
    in_domain_no_answer_cases: list[dict[str, Any]] | None = None,
    in_domain_no_answer_results: list[list[RetrievedPage]] | None = None,
    *,
    out_of_corpus_cases: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    in_domain_cases = in_domain_no_answer_cases or []
    in_domain_results = in_domain_no_answer_results or []
    outside_cases = (
        _cases_without_pages(out_of_corpus_results)
        if out_of_corpus_cases is None
        else out_of_corpus_cases
    )
    if (
        not valid_cases
        or len(valid_cases) != len(valid_results)
        or not out_of_corpus_results
        or len(outside_cases) != len(out_of_corpus_results)
        or len(in_domain_cases) != len(in_domain_results)
    ):
        raise ValueError("Resultados incompletos para los conjuntos de validación.")

    retrieval = calculate_metrics(
        valid_cases,
        [_unique_page_numbers(results) for results in valid_results],
    )
    return {
        "retrieval": retrieval,
        "abstention": {
            "valid": _abstention_metrics(valid_results),
            "out_of_corpus": _abstention_metrics(out_of_corpus_results),
            "in_domain_no_answer": _abstention_metrics(in_domain_results),
        },
        "per_question": (
            _question_metrics("valida", valid_cases, valid_results)
            + _question_metrics("fuera_de_corpus", outside_cases, out_of_corpus_results)
            + _question_metrics(
                "en_dominio_sin_respuesta",
                in_domain_cases,
                in_domain_results,
            )
        ),
    }


def _unique_page_numbers(results: list[RetrievedPage]) -> list[int]:
    return [result.pagina for result in _unique_page_results(results)]


def _cases_without_pages(
    results: list[list[RetrievedPage]],
) -> list[dict[str, Any]]:
    return [
        {"id": f"fuera_{index}", "paginas_esperadas": []}
        for index, _ in enumerate(results, start=1)
    ]


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
    valid, outside, in_domain_no_answer = _partition_cases(cases)

    def retrieve_group(group: list[dict[str, Any]]) -> list[list[RetrievedPage]]:
        return [
            retrieve_fn(
                connection,
                case["pregunta"],
                embedder,
                top_k=20,
                min_similarity=threshold,
            )
            for case in group
        ]

    return calculate_validation_metrics(
        valid,
        retrieve_group(valid),
        retrieve_group(outside),
        in_domain_no_answer,
        retrieve_group(in_domain_no_answer),
        out_of_corpus_cases=outside,
    )


def _format_score(score: float | None) -> str:
    return f"{score:.6f}" if score is not None else "—"


def _format_pages(pages: list[int]) -> str:
    return ", ".join(str(page) for page in pages) if pages else "—"


def write_report(
    result: dict[str, Any],
    threshold: float,
    model_name: str,
    report_path: Path = REPORT_FILE,
    evaluation_date: str | None = None,
) -> None:
    retrieval = result["retrieval"]
    abstention = result["abstention"]
    date_text = evaluation_date or date.today().isoformat()
    group_titles = {
        "valida": "válidas",
        "fuera_de_corpus": "fuera_de_corpus",
        "en_dominio_sin_respuesta": "en_dominio_sin_respuesta",
    }
    details = result["per_question"]
    valid_abstentions = [
        item["numero"]
        for item in details
        if item["grupo"] == "valida" and item["abstencion"]
    ]
    valid_page_misses = [
        item
        for item in details
        if item["grupo"] == "valida" and item["posicion_esperada"] is None
    ]
    outside_answers = [
        item["numero"]
        for item in details
        if item["grupo"] == "fuera_de_corpus" and not item["abstencion"]
    ]
    in_domain_answers = [
        item["numero"]
        for item in details
        if item["grupo"] == "en_dominio_sin_respuesta" and not item["abstencion"]
    ]
    rows = [
        "| Grupo | N.º | Página(s) esperada(s) | Posición | Similitud esperada | Primera página | Similitud primera | Abstención |",
        "|---|---|---:|---:|---:|---:|---:|---|",
    ]
    for item in details:
        rows.append(
            "| "
            + " | ".join(
                [
                    group_titles[item["grupo"]],
                    str(item["numero"]),
                    _format_pages(item["paginas_esperadas"]),
                    str(item["posicion_esperada"] or "—"),
                    _format_score(item["similitud_esperada"]),
                    str(item["primera_pagina"] or "—"),
                    _format_score(item["similitud_primera"]),
                    "sí" if item["abstencion"] else "no",
                ]
            )
            + " |"
        )

    report_lines = [
        "# Evaluación RAG — conjunto de validación",
        "",
        f"- Fecha: {date_text}.",
        f"- Umbral aplicado sin recalibrar: `{threshold:.12f}`.",
        f"- Embeddings: `{model_name}`.",
        "- Procedencia de las preguntas: [completar por Diery]",
        "",
        "## Métricas por grupo",
        "",
        (
            f"- Válidas (n={abstention['valid']['total']}): "
            + "; ".join(
                f"{name}={retrieval[name]:.4f}"
                for name in ("hit@1", "hit@3", "hit@5", "MRR")
            )
            + f"; abstención={abstention['valid']['abstained']}/"
            f"{abstention['valid']['total']} ({abstention['valid']['rate']:.4f})."
        ),
        (
            f"- Fuera de corpus (n={abstention['out_of_corpus']['total']}): "
            f"abstención={abstention['out_of_corpus']['abstained']}/"
            f"{abstention['out_of_corpus']['total']} "
            f"({abstention['out_of_corpus']['rate']:.4f})."
        ),
        (
            f"- En dominio sin respuesta (n={abstention['in_domain_no_answer']['total']}): "
            f"abstención={abstention['in_domain_no_answer']['abstained']}/"
            f"{abstention['in_domain_no_answer']['total']} "
            f"({abstention['in_domain_no_answer']['rate']:.4f})."
        ),
        "",
        "## Resultado por pregunta (sin texto de preguntas ni fragmentos)",
        "",
        *rows,
        "",
        "## Desviaciones observadas",
        "",
        f"- Válidas con abstención: {_format_ids(valid_abstentions)}.",
        "- Válidas sin página esperada entre los resultados: "
        + (
            "; ".join(
                f"{item['numero']} (esperada: {_format_pages(item['paginas_esperadas'])}; "
                f"primera: {_format_page_score(item['primera_pagina'], item['similitud_primera'])})."
                for item in valid_page_misses
            )
            if valid_page_misses
            else "ninguna."
        ),
        f"- Fuera de corpus con resultados: {_format_ids(outside_answers)}.",
        f"- En dominio sin respuesta con resultados: {_format_ids(in_domain_answers)}.",
        "",
        "## Limitaciones",
        "",
        "- Conjunto pequeño.",
        "- El umbral fue calibrado previamente con otro conjunto y no se recalibró aquí.",
        "",
    ]
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(report_lines), encoding="utf-8")


def _format_ids(identifiers: list[str]) -> str:
    return ", ".join(identifiers) if identifiers else "ninguna"


def _format_page_score(page: int | None, score: float | None) -> str:
    if page is None or score is None:
        return "ninguna"
    return f"página {page}, similitud {score:.6f}"


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
