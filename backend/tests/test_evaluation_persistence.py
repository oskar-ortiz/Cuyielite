"""Persistencia de evaluación definitiva y alertas de descarte (0007)."""

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
from backend.app.services import publication as publication_service


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

    scope_id = sync_repo.create_scope(f"eval-{uuid.uuid4()}")
    token = secrets.token_urlsafe(32)
    sync_repo.register_device(scope_id, __import__("hashlib").sha256(token.encode()).hexdigest())
    headers = {"Authorization": f"Bearer {token}"}

    client = TestClient(app)
    yield {"client": client, "scope": scope_id, "headers": headers, "url": url}

    with psycopg.connect(url) as conn:
        conn.execute("DELETE FROM sync_derived_changes WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM sync_changes WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM auth_sessions WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM auth_audit WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM alertas WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM partos WHERE scope_id=%s", (scope_id,))
        conn.execute("UPDATE cuyes SET categoria_ml=NULL WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM cuyes WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM app_users WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM sync_devices WHERE scope_id=%s", (scope_id,))
        conn.execute("DELETE FROM sync_scopes WHERE id=%s", (scope_id,))


def _cuy(lab, *, sexo: str = "H", estado: str = "ACTIVO") -> uuid.UUID:
    cuy_id = uuid.uuid4()
    with psycopg.connect(lab["url"]) as conn:
        conn.execute(
            "INSERT INTO cuyes (id, codigo_identificacion, sexo, estado, scope_id, server_version) "
            "VALUES (%s, %s, %s, %s, %s, 0)",
            (cuy_id, f"SYN-{cuy_id.hex[:8]}", sexo, estado, lab["scope"]),
        )
        conn.commit()
    return cuy_id


def _parto(lab, cuy_id, *, numero: int | None, fecha: date | None = date(2026, 1, 1)) -> uuid.UUID:
    parto_id = uuid.uuid4()
    with psycopg.connect(lab["url"]) as conn:
        conn.execute(
            "INSERT INTO partos (id, madre_id, fecha_parto, numero_parto, nacidos_vivos, "
            "nacidos_muertos, tamano_camada_nacida, scope_id, server_version) "
            "VALUES (%s, %s, %s, %s, 3, 0, 3, %s, 0)",
            (parto_id, cuy_id, fecha, numero, lab["scope"]),
        )
        conn.commit()
    return parto_id


def _evaluate(lab, cuy_id, **body):
    return lab["client"].post(
        f"/evaluaciones/reproductoras/{cuy_id}", json=body, headers=lab["headers"]
    )


def _category(lab, cuy_id) -> dict:
    with psycopg.connect(lab["url"]) as conn:
        row = conn.execute(
            "SELECT categoria_ml, categoria_estado, categoria_motivos, categoria_server_version, "
            "server_version, categoria_procedencia FROM cuyes WHERE id=%s",
            (cuy_id,),
        ).fetchone()
    return {
        "clase": row[0],
        "estado": row[1],
        "motivos": row[2],
        "categoria_version": row[3],
        "server_version": row[4],
        "procedencia": row[5],
    }


def _alerts(lab, cuy_id) -> list[dict]:
    with psycopg.connect(lab["url"]) as conn:
        rows = conn.execute(
            "SELECT id, regla_id, estado, causa_tipo, causa_id, causa_fecha, fecha_limite, motivo "
            "FROM alertas WHERE cuy_id=%s ORDER BY created_at",
            (cuy_id,),
        ).fetchall()
    return [
        {
            "id": row[0],
            "regla_id": row[1],
            "estado": row[2],
            "causa_tipo": row[3],
            "causa_id": row[4],
            "causa_fecha": row[5],
            "fecha_limite": row[6],
            "motivo": row[7],
        }
        for row in rows
    ]


def _derived(lab) -> list[dict]:
    with psycopg.connect(lab["url"]) as conn:
        rows = conn.execute(
            "SELECT entity, record_id, record_version FROM sync_derived_changes "
            "WHERE scope_id=%s ORDER BY sequence",
            (lab["scope"],),
        ).fetchall()
    return [{"entity": row[0], "record_id": row[1], "version": row[2]} for row in rows]


def test_faltantes_no_persisten_ni_crean_alerta(lab):
    cuy_id = _cuy(lab)
    response = _evaluate(lab, cuy_id)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["estado_evaluacion"] == "DATOS_INSUFICIENTES"
    assert body["clase"] is None
    assert body["clase_informativa"] == "NORMAL"
    assert "abortos" in body["campos_faltantes"]
    assert body["categoria_persistida"] is False

    stored = _category(lab, cuy_id)
    assert stored["clase"] is None
    assert stored["server_version"] == 0
    assert _alerts(lab, cuy_id) == []
    assert _derived(lab) == []


def test_macho_no_aplica_no_persiste(lab):
    cuy_id = _cuy(lab, sexo="M")
    response = _evaluate(lab, cuy_id, abortos=0)
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "NO_APLICA"
    assert _category(lab, cuy_id)["clase"] is None


