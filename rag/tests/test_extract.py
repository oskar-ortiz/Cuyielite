import pymupdf

from rag.src.extract import clean_text, extract_pages


def test_clean_text_normalizes_pdf_ligature_glyphs() -> None:
    text = "öbra øexible \uf001bras \uf002ora \ufb01bra \ufb02exible"

    assert clean_text(text) == "fibra flexible fibras flora fibra flexible"


def test_extract_excludes_sena_manual_front_matter(tmp_path) -> None:
    pdf_path = tmp_path / "manual.pdf"
    with pymupdf.open() as document:
        for page_number in range(1, 13):
            page = document.new_page()
            page.insert_text((72, 72), f"Texto de página {page_number}")
        document.save(pdf_path)

    pages = extract_pages(pdf_path)

    assert [page.page for page in pages] == [12]
