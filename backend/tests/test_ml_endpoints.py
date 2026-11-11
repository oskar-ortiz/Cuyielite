"""Pruebas de endpoints ML/RAG D5 con dobles (sin base real)."""

import uuid

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services import ml as ml_service

SCOPE = uuid.uuid4()
CUY = uuid.uuid4()
HEADERS = {"Authorization": "Bearer " + "x" * 40}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(
        "backend.app.services.sync.authenticate",
        lambda token: {"scope_id": SCOPE, "device_id": uuid.uuid4()},
    )
    monkeypatch.setattr(
        "backend.app.repositories.animals.get_animal_for_scope",
        lambda scope, animal: {"id": animal, "sexo": "H", "estado": "ACTIVO", "deleted_at": None},
    )
    monkeypatch.setattr(ml_service, "load_candidate_model", lambda path=None: None)
    return TestClient(app)


def hembra_body(**overrides):
    body = {
        "cuy_id": str(CUY),
        "partos_acumulados": 4,
        "abortos": 0,
        "fecha_ultimo_parto": "2026-01-15",
        "peso_monta_g": 950,
        "hembra_muerta": False,
    }
    body.update(overrides)
    return body


def valid_hembra():
    return {
        "clase": "NORMAL",
        "motivos": ["sin criterios de descarte"],
        "estado_calidad": "COMPLETO",
        "fecha_descarte_sugerida": None,
        "peso_monta_en_rango_900_1000": True,
    }


def valid_candidata(apoyo=None):
    return {
        "clase": "NORMAL",
        "motivos": ["dato faltante: dias_destete"],
        "estado_calidad": "REVISAR",
        "apoyo_modelo": apoyo,
    }


def test_requires_bearer(client):
    assert client.post("/ml/predict/hembra", json=hembra_body()).status_code == 401
    assert client.post("/assistant/query", json={"pregunta": "temperatura"}).status_code == 401


def test_foreign_or_missing_animal_same_404(client, monkeypatch):
    monkeypatch.setattr("backend.app.repositories.animals.get_animal_for_scope", lambda scope, animal: None)
    first = client.post("/ml/predict/hembra", json=hembra_body(), headers=HEADERS)
    second = client.post("/ml/predict/hembra", json=hembra_body(cuy_id=str(uuid.uuid4())), headers=HEADERS)
    assert first.status_code == 404 and second.status_code == 404
    assert first.json() == second.json()


def test_applicability_unknown_and_wrong_sex(client, monkeypatch):
    monkeypatch.setattr(ml_service, "_real_hembra", lambda datos: valid_hembra())
    for animal, code in (
        ({"sexo": "M", "estado": "ACTIVO"}, "NO_APLICA"),
        ({"sexo": None, "estado": "ACTIVO"}, "DATOS_INSUFICIENTES"),
        ({"sexo": "H", "estado": None}, "DATOS_INSUFICIENTES"),
        ({"sexo": "H", "estado": "DESCONOCIDO"}, "DATOS_INSUFICIENTES"),
        ({"sexo": "H", "estado": "MUERTA"}, "NO_APLICA"),
    ):
        animal.update({"id": CUY, "deleted_at": None})
        monkeypatch.setattr("backend.app.repositories.animals.get_animal_for_scope", lambda scope, aid, a=animal: a)
        response = client.post("/ml/predict/hembra", json=hembra_body(), headers=HEADERS)
        assert response.status_code == 422, response.text
        assert response.json()["detail"]["code"] == code
    assert client.post(
        "/ml/predict/hembra",
        json=hembra_body(hembra_muerta=True),
        headers=HEADERS,
    ).status_code == 422


def test_hembra_preserves_reasons_and_quality(client, monkeypatch):
    monkeypatch.setattr(ml_service, "_real_hembra", lambda datos: valid_hembra())
    response = client.post("/ml/predict/hembra", json=hembra_body(), headers=HEADERS)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cuy_id"] == str(CUY)
    assert body["clase"] == "NORMAL"
    assert body["motivos"] == ["sin criterios de descarte"]
    assert body["estado_calidad"] == "COMPLETO"
    assert body["peso_monta_en_rango_900_1000"] is True


