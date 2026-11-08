from datetime import date
import csv
import json

import pytest

from ml.rules.clasificar import clasificar_candidata, clasificar_reproductora
from ml.rules.report import process_features


def candidate(**overrides):
    row = {
        "sexo": "2",
        "sexo_texto": "Hembra",
        "nupar_madre": "2",
        "tcnv": "3",
        "peso_nacimiento_g": "135",
        "peso_destete_g": "270",
        "ojos": "1",
        "ojos_texto": "Negro",
        "destino": "",
        "destino_texto": "",
        "estado_calidad": "CONFIRMADO|INFERIDO_POR_DATOS",
    }
    return row | overrides


def reproductive(**overrides):
    row = {
        "partos_acumulados": "3",
        "abortos": "0",
        "hembra_muerta": "False",
        "peso_monta_g": "950",
        "tasa_mortalidad_camada": "0.8",
        "estado_calidad": "CONFIRMADO",
    }
    return row | overrides


@pytest.mark.parametrize(
    ("nupar", "expected"),
    [(1, "NORMAL"), (2, "ELITE"), (3, "ELITE"), (4, "NORMAL")],
)
def test_candidate_nupar_boundaries(nupar, expected):
    assert clasificar_candidata(candidate(nupar_madre=nupar))["clase"] == expected


@pytest.mark.parametrize(
    ("tcnv", "expected"),
    [(2, "NORMAL"), (3, "ELITE"), (4, "ELITE"), (5, "NORMAL")],
)
def test_candidate_live_litter_boundaries(tcnv, expected):
    assert clasificar_candidata(candidate(tcnv=tcnv))["clase"] == expected


@pytest.mark.parametrize(
    ("weight", "expected"),
    [(134, "NORMAL"), (135, "ELITE")],
)
def test_candidate_birth_weight_boundary(weight, expected):
    assert (
        clasificar_candidata(
            candidate(peso_nacimiento_g=weight, peso_destete_g=2 * weight)
        )["clase"]
        == expected
    )


@pytest.mark.parametrize(
    ("weaning_weight", "expected"),
    [(270, "ELITE"), (269, "NORMAL")],
)
def test_candidate_weaning_weight_boundary(weaning_weight, expected):
    assert (
        clasificar_candidata(
            candidate(peso_destete_g=weaning_weight)
        )["clase"]
        == expected
    )


@pytest.mark.parametrize(
    ("eyes", "expected"),
    [("1", "ELITE"), ("2", "NORMAL")],
)
def test_candidate_eye_catalog(eyes, expected):
    text = "Negro" if eyes == "1" else "Rojo"
    assert (
        clasificar_candidata(candidate(ojos=eyes, ojos_texto=text))["clase"]
        == expected
    )


def test_candidate_missing_eyes_requires_review_without_imputation():
    result = clasificar_candidata(candidate(ojos="", ojos_texto=""))
    assert result["clase"] == ""
    assert result["estado_calidad"] == "REVISAR"
    assert result["motivos"] == ["dato faltante: ojos"]


def test_male_and_death_destination_do_not_receive_a_class():
    male = clasificar_candidata(
        candidate(sexo="1", sexo_texto="Macho")
    )
    assert male["clase"] == ""
    assert male["estado_calidad"] == "NO_APLICA"

    dead = clasificar_candidata(
        candidate(destino="M", destino_texto="Muerte")
    )
    assert dead["clase"] == ""
    assert dead["estado_calidad"] == "NO_APLICA"


@pytest.mark.parametrize(
    ("partos", "expected"),
    [(3, "NORMAL"), (4, "DESCARTE")],
)
def test_reproductive_parturition_boundary_including_abortions(partos, expected):
    result = clasificar_reproductora(
        reproductive(partos_acumulados=partos, abortos=1)
    )
    assert result["clase"] == expected
    if partos == 4:
        assert result["motivos"] == ["ciclo completo"]


@pytest.mark.parametrize(
    ("abortos", "expected", "reason"),
    [
        (0, "NORMAL", "sin criterio de descarte"),
        (1, "NORMAL", "observación: 1 aborto"),
        (2, "DESCARTE", "problema repetido (se dejó un parto más)"),
    ],
)
def test_reproductive_abort_threshold(abortos, expected, reason):
    result = clasificar_reproductora(reproductive(abortos=abortos))
    assert result["clase"] == expected
    assert reason in result["motivos"]
    if abortos == 2:
        assert "PROPUESTA" in result["estado_calidad"]


