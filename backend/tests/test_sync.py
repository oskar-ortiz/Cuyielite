"""Pruebas de sincronizacion de laboratorio (S3)."""
import hashlib
import json
import os
import secrets
import uuid

import pytest


@pytest.fixture
def client(monkeypatch):
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL de pruebas aislada")

    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("CUYIELITE_SYNC_LAB_ENABLED", "1")

    import psycopg
    from fastapi.testclient import TestClient
    from backend.app.main import app

    scope_id = uuid.uuid4()
    device_id = uuid.uuid4()
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with psycopg.connect(database_url) as conn:
        conn.execute(
            "INSERT INTO sync_scopes (id, name) VALUES (%s, %s)",
            (scope_id, f"test-{scope_id}"),
        )
        conn.execute(
            "INSERT INTO sync_devices (id, scope_id, token_hash) VALUES (%s, %s, %s)",
            (device_id, scope_id, token_hash),
        )

    try:
        with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as test_client:
            yield test_client
    finally:
        with psycopg.connect(database_url) as conn:
            conn.execute("DELETE FROM sync_changes WHERE scope_id = %s", (scope_id,))
            conn.execute("DELETE FROM sync_receipts WHERE scope_id = %s", (scope_id,))
            conn.execute("DELETE FROM sync_devices WHERE scope_id = %s", (scope_id,))
            conn.execute("DELETE FROM pozas WHERE scope_id = %s", (scope_id,))
            conn.execute("DELETE FROM galpones WHERE scope_id = %s", (scope_id,))
            conn.execute("DELETE FROM sync_scopes WHERE id = %s", (scope_id,))


def _ctx(client):
    return client.get("/sync/context").json()


def test_context_rejects_missing_token(client):
    response = client.get("/sync/context", headers={"Authorization": ""})
    assert response.status_code == 401


def test_context_rejects_unknown_token(client):
    import psycopg

    database_url = os.environ["TEST_DATABASE_URL"]
    with psycopg.connect(database_url) as conn:
        before = (
            conn.execute("SELECT count(*) FROM sync_scopes").fetchone()[0],
            conn.execute("SELECT count(*) FROM sync_devices").fetchone()[0],
        )

    response = client.get(
        "/sync/context",
        headers={"Authorization": "Bearer " + secrets.token_urlsafe(32)},
    )
    assert response.status_code == 401

    with psycopg.connect(database_url) as conn:
        after = (
            conn.execute("SELECT count(*) FROM sync_scopes").fetchone()[0],
            conn.execute("SELECT count(*) FROM sync_devices").fetchone()[0],
        )
    assert after == before


def test_push_rejects_missing_token(client):
    response = client.post(
        "/sync/push",
        headers={"Authorization": ""},
        json={"protocol_version": 1, "device_id": str(uuid.uuid4()), "operations": []},
    )
    assert response.status_code == 401


def test_context_rejects_token_ambiguous_across_scopes(client):
    import psycopg

    token = client.headers["Authorization"].removeprefix("Bearer ")
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    scope_id = uuid.uuid4()
    device_id = uuid.uuid4()
    database_url = os.environ["TEST_DATABASE_URL"]
    with psycopg.connect(database_url) as conn:
        conn.execute(
            "INSERT INTO sync_scopes (id, name) VALUES (%s, %s)",
            (scope_id, f"ambiguous-{scope_id}"),
        )
        conn.execute(
            "INSERT INTO sync_devices (id, scope_id, token_hash) VALUES (%s, %s, %s)",
            (device_id, scope_id, token_hash),
        )

    try:
        response = client.get("/sync/context")
        assert response.status_code == 401
    finally:
        with psycopg.connect(database_url) as conn:
            conn.execute("DELETE FROM sync_devices WHERE id = %s", (device_id,))
            conn.execute("DELETE FROM sync_scopes WHERE id = %s", (scope_id,))


def test_push_rejects_device_id_not_bound_to_token(client):
    response = client.post(
        "/sync/push",
        json={"protocol_version": 1, "device_id": str(uuid.uuid4()), "operations": []},
    )
    assert response.status_code == 403


