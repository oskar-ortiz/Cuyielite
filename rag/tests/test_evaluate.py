from rag.eval.evaluate import calculate_metrics, calibrate_threshold
from rag.src.retrieve import SearchResult


def _result(page: int, score: float) -> SearchResult:
    return SearchResult(
        documento_fuente="manual.pdf",
        contenido_chunk="fragmento",
        pagina=page,
        seccion=None,
        similitud=score,
    )


def test_aggregate_page_metrics() -> None:
    cases = [
        {"pregunta": "q1", "paginas_esperadas": [2]},
        {"pregunta": "q2", "paginas_esperadas": [4, 5]},
    ]
    metrics = calculate_metrics(cases, [[2, 3, 4], [1, 5, 4]])

    assert metrics == {"hit@1": 0.5, "hit@3": 1.0, "hit@5": 1.0, "MRR": 0.75}


def test_threshold_calibration_balances_relevant_hits_and_abstention() -> None:
    valid_cases = [
        {"pregunta": "q1", "paginas_esperadas": [1]},
        {"pregunta": "q2", "paginas_esperadas": [2]},
    ]
    out_of_corpus_cases = [{"pregunta": "ood1"}, {"pregunta": "ood2"}]

    result = calibrate_threshold(
        valid_cases,
        out_of_corpus_cases,
        [[_result(1, 0.8)], [_result(2, 0.6)]],
        [[_result(9, 0.7)], [_result(10, 0.4)]],
    )

    assert result.threshold == 0.6
    assert result.out_of_corpus_abstained == 1
    assert result.valid_questions_lost == 0
    assert result.balanced_accuracy == 0.75
