"""Compute aggregate expert agreement without writing row-level predictions."""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path
from typing import Any

from sklearn.metrics import (
    accuracy_score,
    cohen_kappa_score,
    confusion_matrix,
    precision_recall_fscore_support,
)

from ml.model.artifact import load_verified_model
from ml.prediccion import predecir_candidata


CLASS_ORDER = ("NORMAL", "ELITE")
CSV_COLUMNS = (
    "id_anonimo",
    "nupar_madre",
    "tcnv",
    "peso_nacimiento_g",
    "peso_destete_g",
    "dias_destete",
    "peso_monta_g",
    "ojos",
    "clasificacion_experta",
)
INTEGER_FIELDS = frozenset({"nupar_madre", "tcnv", "dias_destete"})
NUMERIC_FIELDS = (
    "nupar_madre",
    "tcnv",
    "peso_nacimiento_g",
    "peso_destete_g",
    "dias_destete",
    "peso_monta_g",
)


def _number(value: str, field: str, *, integer: bool) -> int | float:
    try:
        number = float(value)
    except ValueError as error:
        raise ValueError(f"Campo numérico inválido en {field}.") from error
    if not math.isfinite(number) or (integer and not number.is_integer()):
        raise ValueError(f"Campo numérico inválido en {field}.")
    return int(number) if integer else number


def load_review_rows(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if tuple(reader.fieldnames or ()) != CSV_COLUMNS:
            raise ValueError("La cabecera no coincide exactamente con la plantilla ciega.")
        rows = []
        seen_ids: set[str] = set()
        for row_number, row in enumerate(reader, start=2):
            anonymous_id = (row.get("id_anonimo") or "").strip()
            if not anonymous_id or anonymous_id in seen_ids:
                raise ValueError(f"id_anonimo vacío o repetido en la fila {row_number}.")
            seen_ids.add(anonymous_id)
            expert_class = (row.get("clasificacion_experta") or "").strip().upper()
            if expert_class not in CLASS_ORDER:
                raise ValueError(
                    f"Clasificación experta inválida o vacía en la fila {row_number}."
                )
            data: dict[str, Any] = {}
            for field in NUMERIC_FIELDS:
                value = (row.get(field) or "").strip()
                if not value:
                    raise ValueError(
                        f"Campo requerido vacío en la fila {row_number}: {field}."
                    )
                data[field] = _number(
                    value,
                    field,
                    integer=field in INTEGER_FIELDS,
                )
            data["ojos"] = (row.get("ojos") or "").strip()
            if not data["ojos"]:
                raise ValueError(f"Campo requerido vacío en la fila {row_number}: ojos.")
            rows.append(
                {
                    "id_anonimo": anonymous_id,
                    "datos": data,
                    "experto": expert_class,
                }
            )
    if not rows:
        raise ValueError("El archivo no contiene clasificaciones expertas.")
    return rows


def _agreement_metrics(
    expected: list[str],
    predicted: list[str],
) -> dict[str, Any]:
    if not expected or len(expected) != len(predicted):
        raise ValueError("Las etiquetas de referencia y predicción deben coincidir.")
    precision, recall, f1, _ = precision_recall_fscore_support(
        expected,
        predicted,
        labels=CLASS_ORDER,
        zero_division=0,
    )
    kappa = float(cohen_kappa_score(expected, predicted, labels=CLASS_ORDER))
    return {
        "exactitud": float(accuracy_score(expected, predicted)),
        "kappa_cohen": kappa if math.isfinite(kappa) else None,
        "por_clase": {
            label: {
                "precision": float(precision[index]),
                "recall": float(recall[index]),
                "f1": float(f1[index]),
            }
            for index, label in enumerate(CLASS_ORDER)
        },
        "orden_clases": list(CLASS_ORDER),
        "matriz_confusion": confusion_matrix(
            expected,
            predicted,
            labels=CLASS_ORDER,
        ).tolist(),
    }


def evaluate_reviews(
    rows: list[dict[str, Any]],
    model: Any,
) -> dict[str, Any]:
    if model is None:
        raise ValueError("No hay artefacto RF cargado y verificado.")
    expert = []
    rule_predictions = []
    rf_predictions = []
    for row in rows:
        data = row["datos"]
        result = predecir_candidata(data, modelo=model)
        support = result["apoyo_modelo"]
        if support is None:
            raise ValueError("El modelo no produjo apoyo para una fila completa.")
        expert.append(row["experto"])
        rule_predictions.append(result["clase"])
        rf_predictions.append(support["clase"])
    return {
        "n": len(rows),
        "reglas_vs_experto": _agreement_metrics(expert, rule_predictions),
        "rf_vs_experto": _agreement_metrics(expert, rf_predictions),
    }


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    model = load_verified_model()
    if model is None:
        raise RuntimeError("Configura CUYIELITE_RF_MODEL_PATH para cargar el RF verificado.")
    result = evaluate_reviews(load_review_rows(args.csv_path), model)
    rendered = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()
