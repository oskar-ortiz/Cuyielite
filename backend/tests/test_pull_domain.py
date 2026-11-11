"""Pruebas de descarga (pull) de entidades de dominio (D2).

Cubren la respuesta HTTP real de ``GET /sync/pull`` para las cinco entidades
publicables por D1, sin transformar snapshots y sin adelantar el cursor.
"""

import hashlib
import json
import os
import secrets
import uuid
from types import SimpleNamespace

import psycopg
import pytest

from backend.app.services.publication import (
    PUBLISHABLE_FIELDS,
    RegistroPublicacion,
    publicar_cambios,
)

SIGNING_KEY = "synthetic-test-key-never-for-production-0123456789"


def _provision(database_url: str, label: str):
    scope_id = uuid.uuid4()
    device_id = uuid.uuid4()
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with psycopg.connect(database_url) as conn:
        conn.execute(
            "INSERT INTO sync_scopes (id, name) VALUES (%s, %s)",
            (scope_id, f"{label}-{scope_id}"),
        )
        conn.execute(
            "INSERT INTO sync_devices (id, scope_id, token_hash) VALUES (%s, %s, %s)",
            (device_id, scope_id, token_hash),
        )
    return scope_id, device_id, token


@pytest.fixture
def lab(monkeypatch):
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL de pruebas aislada")

    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("CUYIELITE_SYNC_LAB_ENABLED", "1")
    monkeypatch.setenv("SYNC_CURSOR_SIGNING_KEY", SIGNING_KEY)

    from fastapi.testclient import TestClient

    from backend.app.main import app

    scope_a, device_a, token_a = _provision(database_url, "d2-a")
    scope_b, device_b, token_b = _provision(database_url, "d2-b")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    try:
        yield SimpleNamespace(
            url=database_url,
            scope=scope_a,
            device=device_a,
            token=token_a,
            client=TestClient(app, headers=headers_a),
            # Igual que en produccion: un 500 se devuelve como respuesta, no como
            # excepcion, para poder afirmar el codigo real.
            raw=TestClient(app, headers=headers_a, raise_server_exceptions=False),
            other_scope=scope_b,
            other_client=TestClient(app, headers=headers_b),
        )
    finally:
        with psycopg.connect(database_url) as conn:
            for scope in (scope_a, scope_b):
                conn.execute("DELETE FROM sync_changes WHERE scope_id = %s", (scope,))
                conn.execute("DELETE FROM sync_receipts WHERE scope_id = %s", (scope,))
                conn.execute("DELETE FROM sync_devices WHERE scope_id = %s", (scope,))
                # Orden seguro para las FK de dominio antes de pozas/galpones.
                for table in ("parto_crias", "pesajes", "eventos", "partos", "cuyes"):
                    conn.execute(f"DELETE FROM {table} WHERE scope_id = %s", (scope,))
                conn.execute("DELETE FROM pozas WHERE scope_id = %s", (scope,))
                conn.execute("DELETE FROM galpones WHERE scope_id = %s", (scope,))
                conn.execute("DELETE FROM sync_scopes WHERE id = %s", (scope,))


def _insert_cuye(conn, scope, code: str):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO cuyes (id, scope_id, codigo_identificacion, sexo) "
        "VALUES (%s, %s, %s, 'H')",
        (record_id, scope, code),
    )
    return record_id


def _insert_parto(conn, scope, madre_id):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO partos (id, scope_id, madre_id, fecha_parto, numero_parto, "
        "nacidos_vivos, nacidos_muertos, tamano_camada_nacida) "
        "VALUES (%s, %s, %s, '2026-01-20', 1, 1, 0, 1)",
        (record_id, scope, madre_id),
    )
    return record_id


def _insert_evento(conn, scope, cuy_id, tipo: str = "DESTETE"):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO eventos (id, scope_id, cuy_id, tipo) VALUES (%s, %s, %s, %s)",
        (record_id, scope, cuy_id, tipo),
    )
    return record_id


