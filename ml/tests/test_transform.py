from pathlib import Path
import json

import pandas as pd
import pytest

from ml.etl import config
from ml.etl.extract import extract_individual_workbook, extract_reproductive_workbook
from ml.etl.load import run_etl
from ml.etl.transform import (
    decode_code,
    mortality_rate,
    parse_tcn,
    transform_crias,
    transform_reproductoras,
)

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize("value", ["4+1M", "5M", "AB", "X", "4+1"])
def test_unconfirmed_tcn_is_ambiguous(value):
    parsed = parse_tcn(value)
    assert parsed.status == "AMBIGUO"
    assert parsed.vivos is None
    assert parsed.muertos is None
    assert parsed.total is None


def test_simple_integer_tcn_is_confirmed_total_and_blank_is_missing():
    assert parse_tcn("5").total == 5
    assert parse_tcn("5").status == "PARSEADO_TOTAL"
    assert parse_tcn("").status == "VACIO"


def test_filler_rows_are_filtered_from_individual_register():
    records, stats = extract_individual_workbook(
        FIXTURES / "REG IND SINTETICO.xlsx"
    )
    assert len(records) == 3
    assert stats["rows_rejected"]["filler_code"] == 1
    assert stats["rows_rejected"]["invalid_animal_code"] == 1
    assert all("animal_code" not in record for record in records)


def test_reproductive_filter_and_tcn_ambiguity():
    records, stats = extract_reproductive_workbook(
        FIXTURES / "REGISTRO REPRODUCTIVO SINTETICO.xlsx"
    )
    assert len(records) == 2
    assert stats["rows_rejected"]["invalid_animal_code"] == 1
    features = transform_reproductoras(records)
    assert features[0]["partos_acumulados"] == 2
    assert features[0]["tcn_vivos_promedio"] is None
    assert features[0]["tcn_total_promedio"] == 5
    assert features[0]["tasa_mortalidad_camada"] is None
    assert "AMBIGUO" in features[0]["estado_calidad"]


def test_atomic_tcn_mortality_uses_deaths_over_total():
    assert mortality_rate(1, 4) == pytest.approx(0.25)
    assert mortality_rate(0, 0) is None
    records, _ = extract_individual_workbook(
        FIXTURES / "REG IND SINTETICO.xlsx"
    )
    features = transform_crias(records)
    assert features[0]["tasa_mortalidad_camada"] == pytest.approx(1 / 3)


def test_missing_eyes_is_null_and_marks_review():
    records, _ = extract_individual_workbook(
        FIXTURES / "REG IND SINTETICO.xlsx"
    )
    feature = transform_crias(records)[0]
    assert feature["ojos"] is None
    assert feature["ojos_texto"] is None
    assert "REVISAR" in feature["estado_calidad"]


def test_confirmed_catalogs_and_unknown_codes():
    assert decode_code(1, config.OJOS_CODES) == "Negro"
    assert decode_code(2, config.OJOS_CODES) == "Rojo"
    assert decode_code(1, config.SEXO_CODES) == "Macho"
    assert decode_code(2, config.SEXO_CODES) == "Hembra"
    assert {
        code: decode_code(code, config.DESTINO_CODES)
        for code in ("M", "D", "V", "R", "SP", "L", "E")
    } == {
        "M": "Muerte",
        "D": "Descarte",
        "V": "Vendido",
        "R": "Reemplazado",
        "SP": "Sin placa",
        "L": "Levante",
        "E": "Engorde",
    }
    assert decode_code("?", config.DESTINO_CODES) == "CODIGO_DESCONOCIDO"


def test_sp_is_decoded_without_exporting_an_animal_identifier():
    records, _ = extract_individual_workbook(
        FIXTURES / "REG IND SINTETICO.xlsx"
    )
    features = transform_crias(records)
    sp_feature = next(feature for feature in features if feature["destino"] == "SP")
    assert sp_feature["destino_texto"] == "Sin placa"
    assert sp_feature["identidad"] == "SIN_PLACA"
    assert "animal_code" not in sp_feature


def test_aggregate_report_does_not_contain_source_codes_or_nupar(tmp_path):
    report = run_etl(
        input_dir=FIXTURES,
        output_dir=tmp_path / "data",
    )
    report_text = json.dumps(report)
    assert "SYNTH" not in report_text
    assert "NU-SYNTH" not in report_text
    assert "tcn_patterns" in report
    assert (
        report["code_counts"]["crias"]["destino"]["CODIGO_DESCONOCIDO"] == 1
    )
    assert report["code_counts"]["crias"]["destino"]["SP"] == 1
    features = pd.read_csv(tmp_path / "data" / "features_crias.csv")
    assert "NU-SYNTH-MOTHER" in features["nupar_madre"].values
    assert features["etiqueta"].isna().all()
