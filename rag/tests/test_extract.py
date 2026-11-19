import pymupdf

from rag.src.extract import (
    REGISTERED_MANUAL_SHA256,
    clean_text,
    extract_pages,
)


def test_clean_text_normalizes_only_registered_profile_ligatures() -> None:
    profile_text = "öbra øexible \uf001bras \uf002ora \ufb01bra \ufb02exible"

    assert clean_text(profile_text, pdf_sha256=REGISTERED_MANUAL_SHA256) == (
        "fibra flexible fibras flora fibra flexible"
    )


def test_clean_text_preserves_non_profile_o_and_o_slash() -> None:
    text = "öbra øexible \ufb01bra \ufb02exible"

    assert clean_text(text) == "öbra øexible fibra flexible"


def test_clean_text_normalizes_unicode_ligatures_without_profile() -> None:
    text = "\ufb01bra \ufb02exible"

    assert clean_text(text) == "fibra flexible"


def test_extract_excludes_sena_manual_front_matter(tmp_path) -> None:
    pdf_path = tmp_path / "manual.pdf"
    with pymupdf.open() as document:
        for page_number in range(1, 13):
            page = document.new_page()
            page.insert_text((72, 72), f"Texto de pǭgina {page_number}")
        document.save(pdf_path)

    pages = extract_pages(pdf_path)

    assert [page.page for page in pages] == [12]
