"""Pruebas de integración D1: publicación sobre conexión prestada."""

import os
from pathlib import Path
import threading
import urllib.parse
import uuid

import psycopg
import pytest
from psycopg.pq import TransactionStatus

from backend.app.services.publication import (
    PUBLISHABLE_FIELDS,
    PublicacionError,
    RegistroPublicacion,
    publicar_cambios,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
DDL_DIR = REPO_ROOT / "db" / "ddl" / "central"


def _test_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL no configurada")
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname not in ("localhost", "127.0.0.1") or parsed.path.lstrip("/") != "cuyielite_test":
        pytest.fail("TEST_DATABASE_URL debe apuntar a cuyielite_test en localhost")
    return url


def _admin_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    return urllib.parse.urlunparse(parsed._replace(path="/postgres"))


def _new_database(url: str) -> tuple[str, str]:
    name = f"cuyielite_d1_{uuid.uuid4().hex[:8]}"
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
def db_url():
    url = _test_url()
    name, db_url = _new_database(url)
    try:
        boot = psycopg.connect(db_url, autocommit=True)
        try:
            for sql_file in sorted(DDL_DIR.glob("*.sql")):
                boot.execute(sql_file.read_text(encoding="utf-8"))
        finally:
            boot.close()
        from tools.db_migrate.runner import apply_migrations

        apply_migrations(db_url)
        yield db_url
    finally:
        _drop_database(url, name)


def _scope(url: str, name: str = "d1") -> uuid.UUID:
    with psycopg.connect(url) as conn:
        row = conn.execute(
            "INSERT INTO sync_scopes (name) VALUES (%s) RETURNING id", (name,)
        ).fetchone()
    return row[0]


def _insert_cuye(conn, scope_id, code="C001", poza_id=None, estado=None):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO cuyes (id, scope_id, poza_id, codigo_identificacion, sexo, estado) "
        "VALUES (%s, %s, %s, %s, 'H', %s)",
        (record_id, scope_id, poza_id, code, estado),
    )
    return record_id


def _insert_parto(conn, scope_id, madre_id):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO partos (id, scope_id, madre_id, fecha_parto, numero_parto, "
        "nacidos_vivos, nacidos_muertos, tamano_camada_nacida) "
        "VALUES (%s, %s, %s, '2026-01-20', 4, 4, 1, 5)",
        (record_id, scope_id, madre_id),
    )
    return record_id


def _insert_poza(conn, scope_id, galpon_id, codigo="P-1"):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO pozas (id, scope_id, galpon_id, codigo, tipo, capacidad_maxima) "
        "VALUES (%s, %s, %s, %s, 'cria', 10)",
        (record_id, scope_id, galpon_id, codigo),
    )
    return record_id


def _insert_galpon(conn, scope_id, nombre="G-1"):
    record_id = uuid.uuid4()
    conn.execute(
        "INSERT INTO galpones (id, scope_id, nombre, ubicacion) VALUES (%s, %s, %s, NULL)",
        (record_id, scope_id, nombre),
    )
    return record_id


def _after(conn, entity, record_id):
    fields = PUBLISHABLE_FIELDS[entity]
    row = conn.execute(
        f"SELECT {', '.join(fields)} FROM {entity} WHERE id = %s", (record_id,)
    ).fetchone()
    assert row is not None
    return dict(zip(fields, row))


def _registro(entity, record_id, after, before=None, expected_version=None):
    return RegistroPublicacion(
        entity=entity,
        id=record_id,
        expected_version=expected_version,
        before=before,
        after=after,
    )


def _history(conn, scope_id, entity, record_id):
    return conn.execute(
        "SELECT sequence, record_version, snapshot FROM sync_changes "
        "WHERE scope_id=%s AND entity=%s AND record_id=%s ORDER BY sequence",
        (scope_id, entity, record_id),
    ).fetchall()


def _scope_sequence(conn, scope_id):
    return conn.execute(
        "SELECT last_sequence FROM sync_scopes WHERE id=%s", (scope_id,)
    ).fetchone()[0]


