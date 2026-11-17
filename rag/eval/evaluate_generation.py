"""Generate a human-review table for the configured RAG answer mode."""

from __future__ import annotations

import argparse
import os
import re
import time
from pathlib import Path
from typing import Any

RAG_DIR = Path(__file__).resolve().parents[1]
QUESTIONS_FILE = RAG_DIR / "eval" / "preguntas.yaml"
REPORT_FILE = RAG_DIR / "reports" / "evaluacion_generacion.md"
_WHITESPACE = re.compile(r"\s+")
_MAX_ANSWER_LENGTH = 180


def _rating_counts(ratings: list[str]) -> dict[str, int]:
    counts = {"correcta": 0, "parcial": 0, "incorrecta": 0, "pendiente": 0}
    aliases = {
        "ok": "correcta",
        "correcta": "correcta",
        "parcial": "parcial",
        "mal": "incorrecta",
        "incorrecta": "incorrecta",
    }
    for rating in ratings:
        normalized = rating.strip().casefold()
        if not normalized:
            counts["pendiente"] += 1
            continue
        category = aliases.get(normalized)
        if category is None:
            raise ValueError(f"Calificación no reconocida: {normalized!r}")
        counts[category] += 1
    return counts


def _review_summary_lines(
    ratings: list[str],
    *,
    review_date: str = "No registrada en el informe",
    reviewer: str = "No identificado en el informe",
) -> list[str]:
    counts = _rating_counts(ratings)
    total = sum(counts.values())
    rated = total - counts["pendiente"]
    if counts["pendiente"] == 0:
        status = f"calificación completa en la tabla ({rated}/{total})"
    else:
        status = (
            f"calificación parcial ({rated}/{total}); "
            f"{counts['pendiente']} pendiente(s)"
        )
    traceability = (
        "trazabilidad incompleta"
        if review_date.startswith("No registrada") or reviewer.startswith("No identificado")
        else "trazabilidad registrada"
    )
    return [
        f"- Estado de calificación: {status}; {traceability}.",
        "- Conteos: "
        f"{counts['correcta']} correcta, {counts['parcial']} parcial, "
        f"{counts['incorrecta']} incorrecta, {counts['pendiente']} pendiente "
        f"(n={total}).",
        "- Criterios: correcta = respuesta respaldada por el manual y sus fuentes "
        "(una pregunta fuera de corpus debe abstenerse); parcial = pertinente pero "
        "incompleta o débilmente sustentada; incorrecta = falsa, no sustentada o "
        "no se abstiene cuando corresponde.",
        f"- Fecha de calificación: {review_date}.",
        f"- Revisor de calificación: {reviewer}.",
    ]


def refresh_review_summary(report_path: Path = REPORT_FILE) -> dict[str, int]:
    """Recount the existing table's ratings without changing any answer or rating."""
    lines = report_path.read_text(encoding="utf-8").splitlines()
    rating_cells = [
        line.strip().rstrip("|").rsplit("|", 1)[-1].strip()
        for line in lines
        if re.match(r"^\|\s*\d+\s*\|", line)
    ]
    if not rating_cells:
        raise ValueError("El informe no contiene filas calificables.")

    review_date = next(
        (
            line.split(":", 1)[1].strip()
            for line in lines
            if line.startswith("- Fecha de calificación:")
        ),
        "No registrada en el informe",
    ).rstrip(".")
    reviewer = next(
        (
            line.split(":", 1)[1].strip()
            for line in lines
            if line.startswith("- Revisor de calificación:")
        ),
        "No identificado en el informe",
    ).rstrip(".")
    summary_prefixes = (
        "- Estado de calificación:",
        "- Conteos:",
        "- Criterios:",
        "- Fecha de calificación:",
        "- Revisor de calificación:",
    )
    updated: list[str] = []
    summary_written = False
    for line in lines:
        if line.startswith(summary_prefixes):
            continue
        if line.startswith("- Estado:"):
            line = "- Estado de generación:" + line[len("- Estado:"):]
        line = line.replace(
            "completada; respuestas medidas localmente, pendientes de calificación manual.",
            "completada; respuestas medidas localmente.",
        )
        updated.append(line)
        if line.startswith("- Estado de generación:") and not summary_written:
            updated.extend(
                _review_summary_lines(
                    rating_cells,
                    review_date=review_date,
                    reviewer=reviewer,
                )
            )
            summary_written = True
    if not summary_written:
        raise ValueError("El informe no contiene estado de generación.")
    report_path.write_text("\n".join(updated) + "\n", encoding="utf-8")
    return _rating_counts(rating_cells)


def _load_questions() -> list[dict[str, Any]]:
    import yaml

    with QUESTIONS_FILE.open("r", encoding="utf-8") as file:
        content = yaml.safe_load(file)
    if not isinstance(content, dict) or not isinstance(content.get("preguntas"), list):
        raise ValueError("preguntas.yaml debe contener una lista 'preguntas'")
    questions = content["preguntas"]
    if len(questions) != 25 or any(
        not isinstance(item, dict) or not isinstance(item.get("pregunta"), str)
        for item in questions
    ):
        raise ValueError("La evaluación requiere las 25 preguntas existentes")
    return questions


