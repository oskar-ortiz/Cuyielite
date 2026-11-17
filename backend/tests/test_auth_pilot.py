"""Pruebas del acceso de piloto: login, refresh, roles y revocación."""

from __future__ import annotations

import os
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.repositories import auth as auth_repo
from backend.app.repositories import sync as sync_repo
from backend.app.services import auth as auth_service

PASSWORD = "correct horse battery staple"


@pytest.fixture
def pilot(monkeypatch):
    database_url = os.environ.get("TEST_DATABASE_URL")
    if not database_url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL aislada")
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("CUYIELITE_AUTH_MODE", "pilot")
    monkeypatch.setenv("CUYIELITE_AUTH_JWT_SECRET", "synthetic-pilot-auth-key-never-production-0123456789")
    monkeypatch.setenv("CUYIELITE_AUTH_ISSUER", "cuyielite-test")
    monkeypatch.setenv("CUYIELITE_AUTH_AUDIENCE", "cuyielite-pilot-test")
    monkeypatch.setenv("SYNC_CURSOR_SIGNING_KEY", "synthetic-test-key-never-for-production-0123456789")

    scope_id = sync_repo.create_scope(f"auth-{uuid.uuid4()}")
    admin_name = f"admin-{uuid.uuid4().hex[:8]}"
    viewer_name = f"viewer-{uuid.uuid4().hex[:8]}"
    admin = auth_repo.create_user(admin_name, auth_service.hash_password(PASSWORD), "admin", scope_id, False)
    viewer = auth_repo.create_user(viewer_name, auth_service.hash_password(PASSWORD), "viewer", scope_id, False)
    device_id = uuid.uuid4()
    try:
        with TestClient(app) as client:
            yield {
                "client": client,
                "scope_id": scope_id,
                "admin": admin,
                "viewer": viewer,
                "admin_name": admin_name,
                "viewer_name": viewer_name,
                "device_id": device_id,
            }
    finally:
        with psycopg.connect(database_url) as conn:
            conn.execute("DELETE FROM auth_sessions WHERE scope_id=%s", (scope_id,))
            conn.execute("DELETE FROM auth_audit WHERE scope_id=%s", (scope_id,))
            conn.execute(
                "DELETE FROM auth_login_attempts WHERE attempt_key LIKE %s OR attempt_key LIKE %s",
                (f"{admin_name}:%", f"{viewer_name}:%"),
            )
            conn.execute("DELETE FROM app_users WHERE scope_id=%s", (scope_id,))
            conn.execute("DELETE FROM sync_devices WHERE scope_id=%s", (scope_id,))
            conn.execute("DELETE FROM sync_scopes WHERE id=%s", (scope_id,))


def _login(pilot, username: str, device_id=None):
    return pilot["client"].post(
        "/auth/login",
        json={
            "username": username,
            "password": PASSWORD,
            "device_id": str(device_id or pilot["device_id"]),
            "platform": "test",
            "device_name": "equipo compartido",
        },
    )