def test_context_returns_real_ids(client):
    ctx = _ctx(client)
    assert ctx["scope_id"] != "00000000-0000-0000-0000-000000000000"
    assert ctx["device_id"] != "00000000-0000-0000-0000-000000000000"
    assert ctx["device_id"] is not None


def test_push_create_galpon_accepted(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    oid = str(uuid.uuid4())
    req = {
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": oid,
            "entity": "galpon",
            "record_id": gid,
            "action": "create",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"nombre": "Galpon Test", "ubicacion": "Lote 1"},
        }],
    }
    r = client.post("/sync/push", json=req)
    assert r.status_code == 200
    res = r.json()["results"][0]
    assert res["status"] == "accepted"
    assert res["changed"] is True
    assert res["record"]["version"] == "1"


def test_idempotent_retry_same_content(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    oid = str(uuid.uuid4())
    req = {
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": oid,
            "entity": "galpon",
            "record_id": gid,
            "action": "create",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"nombre": "Galpon Test", "ubicacion": "Lote 1"},
        }],
    }
    r1 = client.post("/sync/push", json=req)
    assert r1.status_code == 200
    r2 = client.post("/sync/push", json=req)
    assert r2.status_code == 200
    assert r2.json()["results"][0]["status"] == "accepted"


def test_operation_id_reused_different_content(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    oid = str(uuid.uuid4())
    req = {
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": oid,
            "entity": "galpon",
            "record_id": gid,
            "action": "create",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"nombre": "Galpon Test", "ubicacion": "Lote 1"},
        }],
    }
    client.post("/sync/push", json=req)
    req2 = json.loads(json.dumps(req))
    req2["operations"][0]["data"]["nombre"] = "Changed"
    r = client.post("/sync/push", json=req2)
    assert r.status_code == 200
    assert r.json()["results"][0]["status"] == "rejected"
    assert r.json()["results"][0]["code"] == "OPERATION_ID_REUSED"


def test_poza_nonexistent_galpon_rejected(client):
    ctx = _ctx(client)
    pid = str(uuid.uuid4())
    req = {
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "poza",
            "record_id": pid,
            "action": "create",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"galpon_id": str(uuid.uuid4()), "codigo": "P1", "tipo": "cria", "capacidad_maxima": 10},
        }],
    }
    r = client.post("/sync/push", json=req)
    assert r.status_code == 200
    assert r.json()["results"][0]["status"] == "rejected"
    assert r.json()["results"][0]["code"] == "RELATION_INACTIVE"


def test_update_requires_base_version(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    # create
    client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "galpon",
            "record_id": gid,
            "action": "create",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"nombre": "G1", "ubicacion": None},
        }],
    })
    # update without base_version -> 422
    r = client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "galpon",
            "record_id": gid,
            "action": "update",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"nombre": "G2", "ubicacion": None},
        }],
    })
    assert r.status_code == 422


def test_update_wrong_version_conflict(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "galpon",
            "record_id": gid,
            "action": "create",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"nombre": "G1", "ubicacion": None},
        }],
    })
    r = client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "galpon",
            "record_id": gid,
            "action": "update",
            "base_version": "999",
            "client_edited_at": "2026-11-05T20:05:00.000Z",
            "data": {"nombre": "G2", "ubicacion": None},
        }],
    })
    assert r.status_code == 200
    assert r.json()["results"][0]["status"] == "conflict"
    assert r.json()["results"][0]["code"] == "VERSION_CONFLICT"


def test_idempotent_update_same_data(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "galpon",
            "record_id": gid,
            "action": "create",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"nombre": "G1", "ubicacion": None},
        }],
    })
    # first update
    r1 = client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "galpon",
            "record_id": gid,
            "action": "update",
            "base_version": "1",
            "client_edited_at": "2026-11-05T20:05:00.000Z",
            "data": {"nombre": "G2", "ubicacion": None},
        }],
    })
    assert r1.json()["results"][0]["changed"] is True
    # second update same data -> changed false
    r2 = client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "galpon",
            "record_id": gid,
            "action": "update",
            "base_version": "2",
            "client_edited_at": "2026-11-05T20:06:00.000Z",
            "data": {"nombre": "G2", "ubicacion": None},
        }],
    })
    assert r2.json()["results"][0]["changed"] is False


