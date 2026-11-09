import numpy as np
import pytest

from ml.prediccion import predecir_candidata, predecir_hembra


def candidata(**overrides):
    return {
        "nupar_madre": 2,
        "tcnv": 3,
        "peso_nacimiento_g": 135,
        "peso_destete_g": 270,
        "dias_destete": 15,
        "peso_monta_g": 950,
        "ojos": "1",
    } | overrides


class ModeloStub:
    classes_ = np.array(["ELITE", "NORMAL"])

    def __init__(self, probabilities):
        self.probabilities = probabilities
        self.calls = 0

    def predict_proba(self, features):
        self.calls += 1
        assert list(features.columns) == [
            "nupar_madre",
            "tcnv",
            "peso_nacimiento_g",
            "ojos",
        ]
        return np.array([self.probabilities])


def test_candidate_returns_rule_class_and_optional_model_support():
    model = ModeloStub([0.8, 0.2])

    result = predecir_candidata(candidata(), modelo=model)

    assert result["clase"] == "ELITE"
    assert result["motivos"] == ["cumple todos los criterios ELITE"]
    assert result["apoyo_modelo"] == {
        "clase": "ELITE",
        "probabilidades": {"ELITE": 0.8, "NORMAL": 0.2},
    }
    assert model.calls == 1


def test_model_support_does_not_override_candidate_rules():
    model = ModeloStub([0.9, 0.1])

    result = predecir_candidata(candidata(tcnv=2), modelo=model)

    assert result["clase"] == "NORMAL"
    assert result["apoyo_modelo"]["clase"] == "ELITE"
    assert "nacidos vivos fuera de 3 o 4" in result["motivos"]


def test_candidate_missing_later_rule_inputs_defaults_to_normal_with_model_support():
    model = ModeloStub([0.8, 0.2])

    result = predecir_candidata(
        candidata(peso_destete_g=None, dias_destete=None, peso_monta_g=None),
        modelo=model,
    )

    assert result["clase"] == "NORMAL"
    assert result["estado_calidad"] == "REVISAR"
    assert "dato faltante: peso_destete_g" in result["motivos"]
    assert "dato faltante: dias_destete" in result["motivos"]
    assert "dato faltante: peso_monta_g" in result["motivos"]
    assert result["apoyo_modelo"] is not None
    assert model.calls == 1


def test_candidate_missing_birth_features_skips_model_support():
    model = ModeloStub([0.8, 0.2])

    result = predecir_candidata(candidata(nupar_madre=None), modelo=model)

    assert result["clase"] == "NORMAL"
    assert result["apoyo_modelo"] is None
    assert model.calls == 0


@pytest.mark.parametrize(
    ("field", "value", "reason"),
    [
        ("dias_destete", 14, "destete distinto de 15 días"),
        ("peso_monta_g", 899, "peso de empadre fuera de 900 a 1000 g"),
    ],
)
def test_candidate_rejects_out_of_range_adr_fields(field, value, reason):
    result = predecir_candidata(candidata(**{field: value}))

    assert result["clase"] == "NORMAL"
    assert reason in result["motivos"]


def test_candidate_unknown_eye_and_invalid_number_are_errors():
    with pytest.raises(ValueError, match="ojos"):
        predecir_candidata(candidata(ojos="3"))
    with pytest.raises(ValueError, match="peso_nacimiento_g"):
        predecir_candidata(candidata(peso_nacimiento_g=-1))


def test_hembra_fourth_parturition_returns_discard_and_suggested_date():
    result = predecir_hembra(
        {
            "partos_acumulados": 4,
            "abortos": 0,
            "fecha_ultimo_parto": "2026-01-15",
        }
    )

    assert result["clase"] == "DESCARTE"
    assert result["motivos"] == ["ciclo completo"]
    assert result["fecha_descarte_sugerida"] == "2026-02-04"


def test_hembra_missing_data_defaults_to_normal_and_requires_review():
    result = predecir_hembra({"partos_acumulados": None, "abortos": 0})

    assert result["clase"] == "NORMAL"
    assert result["estado_calidad"] == "REVISAR"
    assert "clase por defecto NORMAL; datos insuficientes" in result["motivos"]


def test_hembra_rejects_dead_female_and_invalid_counts():
    with pytest.raises(ValueError, match="viva"):
        predecir_hembra(
            {"partos_acumulados": 1, "abortos": 0, "hembra_muerta": True}
        )
    with pytest.raises(ValueError, match="entero"):
        predecir_hembra({"partos_acumulados": 1.5, "abortos": 0})


def test_invalid_model_probabilities_raise_explicit_error():
    model = ModeloStub([0.9, 0.9])

    with pytest.raises(ValueError, match="probabilidades inválidas"):
        predecir_candidata(candidata(), modelo=model)
