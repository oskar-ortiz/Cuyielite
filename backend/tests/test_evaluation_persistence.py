"""Evaluación oficial, provisional y evidencia revisable (0007-0008)."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date
import os
import secrets
import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.repositories import sync as sync_repo
from backend.app.services import evaluation as service


def _url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL aislada")
    return url


@pytest.fixture
def lab(monkeypatch):
    url = _url()
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("CUYIELITE_AUTH_MODE", "pilot")
    monkeypatch.setenv("CUYIELITE_AUTH_JWT_SECRET", "synthetic-pilot-auth-key-never-production-0123456789")
    monkeypatch.setenv("SYNC_CURSOR_SIGNING_KEY", "synthetic-test-key-never-for-production-0123456789")

    scope = sync_repo.create_scope(f"eval-{uuid.uuid4()}")
    from backend.app.repositories import auth as auth_repo
    from backend.app.services import auth as auth_service

    admin_name = f"admin-{uuid.uuid4().hex[:8]}"
    auth_repo.create_user(admin_name, auth_service.hash_password("admin-2026"), "admin", scope, False)
    client = TestClient(app)
    login = client.post(
        "/auth/login",
        json={"username": admin_name, "password": "admin-2026", "device_id": str(uuid.uuid4())},
    )
    assert login.status_code == 200, login.text
    yield {
        "client": client,
        "scope": scope,
        "headers": {"Authorization": f"Bearer {login.json()['access_token']}"},
        "url": url,
    }
    with psycopg.connect(url) as conn:
        conn.execute("DELETE FROM sync_derived_changes WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM sync_changes WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM auth_sessions WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM auth_audit WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM evidencias_evaluacion WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM alertas WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM partos WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM cuyes WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM app_users WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM sync_devices WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM sync_scopes WHERE id=%s", (scope,))


def _cuy(lab, *, sexo="H") -> uuid.UUID:
    cuy_id = uuid.uuid4()
    with psycopg.connect(lab["url"]) as conn:
        conn.execute(
            "INSERT INTO cuyes (id, codigo_identificacion, sexo, estado, scope_id, server_version) "
            "VALUES (%s, %s, %s, 'ACTIVO', %s, 0)",
            (cuy_id, f"SYN-{cuy_id.hex[:8]}", sexo, lab["scope"]),
        )
        conn.commit()
    return cuy_id


def _parto(lab, cuy_id, numero, fecha=date(2025, 12, 1)):
    with psycopg.connect(lab["url"]) as conn:
        conn.execute(
            "INSERT INTO partos (id, madre_id, fecha_parto, numero_parto, nacidos_vivos, "
            "nacidos_muertos, tamano_camada_nacida, scope_id, server_version) "
            "VALUES (%s, %s, %s, %s, 3, 0, 3, %s, 0)",
            (uuid.uuid4(), cuy_id, fecha, numero, lab["scope"]),
        )
        conn.commit()


def _cuatro_partos(lab, cuy_id, *, fecha_cuarto=date(2026, 1, 10)):
    for numero in (1, 2, 3):
        _parto(lab, cuy_id, numero, date(2025, 1, numero))
    _parto(lab, cuy_id, 4, fecha_cuarto)


def _revisar(lab, cuy_id, campo, valor):
    declared = lab["client"].post(
        f"/evaluaciones/{cuy_id}/evidencias",
        json={"campo": campo, "valor": valor},
        headers=lab["headers"],
    )
    assert declared.status_code == 200, declared.text
    reviewed = lab["client"].post(
        f"/evaluaciones/{cuy_id}/evidencias/revision",
        json={"campo": campo, "decision": "REVISADA"},
        headers=lab["headers"],
    )
    assert reviewed.status_code == 200, reviewed.text


def _evaluar(lab, cuy_id, **body):
    return lab["client"].post(
        f"/evaluaciones/reproductoras/{cuy_id}", json=body, headers=lab["headers"]
    )


def _estado(lab, cuy_id):
    with psycopg.connect(lab["url"]) as conn:
        row = conn.execute(
            "SELECT categoria_ml, categoria_estado, categoria_caracter, server_version, "
            "categoria_server_version FROM cuyes WHERE id=%s",
            (cuy_id,),
        ).fetchone()
    return {
        "clase": row[0],
        "estado": row[1],
        "caracter": row[2],
        "server_version": row[3],
        "categoria_version": row[4],
    }


def _alertas(lab, cuy_id):
    with psycopg.connect(lab["url"]) as conn:
        rows = conn.execute(
            "SELECT id, regla_id, estado, causa_tipo, causa_id, causa_fecha, fecha_limite "
            "FROM alertas WHERE cuy_id=%s ORDER BY created_at",
            (cuy_id,),
        ).fetchall()
    return [
        {
            "id": r[0],
            "regla_id": r[1],
            "estado": r[2],
            "causa_tipo": r[3],
            "causa_id": r[4],
            "causa_fecha": r[5],
            "fecha_limite": r[6],
        }
        for r in rows
    ]


def test_dos_abortos_es_provisional_y_no_persiste_ni_alerta(lab):
    cuy_id = _cuy(lab)
    _parto(lab, cuy_id, 1)
    _revisar(lab, cuy_id, "abortos", 2)

    response = _evaluar(lab, cuy_id)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["estado_evaluacion"] == "PROVISIONAL"
    assert body["caracter"] == "PROPUESTO"
    assert body["clase"] == "DESCARTE"
    assert body["estado_calidad"] == "REVISAR|PROPUESTA"
    assert body["categoria_persistida"] is False
    assert body["alertas"] == []
    assert [f["regla_id"] for f in body["fundamentos"]] == ["abortos_repetidos_descarte"]
    assert _estado(lab, cuy_id)["clase"] is None
    assert _alertas(lab, cuy_id) == []


def test_cuarto_parto_confirmado_es_oficial_con_fecha_limite(lab):
    cuy_id = _cuy(lab)
    _cuatro_partos(lab, cuy_id)

    body = _evaluar(lab, cuy_id).json()
    assert body["estado_evaluacion"] == "DEFINITIVA"
    assert body["caracter"] == "CONFIRMADO"
    assert body["clase"] == "DESCARTE"
    alerta = _alertas(lab, cuy_id)[0]
    assert alerta["regla_id"] == "partos_reproductora_descarte"
    assert alerta["causa_tipo"] == "PARTO"
    assert alerta["causa_fecha"] == date(2026, 1, 10)
    assert alerta["fecha_limite"] == date(2026, 1, 30)


def test_cuarto_parto_y_abortos_solo_oficializa_la_causa_confirmada(lab):
    cuy_id = _cuy(lab)
    _cuatro_partos(lab, cuy_id)
    _revisar(lab, cuy_id, "abortos", 2)

    body = _evaluar(lab, cuy_id).json()
    assert body["estado_evaluacion"] == "DEFINITIVA"
    assert [f["caracter"] for f in body["fundamentos"]] == ["CONFIRMADO"]
    alertas = _alertas(lab, cuy_id)
    assert len(alertas) == 1
    assert alertas[0]["regla_id"] == "partos_reproductora_descarte"


def test_cuarto_parto_sin_fecha_no_inventa_vencimiento(lab):
    cuy_id = _cuy(lab)
    for numero in (1, 2, 3, 4):
        _parto(lab, cuy_id, numero, None)

    body = _evaluar(lab, cuy_id).json()
    assert body["estado_evaluacion"] == "DEFINITIVA"
    alerta = _alertas(lab, cuy_id)[0]
    assert alerta["causa_id"] is not None
    assert alerta["causa_fecha"] is None
    assert alerta["fecha_limite"] is None


def test_faltantes_quedan_informativos(lab):
    cuy_id = _cuy(lab)
    body = _evaluar(lab, cuy_id).json()
    assert body["estado_evaluacion"] == "DATOS_INSUFICIENTES"
    assert body["clase"] is None
    assert "abortos" in body["campos_faltantes"]
    assert _estado(lab, cuy_id)["clase"] is None


def test_normal_sin_evidencia_revisada_no_persiste(lab):
    cuy_id = _cuy(lab)
    _parto(lab, cuy_id, 1)
    body = _evaluar(lab, cuy_id, abortos=0).json()
    assert body["estado_evaluacion"] == "EVIDENCIA_NO_VALIDADA"
    assert "abortos" in body["evidencia_pendiente"]
    assert _estado(lab, cuy_id)["clase"] is None
    assert body["alertas"] == []


def test_normal_con_evidencia_revisada_persiste(lab):
    cuy_id = _cuy(lab)
    _parto(lab, cuy_id, 1)
    _revisar(lab, cuy_id, "abortos", 0)

    body = _evaluar(lab, cuy_id).json()
    assert body["estado_evaluacion"] == "DEFINITIVA"
    assert body["clase"] == "NORMAL"
    assert body["caracter"] == "CONFIRMADO"
    assert _estado(lab, cuy_id)["clase"] == "NORMAL"
    assert _estado(lab, cuy_id)["caracter"] == "CONFIRMADO"


def test_declaracion_nueva_vuelve_a_no_validada(lab):
    cuy_id = _cuy(lab)
    _parto(lab, cuy_id, 1)
    _revisar(lab, cuy_id, "abortos", 0)
    _evaluar(lab, cuy_id)

    # Una declaración posterior reinicia la revisión.
    _evaluar(lab, cuy_id, abortos=1)
    body = _evaluar(lab, cuy_id).json()
    assert body["estado_evaluacion"] == "EVIDENCIA_NO_VALIDADA"


def test_candidata_sin_evidencia_no_persiste_y_con_evidencia_si(lab):
    cuy_id = _cuy(lab)
    url = f"/evaluaciones/candidatas/{cuy_id}"

    pending = lab["client"].post(url, json={}, headers=lab["headers"])
    assert pending.status_code == 200, pending.text
    assert pending.json()["estado_evaluacion"] == "EVIDENCIA_NO_VALIDADA"
    assert _estado(lab, cuy_id)["clase"] is None

    for campo, valor in (
        ("nupar_madre", 3),
        ("tcnv", 4),
        ("peso_nacimiento_g", 150),
        ("peso_destete_g", 320),
        ("dias_destete", 15),
        ("peso_monta_g", 950),
        ("ojos", "Negro"),
    ):
        _revisar(lab, cuy_id, campo, valor)

    result = lab["client"].post(url, json={}, headers=lab["headers"])
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["estado_evaluacion"] == "DEFINITIVA"
    assert body["clase"] == "ELITE"
    assert _estado(lab, cuy_id)["clase"] == "ELITE"
    assert _alertas(lab, cuy_id) == []


def test_reintento_identico_y_clase_repetida_sin_version_nueva(lab):
    cuy_id = _cuy(lab)
    _cuatro_partos(lab, cuy_id)
    _evaluar(lab, cuy_id)
    version = _estado(lab, cuy_id)["server_version"]
    categoria_version = _estado(lab, cuy_id)["categoria_version"]

    again = _evaluar(lab, cuy_id).json()
    assert again["categoria_cambiada"] is False
    assert again["derivado_actualizado"] is False
    assert _estado(lab, cuy_id)["server_version"] == version
    assert _estado(lab, cuy_id)["categoria_version"] == categoria_version
    assert len(_alertas(lab, cuy_id)) == 1


def test_evaluacion_obsoleta_no_sobrescribe(lab):
    cuy_id = _cuy(lab)
    _cuatro_partos(lab, cuy_id)
    assert _evaluar(lab, cuy_id).status_code == 200
    stale = _evaluar(lab, cuy_id, base_version=0)
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "EVALUACION_OBSOLETA"
    assert _estado(lab, cuy_id)["clase"] == "DESCARTE"


def test_rollback_si_falla_la_publicacion(lab, monkeypatch):
    cuy_id = _cuy(lab)
    _cuatro_partos(lab, cuy_id)

    def _boom(*args, **kwargs):
        raise service.PublicacionError("VERSION_OBSOLETA", "fallo inyectado")

    monkeypatch.setattr(service, "publicar_cambios", _boom)
    response = _evaluar(lab, cuy_id)
    assert response.status_code == 409
    assert _estado(lab, cuy_id)["clase"] is None
    assert _alertas(lab, cuy_id) == []


def test_concurrencia_crea_una_sola_alerta(lab):
    cuy_id = _cuy(lab)
    _cuatro_partos(lab, cuy_id)
    errors: list[Exception] = []

    def run():
        try:
            service.evaluate_reproductora(
                lab["scope"], cuy_id, abortos=None, peso_monta_g=None,
                base_version=None, base_partos_version=None,
            )
        except Exception as error:  # pragma: no cover
            errors.append(error)

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: run(), range(2)))
    assert errors == []
    assert len(_alertas(lab, cuy_id)) == 1


def test_viewer_no_puede_evaluar_ni_revisar(lab, monkeypatch):
    from backend.app.repositories import auth as auth_repo
    from backend.app.services import auth as auth_service

    monkeypatch.setenv("CUYIELITE_AUTH_MODE", "pilot")
    monkeypatch.setenv("CUYIELITE_AUTH_JWT_SECRET", "synthetic-pilot-auth-key-never-production-0123456789")
    username = f"viewer-{uuid.uuid4().hex[:8]}"
    auth_repo.create_user(username, auth_service.hash_password("consulta-2026"), "viewer", lab["scope"], False)
    login = lab["client"].post(
        "/auth/login",
        json={"username": username, "password": "consulta-2026", "device_id": str(uuid.uuid4())},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    cuy_id = _cuy(lab)

    assert lab["client"].get(f"/evaluaciones/reproductoras/{cuy_id}", headers=headers).status_code == 200
    assert lab["client"].post(
        f"/evaluaciones/reproductoras/{cuy_id}", json={"abortos": 0}, headers=headers
    ).status_code == 403
    assert lab["client"].post(
        f"/evaluaciones/{cuy_id}/evidencias/revision",
        json={"campo": "abortos", "decision": "REVISADA"},
        headers=headers,
    ).status_code == 403
