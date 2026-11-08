from datetime import date
import json
from pathlib import Path

from openpyxl import Workbook
import pandas as pd
import pytest

from ml.etl import config
from ml.etl.extract import extract_individual_workbook, extract_reproductive_workbook
from ml.etl.load import run_etl, summarize_weaning_days
from ml.etl.transform import (
    decode_code,
    mortality_rate,
    parse_tcn,
    transform_crias,
    transform_reproductoras,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_confirmed_tcn_codes():
    mixed = parse_tcn("4+1M")
    assert (mixed.vivos, mixed.muertos, mixed.total) == (4, 1, 5)
    assert mixed.status == config.CONFIRMADO

    all_dead = parse_tcn("5M")
    assert (all_dead.vivos, all_dead.muertos, all_dead.total) == (0, 5, 5)
    assert all_dead.status == config.CONFIRMADO
    assert mortality_rate(all_dead.muertos, all_dead.total) == 1.0

    inferred = parse_tcn("5")
    assert (inferred.vivos, inferred.muertos, inferred.total) == (5, 0, 5)
    assert inferred.status == config.INFERIDO_POR_DATOS
    assert mortality_rate(inferred.muertos, inferred.total) == 0.0

    abortion = parse_tcn("AB")
    assert (abortion.vivos, abortion.muertos, abortion.total) == (None, None, None)
    assert abortion.pattern == "AB"
    assert abortion.status == config.CONFIRMADO

    filler = parse_tcn("X")
    assert (filler.vivos, filler.muertos, filler.total) == (None, None, None)
    assert filler.status == "IGNORADO"


def test_unknown_and_empty_tcn_remain_unconfirmed():
    unknown = parse_tcn("4+1")
    assert unknown.pattern == config.UNKNOWN_CODE
    assert unknown.status == config.SIN_CONFIRMAR
    assert (unknown.vivos, unknown.muertos, unknown.total) == (None, None, None)

    empty = parse_tcn("")
    assert empty.pattern == "VACIO"
    assert empty.status == config.SIN_CONFIRMAR


def test_filler_rows_are_filtered_from_individual_register():
    records, stats = extract_individual_workbook(
        FIXTURES / "REG IND SINTETICO.xlsx"
    )
    assert len(records) == 3
    assert stats["rows_rejected"]["filler_code"] == 1
    assert stats["rows_rejected"]["invalid_animal_code"] == 1
    assert all("animal_code" not in record for record in records)


def test_reproductive_filter_and_new_features():
    records, stats = extract_reproductive_workbook(
        FIXTURES / "REGISTRO REPRODUCTIVO SINTETICO.xlsx"
    )
    assert len(records) == 2
    assert stats["rows_rejected"]["invalid_animal_code"] == 1

    features = transform_reproductoras(records)
    assert features[0]["etapa"] == "reproductora"
    assert isinstance(features[0]["abortos"], int)
    assert "hembra_muerta" in features[0]
    assert features[0]["etiqueta"] == ""


def test_reproductive_tcn_aggregation_excludes_abortions_and_x():
    record = {
        "ojos": 1,
        "peso_monta_g": 950,
        "observations": "M",
        "litters": [
            {"date": date(2026, 1, 1), "tcn": "4+1M"},
            {"date": date(2026, 1, 2), "tcn": "5M"},
            {"date": date(2026, 1, 3), "tcn": "AB"},
            {"date": date(2026, 1, 4), "tcn": "X"},
            {"date": date(2026, 1, 5), "tcn": "M"},
        ],
        "source_file": "synthetic.xlsx",
        "source_sheet": "synthetic",
        "source_row": 3,
    }

    feature = transform_reproductoras([record])[0]
    assert feature["partos_acumulados"] == 3
    assert feature["abortos"] == 1
    assert feature["tcn_vivos_promedio"] == 2
    assert feature["tcn_total_promedio"] == 5
    assert feature["tasa_mortalidad_camada"] == pytest.approx(0.6)
    assert feature["hembra_muerta"] is True
    assert feature["estado_calidad"].startswith(config.CONFIRMADO)


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
        "R": "Reemplazo",
        "SP": "Sin placa",
        "L": "Levante",
        "E": "Engorde",
    }
    assert decode_code("?", config.DESTINO_CODES) == config.UNKNOWN_CODE