def test_definitiva_normal_persiste_y_publica(lab):
    cuy_id = _cuy(lab)
    _parto(lab, cuy_id, numero=1)
    response = _evaluate(lab, cuy_id, abortos=0, peso_monta_g=950)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["estado_evaluacion"] == "DEFINITIVA"
    assert body["clase"] == "NORMAL"
    assert body["categoria_cambiada"] is True
    assert body["publicado"] is True
    assert body["alertas"] == []

    stored = _category(lab, cuy_id)
    assert stored["clase"] == "NORMAL"
    assert stored["estado"] == "DEFINITIVA"
    assert stored["server_version"] == 1
    assert stored["motivos"]
    assert stored["procedencia"]["fuente"] == "CENTRAL"
    assert stored["procedencia"]["partos"]["total"] == 1
    assert stored["procedencia"]["declarados"]["abortos"] == 0

    assert [item["entity"] for item in _derived(lab)] == ["categoria"]
    assert _alerts(lab, cuy_id) == []


def test_descarte_por_cuarto_parto_crea_alerta_con_fecha_limite(lab):
    cuy_id = _cuy(lab)
    for numero in (1, 2, 3):
        _parto(lab, cuy_id, numero=numero, fecha=date(2025, 1, numero))
    fourth = _parto(lab, cuy_id, numero=4, fecha=date(2026, 1, 10))

    response = _evaluate(lab, cuy_id, abortos=0, peso_monta_g=980)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["clase"] == "DESCARTE"
    assert len(body["alertas"]) == 1

    alert = _alerts(lab, cuy_id)[0]
    assert alert["regla_id"] == "partos_reproductora_descarte"
    assert alert["estado"] == "activa"
    assert alert["causa_tipo"] == "PARTO"
    assert alert["causa_id"] == fourth
    assert alert["causa_fecha"] == date(2026, 1, 10)
    assert alert["fecha_limite"] == date(2026, 1, 30)

    stored = _category(lab, cuy_id)
    assert stored["clase"] == "DESCARTE"
    assert stored["server_version"] == 1


def test_misma_clase_no_crea_version_ni_derivado_nuevo(lab):
    cuy_id = _cuy(lab)
    _parto(lab, cuy_id, numero=1)
    first = _evaluate(lab, cuy_id, abortos=0).json()
    assert first["categoria_cambiada"] is True
    derived_after_first = len(_derived(lab))

    second = _evaluate(lab, cuy_id, abortos=0)
    assert second.status_code == 200, second.text
    body = second.json()
    assert body["categoria_cambiada"] is False
    assert body["publicado"] is False
    assert body["derivado_actualizado"] is False

    stored = _category(lab, cuy_id)
    assert stored["server_version"] == 1
    assert stored["categoria_version"] == 1
    assert len(_derived(lab)) == derived_after_first


def test_clase_igual_conserva_alerta_y_no_crea_version(lab):
    """Con las reglas actuales el ciclo completo corta la evaluación de abortos:
    una segunda causa no es alcanzable, pero la alerta debe seguir siendo única."""
    cuy_id = _cuy(lab)
    for numero in (1, 2, 3, 4):
        _parto(lab, cuy_id, numero=numero, fecha=date(2025, 12, numero))
    first = _evaluate(lab, cuy_id, abortos=0).json()
    assert first["clase"] == "DESCARTE"
    assert len(_alerts(lab, cuy_id)) == 1
    version_after_first = _category(lab, cuy_id)["server_version"]

    second = _evaluate(lab, cuy_id, abortos=2)
    assert second.status_code == 200, second.text
    body = second.json()
    assert body["clase"] == "DESCARTE"
    assert body["categoria_cambiada"] is False
    assert len(body["alertas"]) == 1
    assert _alerts(lab, cuy_id)[0]["estado"] == "activa"
    assert _category(lab, cuy_id)["server_version"] == version_after_first


def test_mapeo_de_motivos_a_causas():
    """Los dos motivos de DESCARTE de Diery tienen identidad estable."""
    causes, unknown = service._causes(
        motivos=["ciclo completo", "problema repetido (se dejó un parto más)"],
        partos={"cuarto": None, "cuarto_ambiguo": False},
    )
    assert unknown == []
    assert [item["regla_id"] for item in causes] == [
        "partos_reproductora_descarte",
        "abortos_repetidos_descarte",
    ]
    assert causes[0]["causa_tipo"] == "HISTORIA_REPRODUCTIVA"
    assert causes[0]["fecha_limite"] is None

    causes, unknown = service._causes(motivos=["motivo inventado"], partos={})
    assert unknown == ["motivo inventado"]
    assert causes == []