def _insert_pesaje(conn, scope, cuy_id, *, evento_id=None, parto_id=None):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO pesajes (id, scope_id, cuy_id, peso_gramos, etapa, evento_id, parto_id) "
        "VALUES (%s, %s, %s, '250.00', 'DESTETE', %s, %s)",
        (record_id, scope, cuy_id, evento_id, parto_id),
    )
    return record_id


def _insert_parto_cria(conn, scope, parto_id, cuy_id):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO parto_crias (id, scope_id, parto_id, cuy_id, rol) "
        "VALUES (%s, %s, %s, %s, 'CRIA')",
        (record_id, scope, parto_id, cuy_id),
    )
    return record_id


def _after(conn, entity: str, record_id):
    fields = PUBLISHABLE_FIELDS[entity]
    row = conn.execute(
        f"SELECT {', '.join(fields)} FROM {entity} WHERE id = %s", (record_id,)
    ).fetchone()
    assert row is not None
    return dict(zip(fields, row))


def _publish(conn, scope, entity: str, record_id, *, before=None, expected_version=None):
    after = _after(conn, entity, record_id)
    publicar_cambios(
        conn,
        scope,
        [
            RegistroPublicacion(
                entity=entity,
                id=record_id,
                expected_version=expected_version,
                before=before,
                after=after,
            )
        ],
    )
    return after


def test_pull_entrega_las_cinco_entidades_de_dominio(lab):
    with psycopg.connect(lab.url) as conn:
        madre = _insert_cuye(conn, lab.scope, "MADRE-D2")
        cria = _insert_cuye(conn, lab.scope, "CRIA-D2")
        parto = _insert_parto(conn, lab.scope, madre)
        evento = _insert_evento(conn, lab.scope, cria)
        pesaje = _insert_pesaje(conn, lab.scope, cria, evento_id=evento)
        vinculo = _insert_parto_cria(conn, lab.scope, parto, cria)
        for entity, record_id in (
            ("cuyes", madre),
            ("cuyes", cria),
            ("partos", parto),
            ("eventos", evento),
            ("pesajes", pesaje),
            ("parto_crias", vinculo),
        ):
            _publish(conn, lab.scope, entity, record_id)
        conn.commit()

    response = lab.raw.get("/sync/pull", params={"limit": 50})
    assert response.status_code == 200, response.text
    body = response.json()

    entities = [item["entity"] for item in body["items"]]
    assert entities == ["cuyes", "cuyes", "partos", "eventos", "pesajes", "parto_crias"]
    assert set(entities) == {"cuyes", "partos", "pesajes", "eventos", "parto_crias"}
    assert [item["seq"] for item in body["items"]] == ["1", "2", "3", "4", "5", "6"]
    assert all(item["record"]["version"] == "1" for item in body["items"])
    assert all(item["record"]["deleted_at"] is None for item in body["items"])
    assert body["scope_id"] == str(lab.scope)
    assert body["has_more"] is False

    by_entity = {item["entity"]: item["record"] for item in body["items"]}
    assert body["items"][0]["record"]["id"] == str(madre)
    assert body["items"][1]["record"]["id"] == str(cria)
    assert by_entity["partos"]["data"]["madre_id"] == str(madre)
    assert by_entity["eventos"]["data"]["cuy_id"] == str(cria)
    assert by_entity["pesajes"]["data"]["evento_id"] == str(evento)
    assert by_entity["parto_crias"]["data"]["parto_id"] == str(parto)
    assert by_entity["parto_crias"]["data"]["cuy_id"] == str(cria)


def test_pull_no_responde_500_por_entidad_de_dominio(lab):
    published = {}
    with psycopg.connect(lab.url) as conn:
        madre = _insert_cuye(conn, lab.scope, "REG-MADRE")
        cria = _insert_cuye(conn, lab.scope, "REG-CRIA")
        parto = _insert_parto(conn, lab.scope, madre)
        evento = _insert_evento(conn, lab.scope, cria)
        pesaje = _insert_pesaje(conn, lab.scope, cria, evento_id=evento)
        vinculo = _insert_parto_cria(conn, lab.scope, parto, cria)
        for entity, record_id in (
            ("cuyes", madre),
            ("cuyes", cria),
            ("partos", parto),
            ("eventos", evento),
            ("pesajes", pesaje),
            ("parto_crias", vinculo),
        ):
            _publish(conn, lab.scope, entity, record_id)
            published.setdefault(entity, record_id)
        conn.commit()

    for entity in published:
        response = lab.raw.get("/sync/pull", params={"limit": 100})
        assert response.status_code != 500, f"{entity}: {response.text}"
        assert response.status_code == 200
        assert set(item["entity"] for item in response.json()["items"]) >= {entity}


