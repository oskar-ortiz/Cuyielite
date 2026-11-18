"""Extracción y limpieza de texto de manuales PDF."""

from __future__ import annotations

import hashlib
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
REGISTERED_MANUAL_SHA256 = "c33392cb1422bfe50b0f44ccfcc2917888b4aa9b0329830d2b13db3a289a91ea"
UNIVERSAL_LIGATURE_REPLACEMENTS = {
    "\ufb01": "fi",
    "\ufb02": "fl",
}
REGISTERED_MANUAL_LIGATURE_REPLACEMENTS = {
    "\u00f6": "fi",
    "\u00f8": "fl",
    "\uf001": "fi",
    "\uf002": "fl",
    "\ufb01": "fi",
    "\ufb02": "fl",
}
MANUAL_LIGATURE_PROFILES = {
    REGISTERED_MANUAL_SHA256: {
        "name": "produccion_cuyes.pdf",
        "replacements": REGISTERED_MANUAL_LIGATURE_REPLACEMENTS,
    }
}
# Compatibility aliases for callers that expect a profile registry by another name.
LIGATURE_PROFILES = MANUAL_LIGATURE_PROFILES
PDF_LIGATURE_PROFILES = MANUAL_LIGATURE_PROFILES
EXTRACTION_PROFILES = MANUAL_LIGATURE_PROFILES
LIGATURE_REPLACEMENTS = REGISTERED_MANUAL_LIGATURE_REPLACEMENTS


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def ligature_replacements_for_pdf(pdf_sha256: str | None) -> dict[str, str]:
    replacements = dict(UNIVERSAL_LIGATURE_REPLACEMENTS)
    profile = MANUAL_LIGATURE_PROFILES.get((pdf_sha256 or "").lower())
    if profile is not None:
        replacements.update(profile["replacements"])
    return replacements


def _normalize_ligatures(text: str, pdf_sha256: str | None = None) -> str:
    replacements = ligature_replacements_for_pdf(pdf_sha256)
    if not replacements:
        return text
    return text.translate(str.maketrans(replacements))


@dataclass(frozen=True)
class PageText:
    page: int
    text: str
    section: str | None = None


def clean_text(text: str, pdf_sha256: str | None = None, *, sha256: str | None = None, profile: str | None = None) -> str:
    """Normalize line wrapping while retaining paragraph boundaries."""
    selected_sha = pdf_sha256 if pdf_sha256 is not None else sha256
    if selected_sha is None and profile is not None:
        selected_sha = profile
    text = _normalize_ligatures(text, selected_sha).replace("\f", "\n")
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
    *,
    pdf_sha256: str | None = None,
) -> list[PageText]:
    """Extract body pages, retaining PDF page numbers and detected headings."""
    path = Path(pdf_path)
    if not path.is_file():
        raise FileNotFoundError(f"No se encontró el PDF: {path}")

    selected_sha = pdf_sha256 if pdf_sha256 is not None else _sha256_file(path)
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
            text = clean_text(raw_text, pdf_sha256=selected_sha)
            if text:
                pages.append(PageText(page=page_number, text=text, section=section))
    return pages
