from rag.src.chunk import chunk_pages
from rag.src.extract import PageText
from rag.src.extract import _is_section_heading


def test_chunks_pack_paragraphs_and_overlap() -> None:
    first = " ".join(f"palabra{i}" for i in range(12))
    second = " ".join(f"termino{i}" for i in range(12))
    chunks = chunk_pages([PageText(page=4, text=f"{first}\n\n{second}", section="Alimentación")], 16, 0.25)

    assert len(chunks) == 2
    assert len(chunks[0].text.split()) <= 16
    assert len(chunks[1].text.split()) <= 16
    assert len(set(chunks[0].text.split()) & set(chunks[1].text.split())) >= 4
    assert all(chunk.page == 4 and chunk.section == "Alimentación" for chunk in chunks)


def test_oversized_paragraph_is_split_with_overlap() -> None:
    page = PageText(page=2, text=" ".join(f"t{i}" for i in range(25)))
    chunks = chunk_pages([page], target_tokens=10, overlap_ratio=0.2)

    assert [len(chunk.text.split()) for chunk in chunks] == [10, 10, 9]
    assert chunks[0].text.split()[-2:] == chunks[1].text.split()[:2]


def test_section_detection_does_not_treat_body_text_as_a_unit_heading() -> None:
    assert not _is_section_heading("unidad de área. Las medidas de las jaulas individuales")
    assert _is_section_heading("UNIDAD 2: MANEJO")
