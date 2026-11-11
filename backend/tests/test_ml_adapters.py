"""Pruebas de adaptadores ML/RAG D5a, sin HTTP ni base real."""

import pytest

from backend.app.services import ml as ml_service


def test_survival_and_applicability():
    assert ml_service.survival_from_estado("ACTIVO") == "viva"
    assert ml_service.survival_from_estado("MUERTA") == "muerta"
    assert ml_service.survival_from_estado(None) == "desconocida"
    assert ml_service.survival_from_estado("OTRO") == "desconocida"
    with pytest.raises(ml_service.MlNoAplica):
        ml_service.ensure_applicable({"sexo": "M", "estado": "ACTIVO"})
    with pytest.raises(ml_service.MlDatosInsuficientes):
        ml_service.ensure_applicable({"sexo": None, "estado": "ACTIVO"})
    with pytest.raises(ml_service.MlDatosInsuficientes):
        ml_service.ensure_applicable({"sexo": "H", "estado": None})
    with pytest.raises(ml_service.MlNoAplica):
        ml_service.ensure_applicable({"sexo": "H", "estado": "ACTIVO"}, hembra_muerta=True)


def test_output_validation_preserves_reasons_and_quality():
    hembra = ml_service.validate_hembra_output(
        {
            "clase": "NORMAL",
            "motivos": ["dato faltante: abortos"],
            "estado_calidad": "REVISAR",
            "fecha_descarte_sugerida": None,
            "peso_monta_en_rango_900_1000": None,
        }
    )
    assert hembra["estado_calidad"] == "REVISAR"
    assert hembra["motivos"] == ["dato faltante: abortos"]
    candidata = ml_service.validate_candidata_output(
        {
            "clase": "NORMAL",
            "motivos": [],
            "estado_calidad": "REVISAR",
            "apoyo_modelo": {"clase": "ELITE", "probabilidades": {"ELITE": 0.7, "NORMAL": 0.3}},
        }
    )
    assert candidata["clase"] == "NORMAL"
    assert candidata["apoyo_modelo"]["clase"] == "ELITE"


def test_invalid_outputs_are_internal_failures():
    with pytest.raises(ml_service.MlFalloInterno):
        ml_service.validate_hembra_output({"clase": "ELITE"})
    with pytest.raises(ml_service.MlFalloInterno):
        ml_service.validate_candidata_output(
            {
                "clase": "NORMAL",
                "motivos": [],
                "estado_calidad": "OK",
                "apoyo_modelo": {"clase": "ELITE", "probabilidades": {"ELITE": 0.9, "NORMAL": 0.5}},
            }
        )
    with pytest.raises(ml_service.MlFalloInterno):
        ml_service.validate_candidata_output(
            {
                "clase": "NORMAL",
                "motivos": [],
                "estado_calidad": "OK",
                "apoyo_modelo": {"clase": "OTRA", "probabilidades": {"ELITE": 1.0}},
            }
        )


def test_assistant_adapter_selects_only_contract_fields():
    def fake(pregunta, top_k):
        return {"respuesta": "Texto", "fuentes": ["manual.pdf, p. 1"], "modo": "extractivo", "citas": ["x"]}

    result = ml_service.consultar_asistente("pregunta", 5, consultar_fn=fake)
    assert result == {"respuesta": "Texto", "fuentes": ["manual.pdf, p. 1"]}


def test_assistant_failures_are_not_user_validation():
    def down(pregunta, top_k):
        raise RuntimeError("sin base")

    with pytest.raises(ml_service.RagNoDisponible):
        ml_service.consultar_asistente("pregunta", 5, consultar_fn=down)

    def invalid(pregunta, top_k):
        return {"respuesta": "", "fuentes": []}

    with pytest.raises(ml_service.MlFalloInterno):
        ml_service.consultar_asistente("pregunta", 5, consultar_fn=invalid)


def test_real_rule_functions_are_used_by_the_adapter():
    animal = {"sexo": "H", "estado": "ACTIVO"}
    hembra = ml_service.predecir_hembra_para(
        animal,
        {"partos_acumulados": 4, "abortos": 0, "fecha_ultimo_parto": None, "peso_monta_g": 950},
    )
    assert hembra["clase"] in {"NORMAL", "DESCARTE"}
    assert hembra["motivos"]
    candidata = ml_service.predecir_candidata_para(
        animal,
        {"nupar_madre": 2, "tcnv": 3, "peso_nacimiento_g": 135, "ojos": "1"},
        model=None,
    )
    assert candidata["clase"] in {"ELITE", "NORMAL"}
    assert candidata["apoyo_modelo"] is None
