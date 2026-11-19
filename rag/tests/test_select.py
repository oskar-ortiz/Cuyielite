from rag.src.retrieve import ExtractiveGenerator, SearchResult
from rag.src.select import format_extract, select_sentences


def _result(page: int, text: str, source: str = "manual.pdf") -> SearchResult:
    return SearchResult(
        documento_fuente=source,
        contenido_chunk=text,
        pagina=page,
        seccion=None,
        similitud=0.9,
    )


def test_selected_sentences_are_literal_substrings_with_source_citations() -> None:
    results = [
        _result(26, "La gestación dura entre 63 y 70 días. El galpón protege a los cuyes."),
        _result(32, "La tabla indica vitamina C. El concentrado se administra con agua."),
    ]

    answer = ExtractiveGenerator().generate("¿Cuál es la duración de la gestación?", results)
    selected = select_sentences("¿Cuál es la duración de la gestación?", results)

    assert selected
    for item in selected:
        assert item.texto in results[item.result_index].contenido_chunk
        assert f"[{item.documento_fuente}, p. {item.pagina}]" in answer


def test_citation_comes_from_selected_sentence_metadata() -> None:
    results = [_result(41, "El concentrado incluye vitamina C.", "produccion_cuyes.pdf")]

    answer = format_extract("¿Por qué se administra vitamina C?", results)

    assert answer.endswith("[produccion_cuyes.pdf, p. 41]")
    assert answer.startswith("El concentrado incluye vitamina C.")


def test_abstention_is_unchanged_without_results() -> None:
    assert ExtractiveGenerator().generate("Cualquier pregunta", []) == (
        "No encontré información en los manuales."
    )


def test_selection_depends_on_question_not_fixed_terms() -> None:
    results = [
        _result(26, "La gestación dura entre 63 y 70 días. El galpón protege a los cuyes."),
        _result(41, "La impresora Wi-Fi se configura desde el menú."),
        _result(51, "El peso se registra en la planilla."),
        _result(66, "La bibliografía se presenta al final."),
    ]

    first = select_sentences("¿Cuál es la duración de la gestación?", results)
    second = select_sentences("¿Cómo se configura una impresora?", results)

    assert first and second
    best_first = max(first, key=lambda item: item.score).texto
    best_second = max(second, key=lambda item: item.score).texto
    assert best_first != best_second
    assert "gestación" in best_first
    assert "impresora" in best_second


def test_selected_sentences_keep_retrieval_order() -> None:
    results = [
        _result(26, "La gestación dura entre 63 y 70 días."),
        _result(32, "La tabla indica vitamina C."),
        _result(41, "El concentrado se administra con agua."),
    ]

    selected = select_sentences("¿Cuál es la duración de la gestación y la vitamina C?", results)

    assert [item.result_index for item in selected] == sorted(
        item.result_index for item in selected
    )
