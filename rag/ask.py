"""CLI for indexing the local SENA PDF, querying, and evaluating retrieval."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import psycopg

from rag.src.chunk import chunk_pages
from rag.src.embed import E5Embedder
from rag.src.extract import extract_pages
from rag.src.index import index_chunks
from rag.src.retrieve import consultar


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = REPOSITORY_ROOT / "db" / "raw_Lope" / "produccion_cuyes.pdf"


def _database_url() -> str:
    value = os.getenv("RAG_DATABASE_URL")
    if not value:
        raise RuntimeError("Configura RAG_DATABASE_URL para acceder a PostgreSQL")
    return value


def _index(
    pdf_path: Path, *, replace_document: bool = False, dry_run: bool = False
) -> None:
    pages = extract_pages(pdf_path)
    chunks = chunk_pages(pages)
    embedder = E5Embedder()
    with psycopg.connect(_database_url()) as connection:
        count = index_chunks(
            connection, pdf_path.name, chunks, embedder,
            replace_document=replace_document, dry_run=dry_run,
        )
    mode = "reemplazo del documento" if replace_document else "incremental"
    outcome = "ROLLBACK (dry-run, sin cambios persistidos)" if dry_run else "COMMIT"
    print(f"Fragmentos procesados: {count}; modo: {mode}; resultado: {outcome}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    index_parser = commands.add_parser("index", help="Extraer, fragmentar e indexar el PDF")
    index_parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    index_parser.add_argument(
        "--replace-document", action="store_true",
        help="Sustituir solo este documento y retirar sus fragmentos obsoletos.",
    )
    index_parser.add_argument(
        "--dry-run", action="store_true",
        help="Ejecutar la indexación en una transacción que se revierte.",
    )

    ask_parser = commands.add_parser("ask", help="Consultar el corpus con citas")
    ask_parser.add_argument("pregunta")
    ask_parser.add_argument("--top-k", type=int, default=5)

    commands.add_parser("evaluate", help="Calcular métricas agregadas de recuperación")

    args = parser.parse_args()
    if args.command == "index":
        _index(args.pdf, replace_document=args.replace_document, dry_run=args.dry_run)
    elif args.command == "ask":
        print(consultar(args.pregunta, args.top_k))
    else:
        from rag.eval.evaluate import main as evaluate_main

        evaluate_main()


if __name__ == "__main__":
    main()