def test_login_y_contexto_derivan_scope_del_token(pilot):
    response = _login(pilot, pilot["admin_name"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["user"]["role"] == "admin"
    assert body["scope_id"] == str(pilot["scope_id"])
    token = body["access_token"]

    me = pilot["client"].get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["device_id"] == str(pilot["device_id"])

    context = pilot["client"].get("/sync/context", headers={"Authorization": f"Bearer {token}"})
    assert context.status_code == 200
    assert context.json()["scope_id"] == str(pilot["scope_id"])
    assert context.json()["device_id"] == str(pilot["device_id"])


def test_viewer_puede_pull_pero_no_push(pilot):
    response = _login(pilot, pilot["viewer_name"])
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    pull = pilot["client"].get("/sync/pull", headers=headers)
    assert pull.status_code == 200
    assert pull.json()["items"] == []

    operation = {
        "operation_id": str(uuid.uuid4()),
        "entity": "galpon",
        "record_id": str(uuid.uuid4()),
        "action": "create",
        "base_version": None,
        "client_created_at": "2026-11-15T10:00:00Z",
        "data": {"nombre": "No permitido", "ubicacion": None},
    }
    push = pilot["client"].post(
        "/sync/push",
        headers=headers,
        json={"protocol_version": 1, "device_id": str(pilot["device_id"]), "operations": [operation]},
    )
    assert push.status_code == 403
    assert push.json()["detail"] == "ROL_SIN_ESCRITURA"

    v2_operation = {
        "operation_id": str(uuid.uuid4()),
        "entity": "cuyes",
        "record_id": str(uuid.uuid4()),
        "action": "create",
        "base_version": None,
        "client_created_at": "2026-11-15T10:00:00Z",
        "client_edited_at": None,
        "data": {
            "poza_id": str(uuid.uuid4()),
            "galpon_origen_id": None,
            "codigo_identificacion": "NO-PERMITIDO",
            "sexo": "H",
            "fecha_nacimiento": None,
            "color_codigo": None,
            "ojos_codigo": None,
            "pelaje_original": None,
            "padre_id": None,
            "madre_id": None,
            "estado": "ACTIVO",
        },
    }
    push_v2 = pilot["client"].post(
        "/sync/v2/push",
        headers=headers,
        json={"protocol_version": 2, "device_id": str(pilot["device_id"]), "operations": [v2_operation]},
    )
    assert push_v2.status_code == 403
    assert push_v2.json()["detail"] == "ROL_SIN_ESCRITURA"


def test_refresh_rota_y_reintento_dentro_de_gracia_no_duplica_sesion(pilot):
    login = _login(pilot, pilot["admin_name"]).json()
    first = pilot["client"].post("/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert first.status_code == 200, first.text
    rotated = first.json()

    retry = pilot["client"].post("/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert retry.status_code == 200, retry.text
    final = retry.json()

    me = pilot["client"].get("/auth/me", headers={"Authorization": f"Bearer {final['access_token']}"})
    assert me.status_code == 200

    stale = pilot["client"].post("/auth/refresh", json={"refresh_token": rotated["refresh_token"]})
    assert stale.status_code == 401
    assert stale.json()["detail"] == "REFRESH_REUTILIZADO"

    # La reutilización de una credencial rotada revoca la familia completa.
    after_reuse = pilot["client"].get(
        "/auth/me", headers={"Authorization": f"Bearer {final['access_token']}"}
    )
    assert after_reuse.status_code == 401


def test_logout_revoca_refresh_sin_borrar_identidad_de_instalacion(pilot):
    login = _login(pilot, pilot["admin_name"]).json()
    logout = pilot["client"].post("/auth/logout", json={"refresh_token": login["refresh_token"]})
    assert logout.status_code == 200
    refresh = pilot["client"].post("/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert refresh.status_code == 401

    # La misma instalación puede iniciar otra cuenta sin cambiar device_id.
    second = _login(pilot, pilot["viewer_name"], pilot["device_id"])
    assert second.status_code == 200
    assert second.json()["device_id"] == str(pilot["device_id"])
    assert second.json()["scope_id"] == str(pilot["scope_id"])


def test_dispositivo_revocado_invalida_access_y_refresh(pilot):
    login = _login(pilot, pilot["admin_name"]).json()
    auth_service.revoke_device(pilot["device_id"])
    me = pilot["client"].get("/auth/me", headers={"Authorization": f"Bearer {login['access_token']}"})
    assert me.status_code == 403
    assert me.json()["detail"] == "DEVICE_REVOKED"
    refresh = pilot["client"].post("/auth/refresh", json={"refresh_token": login["refresh_token"]})
    assert refresh.status_code == 403


def test_bloqueo_temporal_tras_intentos_fallidos(pilot):
    for _ in range(5):
        response = pilot["client"].post(
            "/auth/login",
            json={
                "username": pilot["admin_name"],
                "password": "incorrecta",
                "device_id": str(pilot["device_id"]),
            },
        )
        assert response.status_code == 401
    blocked = pilot["client"].post(
        "/auth/login",
        json={
            "username": pilot["admin_name"],
            "password": PASSWORD,
            "device_id": str(pilot["device_id"]),
        },
    )
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "LOGIN_BLOQUEADO"
