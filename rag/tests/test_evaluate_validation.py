from dataclasses import dataclass

import yaml

from rag.eval.evaluate_validation import (
    calculate_validation_metrics,
    load_validation_cases,
    run_evaluation,
    write_report,
)


@dataclass
class SyntheticResult:
    pagina: int


def _result(page: int) -> SyntheticResult:
    return SyntheticResult(page)


def _cases():
    return [
        {"pregunta": f"pregunta nueva {index}", "paginas_esperadas": [index], "fuera_de_corpus": False}
        for index in range(1, 11)
    ] + [
        {"pregunta": f"fuera corpus {index}", "paginas_esperadas": [], "fuera_de_corpus": True}
        for index in range(1, 6)
    ]


def test_blank_template_is_not_evaluable():
    try:
        load_validation_cases()
    except ValueError as error:
        assert "está vacía" in str(error)
    else:
        raise AssertionError("La plantilla vacía no debe poder evaluarse.")


def test_validation_set_checks_counts_and_novelty(tmp_path):
    cases = _cases()
    path = tmp_path / "questions.yaml"
    path.write_text(
        yaml.safe_dump(
            {"contract": "rag_validation_questions/v1", "preguntas": cases},
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    original = tmp_path / "original.yaml"
    original.write_text(
        yaml.safe_dump({"preguntas": [{"pregunta": "pregunta original"}]}),
        encoding="utf-8",
    )

    assert len(load_validation_cases(path, original)) == 15
    cases[0]["pregunta"] = "pregunta original"
    path.write_text(
        yaml.safe_dump(
            {"contract": "rag_validation_questions/v1", "preguntas": cases},
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    try:
        load_validation_cases(path, original)
    except ValueError as error:
        assert "no es nueva" in str(error)
    else:
        raise AssertionError("Una pregunta original no debe aceptarse como nueva.")


def test_metrics_separate_valid_and_out_of_corpus_abstention():
    cases = _cases()[:10]
    valid_results = [[_result(1)], [], *[[_result(index)] for index in range(3, 11)]]
    outside_results = [[], [_result(99)], [], [_result(98)], []]

    result = calculate_validation_metrics(cases, valid_results, outside_results)

    assert result["retrieval"] == {
        "hit@1": 0.9,
        "hit@3": 0.9,
        "hit@5": 0.9,
        "MRR": 0.9,
    }
    assert result["abstention"]["valid"] == {
        "abstained": 1,
        "total": 10,
        "rate": 0.1,
    }
    assert result["abstention"]["out_of_corpus"] == {
        "abstained": 3,
        "total": 5,
        "rate": 0.6,
    }


def test_run_uses_fixed_threshold_and_report_has_only_aggregates(tmp_path):
    seen_thresholds = []

    def fake_retrieve(connection, question, embedder, top_k, min_similarity):
        seen_thresholds.append(min_similarity)
        if question.endswith("1") and question.startswith("pregunta"):
            return [_result(1)]
        return []

    result = run_evaluation(
        _cases(),
        object(),
        object(),
        threshold=0.73,
        retrieve_fn=fake_retrieve,
    )
    report = tmp_path / "aggregate.md"
    write_report(result, 0.73, "synthetic-embedder", report)
    content = report.read_text(encoding="utf-8")

    assert len(seen_thresholds) == 15
    assert set(seen_thresholds) == {0.73}
    assert "recalibrar" in content
    assert "pregunta nueva" not in content
    assert "fuera corpus" not in content
    assert "hit@1" in content and "MRR" in content