def _assert_code(exc, code):
    assert isinstance(exc.value, PublicacionError)
    assert exc.value.codigo == code


def test_migracion_agrega_metadatos_a_cinco_tablas(db_url):
    conn = psycopg.connect(db_url)
    try:
        for table in ("cuyes", "partos", "pesajes", "eventos", "parto_crias"):
            columns = {
                row[0]
                for row in conn.execute(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=%s",
                    (table,),
                )
            }
            assert {"scope_id", "server_version", "last_client_edited_at"} <= columns
    finally:
        conn.close()


def test_primera_publicacion_version_uno_y_snapshot(db_url):
    scope_id = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        record_id = _insert_cuye(conn, scope_id)
        after = _after(conn, "cuyes", record_id)
        result = publicar_cambios(conn, scope_id, [_registro("cuyes", record_id, after)])
        conn.commit()

        assert result[0].version == 1 and result[0].changed is True
        assert result[0].sequence == 1
        row = conn.execute(
            "SELECT server_version FROM cuyes WHERE id=%s", (record_id,)
        ).fetchone()
        assert row[0] == 1
        history = _history(conn, scope_id, "cuyes", record_id)
        assert len(history) == 1
        assert history[0][0] == 1 and history[0][1] == 1
        assert history[0][2]["version"] == "1"
        assert history[0][2]["data"]["codigo_identificacion"] == "C001"
        assert _scope_sequence(conn, scope_id) == 1
    finally:
        conn.close()


def test_normaliza_uuid_fecha_y_decimal_desde_strings(db_url):
    scope = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        record_id = _insert_cuye(conn, scope, "STRING")
        conn.execute(
            "UPDATE cuyes SET fecha_nacimiento='2025-03-12', ultimo_peso_g=950.50 WHERE id=%s",
            (record_id,),
        )
        after = _after(conn, "cuyes", record_id)
        after["fecha_nacimiento"] = "2025-03-12"
        after["ultimo_peso_g"] = "950.50"
        result = publicar_cambios(conn, scope, [_registro("cuyes", record_id, after)])
        conn.commit()
        assert result[0].version == 1
        snapshot = _history(conn, scope, "cuyes", record_id)[0][2]
        assert snapshot["data"]["fecha_nacimiento"] == "2025-03-12"
        assert snapshot["data"]["ultimo_peso_g"] == "950.50"
    finally:
        conn.close()


def test_correccion_efectiva_incrementa_version(db_url):
    scope_id = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        record_id = _insert_cuye(conn, scope_id)
        before = _after(conn, "cuyes", record_id)
        publicar_cambios(conn, scope_id, [_registro("cuyes", record_id, before)])
        conn.commit()

        conn.execute("UPDATE cuyes SET estado='PENDIENTE_REVISION' WHERE id=%s", (record_id,))
        after = _after(conn, "cuyes", record_id)
        result = publicar_cambios(
            conn,
            scope_id,
            [_registro("cuyes", record_id, after, before=before, expected_version=1)],
        )
        conn.commit()

        assert result[0].version == 2 and result[0].changed is True
        assert result[0].sequence == 2
        assert _scope_sequence(conn, scope_id) == 2
        assert len(_history(conn, scope_id, "cuyes", record_id)) == 2
        assert _history(conn, scope_id, "cuyes", record_id)[-1][2]["data"]["estado"] == "PENDIENTE_REVISION"
    finally:
        conn.close()