def test_pull_conserva_borrado_logico_y_version(lab):
    with psycopg.connect(lab.url) as conn:
        cuy = _insert_cuye(conn, lab.scope, "BORRADO-D2")
        first = _publish(conn, lab.scope, "cuyes", cuy)
        conn.commit()

        conn.execute("UPDATE cuyes SET deleted_at = now() WHERE id = %s", (cuy,))
        _publish(conn, lab.scope, "cuyes", cuy, before=first, expected_version=1)
        conn.commit()

    body = lab.client.get("/sync/pull").json()
    assert [item["record"]["version"] for item in body["items"]] == ["1", "2"]
    assert body["items"][0]["record"]["deleted_at"] is None
    deleted_at = body["items"][1]["record"]["deleted_at"]
    assert isinstance(deleted_at, str) and deleted_at
    assert body["items"][1]["record"]["id"] == str(cuy)
    # La respuesta ya se serializo a JSON; el snapshot no se transforma ni se omite.
    assert json.loads(json.dumps(body))["items"][1]["record"]["deleted_at"] == deleted_at


def test_pull_aisla_ambitos(lab):
    with psycopg.connect(lab.url) as conn:
        mine = _insert_cuye(conn, lab.scope, "MIO-D2")
        _publish(conn, lab.scope, "cuyes", mine)
        conn.commit()
    with psycopg.connect(lab.url) as conn:
        theirs = _insert_cuye(conn, lab.other_scope, "AJENO-D2")
        _publish(conn, lab.other_scope, "cuyes", theirs)
        conn.commit()

    body_a = lab.client.get("/sync/pull").json()
    assert [item["record"]["id"] for item in body_a["items"]] == [str(mine)]
    assert body_a["scope_id"] == str(lab.scope)

    body_b = lab.other_client.get("/sync/pull").json()
    assert [item["record"]["id"] for item in body_b["items"]] == [str(theirs)]
    assert body_b["scope_id"] == str(lab.other_scope)


def test_pull_pagina_y_cursor_no_adelanta_cambios(lab):
    ids = []
    with psycopg.connect(lab.url) as conn:
        for index in range(5):
            record_id = _insert_cuye(conn, lab.scope, f"PAG-{index}")
            ids.append(record_id)
            _publish(conn, lab.scope, "cuyes", record_id)
        conn.commit()

    page_one = lab.client.get("/sync/pull", params={"limit": 2}).json()
    assert [item["seq"] for item in page_one["items"]] == ["1", "2"]
    assert page_one["has_more"] is True

    with psycopg.connect(lab.url) as conn:
        extra = _insert_cuye(conn, lab.scope, "PAG-5")
        ids.append(extra)
        _publish(conn, lab.scope, "cuyes", extra)
        conn.commit()

    page_two = lab.client.get(
        "/sync/pull", params={"limit": 2, "cursor": page_one["next_cursor"]}
    ).json()
    assert [item["seq"] for item in page_two["items"]] == ["3", "4"]
    assert page_two["has_more"] is True

    page_three = lab.client.get(
        "/sync/pull", params={"limit": 2, "cursor": page_two["next_cursor"]}
    ).json()
    assert [item["seq"] for item in page_three["items"]] == ["5"]
    assert page_three["has_more"] is False

    next_cycle = lab.client.get(
        "/sync/pull", params={"limit": 2, "cursor": page_three["next_cursor"]}
    ).json()
    assert [item["seq"] for item in next_cycle["items"]] == ["6"]

    delivered = [
        item["record"]["id"]
        for page in (page_one, page_two, page_three, next_cycle)
        for item in page["items"]
    ]
    assert delivered == [str(record_id) for record_id in ids]
    assert len(delivered) == len(set(delivered))


