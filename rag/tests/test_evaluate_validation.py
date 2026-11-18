import contextlib
from dataclasses import dataclass

import psycopg
import yaml

from rag.eval import evaluate_validation as evaluate_validation_module
from rag.eval.evaluate_validation import (
    calculate_validation_metrics,
    load_validation_cases,
    run_config_app_evaluation,
    run_evaluation,
    write_config_app_report,
    write_report,
)


@dataclass
class SyntheticResult:
    pagina: int
    similitud: float = 0.9
    contenido_chunk: str = ""


def _result(page: int, score: float = 0.9, text: str = "") -> SyntheticResult:
    return SyntheticResult(page, score, text)


def _cases(valid_count=10, outside_count=5, in_domain_count=3):
    return [
        {
            "id": f"Q{index}",
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
    assert "Procedencia de las preguntas: Conjunto nuevo preparado" in content
    assert "`produccion_cuyes.pdf`" in content
    assert "No consta revisión zootécnica independiente." in content
    assert "hit@1" in content and "MRR" in content
    assert "fuera_de_corpus" in content
    assert "en_dominio_sin_respuesta" in content
    assert "Válidas sin página esperada" in content
    assert "pregunta nueva" not in content
    assert "fuera corpus" not in content
    assert "sin respuesta 1" not in content


def test_config_app_uses_top_k_five_and_diagnostic_cuts():
    calls = []

    def fake_retrieve(connection, question, embedder, top_k, min_similarity):
        calls.append((question, top_k, min_similarity))
        if question == "pregunta nueva 1":
            return [_result(1, 0.95, "pregunta nueva")]
        return []

    result = run_config_app_evaluation(
        _cases(),
        object(),
        object(),
        threshold=0.8,
        retrieve_fn=fake_retrieve,
    )

    assert result["top_k"] == 5
    assert result["principal"]["retrieval"]["hit@1"] == 0.1
    assert result["valid_details"][0]["pagina_correcta_en_5"] is True
    assert result["valid_details"][0]["contiene_todos_los_terminos"] is True
    assert {3, 5, 10, 20}.issubset({top_k for _, top_k, _ in calls})
    assert sum(1 for _, top_k, _ in calls if top_k == 5) == 20
    assert {threshold for _, _, threshold in calls} == {0.8}


def test_config_app_lists_page_misses_and_term_overlap():
    def fake_retrieve(connection, question, embedder, top_k, min_similarity):
        if question == "pregunta nueva 2":
            return [_result(2, 0.9, "pregunta nueva")]
        return []

    result = run_config_app_evaluation(
        _cases(),
        object(),
        object(),
        threshold=0.8,
        retrieve_fn=fake_retrieve,
    )

    assert "Q1" in result["valid_page_misses"]
    detail = next(item for item in result["valid_details"] if item["numero"] == "Q2")
    assert detail["pagina_correcta_en_5"] is True
    assert detail["cobertura_terminos"] == 1.0
    assert detail["contiene_todos_los_terminos"] is True


def test_config_app_report_appends_without_changing_previous_figures(tmp_path):
    def fake_retrieve(connection, question, embedder, top_k, min_similarity):
        if question == "pregunta nueva 1":
            return [_result(1, 0.95, "pregunta nueva")]
        return []

    result = run_config_app_evaluation(
        _cases(),
        object(),
        object(),
        threshold=0.8,
        retrieve_fn=fake_retrieve,
    )
    report = tmp_path / "report.md"
    report.write_text("CIFRAS PREVIAS\n", encoding="utf-8")

    write_config_app_report(
        result,
        0.8,
        "synthetic-embedder",
        report,
        evaluation_date="2026-11-18",
        environment_note="corpus en memoria",
    )

    content = report.read_text(encoding="utf-8")
    assert content.startswith("CIFRAS PREVIAS\n")
    assert "## Medición con la configuración de la app" in content
    assert "top_k=5 (principal)" in content
    assert "top_k=3 (diagnóstico)" in content
    assert "gestación" in content and "vitamina C" in content
    assert "Entorno: corpus en memoria" in content


def test_main_config_app_uses_config_app_branch(monkeypatch, tmp_path):
    calls = {}

    monkeypatch.setenv("RAG_DATABASE_URL", "postgresql://fake")
    monkeypatch.setattr(
        evaluate_validation_module,
        "load_validation_cases",
        lambda *_: _cases(),
    )

    def fake_run(cases, connection, embedder, threshold):
        calls["run"] = (len(cases), threshold)
        return {"top_k": 5}

    def fake_write(result, threshold, model_name, report_path):
        calls["write"] = (result, threshold, model_name, report_path)

    monkeypatch.setattr(evaluate_validation_module, "run_config_app_evaluation", fake_run)
    monkeypatch.setattr(evaluate_validation_module, "write_config_app_report", fake_write)
    monkeypatch.setattr(psycopg, "connect", lambda url: contextlib.nullcontext(object()))

    class FakeEmbedder:
        model_name = "synthetic-embedder"

    monkeypatch.setattr("rag.src.embed.E5Embedder", FakeEmbedder)
    report = tmp_path / "report.md"

    evaluate_validation_module.main(["--config-app", "--report", str(report)])

    assert calls["run"] == (18, 0.807566308073)
    assert calls["write"][2] == "synthetic-embedder"
    assert calls["write"][3] == report