def test_batch_duplicate_operation_id_422(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    oid = str(uuid.uuid4())
    r = client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [
            {"operation_id": oid, "entity": "galpon", "record_id": gid, "action": "create", "base_version": None,
             "client_created_at": "2026-11-05T20:00:00.000Z", "client_edited_at": "2026-11-05T20:00:00.000Z",
             "data": {"nombre": "G1", "ubicacion": None}},
            {"operation_id": oid, "entity": "galpon", "record_id": str(uuid.uuid4()), "action": "create", "base_version": None,
             "client_created_at": "2026-11-05T20:00:00.000Z", "client_edited_at": "2026-11-05T20:00:00.000Z",
             "data": {"nombre": "G2", "ubicacion": None}},
        ],
    })
    assert r.status_code == 422


def test_batch_too_many_413(client):
    ctx = _ctx(client)
    ops = []
    for i in range(101):
        ops.append({"operation_id": str(uuid.uuid4()), "entity": "galpon", "record_id": str(uuid.uuid4()),
                    "action": "create", "base_version": None,
                    "client_created_at": "2026-11-05T20:00:00.000Z", "client_edited_at": "2026-11-05T20:00:00.000Z",
                    "data": {"nombre": f"G{i}", "ubicacion": None}})
    r = client.post("/sync/push", json={"protocol_version": 1, "device_id": ctx["device_id"], "operations": ops})
    assert r.status_code == 413


def test_unknown_field_422(client):
    ctx = _ctx(client)
    r = client.post("/sync/push", json={
        "protocol_version": 1,
        "device_id": ctx["device_id"],
        "operations": [{
            "operation_id": str(uuid.uuid4()),
            "entity": "galpon",
            "record_id": str(uuid.uuid4()),
            "action": "create",
            "base_version": None,
            "client_created_at": "2026-11-05T20:00:00.000Z",
            "client_edited_at": "2026-11-05T20:00:00.000Z",
            "data": {"nombre": "G1", "ubicacion": None},
            "extra_field": "x",
        }],
    })
    assert r.status_code == 422


def test_poza_galpon_change_rejected(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    gid2 = str(uuid.uuid4())
    # create two galpones
    for g in (gid, gid2):
        client.post("/sync/push", json={
            "protocol_version": 1, "device_id": ctx["device_id"],
            "operations": [{"operation_id": str(uuid.uuid4()), "entity": "galpon", "record_id": g, "action": "create",
                            "base_version": None, "client_created_at": "2026-11-05T20:00:00.000Z",
                            "client_edited_at": "2026-11-05T20:00:00.000Z", "data": {"nombre": "G", "ubicacion": None}}],
        })
    # create poza in gid
    pid = str(uuid.uuid4())
    client.post("/sync/push", json={
        "protocol_version": 1, "device_id": ctx["device_id"],
        "operations": [{"operation_id": str(uuid.uuid4()), "entity": "poza", "record_id": pid, "action": "create",
                        "base_version": None, "client_created_at": "2026-11-05T20:00:00.000Z",
                        "client_edited_at": "2026-11-05T20:00:00.000Z",
                        "data": {"galpon_id": gid, "codigo": "P1", "tipo": "cria", "capacidad_maxima": 10}}],
    })
    # update poza changing galpon_id -> RELATION_INACTIVE
    r = client.post("/sync/push", json={
        "protocol_version": 1, "device_id": ctx["device_id"],
        "operations": [{"operation_id": str(uuid.uuid4()), "entity": "poza", "record_id": pid, "action": "update",
                        "base_version": "1", "client_edited_at": "2026-11-05T20:05:00.000Z",
                        "data": {"galpon_id": gid2, "codigo": "P1", "tipo": "cria", "capacidad_maxima": 10}}],
    })
    assert r.status_code == 200
    assert r.json()["results"][0]["status"] == "rejected"
    assert r.json()["results"][0]["code"] == "RELATION_INACTIVE"
