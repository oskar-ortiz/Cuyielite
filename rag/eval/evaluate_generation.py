"""Generate a human-review table for the configured RAG answer mode."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Any

import psycopg
import requests
import yaml

from rag.src.embed import E5Embedder
from rag.src.generate import DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL, generar
from rag.src.retrieve import DEFAULT_MIN_SIMILARITY, retrieve


RAG_DIR = Path(__file__).resolve().parents[1]
QUESTIONS_FILE = RAG_DIR / "eval" / "preguntas.yaml"
REPORT_FILE = RAG_DIR / "reports" / "evaluacion_generacion.md"
_WHITESPACE = re.compile(r"\s+")
_MAX_ANSWER_LENGTH = 180


def _load_questions() -> list[dict[str, Any]]:
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
    REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Evaluación de generación RAG",
        "",
        f"- Estado: {note}",
        f"- Preguntas: {len(questions)} (20 del corpus y 5 fuera de corpus).",
        f"- Proveedor: `{os.getenv('LLM_PROVIDER', 'none')}`.",
        f"- Modelo configurado: `{os.getenv('OLLAMA_MODEL', DEFAULT_OLLAMA_MODEL)}`.",
        "- Las respuestas se limitan a 180 caracteres para revisión manual; no se copian pasajes largos.",
        "",
        "| # | Pregunta | Modo | Tiempo (s) | Respuesta corta | Calificación (OK/parcial/mal) |",
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


def main() -> None:
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

    note = "completada; respuestas medidas localmente, pendientes de calificación manual."
    _write_report(questions, rows, note)
    print(REPORT_FILE)


if __name__ == "__main__":
    main()
