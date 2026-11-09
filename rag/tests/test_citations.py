import pytest

from rag.src.retrieve import SearchResult, build_response, format_citation


def test_citation_format_matches_source_contract() -> None:
    assert format_citation("produccion_cuyes.pdf", 12) == "produccion_cuyes.pdf, p. 12"


def test_response_has_extracts_and_deduplicated_sources() -> None:
    result = SearchResult("manual.pdf", "Fragmento relevante.", 3, None, 0.8)
    response = build_response("pregunta", [result, result])

    assert response["respuesta"].count("[manual.pdf, p. 3]") == 2
    assert response["fuentes"] == ["manual.pdf, p. 3"]


@pytest.mark.parametrize("source,page", [("", 1), ("manual.pdf", 0), ("manual.pdf", True)])
def test_invalid_citation_values_are_rejected(source: str, page: int) -> None:
    with pytest.raises(ValueError):
        format_citation(source, page)