def test_noop_no_cambia_metadatos_historial_ni_contador(db_url):
    scope_id = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        record_id = _insert_cuye(conn, scope_id)
        after = _after(conn, "cuyes", record_id)
        publicar_cambios(conn, scope_id, [_registro("cuyes", record_id, after)])
        conn.commit()
        stamp = conn.execute("SELECT updated_at FROM cuyes WHERE id=%s", (record_id,)).fetchone()[0]
        result = publicar_cambios(
            conn,
            scope_id,
            [_registro("cuyes", record_id, after, before=after, expected_version=1)],
        )
        conn.commit()
        assert result[0].changed is False and result[0].version == 1
        assert result[0].sequence is None
        assert conn.execute("SELECT updated_at FROM cuyes WHERE id=%s", (record_id,)).fetchone()[0] == stamp
        assert _scope_sequence(conn, scope_id) == 1
        assert len(_history(conn, scope_id, "cuyes", record_id)) == 1
    finally:
        conn.close()


def test_version_obsoleta_y_before_inconsistente(db_url):
    scope_id = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        record_id = _insert_cuye(conn, scope_id)
        before = _after(conn, "cuyes", record_id)
        publicar_cambios(conn, scope_id, [_registro("cuyes", record_id, before)])
        conn.commit()
        conn.execute("UPDATE cuyes SET estado='PENDIENTE_REVISION' WHERE id=%s", (record_id,))
        after = _after(conn, "cuyes", record_id)

        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(
                conn,
                scope_id,
                [_registro("cuyes", record_id, after, before=before, expected_version=5)],
            )
        _assert_code(exc, "VERSION_OBSOLETA")
        conn.rollback()

        conn.execute("UPDATE cuyes SET estado='PENDIENTE_REVISION' WHERE id=%s", (record_id,))
        after = _after(conn, "cuyes", record_id)
        bad_before = dict(before)
        bad_before["codigo_identificacion"] = "OTRA"
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(
                conn,
                scope_id,
                [_registro("cuyes", record_id, after, before=bad_before, expected_version=1)],
            )
        _assert_code(exc, "EVIDENCIA_INCONSISTENTE")
        conn.rollback()

        assert len(_history(conn, scope_id, "cuyes", record_id)) == 1
    finally:
        conn.close()


def test_after_no_coincide_con_fila_final(db_url):
    scope_id = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        record_id = _insert_cuye(conn, scope_id)
        after = _after(conn, "cuyes", record_id)
        after["codigo_identificacion"] = "NO-ESCRITO"
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(conn, scope_id, [_registro("cuyes", record_id, after)])
        _assert_code(exc, "FILA_FINAL_INCONSISTENTE")
        conn.rollback()
        assert _history(conn, scope_id, "cuyes", record_id) == []
    finally:
        conn.close()


def test_ambito_referencias_y_duplicados(db_url):
    scope = _scope(db_url)
    other = _scope(db_url, "otro")
    conn = psycopg.connect(db_url)
    try:
        record_id = _insert_cuye(conn, scope)
        after = _after(conn, "cuyes", record_id)
        conn.commit()

        conn.execute("BEGIN")
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(conn, uuid.uuid4(), [_registro("cuyes", record_id, after)])
        _assert_code(exc, "AMBITO_INEXISTENTE")
        conn.rollback()

        conn.execute("UPDATE cuyes SET scope_id=%s WHERE id=%s", (other, record_id))
        conn.commit()
        conn.execute("BEGIN")
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(conn, scope, [_registro("cuyes", record_id, after)])
        _assert_code(exc, "SCOPE_INVALIDO")
        conn.rollback()

        conn.execute("UPDATE cuyes SET scope_id=%s WHERE id=%s", (scope, record_id))
        conn.commit()
        g_unscoped = _insert_galpon(conn, scope)
        p_unscoped = _insert_poza(conn, None, g_unscoped)
        conn.execute("UPDATE cuyes SET poza_id=%s WHERE id=%s", (p_unscoped, record_id))
        conn.commit()
        conn.execute("BEGIN")
        after = _after(conn, "cuyes", record_id)
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(conn, scope, [_registro("cuyes", record_id, after)])
        _assert_code(exc, "REFERENCIA_INVALIDA")
        conn.rollback()

        g_other = _insert_galpon(conn, other)
        p_other = _insert_poza(conn, other, g_other)
        conn.commit()
        conn.execute("UPDATE cuyes SET poza_id=%s WHERE id=%s", (p_other, record_id))
        conn.commit()
        conn.execute("BEGIN")
        after = _after(conn, "cuyes", record_id)
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(conn, scope, [_registro("cuyes", record_id, after)])
        _assert_code(exc, "REFERENCIA_FUERA_DE_AMBITO")
        conn.rollback()

        conn.execute("BEGIN")
        dup = _insert_cuye(conn, scope, "DUPLICADO")
        after_dup = _after(conn, "cuyes", dup)
        good = _registro("cuyes", dup, after_dup)
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(conn, scope, [good, good])
        _assert_code(exc, "REGISTRO_DUPLICADO")
        conn.rollback()
    finally:
        conn.close()


