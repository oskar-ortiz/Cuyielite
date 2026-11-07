"""Write generated features and aggregate-only ETL reports."""

import json
from pathlib import Path
from typing import Any

import pandas as pd

from ml.etl import config
from ml.etl.extract import extract_all
from ml.etl.transform import (
    build_aggregate_report,
    transform_crias,
    transform_reproductoras,
)

REPRODUCTORAS_COLUMNS = [
    "partos_acumulados",
    "tcn_vivos_promedio",
    "tcn_total_promedio",
    "peso_monta_g",
    "tasa_mortalidad_camada",
    "ojos",
    "ojos_texto",
    "estado_calidad",
    "provenance_archivo",
    "provenance_hoja",
    "provenance_fila",
    "etiqueta",
]
CRIAS_COLUMNS = [
    "nupar_madre",
    "tcnv",
    "tcnm",
    "tcnt",
    "tasa_mortalidad_camada",
    "peso_nacimiento_g",
    "peso_destete_g",
    "peso_4_semanas_g",
    "ojos",
    "ojos_texto",
    "sexo",
    "sexo_texto",
    "destino",
    "destino_texto",
    "identidad",
    "estado_calidad",
    "provenance_archivo",
    "provenance_hoja",
    "provenance_fila",
    "etiqueta",
]


def write_outputs(
    reproductive_features: list[dict[str, Any]],
    individual_features: list[dict[str, Any]],
    output_dir: Path = config.DATA_DIR,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(reproductive_features, columns=REPRODUCTORAS_COLUMNS).to_csv(
        output_dir / "features_reproductoras.csv",
        index=False,
        encoding="utf-8",
    )
    pd.DataFrame(individual_features, columns=CRIAS_COLUMNS).to_csv(
        output_dir / "features_crias.csv",
        index=False,
        encoding="utf-8",
    )


def run_etl(
    input_dir: Path = config.RAW_DATA_DIR,
    output_dir: Path = config.DATA_DIR,
) -> dict[str, Any]:
    reproductive_records, individual_records, extraction_stats = extract_all(input_dir)
    reproductive_features = transform_reproductoras(reproductive_records)
    individual_features = transform_crias(individual_records)
    report = build_aggregate_report(
        reproductive_records,
        individual_records,
        extraction_stats,
        (len(reproductive_features), len(REPRODUCTORAS_COLUMNS)),
        (len(individual_features), len(CRIAS_COLUMNS)),
    )
    write_outputs(
        reproductive_features,
        individual_features,
        output_dir,
    )
    return report


def main() -> None:
    report = run_etl()
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
