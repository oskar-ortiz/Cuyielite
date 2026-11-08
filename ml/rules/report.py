"""Classify feature CSVs and write aggregate-only reports."""

import argparse
from collections import Counter
import csv
import json
from pathlib import Path
from typing import Any, Callable

from ml.etl import config
from ml.rules.clasificar import clasificar_candidata, clasificar_reproductora


REPORT_DIR = config.REPOSITORY_ROOT / "ml" / "reports" / "generados"
REFERENCE_ELITE = 52
REFERENCE_FEMALE_CANDIDATES = 398


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))


def _write_csv(
    path: Path,
    rows: list[dict[str, Any]],
    fields: list[str],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def _labeled_fields(rows: list[dict[str, Any]]) -> list[str]:
    fields = list(rows[0]) if rows else []
    return list(dict.fromkeys([*fields, "etiqueta", "motivos", "estado_calidad"]))


def _tokens(status: str) -> set[str]:
    return {token for token in status.split("|") if token}


def _classify_rows(
    rows: list[dict[str, str]],
    classify: Callable[[dict[str, Any]], dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    output_rows = []
    decisions = []
    for row in rows:
        decision = classify(row)
        output = dict(row)
        output["etiqueta"] = decision["clase"]
        output["motivos"] = "; ".join(decision["motivos"])
        output["estado_calidad"] = decision["estado_calidad"]
        output_rows.append(output)
        decisions.append(decision)
    return output_rows, decisions


def _summary_by_stage(
    decisions_by_stage: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    summary = {}
    for stage, decisions in decisions_by_stage.items():
        classes = Counter(decision["clase"] or "SIN_CLASE" for decision in decisions)
        motives = Counter(
            reason for decision in decisions for reason in decision["motivos"]
        )
        states = Counter(
            token
            for decision in decisions
            for token in _tokens(decision["estado_calidad"])
        )
        summary[stage] = {
            "clases": dict(sorted(classes.items())),
            "motivos": dict(sorted(motives.items())),
            "estados": dict(sorted(states.items())),
        }
    return summary


def _parturition_counts(rows: list[dict[str, str]]) -> dict[str, int]:
    counts = {"1": 0, "2": 0, "3": 0, "4+": 0, "0": 0, "SIN_DATO": 0}
    for row in rows:
        try:
            partos = float(row.get("partos_acumulados", ""))
        except (TypeError, ValueError):
            counts["SIN_DATO"] += 1
            continue
        if partos < 0:
            counts["SIN_DATO"] += 1
        elif partos == 0:
            counts["0"] += 1
        elif partos < 4 and partos.is_integer():
            counts[str(int(partos))] += 1
        elif partos >= 4:
            counts["4+"] += 1
        else:
            counts["SIN_DATO"] += 1
    return counts


def _female_candidate_reference(
    rows: list[dict[str, str]],
    decisions: list[dict[str, Any]],
) -> dict[str, Any]:
    eligible = [
        decision
        for row, decision in zip(rows, decisions, strict=True)
        if str(row.get("sexo_texto", "")).strip().casefold() == "hembra"
        and str(row.get("destino_texto", "")).strip().casefold() != "muerte"
    ]
    elite_count = sum(decision["clase"] == "ELITE" for decision in eligible)
    return {
        "elite_en_archivo_actual": elite_count,
        "hembras_candidatas_en_archivo_actual": len(eligible),
        "referencia_exploratoria_elite": REFERENCE_ELITE,
        "referencia_exploratoria_hembras": REFERENCE_FEMALE_CANDIDATES,
        "nota": (
            "Comparación de agregados; el universo de este CSV puede diferir "
            "de la cohorte exploratoria Galpón 2 (52 de 398)."
        ),
    }


def process_features(
    data_dir: Path = config.DATA_DIR,
    report_dir: Path = REPORT_DIR,
) -> dict[str, Any]:
    candidate_path = data_dir / "features_crias.csv"
    reproductive_path = data_dir / "features_reproductoras.csv"
    candidate_rows = _read_csv(candidate_path)
    reproductive_rows = _read_csv(reproductive_path)

    candidate_output, candidate_decisions = _classify_rows(
        candidate_rows, clasificar_candidata
    )
    reproductive_output, reproductive_decisions = _classify_rows(
        reproductive_rows, clasificar_reproductora
    )
    _write_csv(
        data_dir / "features_crias_etiquetadas.csv",
        candidate_output,
        _labeled_fields(candidate_rows),
    )
    _write_csv(
        data_dir / "features_reproductoras_etiquetadas.csv",
        reproductive_output,
        _labeled_fields(reproductive_rows),
    )

    report = {
        "por_etapa": _summary_by_stage(
            {
                "candidata": candidate_decisions,
                "reproductora": reproductive_decisions,
            }
        ),
        "hembras_por_partos": _parturition_counts(reproductive_rows),
        "referencia_exploratoria_galpon_2": _female_candidate_reference(
            candidate_rows, candidate_decisions
        ),
    }
    report_dir.mkdir(parents=True, exist_ok=True)
    with (report_dir / "clasificacion_agregada.json").open(
        "w", encoding="utf-8"
    ) as output:
        json.dump(report, output, ensure_ascii=False, indent=2, sort_keys=True)
        output.write("\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Classify feature CSVs and write aggregate-only reports."
    )
    parser.add_argument("--data-dir", type=Path, default=config.DATA_DIR)
    parser.add_argument("--report-dir", type=Path, default=REPORT_DIR)
    args = parser.parse_args()
    report = process_features(args.data_dir, args.report_dir)
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
