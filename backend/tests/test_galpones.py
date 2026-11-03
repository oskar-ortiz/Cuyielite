"""Pruebas unitarias del contrato de galpones y pozas."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_health_sin_base():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_list_galpones_vacio():
    with patch("backend.app.services.galpones.list_galpones", return_value=[]):
        r = client.get("/galpones")
    assert r.status_code == 200
    assert r.json() == {"items": [], "limit": 50, "offset": 0}


def test_list_galpones_items():
    data = [{"id": "11111111-1111-1111-1111-111111111111", "nombre": "G1", "ubicacion": None}]
    with patch("backend.app.services.galpones.list_galpones", return_value=data):
        r = client.get("/galpones")
    assert r.status_code == 200
    body = r.json()
    assert body["items"][0]["nombre"] == "G1"
    assert body["items"][0]["ubicacion"] is None
    assert body["limit"] == 50
    assert body["offset"] == 0


def test_list_galpones_paginacion():
    with patch("backend.app.services.galpones.list_galpones", return_value=[]):
        r = client.get("/galpones?limit=10&offset=5")
    assert r.status_code == 200
    assert r.json()["limit"] == 10
    assert r.json()["offset"] == 5


def test_list_galpones_limit_invalido():
    r = client.get("/galpones?limit=0")
    assert r.status_code == 422
    r = client.get("/galpones?limit=101")
    assert r.status_code == 422


def test_list_galpones_offset_invalido():
    r = client.get("/galpones?offset=-1")
    assert r.status_code == 422


def test_list_galpones_sin_base():
    import os
    os.environ.pop("DATABASE_URL", None)
    with patch("backend.app.services.galpones.list_galpones", side_effect=RuntimeError("no db")):
        r = client.get("/galpones")
    assert r.status_code == 503
    assert "credenciales" not in r.text.lower()
    assert "sql" not in r.text.lower()


def test_list_pozas_galpon_inexistente():
    with patch("backend.app.services.galpones.list_pozas_by_galpon", side_effect=ValueError("no")):
        r = client.get("/galpones/11111111-1111-1111-1111-111111111111/pozas")
    assert r.status_code == 404


def test_list_pozas_uuid_invalido():
    r = client.get("/galpones/no-es-uuid/pozas")
    assert r.status_code == 422


def test_list_pozas_vacio():
    with patch("backend.app.services.galpones.list_pozas_by_galpon", return_value=[]):
        r = client.get("/galpones/11111111-1111-1111-1111-111111111111/pozas")
    assert r.status_code == 200
    assert r.json() == {"items": [], "limit": 50, "offset": 0}


def test_list_pozas_items():
    data = [{
        "id": "22222222-2222-2222-2222-222222222222",
        "galpon_id": "11111111-1111-1111-1111-111111111111",
        "codigo": "P-1",
        "tipo": "cria",
        "capacidad_maxima": 99,
    }]
    with patch("backend.app.services.galpones.list_pozas_by_galpon", return_value=data):
        r = client.get("/galpones/11111111-1111-1111-1111-111111111111/pozas")
    assert r.status_code == 200
    body = r.json()
    assert body["items"][0]["codigo"] == "P-1"
    assert body["items"][0]["capacidad_maxima"] == 99


def test_list_pozas_sin_base():
    with patch("backend.app.services.galpones.list_pozas_by_galpon", side_effect=RuntimeError("no db")):
        r = client.get("/galpones/11111111-1111-1111-1111-111111111111/pozas")
    assert r.status_code == 503


def test_list_galpones_fallo_conexion():
    import psycopg
    with patch("backend.app.services.galpones.list_galpones", side_effect=psycopg.OperationalError("conn fail")):
        r = client.get("/galpones")
    assert r.status_code == 503
    assert "credenciales" not in r.text.lower()
    assert "sql" not in r.text.lower()


def test_list_pozas_fallo_conexion():
    import psycopg
    with patch("backend.app.services.galpones.list_pozas_by_galpon", side_effect=psycopg.OperationalError("conn fail")):
        r = client.get("/galpones/11111111-1111-1111-1111-111111111111/pozas")
    assert r.status_code == 503