def test_sp_is_decoded_without_exporting_an_animal_identifier():
    records, _ = extract_individual_workbook(
        FIXTURES / "REG IND SINTETICO.xlsx"
    )
    features = transform_crias(records)
    sp_feature = next(feature for feature in features if feature["destino"] == "SP")
    assert sp_feature["destino_texto"] == "Sin placa"
    assert sp_feature["identidad"] == "SIN_PLACA"
    assert "animal_code" not in sp_feature


def test_dates_ratio_and_missing_weaning_weight(tmp_path):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append(
        [
            "ANIMAL No.",
            "NUPAR",
            "T.C.N.V",
            "T.C.N.M",
            "T.C.N.T",
            "FECHA NACIMIENTO",
            "FECHA DESTETE",
            "PESO NACIMIENTO",
            "PESO DESTETE",
            "PESO 4/ SEMANAS",
            "OJOS",
            "SEXO",
            "DESTINO",
        ]
    )
    worksheet.append(
        [
            "SYNTH001",
            2,
            3,
            0,
            3,
            date(2026, 1, 1),
            date(2026, 1, 16),
            100,
            200,
            300,
            1,
            2,
            "SP",
        ]
    )
    worksheet.append(
        [
            "SYNTH002",
            1,
            2,
            0,
            2,
            date(2026, 2, 1),
            date(2026, 2, 18),
            110,
            None,
            250,
            2,
            1,
            "?",
        ]
    )
    workbook_path = tmp_path / "REG IND synthetic.xlsx"
    workbook.save(workbook_path)

    records, stats = extract_individual_workbook(workbook_path)
    features = transform_crias(records)
    assert stats["rows_accepted"] == 2
    assert features[0]["etapa"] == "candidata"
    assert features[0]["ratio_destete_nacimiento"] == 2.0
    assert features[0]["dias_destete"] == 15
    assert features[1]["ratio_destete_nacimiento"] is None
    assert features[1]["dias_destete"] == 17
    assert features[1]["destino_texto"] == config.UNKNOWN_CODE
    assert all(feature["etiqueta"] == "" for feature in features)


def test_weaning_report_counts_fifteen_other_and_missing_days():
    assert summarize_weaning_days(
        [
            {"dias_destete": 15},
            {"dias_destete": 17},
            {"dias_destete": None},
        ]
    ) == {"15": 1, "no_15": 1, "sin_datos": 1}


def test_reproductive_extraction_reads_observations_header(tmp_path):
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append(
        [
            "Hembra",
            "Peso",
            "Color",
            "Ojos",
            "Parto 1",
            "T.C.N.",
            "Parto 2",
            "T.C.N.",
            "Parto 3",
            "T.C.N.",
            "Parto 4",
            "T.C.N.",
            "Observaciones",
        ]
    )
    worksheet.append(["Poza: 1"])
    worksheet.append(
        ["SYNTHF001", 950, None, 1, date(2026, 1, 1), "4+1M", None, None, None, None, None, None, "M"]
    )
    workbook_path = tmp_path / "REGISTRO REPRODUCTIVO synthetic.xlsx"
    workbook.save(workbook_path)

    records, _ = extract_reproductive_workbook(workbook_path)
    feature = transform_reproductoras(records)[0]
    assert feature["hembra_muerta"] is True
    assert feature["partos_acumulados"] == 1
    assert feature["etiqueta"] == ""


def test_aggregate_report_does_not_contain_source_codes_or_nupar(tmp_path):
    report = run_etl(
        input_dir=FIXTURES,
        output_dir=tmp_path / "data",
    )
    report_text = json.dumps(report)
    assert "SYNTH" not in report_text
    assert "NU-SYNTH" not in report_text
    assert "tcn_patterns" in report
    assert report["dias_destete"].keys() == {"15", "no_15", "sin_datos"}
    assert (
        sum(report["dias_destete"].values())
        == report["individual"]["rows_accepted"]
    )
    assert (
        report["code_counts"]["crias"]["destino"][config.UNKNOWN_CODE] == 1
    )
    assert report["code_counts"]["crias"]["destino"]["SP"] == 1
    assert report["code_counts"]["crias"]["destino"]["R"] == 0

    features = pd.read_csv(tmp_path / "data" / "features_crias.csv")
    assert features["etapa"].eq("candidata").all()
    assert features["etiqueta"].isna().all()
    reproductive_features = pd.read_csv(
        tmp_path / "data" / "features_reproductoras.csv"
    )
    assert reproductive_features["etapa"].eq("reproductora").all()
    assert reproductive_features["etiqueta"].isna().all()
