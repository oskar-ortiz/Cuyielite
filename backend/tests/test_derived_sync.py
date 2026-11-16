"""Feed derivado v3 y compatibilidad de los protocolos v1/v2."""

from __future__ import annotations

import os
import secrets
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.repositories import sync as sync_repo


def _database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL aislada")
    return url


@pytest.fixture
def lab(monkeypatch):
    url = _database_url()
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("CUYIELITE_SYNC_LAB_ENABLED", "1")
    monkeypatch.delenv("CUYIELITE_AUTH_MODE", raising=False)
    monkeypatch.setenv("SYNC_CURSOR_SIGNING_KEY", "synthetic-test-key-never-for-production-0123456789")

    scope_id = sync_repo.create_scope(f"derived-{uuid.uuid4()}")
    token = secrets.token_urlsafe(32)
    import hashlib

    device_id = sync_repo.register_device(scope_id, hashlib.sha256(token.encode()).hexdigest())

    cuy_id = uuid.uuid4()
    with psycopg.connect(url) as conn:
        conn.execute(
            "INSERT INTO cuyes (id, codigo_identificacion, sexo, estado, scope_id, server_version) "
            "VALUES (%s, %s, 'H', 'ACTIVO', %s, 0)",
            (cuy_id, f"DER-{cuy_id.hex[:8]}", scope_id),
        )
        conn.commit()

    yield {
        "client": TestClient(app),
        "headers": {"Authorization": f"Bearer {token}"},
        "scope": scope_id,
        "cuy": cuy_id,
        "url": url,
    }

    with psycopg.connect(url) as conn:
        conn.execute("DELETE FROM sync_derived_changes WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM sync_changes WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM alertas WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM partos WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM cuyes WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM sync_devices WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM sync_scopes WHERE id=%s", (scope_id,))


def _partos(lab, total: int) -> None:
    with psycopg.connect(lab["url"]) as conn:
        for numero in range(1, total + 1):
            conn.execute(
                "INSERT INTO partos (id, madre_id, fecha_parto, numero_parto, nacidos_vivos, "
                "nacidos_muertos, tamano_camada_nacida, scope_id, server_version) "
                "VALUES (%s, %s, %s, %s, 3, 0, 3, %s, 0)",
                (uuid.uuid4(), lab["cuy"], f"2025-12-{numero:02d}", numero, lab["scope"]),
            )
        conn.commit()


def _context(lab):
    return lab["client"].get("/sync/v3/context", headers=lab["headers"])


def _pull(lab, cursor=None):
    params = {"limit": 50}
    if cursor is not None:
        params["cursor"] = cursor
    return lab["client"].get("/sync/v3/pull", params=params, headers=lab["headers"])


def test_contexto_v3_declara_solo_entidades_derivadas(lab):
    response = _context(lab)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["protocol_version"] == 3
    assert body["supported_entities"] == ["categoria", "alerta"]
    assert body["scope_id"] == str(lab["scope"])


def test_pull_v3_entrega_categoria_y_alerta_con_su_version(lab):
    _partos(lab, 4)
    evaluated = lab["client"].post(
        f"/evaluaciones/reproductoras/{lab['cuy']}", json={"abortos": 0}, headers=lab["headers"]
    )
    assert evaluated.status_code == 200, evaluated.text

    page = _pull(lab)
    assert page.status_code == 200, page.text
    body = page.json()
    assert body["protocol_version"] == 3
    assert body["has_more"] is False
    entities = [item["entity"] for item in body["items"]]
    assert entities == ["categoria", "alerta"]
    assert body["items"][0]["record"]["data"]["clase"] == "DESCARTE"
    assert body["items"][0]["record"]["data"]["categoria_estado"] == "DEFINITIVA"
    assert body["items"][1]["record"]["data"]["tipo_alerta"] == "DESCARTE_REPRODUCTORA"
    assert body["items"][1]["record"]["data"]["estado"] == "activa"
    assert body["items"][1]["record"]["data"]["atendida"] is False

    again = _pull(lab, body["next_cursor"])
    assert again.status_code == 200
    assert again.json()["items"] == []


def test_pull_v3_rechaza_cursor_de_otro_protocolo(lab):
    v1 = lab["client"].get("/sync/pull", headers=lab["headers"]).json()["next_cursor"]
    response = _pull(lab, v1)
    assert response.status_code == 400
    assert response.json()["detail"] == "CURSOR_INVALID"


def test_alertas_no_avanzan_el_cursor_v1_ni_v2(lab):
    before = lab["client"].get("/sync/context", headers=lab["headers"]).json()
    _partos(lab, 4)
    lab["client"].post(
        f"/evaluaciones/reproductoras/{lab['cuy']}", json={"abortos": 0}, headers=lab["headers"]
    )
    after = lab["client"].get("/sync/context", headers=lab["headers"]).json()
    assert after["scope_id"] == before["scope_id"]

    with psycopg.connect(lab["url"]) as conn:
        last_sequence = conn.execute(
            "SELECT last_sequence, derived_sequence FROM sync_scopes WHERE id=%s", (lab["scope"],)
        ).fetchone()
    # La publicación de categoria_ml usa last_sequence (contrato vigente);
    # el feed derivado solo mueve derived_sequence.
    assert last_sequence[0] == 1
    assert last_sequence[1] == 2

    v1 = lab["client"].get("/sync/pull", params={"limit": 50}, headers=lab["headers"])
    assert v1.status_code == 200, v1.text
    assert {item["entity"] for item in v1.json()["items"]} == {"cuyes"}
    assert v1.json()["items"][0]["record"]["data"]["categoria_ml"] == "DESCARTE"

    v2 = lab["client"].get("/sync/v2/pull", params={"limit": 50}, headers=lab["headers"])
    assert v2.status_code == 200, v2.text
    assert "alerta" not in {item["entity"] for item in v2.json()["items"]}


def test_entidad_desconocida_en_historial_no_adelanta_cursor(lab):
    with psycopg.connect(lab["url"]) as conn:
        sequence = conn.execute(
            "UPDATE sync_scopes SET last_sequence = last_sequence + 1 WHERE id=%s RETURNING last_sequence",
            (lab["scope"],),
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO sync_changes (scope_id, sequence, entity, record_id, record_version, snapshot) "
            "VALUES (%s, %s, 'desconocida', %s, 1, %s)",
            (lab["scope"], sequence, uuid.uuid4(), psycopg.types.json.Jsonb({"id": str(uuid.uuid4())})),
        )
        conn.commit()

    response = lab["client"].get("/sync/v2/pull", params={"limit": 50}, headers=lab["headers"])
    assert response.status_code == 500
    assert response.json()["detail"] == "HISTORIAL_NO_SOPORTADO"

    with psycopg.connect(lab["url"]) as conn:
        conn.execute("DELETE FROM sync_changes WHERE scope_id=%s AND entity='desconocida'", (lab["scope"],))
        conn.commit()

    recovered = lab["client"].get("/sync/v2/pull", params={"limit": 50}, headers=lab["headers"])
    assert recovered.status_code == 200
    assert recovered.json()["items"] == []