def test_pull_conjunto_vacio_y_limite_uno(lab):
    empty = lab.raw.get("/sync/pull", params={"limit": 1})
    assert empty.status_code == 200
    body = empty.json()
    assert body["items"] == []
    assert body["has_more"] is False
    assert body["next_cursor"]
    assert body["scope_id"] == str(lab.scope)

    with psycopg.connect(lab.url) as conn:
        for index in range(2):
            record_id = _insert_cuye(conn, lab.scope, f"LIM-{index}")
            _publish(conn, lab.scope, "cuyes", record_id)
        conn.commit()

    first = lab.client.get("/sync/pull", params={"limit": 1}).json()
    assert [item["seq"] for item in first["items"]] == ["1"]
    assert first["has_more"] is True

    second = lab.client.get(
        "/sync/pull", params={"limit": 1, "cursor": first["next_cursor"]}
    ).json()
    assert [item["seq"] for item in second["items"]] == ["2"]
    assert second["has_more"] is False


def test_pull_conserva_galpon_y_poza(lab):
    context = lab.client.get("/sync/context").json()
    galpon_id = str(uuid.uuid4())
    poza_id = str(uuid.uuid4())
    create_galpon = lab.client.post(
        "/sync/push",
        json={
            "protocol_version": 1,
            "device_id": context["device_id"],
            "operations": [
                {
                    "operation_id": str(uuid.uuid4()),
                    "entity": "galpon",
                    "record_id": galpon_id,
                    "action": "create",
                    "base_version": None,
                    "client_created_at": "2026-11-10T10:00:00.000Z",
                    "client_edited_at": "2026-11-10T10:00:00.000Z",
                    "data": {"nombre": "G-D2", "ubicacion": None},
                }
            ],
        },
    )
    assert create_galpon.status_code == 200
    assert create_galpon.json()["results"][0]["status"] == "accepted"

    create_poza = lab.client.post(
        "/sync/push",
        json={
            "protocol_version": 1,
            "device_id": context["device_id"],
            "operations": [
                {
                    "operation_id": str(uuid.uuid4()),
                    "entity": "poza",
                    "record_id": poza_id,
                    "action": "create",
                    "base_version": None,
                    "client_created_at": "2026-11-10T10:00:01.000Z",
                    "client_edited_at": "2026-11-10T10:00:01.000Z",
                    "data": {
                        "galpon_id": galpon_id,
                        "codigo": "P-D2",
                        "tipo": "cria",
                        "capacidad_maxima": 10,
                    },
                }
            ],
        },
    )
    assert create_poza.status_code == 200
    assert create_poza.json()["results"][0]["status"] == "accepted"

    body = lab.client.get("/sync/pull").json()
    assert [item["entity"] for item in body["items"]] == ["galpon", "poza"]
    assert body["items"][0]["record"]["data"] == {"nombre": "G-D2", "ubicacion": None}
    assert body["items"][1]["record"]["data"]["galpon_id"] == galpon_id
    assert body["items"][1]["record"]["data"]["codigo"] == "P-D2"


def test_pull_entidad_desconocida_falla_sin_avanzar(lab):
    snapshot = {
        "id": str(uuid.uuid4()),
        "version": "1",
        "created_at": "2026-11-10T10:00:00Z",
        "updated_at": "2026-11-10T10:00:00Z",
        "deleted_at": None,
        "last_client_edited_at": None,
        "data": {"motivo": "sintetico"},
    }
    with psycopg.connect(lab.url) as conn:
        sequence = conn.execute(
            "UPDATE sync_scopes SET last_sequence = last_sequence + 1 "
            "WHERE id = %s RETURNING last_sequence",
            (lab.scope,),
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO sync_changes "
            "(scope_id, sequence, entity, record_id, record_version, snapshot) "
            "VALUES (%s, %s, 'mortalidad', %s, 1, %s)",
            (lab.scope, sequence, uuid.UUID(snapshot["id"]), json.dumps(snapshot)),
        )

    response = lab.raw.get("/sync/pull")
    assert response.status_code == 500
    assert response.json()["detail"] == "HISTORIAL_NO_SOPORTADO"