def test_rollback_exterior_y_conexion_prestada(db_url):
    scope = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        record_id = _insert_cuye(conn, scope)
        after = _after(conn, "cuyes", record_id)
        publicar_cambios(conn, scope, [_registro("cuyes", record_id, after)])
        assert conn.closed == 0
        assert conn.info.transaction_status == TransactionStatus.INTRANS
        conn.rollback()
        assert conn.execute("SELECT count(*) FROM cuyes WHERE id=%s", (record_id,)).fetchone()[0] == 0
        assert _scope_sequence(conn, scope) == 0
        assert _history(conn, scope, "cuyes", record_id) == []
        conn.execute(
            "INSERT INTO cuyes (id, scope_id, codigo_identificacion) VALUES (%s,%s,%s)",
            (uuid.uuid4(), scope, "POST-ROLLBACK"),
        )
        conn.commit()
        assert conn.execute("SELECT count(*) FROM cuyes WHERE codigo_identificacion='POST-ROLLBACK'").fetchone()[0] == 1
    finally:
        conn.close()


def test_historico_sin_ambito_no_se_publica(db_url):
    scope = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        record_id = uuid.uuid4()
        conn.execute(
            "INSERT INTO cuyes (id, codigo_identificacion) VALUES (%s, 'HISTORICO')",
            (record_id,),
        )
        after = _after(conn, "cuyes", record_id)
        conn.commit()
        conn.execute("BEGIN")
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(conn, scope, [_registro("cuyes", record_id, after)])
        _assert_code(exc, "SCOPE_NO_ASIGNADO")
        conn.rollback()
        row = conn.execute(
            "SELECT scope_id, server_version FROM cuyes WHERE id=%s", (record_id,)
        ).fetchone()
        assert row == (None, 0)
        assert _scope_sequence(conn, scope) == 0
    finally:
        conn.close()


def test_publica_cinco_entidades_soportadas(db_url):
    scope = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        galpon = _insert_galpon(conn, scope)
        poza = _insert_poza(conn, scope, galpon)
        madre = _insert_cuye(conn, scope, "MADRE", poza)
        cria = _insert_cuye(conn, scope, "CRIA", poza)
        parto = _insert_parto(conn, scope, madre)
        evento = uuid.uuid4()
        conn.execute(
            "INSERT INTO eventos (id, scope_id, cuy_id, tipo, fecha) VALUES (%s,%s,%s,'DESTETE','2026-02-04')",
            (evento, scope, cria),
        )
        pesaje = uuid.uuid4()
        conn.execute(
            "INSERT INTO pesajes (id, scope_id, cuy_id, fecha_pesaje, peso_gramos, etapa, evento_id) "
            "VALUES (%s,%s,%s,'2026-02-04','270.00','DESTETE',%s)",
            (pesaje, scope, cria, evento),
        )
        vinculacion = uuid.uuid4()
        conn.execute(
            "INSERT INTO parto_crias (id, scope_id, parto_id, cuy_id, rol) VALUES (%s,%s,%s,%s,'CRIA')",
            (vinculacion, scope, parto, cria),
        )

        records = []
        for entity, record_id in (
            ("cuyes", madre),
            ("cuyes", cria),
            ("partos", parto),
            ("eventos", evento),
            ("pesajes", pesaje),
            ("parto_crias", vinculacion),
        ):
            records.append(_registro(entity, record_id, _after(conn, entity, record_id)))
        result = publicar_cambios(conn, scope, records)
        conn.commit()
        assert [item.version for item in result] == [1, 1, 1, 1, 1, 1]
        assert _scope_sequence(conn, scope) == 6
        for entity, record_id in (
            ("cuyes", madre),
            ("cuyes", cria),
            ("partos", parto),
            ("eventos", evento),
            ("pesajes", pesaje),
            ("parto_crias", vinculacion),
        ):
            assert len(_history(conn, scope, entity, record_id)) == 1
    finally:
        conn.close()