def test_hembra_null_is_not_zero():
    from backend.app.schemas.ml import HembraRequest

    parsed = HembraRequest(cuy_id=CUY)
    assert parsed.abortos is None
    assert parsed.partos_acumulados is None
    assert parsed.hembra_muerta is None


def test_invalid_input_and_extra_fields(client):
    assert client.post("/ml/predict/hembra", json=hembra_body(abortos=True), headers=HEADERS).status_code == 422
    assert client.post("/ml/predict/hembra", json=hembra_body(peso_monta_g=0), headers=HEADERS).status_code == 422
    assert client.post("/ml/predict/hembra", json={**hembra_body(), "extra": 1}, headers=HEADERS).status_code == 422
    assert client.post(
        "/ml/predict/candidata",
        json={"cuy_id": str(CUY), "ojos": "3"},
        headers=HEADERS,
    ).status_code == 422


def test_candidata_keeps_rule_class_and_optional_support(client, monkeypatch):
    monkeypatch.setattr(ml_service, "_real_candidata", lambda datos, model: valid_candidata())
    without = client.post("/ml/predict/candidata", json={"cuy_id": str(CUY), "ojos": "1"}, headers=HEADERS)
    assert without.status_code == 200
    assert without.json()["apoyo_modelo"] is None
    monkeypatch.setattr(
        ml_service,
        "_real_candidata",
        lambda datos, model: valid_candidata({"clase": "ELITE", "probabilidades": {"ELITE": 0.72, "NORMAL": 0.28}}),
    )
    with_support = client.post("/ml/predict/candidata", json={"cuy_id": str(CUY)}, headers=HEADERS)
    assert with_support.status_code == 200
    assert with_support.json()["clase"] == "NORMAL"
    assert with_support.json()["apoyo_modelo"]["clase"] == "ELITE"


def test_model_failures_are_internal_not_422(client, monkeypatch):
    monkeypatch.setattr(ml_service, "_real_hembra", lambda datos: {"clase": "OTRA"})
    response = client.post("/ml/predict/hembra", json=hembra_body(), headers=HEADERS)
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "ML_FALLO_INTERNO"

    def boom(datos):
        raise ValueError("salida rota")

    monkeypatch.setattr(ml_service, "_real_hembra", boom)
    response = client.post("/ml/predict/hembra", json=hembra_body(), headers=HEADERS)
    assert response.status_code == 503


def test_ml_unavailable(client, monkeypatch):
    def unavailable(animal, datos, **kwargs):
        raise ml_service.MlNoDisponible()

    monkeypatch.setattr(ml_service, "predecir_hembra_para", unavailable)
    response = client.post("/ml/predict/hembra", json=hembra_body(), headers=HEADERS)
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "ML_NO_DISPONIBLE"


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


def test_assistant_exact_dto_abstention_and_unavailable(client, monkeypatch):
    monkeypatch.setattr(
        ml_service,
        "consultar_asistente",
        lambda pregunta, top_k: {"respuesta": "Texto sintético", "fuentes": ["manual-sintetico.pdf, p. 12"]},
    )
    response = client.post("/assistant/query", json={"pregunta": "temperatura", "top_k": 5}, headers=HEADERS)
    assert response.status_code == 200
    assert response.json() == {"respuesta": "Texto sintético", "fuentes": ["manual-sintetico.pdf, p. 12"]}

    monkeypatch.setattr(
        ml_service,
        "consultar_asistente",
        lambda pregunta, top_k: {"respuesta": "No encontré información en los manuales.", "fuentes": []},
    )
    abstention = client.post("/assistant/query", json={"pregunta": "tema ausente"}, headers=HEADERS)
    assert abstention.json()["fuentes"] == []

    def down(pregunta, top_k):
        raise ml_service.RagNoDisponible()

    monkeypatch.setattr(ml_service, "consultar_asistente", down)
    assert client.post("/assistant/query", json={"pregunta": "temperatura"}, headers=HEADERS).status_code == 503
