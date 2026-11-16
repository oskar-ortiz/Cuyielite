"""Revisión acotada de alertas creadas por la causa propuesta (dry-run/apply)."""

from __future__ import annotations

import os
import uuid

import psycopg
import pytest

from backend.app import alertas_cli
from backend.app.repositories import evaluation as repo
from backend.app.repositories import sync as sync_repo


def _url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL aislada")
    return url


@pytest.fixture
def scope_env(monkeypatch):
    url = _url()
    monkeypatch.setenv("DATABASE_URL", url)
    scope = sync_repo.create_scope(f"alertas-{uuid.uuid4()}")
    yield {"url": url, "scope": scope}
    with psycopg.connect(url) as conn:
        conn.execute("DELETE FROM sync_derived_changes WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM alertas WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM cuyes WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM auth_audit WHERE scope_id=%s", (scope,))
        conn.execute("DELETE FROM sync_scopes WHERE id=%s", (scope,))


def _cuy(url, scope) -> uuid.UUID:
    cuy_id = uuid.uuid4()
    with psycopg.connect(url) as conn:
        conn.execute(
            "INSERT INTO cuyes (id, codigo_identificacion, sexo, estado, scope_id, server_version) "
            "VALUES (%s, %s, 'H', 'ACTIVO', %s, 0)",
            (cuy_id, f"ALR-{cuy_id.hex[:8]}", scope),
        )
        conn.commit()
    return cuy_id


def _alerta(url, scope, cuy_id, regla):
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO alertas (cuy_id, scope_id, tipo_alerta, regla_id, motivo, estado, "
                "causa_tipo, reglas_version) "
                "VALUES (%s, %s, 'DESCARTE_REPRODUCTORA', %s, 'motivo', 'activa', "
                "'HISTORIA_REPRODUCTIVA', 'v1') RETURNING id",
                (cuy_id, scope, regla),
            )
            alerta_id = cur.fetchone()[0]
        conn.commit()
    return alerta_id


def _estado(url, alerta_id):
    with psycopg.connect(url) as conn:
        return conn.execute(
            "SELECT estado, closed_reason FROM alertas WHERE id=%s", (alerta_id,)
        ).fetchone()


def test_dry_run_no_modifica(scope_env, capsys):
    cuy = _cuy(scope_env["url"], scope_env["scope"])
    propuesta = _alerta(scope_env["url"], scope_env["scope"], cuy, "abortos_repetidos_descarte")
    confirmada = _alerta(scope_env["url"], scope_env["scope"], cuy, "partos_reproductora_descarte")

    assert alertas_cli.main(["--scope", str(scope_env["scope"])]) == 0
    salida = capsys.readouterr().out
    assert "Dry-run" in salida
    assert str(propuesta) in salida
    assert _estado(scope_env["url"], propuesta) == ("activa", None)
    assert _estado(scope_env["url"], confirmada) == ("activa", None)


def test_apply_cierra_solo_la_propuesta_y_audita(scope_env, capsys):
    cuy = _cuy(scope_env["url"], scope_env["scope"])
    propuesta = _alerta(scope_env["url"], scope_env["scope"], cuy, "abortos_repetidos_descarte")
    confirmada = _alerta(scope_env["url"], scope_env["scope"], cuy, "partos_reproductora_descarte")

    assert (
        alertas_cli.main(
            ["--scope", str(scope_env["scope"]), "--apply", "--responsable", "Oskar Ortiz"]
        )
        == 0
    )
    assert _estado(scope_env["url"], propuesta) == ("obsoleta", "CAUSA_PROPUESTA_NO_OFICIAL")
    assert _estado(scope_env["url"], confirmada) == ("activa", None)

    with psycopg.connect(scope_env["url"]) as conn:
        audit = conn.execute(
            "SELECT detail FROM auth_audit WHERE event='alerta_propuesta_obsoleta' AND scope_id=%s",
            (scope_env["scope"],),
        ).fetchall()
        derived = conn.execute(
            "SELECT count(*) FROM sync_derived_changes WHERE scope_id=%s AND entity='alerta'",
            (scope_env["scope"],),
        ).fetchone()[0]
    assert len(audit) == 1
    assert "Oskar Ortiz" in str(audit[0][0])
    assert derived == 1


def test_apply_es_idempotente_y_exige_responsable(scope_env):
    cuy = _cuy(scope_env["url"], scope_env["scope"])
    propuesta = _alerta(scope_env["url"], scope_env["scope"], cuy, "abortos_repetidos_descarte")

    assert alertas_cli.main(["--scope", str(scope_env["scope"]), "--apply"]) == 2
    assert _estado(scope_env["url"], propuesta) == ("activa", None)

    args = ["--scope", str(scope_env["scope"]), "--apply", "--responsable", "Revisor"]
    assert alertas_cli.main(args) == 0
    assert alertas_cli.main(args) == 0
    with psycopg.connect(scope_env["url"]) as conn:
        assert conn.execute(
            "SELECT count(*) FROM auth_audit WHERE event='alerta_propuesta_obsoleta' AND scope_id=%s",
            (scope_env["scope"],),
        ).fetchone()[0] == 1