def test_pesaje_con_dos_vinculos_se_rechaza(db_url):
    scope = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        madre = _insert_cuye(conn, scope, "MADRE2")
        parto = _insert_parto(conn, scope, madre)
        evento = uuid.uuid4()
        conn.execute(
            "INSERT INTO eventos (id, scope_id, cuy_id, tipo) VALUES (%s,%s,%s,'DESTETE')",
            (evento, scope, madre),
        )
        pesaje = uuid.uuid4()
        conn.execute(
            "INSERT INTO pesajes (id, scope_id, cuy_id, peso_gramos, parto_id, evento_id) "
            "VALUES (%s,%s,%s,'300.00',%s,%s)",
            (pesaje, scope, madre, parto, evento),
        )
        after = _after(conn, "pesajes", pesaje)
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(conn, scope, [_registro("pesajes", pesaje, after)])
        _assert_code(exc, "VINCULO_INVALIDO")
        conn.rollback()
    finally:
        conn.close()


def test_pesaje_y_parto_crias_exigen_el_animal_correcto(db_url):
    scope = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        madre = _insert_cuye(conn, scope, "MADRE-REL")
        otra = _insert_cuye(conn, scope, "OTRA-REL")
        parto = _insert_parto(conn, scope, madre)
        evento = uuid.uuid4()
        conn.execute(
            "INSERT INTO eventos (id, scope_id, cuy_id, tipo) VALUES (%s,%s,%s,'DESTETE')",
            (evento, scope, madre),
        )
        conn.commit()
        pesaje_parto = uuid.uuid4()
        conn.execute(
            "INSERT INTO pesajes (id, scope_id, cuy_id, peso_gramos, etapa, parto_id) "
            "VALUES (%s,%s,%s,'500.00','PARTO',%s)",
            (pesaje_parto, scope, otra, parto),
        )
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(
                conn,
                scope,
                [_registro("pesajes", pesaje_parto, _after(conn, "pesajes", pesaje_parto))],
            )
        _assert_code(exc, "RELACION_INCONSISTENTE")
        conn.rollback()

        pesaje_evento = uuid.uuid4()
        conn.execute(
            "INSERT INTO pesajes (id, scope_id, cuy_id, peso_gramos, etapa, evento_id) "
            "VALUES (%s,%s,%s,'270.00','DESTETE',%s)",
            (pesaje_evento, scope, otra, evento),
        )
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(
                conn,
                scope,
                [_registro("pesajes", pesaje_evento, _after(conn, "pesajes", pesaje_evento))],
            )
        _assert_code(exc, "RELACION_INCONSISTENTE")
        conn.rollback()

        vinculacion = uuid.uuid4()
        conn.execute(
            "INSERT INTO parto_crias (id, scope_id, parto_id, cuy_id, rol) "
            "VALUES (%s,%s,%s,%s,'CRIA')",
            (vinculacion, scope, parto, madre),
        )
        with pytest.raises(PublicacionError) as exc:
            publicar_cambios(
                conn,
                scope,
                [_registro("parto_crias", vinculacion, _after(conn, "parto_crias", vinculacion))],
            )
        _assert_code(exc, "RELACION_INCONSISTENTE")
        conn.rollback()
    finally:
        conn.close()


