"""Prueba integrada D1 -> D2 sobre PostgreSQL temporal aislado.

Demuestra el contrato de plataforma completo con un orquestador sintético:

1. Crear una base nueva con nombre único y aplicar bootstrap + migraciones.
2. Escribir dominio y publicar versiones con ``publicar_cambios`` en una sola
   conexión/transacción, confirmada solo por el orquestador sintético.
3. Descargar el delta con ``GET /sync/pull`` autenticado y verificar snapshots,
   versión, secuencia, UUID, referencias, cursor y borrado lógico.
4. Comprobar que un fallo antes del COMMIT exterior revierte dominio, metadatos,
   historial, contador y lote sintético.
5. Comprobar que el push v1 conserva su contrato y rechaza entidades de dominio.

No implementa el ETL de Diery: el orquestador es un arnés de prueba, no un
servicio de promoción paralelo.
"""

import hashlib
import os
from pathlib import Path
import secrets
import urllib.parse
import uuid

import psycopg
import pytest

from backend.app.services.publication import (
    PUBLISHABLE_FIELDS,
    PublicacionError,
    RegistroPublicacion,
    publicar_cambios,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DDL_DIR = REPO_ROOT / "db" / "ddl" / "central"
SIGNING_KEY = "synthetic-test-key-never-for-production-0123456789"
MAX_EXPECTED_MIGRATION = "0004_publicacion_dominio.sql"


def _base_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL de pruebas aislada")
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname not in ("localhost", "127.0.0.1"):
        pytest.fail("TEST_DATABASE_URL debe apuntar a localhost")
    return url


def _admin_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    return urllib.parse.urlunparse(parsed._replace(path="/postgres"))


def _new_database(url: str) -> tuple[str, str]:
    name = f"cuyielite_d1_d2_{uuid.uuid4().hex[:10]}"
    admin = psycopg.connect(_admin_url(url), autocommit=True)
    try:
        admin.execute(f'CREATE DATABASE "{name}"')
    finally:
        admin.close()
    parsed = urllib.parse.urlparse(url)
    db_url = urllib.parse.urlunparse(parsed._replace(path=f"/{name}"))
    return name, db_url


def _drop_database(url: str, name: str) -> None:
    admin = psycopg.connect(_admin_url(url), autocommit=True)
    try:
        admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
    finally:
        admin.close()


@pytest.fixture(scope="module")
def lab_url():
    base = _base_url()
    name, db_url = _new_database(base)
    try:
        boot = psycopg.connect(db_url, autocommit=True)
        try:
            for sql_file in sorted(DDL_DIR.glob("*.sql")):
                boot.execute(sql_file.read_text(encoding="utf-8"))
        finally:
            boot.close()

        from tools.db_migrate.runner import apply_migrations

        applied = apply_migrations(db_url)
        assert applied[:4] == [
            "0001_lope_domain.sql",
            "0002_sync_lab.sql",
            "0003_rag_e5_embeddings.sql",
            MAX_EXPECTED_MIGRATION,
        ]
        assert MAX_EXPECTED_MIGRATION in applied
        assert "0005_pesajes_check.sql" not in applied
        with psycopg.connect(db_url) as conn:
            assert conn.execute("SELECT max(id) FROM schema_migrations").fetchone()[0] == MAX_EXPECTED_MIGRATION
        yield db_url
    finally:
        _drop_database(base, name)


@pytest.fixture
def lab(lab_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", lab_url)
    monkeypatch.setenv("CUYIELITE_SYNC_LAB_ENABLED", "1")
    monkeypatch.setenv("SYNC_CURSOR_SIGNING_KEY", SIGNING_KEY)

    from fastapi.testclient import TestClient

    from backend.app.main import app

    scope_id = uuid.uuid4()
    device_id = uuid.uuid4()
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with psycopg.connect(lab_url) as conn:
        conn.execute(
            "INSERT INTO sync_scopes (id, name) VALUES (%s, %s)",
            (scope_id, f"d1d2-{scope_id}"),
        )
        conn.execute(
            "INSERT INTO sync_devices (id, scope_id, token_hash) VALUES (%s, %s, %s)",
            (device_id, scope_id, token_hash),
        )

    client = TestClient(app, headers={"Authorization": f"Bearer {token}"})
    try:
        yield {
            "url": lab_url,
            "scope": scope_id,
            "device": device_id,
            "token": token,
            "client": client,
        }
    finally:
        with psycopg.connect(lab_url) as conn:
            for table in ("sync_changes", "sync_receipts", "sync_devices"):
                conn.execute(f"DELETE FROM {table} WHERE scope_id = %s", (scope_id,))
            for table in ("parto_crias", "pesajes", "eventos", "partos", "cuyes", "pozas", "galpones"):
                conn.execute(f"DELETE FROM {table} WHERE scope_id = %s", (scope_id,))
            conn.execute("DELETE FROM sync_scopes WHERE id = %s", (scope_id,))


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


def _insert_evento(conn, scope, cuy_id):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO eventos (id, scope_id, cuy_id, tipo) VALUES (%s, %s, %s, 'DESTETE')",
        (record_id, scope, cuy_id),
    )
    return record_id


def _insert_pesaje(conn, scope, cuy_id, evento_id):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO pesajes (id, scope_id, cuy_id, peso_gramos, etapa, evento_id) "
        "VALUES (%s, %s, %s, '250.00', 'DESTETE', %s)",
        (record_id, scope, cuy_id, evento_id),
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


def _registro(entity, record_id, after, *, before=None, expected_version=None):
    return RegistroPublicacion(
        entity=entity,
        id=record_id,
        expected_version=expected_version,
        before=before,
        after=after,
    )


def test_promocion_sintetica_d1_llega_al_pull_d2(lab):
    conn = psycopg.connect(lab["url"])
    try:
        madre = _insert_cuye(conn, lab["scope"], "MADRE-INT")
        cria = _insert_cuye(conn, lab["scope"], "CRIA-INT")
        parto = _insert_parto(conn, lab["scope"], madre)
        evento = _insert_evento(conn, lab["scope"], cria)
        pesaje = _insert_pesaje(conn, lab["scope"], cria, evento)
        vinculo = _insert_parto_cria(conn, lab["scope"], parto, cria)

        pendientes = [
            ("cuyes", madre),
            ("cuyes", cria),
            ("partos", parto),
            ("eventos", evento),
            ("pesajes", pesaje),
            ("parto_crias", vinculo),
        ]
        antes = {record_id: _after(conn, entity, record_id) for entity, record_id in pendientes}
        publicados = publicar_cambios(
            conn,
            lab["scope"],
            [
                _registro(entity, record_id, antes[record_id])
                for entity, record_id in pendientes
            ],
        )
        assert [item.version for item in publicados] == [1, 1, 1, 1, 1, 1]
        assert [item.changed for item in publicados] == [True] * 6
        # Confirmacion exclusiva del orquestador sintetico.
        conn.commit()
    finally:
        conn.close()

    first = lab["client"].get("/sync/pull", params={"limit": 100})
    assert first.status_code == 200, first.text
    body = first.json()

    assert body["scope_id"] == str(lab["scope"])
    assert [item["seq"] for item in body["items"]] == ["1", "2", "3", "4", "5", "6"]
    assert [item["entity"] for item in body["items"]] == [
        "cuyes",
        "cuyes",
        "partos",
        "eventos",
        "pesajes",
        "parto_crias",
    ]
    assert [item["record"]["version"] for item in body["items"]] == ["1"] * 6
    assert [item["record"]["deleted_at"] for item in body["items"]] == [None] * 6
    assert body["has_more"] is False
    assert body["next_cursor"]

    snapshots = {item["record"]["id"]: item["record"] for item in body["items"]}
    assert set(snapshots) == {str(record_id) for _, record_id in pendientes}
    assert all(str(uuid.UUID(record_id)) == record_id for record_id in snapshots)
    assert snapshots[str(madre)]["data"]["codigo_identificacion"] == "MADRE-INT"
    assert snapshots[str(parto)]["data"]["madre_id"] == str(madre)
    assert snapshots[str(evento)]["data"]["cuy_id"] == str(cria)
    assert snapshots[str(pesaje)]["data"]["evento_id"] == str(evento)
    assert snapshots[str(vinculo)]["data"]["parto_id"] == str(parto)
    assert snapshots[str(vinculo)]["data"]["cuy_id"] == str(cria)

    # Correccion efectiva despues del checkpoint: version 2 y borrado logico.
    conn = psycopg.connect(lab["url"])
    try:
        conn.execute("UPDATE cuyes SET deleted_at = now() WHERE id = %s", (cria,))
        publicar_cambios(
            conn,
            lab["scope"],
            [_registro("cuyes", cria, _after(conn, "cuyes", cria), before=antes[cria], expected_version=1)],
        )
        conn.commit()
    finally:
        conn.close()

    second = lab["client"].get("/sync/pull", params={"cursor": body["next_cursor"]})
    assert second.status_code == 200, second.text
    delta = second.json()
    assert [item["seq"] for item in delta["items"]] == ["7"]
    assert delta["items"][0]["entity"] == "cuyes"
    assert delta["items"][0]["record"]["id"] == str(cria)
    assert delta["items"][0]["record"]["version"] == "2"
    assert delta["items"][0]["record"]["deleted_at"]

    # El checkpoint cerro el ciclo: no quedan cambios pendientes.
    empty = lab["client"].get("/sync/pull", params={"cursor": delta["next_cursor"]})
    assert empty.status_code == 200
    assert empty.json()["items"] == []


def test_fallo_antes_del_commit_exterior_revierte_todo(lab):
    conn = psycopg.connect(lab["url"])
    try:
        cuy = _insert_cuye(conn, lab["scope"], "ROLLBACK-INT")
        publicar_cambios(conn, lab["scope"], [_registro("cuyes", cuy, _after(conn, "cuyes", cuy))])
        # El orquestador sintetico falla despues de publicar y antes del COMMIT.
        try:
            raise RuntimeError("fallo simulado antes del COMMIT exterior")
        except RuntimeError:
            conn.rollback()
    finally:
        conn.close()

    with psycopg.connect(lab["url"]) as check:
        assert check.execute(
            "SELECT count(*) FROM cuyes WHERE id = %s", (cuy,)
        ).fetchone()[0] == 0
        assert check.execute(
            "SELECT count(*) FROM sync_changes WHERE scope_id = %s", (lab["scope"],)
        ).fetchone()[0] == 0
        assert check.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s", (lab["scope"],)
        ).fetchone()[0] == 0

    body = lab["client"].get("/sync/pull").json()
    assert body["items"] == []
    assert body["has_more"] is False


