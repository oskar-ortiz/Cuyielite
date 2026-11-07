"""Pruebas de contrato HTTP del controlador de sincronización de laboratorio."""

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services import sync as service

LAB_TOKEN = "controller-test-token-abcdefghijklmnopqrstuvwxyz0123456789"


@pytest.fixture
def client():
    return TestClient(app, headers={"Authorization": f"Bearer {LAB_TOKEN}"})


@pytest.fixture(autouse=True)
def enable_lab(monkeypatch):
    monkeypatch.setenv("CUYIELITE_SYNC_LAB_ENABLED", "1")


def _operation(*, operation_id=None, record_id=None, entity="galpon"):
    data = {"nombre": "Galpón de prueba", "ubicacion": None}
    if entity == "poza":
        data = {
            "galpon_id": str(uuid4()),
            "codigo": "P-1",
            "tipo": "cría",
            "capacidad_maxima": 10,
        }
    return {
        "operation_id": str(operation_id or uuid4()),
        "entity": entity,
        "record_id": str(record_id or uuid4()),
        "action": "create",
        "base_version": None,
        "client_created_at": "2026-11-05T20:00:00Z",
        "client_edited_at": "2026-11-05T20:00:00Z",
        "data": data,
    }


def _request(*operations, protocol_version=1):
    return {
        "protocol_version": protocol_version,
        "device_id": str(uuid4()),
        "operations": list(operations),
    }


def test_sync_routes_are_disabled_by_default(client, monkeypatch):
    monkeypatch.delenv("CUYIELITE_SYNC_LAB_ENABLED")

    context = client.get("/sync/context")
    push = client.post("/sync/push", json=_request(_operation()))

    assert context.status_code == 404
    assert context.json()["detail"] == "SYNC_LAB_DISABLED"
    assert push.status_code == 404
    assert push.json()["detail"] == "SYNC_LAB_DISABLED"


def test_context_returns_service_identity(client, monkeypatch):
    expected = {
        "protocol_version": 1,
        "scope_id": str(uuid4()),
        "device_id": str(uuid4()),
        "limits": {"push_operations": 100},
    }
    monkeypatch.setattr(service, "get_context", lambda token: expected)

    response = client.get("/sync/context")

    assert response.status_code == 200
    assert response.json() == expected


def test_context_hides_unexpected_service_errors(client, monkeypatch):
    def fail(_token):
        raise RuntimeError("private database detail")

    monkeypatch.setattr(service, "get_context", fail)

    response = client.get("/sync/context")

    assert response.status_code == 503
    assert response.json()["detail"] == "Servicio no disponible"
    assert "private database detail" not in response.text


def test_push_passes_validated_operations_to_service(client, monkeypatch):
    operation = _operation()
    received = {}

    def process_push(*, token, device_id_body, operations):
        received["token"] = token
        received["device_id"] = device_id_body
        received["operations"] = operations
        return [{
            "operation_id": operation["operation_id"],
            "entity": "galpon",
            "record_id": operation["record_id"],
            "status": "accepted",
            "changed": True,
            "code": None,
            "record": None,
        }]

    monkeypatch.setattr(service, "process_push", process_push)
    request = _request(operation)

    response = client.post("/sync/push", json=request)

    assert response.status_code == 200
    assert response.json()["protocol_version"] == 1
    assert response.json()["results"][0]["status"] == "accepted"
    assert received["token"] == LAB_TOKEN
    assert str(received["device_id"]) == request["device_id"]
    assert str(received["operations"][0]["operation_id"]) == operation["operation_id"]


def test_push_rejects_unsupported_protocol(client):
    response = client.post(
        "/sync/push", json=_request(_operation(), protocol_version=2)
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "PROTOCOL_UNSUPPORTED"


def test_push_rejects_batches_over_limit(client):
    response = client.post(
        "/sync/push", json=_request(*(_operation() for _ in range(101)))
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "BATCH_TOO_LARGE"


def test_push_rejects_duplicate_operation_ids(client):
    operation_id = str(uuid4())
    response = client.post(
        "/sync/push",
        json=_request(
            _operation(operation_id=operation_id),
            _operation(operation_id=operation_id),
        ),
    )

    assert response.status_code == 422


def test_push_rejects_duplicate_records_in_batch(client):
    record_id = str(uuid4())
    response = client.post(
        "/sync/push",
        json=_request(
            _operation(record_id=record_id), _operation(record_id=record_id)
        ),
    )

    assert response.status_code == 422


def test_push_hides_unexpected_service_errors(client, monkeypatch):
    def fail(**_kwargs):
        raise RuntimeError("private database detail")

    monkeypatch.setattr(service, "process_push", fail)

    response = client.post("/sync/push", json=_request(_operation()))

    assert response.status_code == 503
    assert response.json()["detail"] == "Servicio no disponible"
    assert "private database detail" not in response.text
