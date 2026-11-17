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
    similitud: float = 0.9


def _result(page: int, score: float = 0.9) -> SyntheticResult:
    return SyntheticResult(page, score)


def _cases(valid_count=10, outside_count=5, in_domain_count=3):
    return [
        {
            "id": f"A{index}",
            "grupo": "valida",
            "pregunta": f"pregunta nueva {index}",
            "paginas_esperadas": [index],
            "fuera_de_corpus": False,
        }
        for index in range(1, valid_count + 1)
    ] + [
        {
            "id": f"F{index}",
            "grupo": "fuera_de_corpus",
            "pregunta": f"fuera corpus {index}",
            "paginas_esperadas": [],
            "fuera_de_corpus": True,
        }
        for index in range(1, outside_count + 1)
    ] + [
        {
            "id": f"D{index}",
            "grupo": "en_dominio_sin_respuesta",
            "pregunta": f"sin respuesta {index}",
            "paginas_esperadas": [],
            "fuera_de_corpus": False,
        }
        for index in range(1, in_domain_count + 1)
    ]


def test_repository_validation_set_has_three_distinct_groups():
    cases = load_validation_cases()

    assert sum(case["grupo"] == "valida" for case in cases) == 17
    assert sum(case["grupo"] == "fuera_de_corpus" for case in cases) == 10
    assert sum(case["grupo"] == "en_dominio_sin_respuesta" for case in cases) == 3


def test_validation_set_checks_minimum_counts_novelty_and_ids(tmp_path):
    cases = _cases(valid_count=11, outside_count=6, in_domain_count=2)
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

    assert len(load_validation_cases(path, original)) == 19
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


def test_validation_set_rejects_below_minimum_counts(tmp_path):
    cases = _cases(valid_count=9, outside_count=5, in_domain_count=0)
    path = tmp_path / "questions.yaml"
    path.write_text(
        yaml.safe_dump(
            {"contract": "rag_validation_questions/v1", "preguntas": cases},
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    original = tmp_path / "original.yaml"
    original.write_text(yaml.safe_dump({"preguntas": []}), encoding="utf-8")

    try:
        load_validation_cases(path, original)
    except ValueError as error:
        assert "al menos 10" in str(error)
    else:
        raise AssertionError("El conjunto por debajo del mínimo no debe aceptarse.")


def test_metrics_separate_abstention_and_record_expected_page_position():
    valid_cases = _cases()[:10]
    valid_results = [
        [_result(99, 0.93), _result(1, 0.88)],
        [],
        *[[_result(index)] for index in range(3, 11)],
    ]
    outside_results = [[], [_result(99)], [], [_result(98)], []]
    in_domain_cases = _cases()[-3:]
    in_domain_results = [[], [_result(97, 0.87)], []]

    result = calculate_validation_metrics(
        valid_cases,
        valid_results,
        outside_results,
        in_domain_cases,
        in_domain_results,
        out_of_corpus_cases=_cases()[10:15],
    )

    assert result["retrieval"] == {
        "hit@1": 0.8,
        "hit@3": 0.9,
        "hit@5": 0.9,
        "MRR": 0.85,
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
    assert result["abstention"]["in_domain_no_answer"] == {
        "abstained": 2,
        "total": 3,
        "rate": 2 / 3,
    }
    assert result["per_question"][0]["posicion_esperada"] == 2
    assert result["per_question"][0]["similitud_esperada"] == 0.88
    assert result["per_question"][-2]["abstencion"] is False


def test_run_uses_fixed_threshold_and_report_has_only_aggregates(tmp_path):
    seen_thresholds = []

    def fake_retrieve(connection, question, embedder, top_k, min_similarity):
        seen_thresholds.append(min_similarity)
        if question.endswith("1") and question.startswith("pregunta"):
            return [_result(1, 0.91)]
        return []

    result = run_evaluation(
        _cases(),
        object(),
        object(),
        threshold=0.73,
        retrieve_fn=fake_retrieve,
    )
    report = tmp_path / "aggregate.md"
    write_report(
        result,
        0.73,
        "synthetic-embedder",
        report,
        evaluation_date="2026-11-16",
    )
    content = report.read_text(encoding="utf-8")

    assert len(seen_thresholds) == 18
    assert set(seen_thresholds) == {0.73}
    assert "2026-11-16" in content
    assert "Procedencia de las preguntas: [completar por Diery]" in content
    assert "hit@1" in content and "MRR" in content
    assert "fuera_de_corpus" in content
    assert "en_dominio_sin_respuesta" in content
    assert "Válidas sin página esperada" in content
    assert "pregunta nueva" not in content
    assert "fuera corpus" not in content
    assert "sin respuesta 1" not in content
