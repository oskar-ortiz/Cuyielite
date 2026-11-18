"""Rebuild local RAG fragments and embeddings without database access."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import numpy as np
import pymupdf

from rag.src.chunk import chunk_pages
from rag.src.embed import DEFAULT_MODEL, E5Embedder
from rag.src.extract import LIGATURE_REPLACEMENTS, extract_pages


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
RAG_DIR = REPOSITORY_ROOT / "rag"
PDF_PATH = REPOSITORY_ROOT / "db" / "raw_Lope" / "produccion_cuyes.pdf"
OUTPUT_DIR = RAG_DIR / ".cache" / "local-corpus"
TARGET_TOKENS = 400
OVERLAP_RATIO = 0.15
EXPECTED_CHUNKS = 76


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

    if not PDF_PATH.is_file():
        raise FileNotFoundError(f"No se encontró el PDF: {PDF_PATH}")

    with pymupdf.open(PDF_PATH) as document:
        pdf_page_count = document.page_count

    pages = extract_pages(PDF_PATH)
    chunks = chunk_pages(
        pages,
        target_tokens=TARGET_TOKENS,
        overlap_ratio=OVERLAP_RATIO,
    )
    if len(chunks) != EXPECTED_CHUNKS:
        raise RuntimeError(
            f"Se esperaban {EXPECTED_CHUNKS} fragmentos; se generaron {len(chunks)}."
        )

    mapped_characters = set(LIGATURE_REPLACEMENTS)
    remaining = sum(
        character in mapped_characters
        for chunk in chunks
        for character in chunk.text
    )
    if remaining:
        raise RuntimeError(f"Quedan {remaining} caracteres de ligadura sin normalizar.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fragments_path = OUTPUT_DIR / "fragments.json"
    embeddings_path = OUTPUT_DIR / "embeddings.npy"
    fragments_path.write_text(
        json.dumps(
            [
                {"page": chunk.page, "section": chunk.section, "text": chunk.text}
                for chunk in chunks
            ],
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n",
        encoding="utf-8",
    )

    embedder = E5Embedder(DEFAULT_MODEL)
    embeddings = np.asarray(
        embedder.embed_passages([chunk.text for chunk in chunks]),
        dtype=np.float32,
    )
    if embeddings.shape != (EXPECTED_CHUNKS, embedder.dimensions):
        raise RuntimeError(
            f"Forma inesperada de embeddings: {embeddings.shape}."
        )
    np.save(embeddings_path, embeddings, allow_pickle=False)

    print(
        json.dumps(
            {
                "pdf_sha256": _sha256(PDF_PATH),
                "pdf_pages": pdf_page_count,
                "extracted_pages": len(pages),
                "fragments": len(chunks),
                "mapped_glyphs_remaining": remaining,
                "model": embedder.model_name,
                "dimensions": embedder.dimensions,
                "target_tokens": TARGET_TOKENS,
                "overlap_ratio": OVERLAP_RATIO,
                "fragments_path": str(fragments_path.relative_to(REPOSITORY_ROOT)),
                "fragments_sha256": _sha256(fragments_path),
                "embeddings_path": str(embeddings_path.relative_to(REPOSITORY_ROOT)),
                "embeddings_sha256": _sha256(embeddings_path),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
