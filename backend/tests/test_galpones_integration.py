"""Pruebas de integración contra PostgreSQL real."""

import os
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest

DDL_DIR = Path(__file__).resolve().parents[2] / "db" / "ddl" / "central"


import urllib.parse


def _validate_test_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname
    db_name = parsed.path.lstrip("/")
    if host not in ("localhost", "127.0.0.1"):
        raise ValueError(
            f"Host no permitido para base de pruebas: {host}. "
            "Solo se permite localhost o 127.0.0.1."
        )
    if db_name != "cuyielite_test":
        raise ValueError(
            f"Base no permitida para pruebas: {db_name}. "
            "Solo se permite cuyielite_test."
        )


def _require_test_db():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL no configurada")
    _validate_test_url(url)
    return url


@pytest.fixture
def test_db():
    url = _require_test_db()
    prev_url = os.environ.get("DATABASE_URL")
    conn = psycopg.connect(url, autocommit=True)
    try:
        # Aplicar DDL solo si las tablas no existen
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = 'galpones'")
            exists = cur.fetchone() is not None
        if not exists:
            for sql_file in sorted(DDL_DIR.glob("*.sql")):
                with open(sql_file) as f:
                    conn.execute(f.read())

        g1 = uuid4()
        g2 = uuid4()
        g_deleted = uuid4()
        p1 = uuid4()
        p2 = uuid4()
        p_deleted = uuid4()

        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, deleted_at) VALUES (%s, %s, %s, now(), now(), NULL)",
                (g1, "Bravo", "Lote B"),
            )
            cur.execute(
                "INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, deleted_at) VALUES (%s, %s, %s, now(), now(), NULL)",
                (g2, "Alfa", None),
            )
            cur.execute(
                "INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, deleted_at) VALUES (%s, %s, %s, now(), now(), now())",
                (g_deleted, "Eliminado", "Lote X"),
            )
            cur.execute(
                "INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, deleted_at) VALUES (%s, %s, %s, %s, %s, now(), now(), NULL)",
                (p1, g1, "P-B", "engorde", 50),
            )
            cur.execute(
                "INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, deleted_at) VALUES (%s, %s, %s, %s, %s, now(), now(), NULL)",
                (p2, g1, "P-A", "cria", 30),
            )
            cur.execute(
                "INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, deleted_at) VALUES (%s, %s, %s, %s, %s, now(), now(), now())",
                (p_deleted, g1, "P-ELIM", "cria", 10),
            )
        conn.commit()

        os.environ["DATABASE_URL"] = url
        yield {
            "g1": g1, "g2": g2, "g_deleted": g_deleted,
            "p1": p1, "p2": p2, "p_deleted": p_deleted,
        }
    finally:
        cleanup_error = None
        try:
            try:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM pozas WHERE id IN (%s, %s, %s)", (p1, p2, p_deleted))
                    cur.execute("DELETE FROM galpones WHERE id IN (%s, %s, %s)", (g1, g2, g_deleted))
                conn.commit()
            except Exception as exc:
                cleanup_error = RuntimeError(f"Teardown de prueba falló: {exc}")
        finally:
            try:
                conn.close()
            except Exception:
                pass
            if prev_url is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = prev_url
        if cleanup_error is not None:
            raise cleanup_error


@pytest.fixture
def client(test_db):
    from fastapi.testclient import TestClient
    from backend.app.main import app
    return TestClient(app)


def test_list_galpones_orden(client, test_db):
    r = client.get("/galpones")
    assert r.status_code == 200
    nombres = [i["nombre"] for i in r.json()["items"]]
    assert nombres == ["Alfa", "Bravo"]


def test_list_galpones_ubicacion_null(client, test_db):
    r = client.get("/galpones")
    alfa = [i for i in r.json()["items"] if i["nombre"] == "Alfa"][0]
    assert alfa["ubicacion"] is None


def test_list_galpones_excluye_eliminados(client, test_db):
    r = client.get("/galpones")
    nombres = [i["nombre"] for i in r.json()["items"]]
    assert "Eliminado" not in nombres


def test_list_pozas_orden(client, test_db):
    g1 = test_db["g1"]
    r = client.get(f"/galpones/{g1}/pozas")
    assert r.status_code == 200
    codigos = [i["codigo"] for i in r.json()["items"]]
    assert codigos == ["P-A", "P-B"]


def test_list_pozas_excluye_eliminados(client, test_db):
    g1 = test_db["g1"]
    r = client.get(f"/galpones/{g1}/pozas")
    codigos = [i["codigo"] for i in r.json()["items"]]
    assert "P-ELIM" not in codigos


def test_list_pozas_galpon_inexistente(client, test_db):
    from uuid import uuid4
    r = client.get(f"/galpones/{uuid4()}/pozas")
    assert r.status_code == 404


def test_list_pozas_capacidad(client, test_db):
    g1 = test_db["g1"]
    r = client.get(f"/galpones/{g1}/pozas")
    p = [i for i in r.json()["items"] if i["codigo"] == "P-A"][0]
    assert p["capacidad_maxima"] == 30


def test_paginacion(client, test_db):
    r = client.get("/galpones?limit=1&offset=0")
    assert r.status_code == 200
    assert len(r.json()["items"]) == 1
    r2 = client.get("/galpones?limit=1&offset=1")
    assert len(r2.json()["items"]) == 1


def test_validate_test_url_rechaza_base_remota():
    import pytest
    from backend.tests.test_galpones_integration import _validate_test_url
    with pytest.raises(ValueError, match="Base no permitida"):
        _validate_test_url("postgresql://u:p@localhost:5432/otra_base")


def test_validate_test_url_rechaza_host_remoto():
    import pytest
    from backend.tests.test_galpones_integration import _validate_test_url
    with pytest.raises(ValueError, match="Host no permitido"):
        _validate_test_url("postgresql://u:p@192.168.1.10:5432/cuyielite_test")