import csv
import json

import numpy as np
import pytest

from ml.validacion_experta.evaluate import (
    CSV_COLUMNS,
    _agreement_metrics,
    evaluate_reviews,
    load_review_rows,
)


class SyntheticModel:
    classes_ = ["ELITE", "NORMAL"]

    def predict_proba(self, features):
        probabilities = []
        for tcnv in features["tcnv"]:
            probabilities.append([0.9, 0.1] if tcnv == 3 else [0.1, 0.9])
        return np.asarray(probabilities)


def _review_rows():
    values = [
        ("ELITE", 2, 3, 140, 300, 15, 950, "1"),
        ("NORMAL", 1, 2, 120, 200, 15, 950, "2"),
        ("NORMAL", 2, 3, 140, 200, 15, 950, "1"),
        ("ELITE", 1, 2, 120, 200, 15, 950, "2"),
    ]
    return [
        {
            "id_anonimo": f"anon-{index}",
            "experto": expert,
            "datos": {
                "nupar_madre": nupar,
                "tcnv": tcnv,
                "peso_nacimiento_g": birth,
                "peso_destete_g": weaning,
                "dias_destete": days,
                "peso_monta_g": mating,
                "ojos": eyes,
            },
        }
        for index, (expert, nupar, tcnv, birth, weaning, days, mating, eyes)
        in enumerate(values, start=1)
    ]


def test_metrics_include_accuracy_kappa_per_class_and_confusion_matrix():
    result = _agreement_metrics(
        ["ELITE", "NORMAL", "ELITE", "NORMAL"],
        ["ELITE", "NORMAL", "NORMAL", "ELITE"],
    )

    assert result["exactitud"] == 0.5
    assert result["kappa_cohen"] == 0.0
    assert result["por_clase"]["ELITE"] == {
        "precision": 0.5,
        "recall": 0.5,
        "f1": 0.5,
    }
    assert result["matriz_confusion"] == [[1, 1], [1, 1]]


def test_rules_and_rf_agreement_is_aggregate_only():
    result = evaluate_reviews(_review_rows(), SyntheticModel())
    serialized = json.dumps(result)

    assert result["n"] == 4
    assert result["reglas_vs_experto"]["exactitud"] == 0.75
    assert result["reglas_vs_experto"]["kappa_cohen"] == 0.5
    assert result["rf_vs_experto"]["exactitud"] == 0.5
    assert result["rf_vs_experto"]["kappa_cohen"] == 0.0
    assert "anon-" not in serialized
    assert "peso_nacimiento" not in serialized


def test_csv_loader_requires_blinded_template_header_and_complete_rows(tmp_path):
    path = tmp_path / "review.csv"
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        source = _review_rows()[0]
        writer.writerow(
            {
                "id_anonimo": source["id_anonimo"],
                **source["datos"],
                "clasificacion_experta": source["experto"],
            }
        )

    rows = load_review_rows(path)
    assert len(rows) == 1
    assert rows[0]["datos"]["peso_nacimiento_g"] == 140
    assert rows[0]["experto"] == "ELITE"

    path.write_text(
        "id_anonimo,nupar_madre,prediccion_rf\nanon-1,2,ELITE\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="cabecera"):
        load_review_rows(path)
