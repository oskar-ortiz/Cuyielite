"""Extracción y limpieza de texto de manuales PDF."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import pymupdf


_NUMBERED_HEADING = re.compile(r"^\d{1,2}(?:\.\d{1,2}){0,3}\s+\S.{0,150}$")
_NAMED_HEADING = re.compile(
    r"^(?:CAP[IÍ]TULO|UNIDAD|SECCI[ÓO]N|TEMA)\s+(?:\d+(?:\.\d+)*|[IVXLCDM]+)(?:\s+.{1,120})?$",
    re.IGNORECASE,
)
SENA_MANUAL_FRONT_MATTER_PAGES = frozenset(range(1, 12))


@dataclass(frozen=True)
class PageText:
    page: int
    text: str
    section: str | None = None


def clean_text(text: str) -> str:
    """Normalize line wrapping while retaining paragraph boundaries."""
    text = text.replace("\f", "\n")
    text = re.sub(r"(?<=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])-\s*\n(?=[A-Za-zÁÉÍÓÚÜÑáéíóúüñ])", "", text)
    lines = [line.strip() for line in text.splitlines()]
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        if not line:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        current.append(line)
    if current:
        paragraphs.append(" ".join(current))
    return "\n\n".join(paragraphs).strip()


def _is_section_heading(line: str) -> bool:
    line = line.strip()
    if not line or len(line) > 160:
        return False
    if _NUMBERED_HEADING.match(line) or _NAMED_HEADING.match(line):
        return True
    letters = [character for character in line if character.isalpha()]
    return (
        len(letters) >= 5
        and len(line.split()) <= 10
        and sum(character.isupper() for character in letters) / len(letters) >= 0.85
    )


def extract_pages(
    pdf_path: str | Path,
    excluded_pages: frozenset[int] = SENA_MANUAL_FRONT_MATTER_PAGES,
) -> list[PageText]:
    """Extract body pages, retaining PDF page numbers and detected headings."""
    path = Path(pdf_path)
    if not path.is_file():
        raise FileNotFoundError(f"No se encontró el PDF: {path}")

    pages: list[PageText] = []
    section: str | None = None
    with pymupdf.open(path) as document:
        raw_pages = [pdf_page.get_text("text") for pdf_page in document]
        line_counts = Counter(
            line.strip().casefold()
            for raw_text in raw_pages
            for line in raw_text.splitlines()
            if line.strip()
        )
        for page_number, raw_text in enumerate(raw_pages, start=1):
            if page_number in excluded_pages:
                continue
            for line in raw_text.splitlines():
                if _is_section_heading(line) and line_counts[line.strip().casefold()] <= 4:
                    section = line.strip()
            text = clean_text(raw_text)
            if text:
                pages.append(PageText(page=page_number, text=text, section=section))
    return pages
