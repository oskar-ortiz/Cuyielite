"""Synthetic integration tests for atomic Lope batch promotion."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import date
from decimal import Decimal
import json
from pathlib import Path
import os
import urllib.parse
import uuid

import psycopg
import pytest

from backend.app.services.publication import PUBLISHABLE_FIELDS
from tools.lope_import.promote import (
    PromocionError,
    publicar_con_d1,
    promote_batch,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
DDL_DIR = REPO_ROOT / "db" / "ddl" / "central"
MIGRATIONS_DIR = Path(
    os.environ.get(
        "LOPE_TEST_MIGRATIONS_DIR",
        REPO_ROOT / "db" / "migrations" / "central",
    )
)


def _base_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("TEST_DATABASE_URL debe apuntar a una base PostgreSQL desechable")
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname not in {"localhost", "127.0.0.1"}:
        pytest.fail("TEST_DATABASE_URL debe apuntar a localhost")
    if parsed.path.lstrip("/") != "cuyielite_test":
        pytest.fail("TEST_DATABASE_URL debe usar la base administrativa cuyielite_test")
    return url


def _admin_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    return urllib.parse.urlunparse(parsed._replace(path="/postgres"))


@pytest.fixture(scope="module")
def fresh_db():
    base_url = _base_url()
    database_name = f"cuyielite_lope_promote_{uuid.uuid4().hex[:10]}"
    with psycopg.connect(_admin_url(base_url), autocommit=True) as admin:
        admin.execute(f'CREATE DATABASE "{database_name}"')

    parsed = urllib.parse.urlparse(base_url)
    database_url = urllib.parse.urlunparse(
        parsed._replace(path=f"/{database_name}")
    )
    try:
        with psycopg.connect(database_url, autocommit=True) as bootstrap:
            for sql_file in sorted(DDL_DIR.glob("*.sql")):
                bootstrap.execute(sql_file.read_text(encoding="utf-8"))
        from tools.db_migrate.runner import apply_migrations

        apply_migrations(database_url, directory=MIGRATIONS_DIR)
        yield database_url
    finally:
        with psycopg.connect(_admin_url(base_url), autocommit=True) as admin:
            admin.execute(f'DROP DATABASE IF EXISTS "{database_name}" WITH (FORCE)')


class FakePublicador:
    def __init__(self, *, fail: bool = False):
        self.calls = 0
        self.scope_ids = []
        self.fail = fail

    def __call__(
        self,
        conn,
        scope_id,
        registros: Sequence[Mapping[str, object]],
    ):
        self.calls += 1
        self.scope_ids.append(scope_id)
        assert not conn.autocommit
        assert conn.info.transaction_status.name == "INTRANS"
        for record in registros:
            entity = record["entity"]
            fields = PUBLISHABLE_FIELDS[entity]
            actual = conn.execute(
                f"SELECT {', '.join(fields)} FROM {entity} WHERE id = %s",
                (record["id"],),
            ).fetchone()
            assert actual is not None
            assert tuple(record["after"][field] for field in fields) == actual
        conn.execute(
            "UPDATE sync_scopes SET last_sequence = last_sequence + 1 WHERE id = %s",
            (scope_id,),
        )
        if self.fail:
            raise RuntimeError("publicador sintético falló")
        results = []
        for record in registros:
            table = record["entity"]
            conn.execute(
                f"UPDATE {table} SET server_version = server_version + 1 WHERE id = %s",
                (record["id"],),
            )
            results.append({"changed": True})
        return results


def _new_batch(conn):
    scope_id = uuid.uuid4()
    galpon_id = uuid.uuid4()
    poza_id = uuid.uuid4()
    batch_id = uuid.uuid4()
    source_hash = uuid.uuid4().hex
    conn.execute(
        "INSERT INTO sync_scopes (id, name) VALUES (%s, %s)",
        (scope_id, "synthetic"),
    )
    conn.execute(
        "INSERT INTO galpones (id, scope_id, nombre) VALUES (%s, %s, %s)",
        (galpon_id, scope_id, "Galpón sintético"),
    )
    conn.execute(
        "INSERT INTO pozas (id, scope_id, galpon_id, codigo, tipo, capacidad_maxima) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (poza_id, scope_id, galpon_id, "P-TEST", "cria", 5),
    )
    conn.execute(
        "INSERT INTO importacion_lotes "
        "(id, huella_archivo, parser_version, mapeo_version) "
        "VALUES (%s, %s, %s, %s)",
        (batch_id, source_hash, "synthetic", "synthetic"),
    )
    madre_id, cuy_id, parto_id, evento_id, pesaje_id, vinculo_id = (
        uuid.uuid4() for _ in range(6)
    )

    def add_record(entity, record_id, role, source_row, values):
        origin_id = uuid.uuid4()
        correspondence_id = uuid.uuid4()
        conn.execute(
            "INSERT INTO importacion_origenes "
            "(id, huella_archivo, origen_hoja, origen_celda, origen_fila, origen_rol, entidad_tipo) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (
                origin_id,
                source_hash,
                "Synthetic",
                f"A{source_row}",
                source_row,
                role,
                entity,
            ),
        )
        conn.execute(
            "INSERT INTO importacion_correspondencias "
            "(id, origen_id, lote_id, estado, parser_version, mapeo_version) "
            "VALUES (%s, %s, %s, 'ACEPTADO', 'synthetic', 'synthetic')",
            (correspondence_id, origin_id, batch_id),
        )
        after = {field: None for field in PUBLISHABLE_FIELDS[entity]}
        after.update(values)
        return {
            "correspondencia_id": correspondence_id,
            "entity": entity,
            "id": record_id,
            "expected_version": None,
            "before": None,
            "after": after,
        }

    records = [
        add_record(
            "pesajes",
            pesaje_id,
            "PESAJE_CRIA",
            6,
            {
                "cuy_id": cuy_id,
                "fecha_pesaje": date(2026, 2, 1),
                "peso_gramos": Decimal("123.45"),
                "etapa": "DESTETE",
                "evento_id": evento_id,
            },
        ),
        add_record(
            "eventos",
            evento_id,
            "EVENTO",
            5,
            {
                "cuy_id": cuy_id,
                "tipo": "DESTETE",
                "fecha": date(2026, 2, 1),
            },
        ),
        add_record(
            "partos",
            parto_id,
            "PARTO",
            4,
            {
                "madre_id": madre_id,
                "fecha_parto": date(2026, 1, 1),
                "numero_parto": 1,
                "nacidos_vivos": 1,
                "nacidos_muertos": 0,
                "tamano_camada_nacida": 1,
            },
        ),
        add_record(
            "parto_crias",
            vinculo_id,
            "CRIA_DE_PARTO",
            3,
            {
                "parto_id": parto_id,
                "cuy_id": cuy_id,
                "rol": "CRIA",
            },
        ),
        add_record(
            "cuyes",
            cuy_id,
            "ANIMAL",
            3,
            {
                "poza_id": poza_id,
                "codigo_identificacion": "SYN-CRIA",
                "sexo": "H",
                "madre_id": madre_id,
            },
        ),
        add_record(
            "cuyes",
            madre_id,
            "ANIMAL",
            2,
            {
                "poza_id": poza_id,
                "codigo_identificacion": "SYN-MADRE",
                "sexo": "H",
            },
        ),
    ]
    return scope_id, batch_id, records


def test_promocion_feliz_escribe_y_publica_la_fila_final(fresh_db):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)
    publicador = FakePublicador()

    with psycopg.connect(fresh_db) as conn:
        result = promote_batch(
            conn, scope_id, batch_id, records, publicador, dry_run=False
        )
    with psycopg.connect(fresh_db) as conn:
        for record in records:
            fields = PUBLISHABLE_FIELDS[record["entity"]]
            actual = conn.execute(
                f"SELECT {', '.join(fields)} FROM {record['entity']} WHERE id = %s",
                (record["id"],),
            ).fetchone()
            assert tuple(record["after"][field] for field in fields) == actual
        assert conn.execute(
            "SELECT estado FROM importacion_lotes WHERE id = %s", (batch_id,)
        ).fetchone()[0] == "APLICADO"
        assert conn.execute(
            "SELECT count(*) FROM importacion_correspondencias "
            "WHERE lote_id = %s AND entidad_id IS NOT NULL",
            (batch_id,),
        ).fetchone()[0] == len(records)
        for record in records:
            assert conn.execute(
                f"SELECT server_version FROM {record['entity']} WHERE id = %s",
                (record["id"],),
            ).fetchone()[0] == 1
    assert result.changed is True
    assert result.changed_count == len(records)
    assert result.entity_counts == tuple(
        (
            ("cuyes", 2),
            ("eventos", 1),
            ("parto_crias", 1),
            ("partos", 1),
            ("pesajes", 1),
        )
    )
    assert publicador.calls == 1
    assert publicador.scope_ids == [scope_id]


def test_publicador_d1_real_publica_y_repetir_es_noop(fresh_db):
    with psycopg.connect(fresh_db) as conn:
        assert [
            row[0]
            for row in conn.execute(
                "SELECT id FROM schema_migrations ORDER BY id"
            ).fetchall()
        ] == [f"000{i}_{suffix}.sql" for i, suffix in (
            (1, "lope_domain"),
            (2, "sync_lab"),
            (3, "rag_e5_embeddings"),
            (4, "publicacion_dominio"),
        )]

    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)

    with psycopg.connect(fresh_db) as conn:
        first = promote_batch(
            conn, scope_id, batch_id, records, publicar_con_d1, dry_run=False
        )
    with psycopg.connect(fresh_db) as conn:
        second = promote_batch(
            conn, scope_id, batch_id, records, publicar_con_d1, dry_run=False
        )

    with psycopg.connect(fresh_db) as conn:
        for record in records:
            fields = PUBLISHABLE_FIELDS[record["entity"]]
            row = conn.execute(
                f"SELECT {', '.join(fields)}, server_version "
                f"FROM {record['entity']} WHERE id = %s",
                (record["id"],),
            ).fetchone()
            assert row is not None
            assert tuple(record["after"][field] for field in fields) == row[:-1]
            assert row[-1] == 1
        assert conn.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s", (scope_id,)
        ).fetchone()[0] == len(records)

    assert first.changed is True
    assert first.changed_count == len(records)
    assert second.changed is False
    assert second.changed_count == 0
    assert second.unchanged_count == len(records)


def test_correspondencia_publicada_exige_before_y_version_esperada(fresh_db):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)
    with psycopg.connect(fresh_db) as conn:
        promote_batch(
            conn,
            scope_id,
            batch_id,
            records,
            publicar_con_d1,
            dry_run=False,
        )

    mother = next(
        record
        for record in records
        if record["entity"] == "cuyes"
        and record["after"]["codigo_identificacion"] == "SYN-MADRE"
    )
    batch_id = uuid.uuid4()
    origin_id = uuid.uuid4()
    correspondence_id = uuid.uuid4()
    source_hash = uuid.uuid4().hex
    with psycopg.connect(fresh_db) as conn:
        conn.execute(
            "INSERT INTO importacion_lotes "
            "(id, huella_archivo, parser_version, mapeo_version) "
            "VALUES (%s, %s, %s, %s)",
            (batch_id, source_hash, "synthetic", "synthetic"),
        )
        conn.execute(
            "INSERT INTO importacion_origenes "
            "(id, huella_archivo, origen_hoja, origen_celda, origen_fila, origen_rol, entidad_tipo) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (
                origin_id,
                source_hash,
                "Synthetic",
                "A8",
                8,
                "ANIMAL_CORRECTION",
                "cuyes",
            ),
        )
        conn.execute(
            "INSERT INTO importacion_correspondencias "
            "(id, origen_id, lote_id, entidad_id, estado, parser_version, mapeo_version) "
            "VALUES (%s, %s, %s, %s, 'ACEPTADO', 'synthetic', 'synthetic')",
            (correspondence_id, origin_id, batch_id, mother["id"]),
        )

    before = dict(mother["after"])
    after = dict(before)
    after["ultimo_peso_g"] = Decimal("950.00")
    correction = {
        "correspondencia_id": correspondence_id,
        "entity": "cuyes",
        "id": mother["id"],
        "expected_version": 1,
        "before": before,
        "after": after,
    }

    with psycopg.connect(fresh_db) as conn:
        result = promote_batch(
            conn,
            scope_id,
            batch_id,
            [correction],
            publicar_con_d1,
            dry_run=False,
        )

    with psycopg.connect(fresh_db) as conn:
        row = conn.execute(
            "SELECT ultimo_peso_g, server_version FROM cuyes WHERE id = %s",
            (mother["id"],),
        ).fetchone()
        assert row == (Decimal("950.00"), 2)
    assert result.changed is True
    assert result.changed_count == 1


def test_fallo_despues_de_publicar_con_d1_revierte_todo(fresh_db):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)

    def publicar_y_fallar(conn, publisher_scope_id, publication_records):
        assert conn.info.transaction_status.name == "INTRANS"
        results = publicar_con_d1(conn, publisher_scope_id, publication_records)
        assert all(result.changed for result in results)
        assert conn.info.transaction_status.name == "INTRANS"
        raise RuntimeError("fallo sintético posterior a D1")

    with psycopg.connect(fresh_db) as conn:
        with pytest.raises(RuntimeError, match="posterior a D1"):
            promote_batch(
                conn, scope_id, batch_id, records, publicar_y_fallar, dry_run=False
            )

    with psycopg.connect(fresh_db) as conn:
        for record in records:
            assert conn.execute(
                f"SELECT count(*) FROM {record['entity']} WHERE id = %s",
                (record["id"],),
            ).fetchone()[0] == 0
        assert conn.execute(
            "SELECT estado FROM importacion_lotes WHERE id = %s", (batch_id,)
        ).fetchone()[0] == "PENDIENTE"
        assert conn.execute(
            "SELECT count(*) FROM importacion_correspondencias WHERE lote_id = %s "
            "AND entidad_id IS NOT NULL",
            (batch_id,),
        ).fetchone()[0] == 0
        assert conn.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s", (scope_id,)
        ).fetchone()[0] == 0
        assert conn.execute(
            "SELECT count(*) FROM sync_changes WHERE scope_id = %s", (scope_id,)
        ).fetchone()[0] == 0


def test_fallo_del_publicador_revierte_el_lote_completo(fresh_db):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)
    publicador = FakePublicador(fail=True)

    with psycopg.connect(fresh_db) as conn:
        with pytest.raises(RuntimeError, match="publicador sintético"):
            promote_batch(
                conn, scope_id, batch_id, records, publicador, dry_run=False
            )
    with psycopg.connect(fresh_db) as conn:
        for record in records:
            assert conn.execute(
                f"SELECT count(*) FROM {record['entity']} WHERE id = %s",
                (record["id"],),
            ).fetchone()[0] == 0
        assert conn.execute(
            "SELECT estado FROM importacion_lotes WHERE id = %s", (batch_id,)
        ).fetchone()[0] == "PENDIENTE"
        assert conn.execute(
            "SELECT entidad_id FROM importacion_correspondencias WHERE lote_id = %s",
            (batch_id,),
        ).fetchone()[0] is None
        assert conn.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s", (scope_id,)
        ).fetchone()[0] == 0


def test_segunda_ejecucion_del_lote_es_noop(fresh_db):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)
    publicador = FakePublicador()
    for _ in range(2):
        with psycopg.connect(fresh_db) as conn:
            result = promote_batch(
                conn, scope_id, batch_id, records, publicador, dry_run=False
            )
    with psycopg.connect(fresh_db) as conn:
        for record in records:
            assert conn.execute(
                f"SELECT server_version FROM {record['entity']} WHERE id = %s",
                (record["id"],),
            ).fetchone()[0] == 1
    assert publicador.calls == 1
    assert result.changed is False
    assert result.changed_count == 0
    assert result.unchanged_count == len(records)


def test_lote_aplicado_no_se_reutiliza_en_otro_ambito(fresh_db):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)
        other_scope_id = uuid.uuid4()
        conn.execute(
            "INSERT INTO sync_scopes (id, name) VALUES (%s, %s)",
            (other_scope_id, "other-synthetic"),
        )

    with psycopg.connect(fresh_db) as conn:
        promote_batch(conn, scope_id, batch_id, records, publicar_con_d1, dry_run=False)

    with psycopg.connect(fresh_db) as conn:
        with pytest.raises(PromocionError, match="no coincide"):
            promote_batch(
                conn,
                other_scope_id,
                batch_id,
                records,
                publicar_con_d1,
                dry_run=False,
            )

    with psycopg.connect(fresh_db) as conn:
        assert conn.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s",
            (scope_id,),
        ).fetchone()[0] == len(records)
        assert conn.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s",
            (other_scope_id,),
        ).fetchone()[0] == 0


def test_scope_id_del_payload_se_rechaza(fresh_db):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)
    payload_record = {**records[0], "scope_id": uuid.uuid4()}
    with psycopg.connect(fresh_db) as conn:
        with pytest.raises(PromocionError, match="scope_id"):
            promote_batch(
                conn,
                scope_id,
                batch_id,
                [payload_record],
                FakePublicador(),
                dry_run=False,
            )
    with psycopg.connect(fresh_db) as conn:
        assert conn.execute(
            "SELECT count(*) FROM pesajes WHERE id = %s", (payload_record["id"],)
        ).fetchone()[0] == 0


def test_dry_run_revierta_y_commit_rechaza_cuyielite(fresh_db, monkeypatch, capsys):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)
    with psycopg.connect(fresh_db) as conn:
        result = promote_batch(
            conn, scope_id, batch_id, records, FakePublicador(), dry_run=True
        )
    with psycopg.connect(fresh_db) as conn:
        for record in records:
            assert conn.execute(
                f"SELECT count(*) FROM {record['entity']} WHERE id = %s",
                (record["id"],),
            ).fetchone()[0] == 0
        assert conn.execute(
            "SELECT estado FROM importacion_lotes WHERE id = %s", (batch_id,)
        ).fetchone()[0] == "PENDIENTE"
    assert result.dry_run is True
    assert result.changed is True

    from tools.lope_import.promote import main

    for database_url in (
        "postgresql://localhost:5432/cuyielite",
        "postgresql://db.invalid:5432/cuyielite_test",
    ):
        monkeypatch.setenv("LOPE_TEST_DATABASE_URL", database_url)
        exit_code = main(
            [
                "--manifiesto",
                "unused.json",
                "--batch-id",
                str(batch_id),
                "--scope-id",
                str(scope_id),
                "--database-url-env",
                "LOPE_TEST_DATABASE_URL",
                "--commit",
            ]
        )
        assert exit_code == 1
        assert "PromocionError" in capsys.readouterr().err


def test_cli_dry_run_por_defecto_solo_emite_agregados(
    fresh_db, monkeypatch, capsys, tmp_path
):
    with psycopg.connect(fresh_db) as conn:
        scope_id, batch_id, records = _new_batch(conn)

    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(
        json.dumps({"records": records}, default=str),
        encoding="utf-8",
    )
    monkeypatch.setenv("LOPE_TEST_DATABASE_URL", fresh_db)
    from tools.lope_import.promote import main

    exit_code = main(
        [
            "--manifiesto",
            str(manifest_path),
            "--batch-id",
            str(batch_id),
            "--scope-id",
            str(scope_id),
            "--database-url-env",
            "LOPE_TEST_DATABASE_URL",
        ]
    )
    output = capsys.readouterr()
    assert exit_code == 0
    assert "Modo: dry-run (rollback)" in output.out
    assert f"registros: {len(records)}" in output.out
    assert output.err == ""

    private_tokens = {str(scope_id), str(batch_id), "P-TEST", "123.45"}
    for record in records:
        private_tokens.update(
            str(value)
            for value in (
                record["id"],
                record["correspondencia_id"],
                *record["after"].values(),
            )
            if isinstance(value, uuid.UUID)
        )
        for field in ("codigo_identificacion", "peso_gramos"):
            if record["after"].get(field) is not None:
                private_tokens.add(str(record["after"][field]))
    matches = [
        token
        for token in private_tokens
        if token in output.out or token in output.err
    ]
    assert matches == []

    with psycopg.connect(fresh_db) as conn:
        for record in records:
            assert conn.execute(
                f"SELECT count(*) FROM {record['entity']} WHERE id = %s",
                (record["id"],),
            ).fetchone()[0] == 0
        assert conn.execute(
            "SELECT estado FROM importacion_lotes WHERE id = %s", (batch_id,)
        ).fetchone()[0] == "PENDIENTE"
        assert conn.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s", (scope_id,)
        ).fetchone()[0] == 0
