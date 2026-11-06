"""Pruebas de sincronizacion de laboratorio (S3)."""
import os
import uuid
import json

import pytest

LAB_TOKEN = "lab-token-device-1-abcdefghijklmnopqrstuvwxyz012345"


def _database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("Define TEST_DATABASE_URL con una base PostgreSQL aislada para estas pruebas")
    return url


@pytest.fixture
def client(monkeypatch):
    url = _database_url()
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("TEST_DATABASE_URL", url)
    from fastapi.testclient import TestClient
    from backend.app.main import app
    return TestClient(app)


def _headers():
    return {"Authorization": "Bearer " + LAB_TOKEN}


def _ctx(client):
    return client.get("/sync/context", headers=_headers()).json()


def _clean():
    import psycopg
    conn = psycopg.connect(_database_url(), autocommit=True)
    conn.execute("DELETE FROM sync_changes")
    conn.execute("DELETE FROM sync_receipts")
    conn.execute("DELETE FROM sync_devices")
    conn.execute("DELETE FROM pozas WHERE scope_id IS NOT NULL")
    conn.execute("DELETE FROM galpones WHERE scope_id IS NOT NULL")
    conn.execute("DELETE FROM sync_scopes")
    conn.close()


@pytest.fixture(autouse=True)
def clean_db():
    _clean()
    os.environ["DATABASE_URL"] = _database_url()
    from backend.app.services import sync as svc
    svc.register_device_token(LAB_TOKEN)
    yield
    _clean()


def _push(client, payload):
    return client.post("/sync/push", json=payload, headers=_headers())


def test_context_requires_token(client):
    r = client.get("/sync/context")
    assert r.status_code == 401


def test_context_invalid_token(client):
    r = client.get("/sync/context", headers={"Authorization": "Bearer invalid-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"})
    assert r.status_code == 401


def test_context_returns_real_ids(client):
    ctx = _ctx(client)
    assert ctx["scope_id"] != "00000000-0000-0000-0000-000000000000"
    assert ctx["device_id"] != "00000000-0000-0000-0000-000000000000"


def test_push_requires_token(client):
    ctx = _ctx(client)
    r = client.post("/sync/push", json={"protocol_version": 1, "device_id": ctx["device_id"], "operations": []})
    assert r.status_code == 401


def test_push_foreign_device_403(client):
    ctx = _ctx(client)
    import uuid
    foreign = str(uuid.uuid4())
    r = client.post("/sync/push", json={"protocol_version": 1, "device_id": foreign, "operations": []}, headers=_headers())
    assert r.status_code == 403


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
    r = _push(client, req)
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
    r1 = _push(client, req)
    assert r1.status_code == 200
    r2 = _push(client, req)
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
    _push(client, req)
    req2 = json.loads(json.dumps(req))
    req2["operations"][0]["data"]["nombre"] = "Changed"
    r = _push(client, req2)
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
    r = _push(client, req)
    assert r.status_code == 200
    assert r.json()["results"][0]["status"] == "rejected"
    assert r.json()["results"][0]["code"] == "RELATION_INACTIVE"


def test_update_requires_base_version(client):
    ctx = _ctx(client)
    gid = str(uuid.uuid4())
    _push(client, {
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
    r = _push(client, {
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
    _push(client, {
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
    r = _push(client, {
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
    _push(client, {
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
    r1 = _push(client, {
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
    r2 = _push(client, {
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
    r = _push(client, {
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
    r = _push(client, {"protocol_version": 1, "device_id": ctx["device_id"], "operations": ops})
    assert r.status_code == 413


def test_unknown_field_422(client):
    ctx = _ctx(client)
    r = _push(client, {
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
    for g in (gid, gid2):
        _push(client, {
            "protocol_version": 1, "device_id": ctx["device_id"],
            "operations": [{"operation_id": str(uuid.uuid4()), "entity": "galpon", "record_id": g, "action": "create",
                            "base_version": None, "client_created_at": "2026-11-05T20:00:00.000Z",
                            "client_edited_at": "2026-11-05T20:00:00.000Z", "data": {"nombre": "G", "ubicacion": None}}],
        })
    pid = str(uuid.uuid4())
    _push(client, {
        "protocol_version": 1, "device_id": ctx["device_id"],
        "operations": [{"operation_id": str(uuid.uuid4()), "entity": "poza", "record_id": pid, "action": "create",
                        "base_version": None, "client_created_at": "2026-11-05T20:00:00.000Z",
                        "client_edited_at": "2026-11-05T20:00:00.000Z",
                        "data": {"galpon_id": gid, "codigo": "P1", "tipo": "cria", "capacidad_maxima": 10}}],
    })
    r = _push(client, {
        "protocol_version": 1, "device_id": ctx["device_id"],
        "operations": [{"operation_id": str(uuid.uuid4()), "entity": "poza", "record_id": pid, "action": "update",
                        "base_version": "1", "client_edited_at": "2026-11-05T20:05:00.000Z",
                        "data": {"galpon_id": gid2, "codigo": "P1", "tipo": "cria", "capacidad_maxima": 10}}],
    })
    assert r.status_code == 200
    assert r.json()["results"][0]["status"] == "rejected"
    assert r.json()["results"][0]["code"] == "RELATION_INACTIVE"