def test_causa_invalidada_cierra_alerta_con_historial(lab):
    cuy_id = _cuy(lab)
    for numero in (1, 2, 3, 4):
        _parto(lab, cuy_id, numero=numero, fecha=date(2025, 11, numero))
    _evaluate(lab, cuy_id, abortos=0)
    original = _alerts(lab, cuy_id)[0]
    assert original["estado"] == "activa"

    with psycopg.connect(lab["url"]) as conn:
        conn.execute("UPDATE partos SET numero_parto=NULL WHERE id=%s", (original["causa_id"],))
        conn.commit()

    response = _evaluate(lab, cuy_id, abortos=0)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["clase"] == "DESCARTE"
    assert body["alertas_cerradas"] == 1

    alerts = _alerts(lab, cuy_id)
    closed = [item for item in alerts if item["id"] == original["id"]][0]
    assert closed["estado"] == "obsoleta"
    active = [item for item in alerts if item["estado"] == "activa"]
    assert len(active) == 1
    assert active[0]["causa_tipo"] == "HISTORIA_REPRODUCTIVA"
    assert active[0]["fecha_limite"] is None

    versions = [(item["entity"], int(item["version"])) for item in _derived(lab)]
    assert ("alerta", 2) in versions


def test_evaluacion_obsoleta_no_sobrescribe(lab):
    cuy_id = _cuy(lab)
    _parto(lab, cuy_id, numero=1)
    current = lab["client"].get(f"/evaluaciones/reproductoras/{cuy_id}", headers=lab["headers"]).json()
    _evaluate(lab, cuy_id, abortos=0, base_version=current["base_version"])

    stale = _evaluate(lab, cuy_id, abortos=0, base_version=0)
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "EVALUACION_OBSOLETA"
    assert _category(lab, cuy_id)["server_version"] == 1


def test_reintento_identico_no_duplica_alerta(lab):
    cuy_id = _cuy(lab)
    for numero in (1, 2, 3, 4):
        _parto(lab, cuy_id, numero=numero)
    _evaluate(lab, cuy_id, abortos=0)
    _evaluate(lab, cuy_id, abortos=0)
    _evaluate(lab, cuy_id, abortos=0)

    alerts = _alerts(lab, cuy_id)
    assert len(alerts) == 1
    assert len([item for item in _derived(lab) if item["entity"] == "alerta"]) == 1
    assert _category(lab, cuy_id)["server_version"] == 1


def test_rollback_total_si_falla_la_publicacion(lab, monkeypatch):
    cuy_id = _cuy(lab)
    for numero in (1, 2, 3, 4):
        _parto(lab, cuy_id, numero=numero)

    def _boom(*args, **kwargs):
        raise publication_service.PublicacionError("VERSION_OBSOLETA", "fallo inyectado")

    monkeypatch.setattr(service, "publicar_cambios", _boom)
    response = _evaluate(lab, cuy_id, abortos=0)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "VERSION_OBSOLETA"

    stored = _category(lab, cuy_id)
    assert stored["clase"] is None
    assert stored["server_version"] == 0
    assert _alerts(lab, cuy_id) == []
    assert _derived(lab) == []


def test_dos_evaluaciones_concurrentes_crean_una_alerta(lab):
    cuy_id = _cuy(lab)
    for numero in (1, 2, 3, 4):
        _parto(lab, cuy_id, numero=numero)

    errors: list[Exception] = []

    def run() -> None:
        try:
            service.evaluate_and_persist(
                lab["scope"],
                cuy_id,
                abortos=0,
                peso_monta_g=None,
                base_version=None,
                base_partos_version=None,
            )
        except Exception as error:  # pragma: no cover - se reporta abajo
            errors.append(error)

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda _: run(), range(2)))

    assert errors == []
    assert len(_alerts(lab, cuy_id)) == 1
    assert len([item for item in _derived(lab) if item["entity"] == "alerta"]) == 1


def test_viewer_no_puede_evaluar(lab, monkeypatch):
    from backend.app.repositories import auth as auth_repo
    from backend.app.services import auth as auth_service

    monkeypatch.setenv("CUYIELITE_AUTH_MODE", "pilot")
    monkeypatch.setenv("CUYIELITE_AUTH_JWT_SECRET", "synthetic-pilot-auth-key-never-production-0123456789")
    username = f"viewer-{uuid.uuid4().hex[:8]}"
    auth_repo.create_user(username, auth_service.hash_password("consulta-2026"), "viewer", lab["scope"], False)
    device_id = uuid.uuid4()
    login = lab["client"].post(
        "/auth/login",
        json={"username": username, "password": "consulta-2026", "device_id": str(device_id)},
    )
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    cuy_id = _cuy(lab)

    read = lab["client"].get(f"/evaluaciones/reproductoras/{cuy_id}", headers=headers)
    assert read.status_code == 200

    write = lab["client"].post(
        f"/evaluaciones/reproductoras/{cuy_id}", json={"abortos": 0}, headers=headers
    )
    assert write.status_code == 403
    assert write.json()["detail"] == "ROL_SIN_ESCRITURA"
