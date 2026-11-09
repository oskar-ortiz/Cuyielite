"""Train, evaluate, and persist the anticipatory candidate Random Forest."""

import argparse
from datetime import date
import json
from pathlib import Path
import platform
from typing import Any

import joblib
import sklearn

from ml.model.dataset import (
    FEATURES_A,
    FEATURES_B,
    CandidateDataset,
    load_dataset,
    reproductive_label_counts,
)
from ml.model.evaluate import evaluate_experiment, fit_final_model


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = REPOSITORY_ROOT / "ml" / "data"
DEFAULT_MODEL_DIR = REPOSITORY_ROOT / "ml" / "models"
DEFAULT_REPORT = REPOSITORY_ROOT / "ml" / "reports" / "informe_metricas.md"


def _markdown_table(headers: list[str], rows: list[list[Any]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    lines.extend("| " + " | ".join(str(value) for value in row) + " |" for row in rows)
    return "\n".join(lines)


def _format_metric(result: dict[str, Any], metric: str) -> str:
    values = result["metrics"][metric]
    return f"{values['mean']:.3f} ± {values['std']:.3f}"


def _format_class_metric(
    result: dict[str, Any],
    label: str,
    metric: str,
) -> str:
    values = result["metrics_by_class"][label][metric]
    return f"{values['mean']:.3f} ± {values['std']:.3f}"


def render_report(metadata: dict[str, Any]) -> str:
    """Render a metrics report using only aggregate metadata."""
    data = metadata["dataset"]
    experiments = metadata["experiments"]
    lines = [
        "# Informe de métricas — Random Forest de candidatas",
        "",
        f"- Fecha: {metadata['date']}",
        f"- Versión scikit-learn: {metadata['versions']['scikit_learn']}",
        f"- SHA-256 del CSV etiquetado: `{metadata['dataset_sha256']}`",
        f"- Protocolo: RepeatedStratifiedKFold, 5 pliegues × "
        f"{metadata['protocol']['repeats']} repeticiones; ajuste interno "
        f"StratifiedKFold de {metadata['protocol']['inner_folds']} pliegues.",
        "- Clasificador: `RandomForestClassifier(class_weight='balanced', "
        "random_state=42)`; búsqueda de hiperparámetros dentro de cada pliegue "
        "de entrenamiento.",
        "",
        "## Dataset",
        "",
        _markdown_table(
            ["Filas", "ELITE", "NORMAL", "NO_APLICA excluidas", "REVISAR excluidas",
             "Conflictos duplicados excluidos", "Duplicados retirados"],
            [[
                data["rows_used"],
                data["class_counts"].get("ELITE", 0),
                data["class_counts"].get("NORMAL", 0),
                data["excluded_no_aplica"],
                data["excluded_review"],
                data.get("excluded_duplicate_conflict", 0),
                data["duplicate_rows_removed"],
            ]],
        ),
        "",
        f"Filas elegibles sin identificador utilizable: "
        f"{data['rows_without_usable_identity']}; por ello no fue posible "
        "comprobar duplicados para esas filas.",
        "",
        "## Resultados de validación cruzada",
        "",
        "Se informa media ± desviación estándar entre pliegues. Las matrices "
        "agregan las predicciones de todos los pliegues repetidos y usan orden "
        "de clase NORMAL, ELITE.",
        "",
        _markdown_table(
            ["Experimento", "Variables", "Precisión ELITE", "Recall ELITE", "F1 ELITE"],
            [
                [
                    name,
                    ", ".join(experiments[name]["feature_names"]),
                    _format_metric(experiments[name], "precision"),
                    _format_metric(experiments[name], "recall"),
                    _format_metric(experiments[name], "f1"),
                ]
                for name in ("A_completo", "B_nacimiento")
            ],
        ),
        "",
    ]
    for name in ("A_completo", "B_nacimiento"):
        result = experiments[name]
        tn, fp = result["confusion_matrix_pooled"][0]
        fn, tp = result["confusion_matrix_pooled"][1]
        lines.extend(
            [
                f"### Matriz de confusión — {name}",
                "",
                _markdown_table(
                    ["", "Predicho NORMAL", "Predicho ELITE"],
                    [["Real NORMAL", tn, fp], ["Real ELITE", fn, tp]],
                ),
                "",
                    "#### Precisión, recall y F1 por clase",
                    "",
                    _markdown_table(
                        ["Clase", "Precisión", "Recall", "F1"],
                        [
                            [
                                label,
                                _format_class_metric(result, label, "precision"),
                                _format_class_metric(result, label, "recall"),
                                _format_class_metric(result, label, "f1"),
                            ]
                            for label in ("NORMAL", "ELITE")
                        ],
                    ),
                    "",
                    "#### Importancia media de variables",
                "",
                _markdown_table(
                    ["Variable", "Importancia media", "Desviación estándar"],
                    [
                        [
                            item["feature"],
                            f"{item['mean']:.4f}",
                            f"{item['std']:.4f}",
                        ]
                        for item in result["feature_importance"]
                    ],
                ),
                "",
                _markdown_table(
                    ["Línea base", "Precisión ELITE", "Recall ELITE", "F1 ELITE"],
                    [
                        [
                            baseline_name,
                            _format_metric(baseline, "precision"),
                            _format_metric(baseline, "recall"),
                            _format_metric(baseline, "f1"),
                        ]
                        for baseline_name, baseline in result["baselines"].items()
                    ],
                ),
                "",
            ]
        )
    reproductive = metadata["reproductive_examples"]
    lines.extend(
        [
            "## DESCARTE en reproductoras",
            "",
            f"Hay {reproductive['descarte']} ejemplos `DESCARTE`, "
            f"{reproductive['normal']} `NORMAL` y {reproductive['unlabeled']} sin "
            "clase entre las filas reproductoras. No se entrenó este modelo: hay "
            "pocos ejemplos de descarte, y el historial de empadres y el cruce "
            "madre-cría siguen siendo limitaciones; por ahora se mantienen las reglas.",
            "",
            "## Limitaciones e interpretación",
            "",
            "- Las etiquetas se derivan de las reglas del ADR 0004, no de una "
            "evaluación independiente del resultado productivo. El experimento A "
            "incluye los criterios usados directamente para crear la etiqueta; "
            "su puntuación alta es fuga de información y no evidencia de "
            "generalización.",
            "- El experimento B excluye peso al destete y ratio; estima la clase "
            "derivada posteriormente a partir de variables disponibles al nacer. "
            "Su resultado no confirma que la candidata llegue a cumplir los "
            "criterios de destete.",
            "- La muestra procede de una sola explotación/centro e incluye "
            "registros de Galpón 1 y Galpón 2. La validación mezcla ambos galpones; "
            "no equivale a validación externa ni a evaluación en un galpón aislado.",
            "- Las filas sin identificador utilizable no permiten detectar posibles "
            "duplicados entre archivos. Los datos no se separaron por animal ni por "
            "galpón, lo cual puede inflar métricas si hay dependencias entre registros.",
            "- Random Forest y líneas base se evaluaron sobre una muestra de "
            f"{data['rows_used']} observaciones clasificables; las métricas dependen "
            "del tamaño y composición de esta muestra.",
            "",
            "El modelo guardado corresponde al experimento B, ajustado con todos "
            "los ejemplos elegibles después de completar la evaluación anidada. "
            "Las métricas informadas son las de validación cruzada, no las del "
            "ajuste final.",
            "",
        ]
    )
    return "\n".join(lines)


def train(
    data_dir: Path = DEFAULT_DATA_DIR,
    model_dir: Path = DEFAULT_MODEL_DIR,
    report_path: Path = DEFAULT_REPORT,
) -> dict[str, Any]:
    dataset: CandidateDataset = load_dataset(data_dir / "features_crias_etiquetadas.csv")
    experiment_a = evaluate_experiment(
        dataset.features_a, dataset.labels, FEATURES_A
    )
    experiment_b = evaluate_experiment(
        dataset.features_b, dataset.labels, FEATURES_B
    )
    reproductive_counts = reproductive_label_counts(
        data_dir / "features_reproductoras_etiquetadas.csv"
    )
    final_search = fit_final_model(
        dataset.features_b, dataset.labels, FEATURES_B
    )

    model_dir.mkdir(parents=True, exist_ok=True)
    model_path = model_dir / "candidate_random_forest_b.joblib"
    joblib.dump(final_search.best_estimator_, model_path)

    metadata = {
        "model": "RandomForestClassifier",
        "primary_experiment": "B_nacimiento",
        "date": date.today().isoformat(),
        "versions": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
        },
        "dataset_sha256": dataset.sha256,
        "dataset": dataset.stats,
        "protocol": {
            "outer": "RepeatedStratifiedKFold",
            "folds": 5,
            "repeats": 3,
            "inner_cv": "StratifiedKFold",
            "inner_folds": 3,
            "scoring": "f1 (pos_label=ELITE)",
            "random_state": 42,
            "search_grid": {
                "n_estimators": [100, 200],
                "max_depth": [None, 8],
                "min_samples_leaf": [1, 5],
            },
        },
        "final_model_features": list(FEATURES_B),
        "final_model_parameters": final_search.best_params_,
        "experiments": {
            "A_completo": experiment_a,
            "B_nacimiento": experiment_b,
        },
        "reproductive_examples": reproductive_counts,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(render_report(metadata), encoding="utf-8")
    (model_dir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate candidate Random Forest experiments A and B."
    )
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--model-dir", type=Path, default=DEFAULT_MODEL_DIR)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    metadata = train(args.data_dir, args.model_dir, args.report)
    print(
        json.dumps(
            {
                "dataset": metadata["dataset"],
                "experiments": {
                    name: result["metrics"]
                    for name, result in metadata["experiments"].items()
                },
                "reproductive_examples": metadata["reproductive_examples"],
            },
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