def test_publicacion_fallida_no_deja_lote_parcial(lab):
    conn = psycopg.connect(lab["url"])
    try:
        valido = _insert_cuye(conn, lab["scope"], "PARCIAL-OK")
        invalido = _insert_cuye(conn, lab["scope"], "PARCIAL-MAL")
        after_invalido = _after(conn, "cuyes", invalido)
        after_invalido["codigo_identificacion"] = "NO-ESCRITO"

        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(
                conn,
                lab["scope"],
                [
                    _registro("cuyes", valido, _after(conn, "cuyes", valido)),
                    _registro("cuyes", invalido, after_invalido),
                ],
            )
        assert exc.value.codigo == "FILA_FINAL_INCONSISTENTE"
        conn.rollback()
    finally:
        conn.close()

    with psycopg.connect(lab["url"]) as check:
        assert check.execute(
            "SELECT count(*) FROM cuyes WHERE scope_id = %s", (lab["scope"],)
        ).fetchone()[0] == 0
        assert check.execute(
            "SELECT count(*) FROM sync_changes WHERE scope_id = %s", (lab["scope"],)
        ).fetchone()[0] == 0
        assert check.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s", (lab["scope"],)
        ).fetchone()[0] == 0


def test_push_v1_conserva_contrato_y_rechaza_dominio(lab):
    context = lab["client"].get("/sync/context").json()
    galpon_id = str(uuid.uuid4())

    accepted = lab["client"].post(
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
                    "data": {"nombre": "G-INT", "ubicacion": None},
                }
            ],
        },
    )
    assert accepted.status_code == 200
    assert accepted.json()["results"][0]["status"] == "accepted"

    for entity in ("cuyes", "partos", "pesajes", "eventos", "parto_crias"):
        rejected = lab["client"].post(
            "/sync/push",
            json={
                "protocol_version": 1,
                "device_id": context["device_id"],
                "operations": [
                    {
                        "operation_id": str(uuid.uuid4()),
                        "entity": entity,
                        "record_id": str(uuid.uuid4()),
                        "action": "create",
                        "base_version": None,
                        "client_created_at": "2026-11-10T10:00:00.000Z",
                        "client_edited_at": "2026-11-10T10:00:00.000Z",
                        "data": {},
                    }
                ],
            },
        )
        assert rejected.status_code == 422, f"{entity}: {rejected.text}"

    pulled = lab["client"].get("/sync/pull").json()
    assert [item["entity"] for item in pulled["items"]] == ["galpon"]
    assert pulled["items"][0]["record"]["data"] == {"nombre": "G-INT", "ubicacion": None}