def _ollama_status() -> str | None:
    import requests
    from rag.src.generate import DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL

    url = os.getenv("OLLAMA_URL", DEFAULT_OLLAMA_URL).strip().rstrip("/")
    model = os.getenv("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL).strip()
    try:
        response = requests.get(f"{url}/api/tags", timeout=3)
        response.raise_for_status()
        body = response.json()
    except (requests.RequestException, ValueError) as error:
        return f"Ollama no disponible ({type(error).__name__}); no se generaron resultados."

    models = body.get("models") if isinstance(body, dict) else None
    names = (
        {
            item.get("name")
            for item in models
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        }
        if isinstance(models, list)
        else set()
    )
    if model not in names:
        return f"El modelo configurado `{model}` no está descargado; no se generaron resultados."
    return None


def _short_answer(answer: str) -> str:
    normalized = _WHITESPACE.sub(" ", answer).strip()
    if len(normalized) <= _MAX_ANSWER_LENGTH:
        return normalized
    return normalized[: _MAX_ANSWER_LENGTH - 1].rstrip() + "…"


def _write_report(
    questions: list[dict[str, Any]],
    rows: list[tuple[str, str, str, str]],
    note: str,
) -> None:
    from rag.src.generate import DEFAULT_OLLAMA_MODEL

    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Evaluación de generación RAG",
        "",
        f"- Estado de generación: {note}",
        *_review_summary_lines([row[3] for row in rows]),
        f"- Preguntas: {len(questions)} (20 del corpus y 5 fuera de corpus).",
        f"- Proveedor: `{os.getenv('LLM_PROVIDER', 'none')}`.",
        f"- Modelo configurado: `{os.getenv('OLLAMA_MODEL', DEFAULT_OLLAMA_MODEL)}`.",
        "- Las respuestas se limitan a 180 caracteres para revisión manual; no se copian pasajes largos.",
        "",
        "| # | Pregunta | Modo | Tiempo (s) | Respuesta corta | Calificación (`ok`/`parcial`/`mal`) |",
        "|---:|---|---|---:|---|---|",
    ]
    for index, (question, row) in enumerate(zip(questions, rows, strict=True), start=1):
        mode, elapsed, answer, rating = row
        escaped_question = question["pregunta"].replace("|", "\\|")
        escaped_answer = answer.replace("|", "\\|")
        lines.append(
            f"| {index} | {escaped_question} | {mode} | {elapsed} | {escaped_answer} | {rating} |"
        )
    lines.append("")
    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh-review-summary",
        action="store_true",
        help="Recalcula los conteos de la tabla existente, sin ejecutar RAG.",
    )
    args = parser.parse_args(argv)
    if args.refresh_review_summary:
        refresh_review_summary()
        print(REPORT_FILE)
        return

    questions = _load_questions()
    provider = os.getenv("LLM_PROVIDER", "none").strip().lower()
    if provider not in {"none", "ollama"}:
        raise ValueError("LLM_PROVIDER debe ser 'none' u 'ollama'")

    if provider == "ollama":
        status = _ollama_status()
        if status:
            _write_report(
                questions,
                [("No ejecutado", "—", "No evaluada", "") for _ in questions],
                status,
            )
            print(REPORT_FILE)
            return

    database_url = os.getenv("RAG_DATABASE_URL")
    if not database_url:
        _write_report(
            questions,
            [("No ejecutado", "—", "No evaluada", "") for _ in questions],
            "no ejecutada: configura RAG_DATABASE_URL para usar recuperación real.",
        )
        print(REPORT_FILE)
        return

    import psycopg

    from rag.src.embed import E5Embedder
    from rag.src.generate import generar
    from rag.src.retrieve import DEFAULT_MIN_SIMILARITY, retrieve

    embedder = E5Embedder()
    minimum_similarity = float(
        os.getenv("RAG_MIN_SIMILARITY", str(DEFAULT_MIN_SIMILARITY))
    )
    rows = []
    with psycopg.connect(database_url) as connection:
        for item in questions:
            started = time.perf_counter()
            fragments = retrieve(
                connection,
                item["pregunta"],
                embedder,
                top_k=5,
                min_similarity=minimum_similarity,
            )
            answer = generar(item["pregunta"], fragments)
            elapsed = time.perf_counter() - started
            rows.append(
                (
                    answer["modo"],
                    f"{elapsed:.2f}",
                    _short_answer(answer["respuesta"]),
                    "",
                )
            )

    note = "completada; respuestas medidas localmente."
    _write_report(questions, rows, note)
    print(REPORT_FILE)


if __name__ == "__main__":
    main()