def test_pesaje_valido_de_madre_y_evento(db_url):
    scope = _scope(db_url)
    conn = psycopg.connect(db_url)
    try:
        madre = _insert_cuye(conn, scope, "MADRE-VALIDA")
        parto = _insert_parto(conn, scope, madre)
        pesaje_parto = uuid.uuid4()
        conn.execute(
            "INSERT INTO pesajes (id, scope_id, cuy_id, peso_gramos, etapa, parto_id) "
            "VALUES (%s,%s,%s,'950.00','PARTO',%s)",
            (pesaje_parto, scope, madre, parto),
        )
        evento = uuid.uuid4()
        conn.execute(
            "INSERT INTO eventos (id, scope_id, cuy_id, tipo) VALUES (%s,%s,%s,'DESTETE')",
            (evento, scope, madre),
        )
        pesaje_evento = uuid.uuid4()
        conn.execute(
            "INSERT INTO pesajes (id, scope_id, cuy_id, peso_gramos, etapa, evento_id) "
            "VALUES (%s,%s,%s,'300.00','DESTETE',%s)",
            (pesaje_evento, scope, madre, evento),
        )
        records = [
            _registro("pesajes", pesaje_parto, _after(conn, "pesajes", pesaje_parto)),
            _registro("pesajes", pesaje_evento, _after(conn, "pesajes", pesaje_evento)),
        ]
        result = publicar_cambios(conn, scope, records)
        conn.commit()
        assert [item.version for item in result] == [1, 1]
    finally:
        conn.close()


def test_escritores_concurrentes_ordenan_contador(db_url):
    scope = _scope(db_url)
    barrier = threading.Barrier(2)
    errors = []

    def worker(code):
        try:
            conn = psycopg.connect(db_url)
            try:
                barrier.wait(timeout=10)
                # El protocolo exige bloquear el ámbito antes de escribir dominio.
                conn.execute("SELECT id FROM sync_scopes WHERE id=%s FOR UPDATE", (scope,))
                record_id = _insert_cuye(conn, scope, code)
                after = _after(conn, "cuyes", record_id)
                publicar_cambios(conn, scope, [_registro("cuyes", record_id, after)])
                conn.commit()
            finally:
                conn.close()
        except Exception as error:  # pragma: no cover - falla visible en assert
            errors.append(error)

    threads = [threading.Thread(target=worker, args=(f"CONC-{index}",)) for index in (1, 2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    assert not errors, errors
    assert all(not thread.is_alive() for thread in threads)
    conn = psycopg.connect(db_url)
    try:
        assert _scope_sequence(conn, scope) == 2
        rows = conn.execute(
            "SELECT sequence, record_id FROM sync_changes WHERE scope_id=%s ORDER BY sequence",
            (scope,),
        ).fetchall()
        assert [row[0] for row in rows] == [1, 2]
        assert len({row[1] for row in rows}) == 2
        assert conn.execute(
            "SELECT count(*) FROM cuyes WHERE scope_id=%s AND server_version=1", (scope,)
        ).fetchone()[0] == 2
    finally:
        conn.close()


def test_v1_sigue_rechazando_entidades_nuevas():
    from pydantic import ValidationError
    from backend.app.schemas.sync import SyncPullItem, SyncOperation

    payload = {
        "operation_id": uuid.uuid4(),
        "entity": "cuyes",
        "record_id": uuid.uuid4(),
        "action": "create",
        "client_created_at": "2026-11-10T10:00:00Z",
        "data": {},
    }
    with pytest.raises(ValidationError):
        SyncOperation(**payload)
    with pytest.raises(ValidationError):
        SyncPullItem(
            seq="1",
            entity="cuyes",
            record={
                "id": uuid.uuid4(),
                "version": "1",
                "created_at": "2026-11-10T10:00:00Z",
                "updated_at": "2026-11-10T10:00:00Z",
                "deleted_at": None,
                "last_client_edited_at": None,
                "data": {},
            },
        )