def test_dead_female_is_no_aplica_and_mortality_alone_does_not_discard():
    dead = clasificar_reproductora(reproductive(hembra_muerta="True"))
    assert dead["clase"] == ""
    assert dead["estado_calidad"] == "NO_APLICA"

    high_mortality = clasificar_reproductora(
        reproductive(tasa_mortalidad_camada="1.0")
    )
    assert high_mortality["clase"] == "NORMAL"


def test_reproductive_missing_values_require_review_without_imputation():
    result = clasificar_reproductora(
        reproductive(partos_acumulados="", abortos="0")
    )
    assert result["clase"] == ""
    assert result["estado_calidad"] == "REVISAR"
    assert result["fecha_descarte_sugerida"] is None


def test_cycle_complete_suggests_exit_twenty_days_after_last_parturition():
    result = clasificar_reproductora(
        reproductive(
            partos_acumulados=4,
            fecha_ultimo_parto=date(2026, 1, 15),
        )
    )
    assert result["clase"] == "DESCARTE"
    assert result["fecha_descarte_sugerida"] == "2026-02-04"
    assert result["peso_monta_en_rango_900_1000"] is True


def test_cycle_complete_without_last_parturition_date_leaves_suggested_date_empty():
    result = clasificar_reproductora(reproductive(partos_acumulados=4))
    assert result["clase"] == "DESCARTE"
    assert result["fecha_descarte_sugerida"] is None


@pytest.mark.parametrize(
    ("weight", "expected"),
    [(899, False), (900, True), (950, True), (1000, True), (1001, False)],
)
def test_mating_weight_is_informative_not_a_class_rule(weight, expected):
    result = clasificar_reproductora(
        reproductive(peso_monta_g=weight)
    )
    assert result["clase"] == "NORMAL"
    assert result["peso_monta_en_rango_900_1000"] is expected


def test_reports_are_aggregate_only_and_csvs_preserve_empty_labels_for_review(
    tmp_path,
):
    data_dir = tmp_path / "data"
    report_dir = tmp_path / "reports"
    data_dir.mkdir()
    candidate_rows = [
        candidate(animal_code="CHAPA-TEST-1"),
        candidate(
            sexo="1",
            sexo_texto="Macho",
            animal_code="CHAPA-TEST-2",
        ),
        candidate(
            nupar_madre="1",
            animal_code="CHAPA-TEST-3",
        ),
        candidate(
            ojos="",
            ojos_texto="",
            animal_code="CHAPA-TEST-4",
        ),
    ]
    reproductive_rows = [
        reproductive(
            partos_acumulados="4",
            fecha_ultimo_parto="2026-01-15",
            animal_code="CHAPA-TEST-4",
        ),
        reproductive(
            hembra_muerta="True",
            animal_code="CHAPA-TEST-5",
        ),
    ]

    for filename, rows in (
        ("features_crias.csv", candidate_rows),
        ("features_reproductoras.csv", reproductive_rows),
    ):
        with (data_dir / filename).open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)

    report = process_features(data_dir, report_dir)
    report_text = json.dumps(report, ensure_ascii=False)
    assert "CHAPA-TEST" not in report_text
    assert report["por_etapa"]["candidata"]["clases"] == {
        "ELITE": 1,
        "NORMAL": 1,
        "SIN_CLASE": 2,
    }
    assert report["por_etapa"]["candidata"]["estados"]["REVISAR"] == 1
    assert report["por_etapa"]["candidata"]["estados"]["NO_APLICA"] == 1
    assert report["hembras_por_partos"]["4+"] == 1

    with (data_dir / "features_crias_etiquetadas.csv").open(
        encoding="utf-8", newline=""
    ) as file:
        labeled_candidates = list(csv.DictReader(file))
    assert labeled_candidates[3]["etiqueta"] == ""
    assert "REVISAR" in labeled_candidates[3]["estado_calidad"]
    assert "CHAPA-TEST" not in labeled_candidates[0]["motivos"]
