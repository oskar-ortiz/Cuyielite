import csv
import json

import joblib
import pandas as pd

from ml.model.dataset import FEATURES_A, FEATURES_B, load_dataset
from ml.model.evaluate import (
    build_pipeline,
    evaluate_experiment,
)
from ml.model.train import render_report


def _synthetic_features(rows=40):
    labels = pd.Series(["ELITE" if index % 2 else "NORMAL" for index in range(rows)])
    features = pd.DataFrame(
        {
            "nupar_madre": [2 if label == "ELITE" else 1 for label in labels],
            "tcnv": [3 if label == "ELITE" else 2 for label in labels],
            "peso_nacimiento_g": [
                140 if label == "ELITE" else 120 for label in labels
            ],
            "ojos": ["1" if label == "ELITE" else "2" for label in labels],
            "peso_destete_g": [
                290 if label == "ELITE" else 200 for label in labels
            ],
            "ratio_destete_nacimiento": [
                2.1 if label == "ELITE" else 1.6 for label in labels
            ],
        }
    )
    return features, labels


def test_experiment_b_contains_only_birth_available_features():
    assert FEATURES_B == (
        "nupar_madre",
        "tcnv",
        "peso_nacimiento_g",
        "ojos",
    )
    assert "peso_destete_g" not in FEATURES_B
    assert "ratio_destete_nacimiento" not in FEATURES_B
    assert set(FEATURES_B).issubset(FEATURES_A)


def test_dataset_filters_labels_and_deduplicates_usable_identifiers(tmp_path):
    path = tmp_path / "features_crias_etiquetadas.csv"
    fields = [
        *FEATURES_A,
        "etiqueta",
        "estado_calidad",
        "identidad",
        "provenance_archivo",
    ]
    rows = [
        ["2", "3", "140", "280", "2.0", "1", "ELITE", "CONFIRMADO",
         "ID-SYNTHETIC", "source-a.xlsx"],
        ["2", "3", "140", "280", "2.0", "1", "ELITE", "CONFIRMADO",
         "ID-SYNTHETIC", "source-b.xlsx"],
        ["1", "2", "120", "200", "1.6", "2", "NORMAL", "CONFIRMADO",
         "", "source-a.xlsx"],
        ["", "", "", "", "", "", "", "NO_APLICA", "", "source-a.xlsx"],
        ["", "", "", "", "", "", "", "REVISAR", "", "source-a.xlsx"],
    ]
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(fields)
        writer.writerows(rows)

    dataset = load_dataset(path)
    assert len(dataset.labels) == 2
    assert dataset.stats["duplicate_rows_removed"] == 1
    assert dataset.stats["cross_source_duplicate_ids"] == 1
    assert dataset.stats["excluded_no_aplica"] == 1
    assert dataset.stats["excluded_review"] == 1
    assert dataset.stats["rows_without_usable_identity"] == 1
    assert "ID-SYNTHETIC" not in json.dumps(dataset.stats)


def test_same_seed_produces_identical_cross_validation_metrics():
    features, labels = _synthetic_features()
    options = {
        "n_splits": 2,
        "n_repeats": 2,
        "inner_splits": 2,
        "param_grid": {
            "classifier__n_estimators": (10,),
            "classifier__max_depth": (None,),
            "classifier__min_samples_leaf": (1,),
        },
    }
    first = evaluate_experiment(features.loc[:, FEATURES_B], labels, FEATURES_B, **options)
    second = evaluate_experiment(features.loc[:, FEATURES_B], labels, FEATURES_B, **options)
    assert first["metrics"] == second["metrics"]
    assert first["fold_metrics"] == second["fold_metrics"]
    assert len(first["fold_metrics"]) == first["folds"]
    assert all(
        set(metrics) == {"precision", "recall", "f1"}
        for metrics in first["fold_metrics"]
    )
    assert first["metrics_by_class"] == second["metrics_by_class"]
    assert set(first["metrics_by_class"]) == {"NORMAL", "ELITE"}
    assert set(first["metrics_by_class"]["ELITE"]) == {
        "precision",
        "recall",
        "f1",
    }
    assert first["confusion_matrix_pooled"] == second["confusion_matrix_pooled"]
    assert first["feature_importance"] == second["feature_importance"]


def test_model_serializes_loads_and_predicts(tmp_path):
    features, labels = _synthetic_features()
    model = build_pipeline(FEATURES_B).fit(features.loc[:, FEATURES_B], labels)
    model_path = tmp_path / "candidate.joblib"
    joblib.dump(model, model_path)

    loaded = joblib.load(model_path)
    predictions = loaded.predict(features.loc[:, FEATURES_B].iloc[:4])
    assert len(predictions) == 4
    assert set(predictions).issubset({"ELITE", "NORMAL"})


def test_metrics_report_contains_no_animal_identifiers():
    report = render_report(
        {
            "date": "2026-11-08",
            "versions": {"scikit_learn": "test-version"},
            "dataset_sha256": "0" * 64,
            "protocol": {"repeats": 3, "inner_folds": 3},
            "dataset": {
                "rows_used": 20,
                "class_counts": {"ELITE": 8, "NORMAL": 12},
                "excluded_no_aplica": 1,
                "excluded_review": 2,
                "duplicate_rows_removed": 0,
                "rows_without_usable_identity": 20,
            },
            "experiments": {
                name: {
                    "feature_names": list(FEATURES_B),
                    "metrics": {
                        metric: {"mean": 0.5, "std": 0.1}
                        for metric in ("precision", "recall", "f1")
                    },
                    "metrics_by_class": {
                        label: {
                            metric: {"mean": 0.5, "std": 0.1}
                            for metric in ("precision", "recall", "f1")
                        }
                        for label in ("NORMAL", "ELITE")
                    },
                    "confusion_matrix_pooled": [[30, 6], [4, 20]],
                    "feature_importance": [
                        {"feature": feature, "mean": 0.25, "std": 0.01}
                        for feature in FEATURES_B
                    ],
                    "baselines": {
                        "majority_class": {
                            "metrics": {
                                metric: {"mean": 0.0, "std": 0.0}
                                for metric in ("precision", "recall", "f1")
                            }
                        },
                        "decision_tree_depth_1": {
                            "metrics": {
                                metric: {"mean": 0.3, "std": 0.1}
                                for metric in ("precision", "recall", "f1")
                            }
                        },
                    },
                }
                for name in ("A_completo", "B_nacimiento")
            },
            "reproductive_examples": {
                "descarte": 2,
                "normal": 10,
                "unlabeled": 1,
            },
        }
    )
    assert "ID-SYNTHETIC-ANIMAL-123" not in report
    assert "CHAPA-REAL-123" not in report
    assert "fuga de información" in report
    assert "Precisión, recall y F1 por clase" in report
