"""Pruebas de migraciones centrales contra PostgreSQL real."""

import hashlib
import os
import threading
import time
import urllib.parse
import uuid
from pathlib import Path

import psycopg
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
DDL_DIR = REPO_ROOT / "db" / "ddl" / "central"
MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations" / "central"
EXPECTED_MIGRATION_IDS = sorted(path.name for path in MIGRATIONS_DIR.glob("*.sql"))


def _validate_test_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname
    db_name = parsed.path.lstrip("/")
    if host not in ("localhost", "127.0.0.1"):
        raise ValueError(f"Host no permitido para base de pruebas: {host}.")
    if db_name != "cuyielite_test":
        raise ValueError(f"Base no permitida para pruebas: {db_name}.")


def _require_test_db():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.fail("TEST_DATABASE_URL no configurada; configuracion obligatoria para estas pruebas")
    _validate_test_url(url)
    return url


def _admin_url(test_url: str) -> str:
    parsed = urllib.parse.urlparse(test_url)
    return urllib.parse.urlunparse(parsed._replace(path="/postgres"))


_CREATED_DBS = []


def _create_fresh_db(test_url: str) -> str:
    admin = _admin_url(test_url)
    db_name = f"cuyielite_c1_{uuid.uuid4().hex[:8]}"
    conn = psycopg.connect(admin, autocommit=True)
    try:
        conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        conn.close()
    _CREATED_DBS.append(db_name)
    parsed = urllib.parse.urlparse(test_url)
    new_url = urllib.parse.urlunparse(parsed._replace(path=f"/{db_name}"))
    # bootstrap
    bconn = psycopg.connect(new_url, autocommit=True)
    try:
        for sql_file in sorted(DDL_DIR.glob("*.sql")):
            with open(sql_file, encoding="utf-8") as f:
                bconn.execute(f.read())
    finally:
        bconn.close()
    return new_url


def _drop_db(test_url: str, db_url: str) -> None:
    parsed = urllib.parse.urlparse(db_url)
    db_name = parsed.path.lstrip("/")
    admin = _admin_url(test_url)
    conn = psycopg.connect(admin, autocommit=True)
    try:
        conn.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
    finally:
        conn.close()
    if db_name in _CREATED_DBS:
        _CREATED_DBS.remove(db_name)


@pytest.fixture
def fresh_db():
    test_url = _require_test_db()
    db_url = _create_fresh_db(test_url)
    yield db_url
    _drop_db(test_url, db_url)


@pytest.fixture(autouse=True)
def cleanup_created_dbs(request):
    yield
    # safety: drop any leftover
    test_url = os.environ.get("TEST_DATABASE_URL")
    if not test_url:
        return
    for db_name in list(_CREATED_DBS):
        try:
            admin = _admin_url(test_url)
            conn = psycopg.connect(admin, autocommit=True)
            conn.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
            conn.close()
            _CREATED_DBS.remove(db_name)
        except Exception:
            pass


def _apply_migration(url: str, directory=None):
    from tools.db_migrate.runner import apply_migrations
    kwargs = {}
    if directory is not None:
        kwargs["directory"] = directory
    return apply_migrations(url, **kwargs)


# ---------- A. Upgrade y conservación ----------

def test_bootstrap_vacio_migra(fresh_db):
    applied = _apply_migration(fresh_db)
    assert "0001_lope_domain.sql" in applied
    conn = psycopg.connect(fresh_db)
    try:
        with conn.cursor() as cur:
            for t in ("eventos", "parto_crias", "importacion_origenes",
                      "importacion_lotes", "importacion_correspondencias", "schema_migrations"):
                cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name=%s", (t,))
                assert cur.fetchone() is not None, t
    finally:
        conn.close()


def test_base_vacia_sin_filas_negocio(fresh_db):
    _apply_migration(fresh_db)
    conn = psycopg.connect(fresh_db)
    try:
        with conn.cursor() as cur:
            for t in ("cuyes", "partos", "pesajes", "eventos", "parto_crias"):
                cur.execute(f"SELECT count(*) FROM {t}")
                assert cur.fetchone()[0] == 0
    finally:
        conn.close()


def test_conservacion_datos_sinteticos(fresh_db):
    import uuid as _u
    url = fresh_db
    g = _u.uuid4(); p = _u.uuid4(); c = _u.uuid4()
    m = _u.uuid4()
    parto = _u.uuid4()
    pesaje = _u.uuid4()
    conn = psycopg.connect(url, autocommit=True)
    try:
        conn.execute("INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, deleted_at) VALUES (%s,%s,%s,now(),now(),NULL)", (g, "G1", "Lote"))
        conn.execute("INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, deleted_at) VALUES (%s,%s,%s,%s,%s,now(),now(),NULL)", (p, g, "P1", "cria", 10))
        # cuye con estado no-ACTIVO y timestamps conocidos
        conn.execute(
            "INSERT INTO cuyes (id, poza_id, codigo_identificacion, sexo, fecha_nacimiento, estado, created_at, updated_at, deleted_at) "
            "VALUES (%s,%s,%s,%s,%s,%s, '2026-01-01T10:00:00Z', '2026-01-02T11:00:00Z', NULL)",
            (c, p, "C001", "H", "2026-01-01", "PENDIENTE_REVISION"),
        )
        conn.execute("INSERT INTO cuyes (id, poza_id, codigo_identificacion, sexo, estado, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (m, p, "M1", "H", "ACTIVO"))
        conn.execute(
            "INSERT INTO partos (id, madre_id, fecha_parto, tamano_camada_nacida, nacidos_vivos, nacidos_muertos, created_at, updated_at) "
            "VALUES (%s,%s,%s,%s,%s,%s, '2026-01-03T09:00:00Z', '2026-01-03T09:00:00Z')",
            (parto, m, "2026-01-10", 5, 4, 1),
        )
        conn.execute(
            "INSERT INTO pesajes (id, cuy_id, fecha_pesaje, peso_gramos, created_at, updated_at) "
            "VALUES (%s,%s,%s,%s, '2026-01-04T08:00:00Z', '2026-01-04T08:00:00Z')",
            (pesaje, m, "2026-01-05", "123.45"),
        )
    finally:
        conn.close()

    # snapshot before
    conn = psycopg.connect(url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, poza_id, codigo_identificacion, sexo, fecha_nacimiento, estado, created_at, updated_at, deleted_at FROM cuyes WHERE id=%s", (c,))
            before_cuye = cur.fetchone()
            cur.execute("SELECT id, madre_id, fecha_parto, tamano_camada_nacida, nacidos_vivos, nacidos_muertos, created_at, updated_at, deleted_at FROM partos WHERE id=%s", (parto,))
            before_parto = cur.fetchone()
            cur.execute("SELECT id, cuy_id, fecha_pesaje, peso_gramos, created_at, updated_at, deleted_at FROM pesajes WHERE id=%s", (pesaje,))
            before_pesaje = cur.fetchone()
    finally:
        conn.close()

    _apply_migration(url)

    conn = psycopg.connect(url)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, poza_id, codigo_identificacion, sexo, fecha_nacimiento, estado, created_at, updated_at, deleted_at FROM cuyes WHERE id=%s", (c,))
            after_cuye = cur.fetchone()
            cur.execute("SELECT id, madre_id, fecha_parto, tamano_camada_nacida, nacidos_vivos, nacidos_muertos, created_at, updated_at, deleted_at FROM partos WHERE id=%s", (parto,))
            after_parto = cur.fetchone()
            cur.execute("SELECT id, cuy_id, fecha_pesaje, peso_gramos, created_at, updated_at, deleted_at FROM pesajes WHERE id=%s", (pesaje,))
            after_pesaje = cur.fetchone()
        assert before_cuye == after_cuye, "cuye no conservado"
        assert before_parto == after_parto, "parto no conservado"
        assert before_pesaje == after_pesaje, "pesaje no conservado"
        assert after_cuye[5] == "PENDIENTE_REVISION", "estado no conservado"
    finally:
        conn.close()


# ---------- B. Comportamiento del esquema ----------

def test_chapa_duplicada_permitida(fresh_db):
    _apply_migration(fresh_db)
    import uuid as _u
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        g = _u.uuid4(); p = _u.uuid4()
        conn.execute("INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (%s,%s,now(),now())", (g, "G"))
        conn.execute("INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (p, g, "P", "cria", 5))
        c1 = _u.uuid4(); c2 = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,%s,now(),now())", (c1, p, "CHAPA1"))
        conn.execute("INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,%s,now(),now())", (c2, p, "CHAPA1"))
    finally:
        conn.close()


def test_nulls_conservados(fresh_db):
    _apply_migration(fresh_db)
    import uuid as _u
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        g = _u.uuid4(); p = _u.uuid4()
        conn.execute("INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (%s,%s,now(),now())", (g, "G"))
        conn.execute("INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (p, g, "P", "cria", 5))
        c = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (c, "C1"))
        m = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (m, "M1"))
        conn.execute("INSERT INTO partos (id,madre_id,tamano_camada_nacida,created_at,updated_at) VALUES (%s,%s,NULL,now(),now())", (_u.uuid4(), m))
        with conn.cursor() as cur:
            cur.execute("SELECT poza_id FROM cuyes WHERE id=%s", (c,))
            assert cur.fetchone()[0] is None
            cur.execute("SELECT tamano_camada_nacida FROM partos WHERE madre_id=%s", (m,))
            assert cur.fetchone()[0] is None
    finally:
        conn.close()


def test_cero_vs_null(fresh_db):
    _apply_migration(fresh_db)
    import uuid as _u
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        g = _u.uuid4(); p = _u.uuid4()
        conn.execute("INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (%s,%s,now(),now())", (g, "G"))
        conn.execute("INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (p, g, "P", "cria", 5))
        m = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (m, "M1"))
        conn.execute("INSERT INTO partos (id,madre_id,tamano_camada_nacida,nacidos_vivos,nacidos_muertos,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (_u.uuid4(), m, 0, 0, 0))
        with conn.cursor() as cur:
            cur.execute("SELECT tamano_camada_nacida, nacidos_vivos, nacidos_muertos FROM partos WHERE madre_id=%s", (m,))
            row = cur.fetchone()
            assert row == (0, 0, 0)
    finally:
        conn.close()


def test_no_activo_default(fresh_db):
    _apply_migration(fresh_db)
    import uuid as _u
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        c = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (c, "C1"))
        with conn.cursor() as cur:
            cur.execute("SELECT estado FROM cuyes WHERE id=%s", (c,))
            assert cur.fetchone()[0] is None
    finally:
        conn.close()


def test_estados_existentes_no_activo_conservados(fresh_db):
    import uuid as _u
    # insert before migration with non-ACTIVO state
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        g = _u.uuid4(); p = _u.uuid4()
        conn.execute("INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (%s,%s,now(),now())", (g, "G"))
        conn.execute("INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (p, g, "P", "cria", 5))
        c = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,poza_id,codigo_identificacion,sexo,estado,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (c, p, "C1", "M", "PENDIENTE_REVISION"))
    finally:
        conn.close()
    _apply_migration(fresh_db)
    conn = psycopg.connect(fresh_db)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT estado FROM cuyes WHERE id=%s", (c,))
            assert cur.fetchone()[0] == "PENDIENTE_REVISION"
    finally:
        conn.close()


def test_referencias_invalidas_fallan(fresh_db):
    _apply_migration(fresh_db)
    import uuid as _u
    conn = psycopg.connect(fresh_db, autocommit=False)
    try:
        with pytest.raises(psycopg.errors.ForeignKeyViolation):
            conn.execute("INSERT INTO cuyes (id,poza_id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,%s,now(),now())", (_u.uuid4(), _u.uuid4(), "C1"))
            conn.commit()
        conn.rollback()
    finally:
        conn.close()


def test_parto_varias_crias_una_cria_un_parto(fresh_db):
    _apply_migration(fresh_db)
    import uuid as _u
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        g = _u.uuid4(); p = _u.uuid4()
        conn.execute("INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (%s,%s,now(),now())", (g, "G"))
        conn.execute("INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (p, g, "P", "cria", 5))
        m = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (m, "M"))
        parto = _u.uuid4()
        conn.execute("INSERT INTO partos (id,madre_id,created_at,updated_at) VALUES (%s,%s,now(),now())", (parto, m))
        c1 = _u.uuid4(); c2 = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (c1, "C1"))
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (c2, "C2"))
        conn.execute("INSERT INTO parto_crias (parto_id,cuy_id) VALUES (%s,%s)", (parto, c1))
        conn.execute("INSERT INTO parto_crias (parto_id,cuy_id) VALUES (%s,%s)", (parto, c2))
        parto2 = _u.uuid4()
        conn.execute("INSERT INTO partos (id,madre_id,created_at,updated_at) VALUES (%s,%s,now(),now())", (parto2, m))
        with pytest.raises(psycopg.errors.UniqueViolation):
            conn.execute("INSERT INTO parto_crias (parto_id,cuy_id) VALUES (%s,%s)", (parto2, c1))
    finally:
        conn.close()


def test_peso_materno_y_cria_separados(fresh_db):
    _apply_migration(fresh_db)
    import uuid as _u
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        g = _u.uuid4(); p = _u.uuid4()
        conn.execute("INSERT INTO galpones (id,nombre,created_at,updated_at) VALUES (%s,%s,now(),now())", (g, "G"))
        conn.execute("INSERT INTO pozas (id,galpon_id,codigo,tipo,capacidad_maxima,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,now(),now())", (p, g, "P", "cria", 5))
        m = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (m, "M"))
        parto = _u.uuid4()
        conn.execute("INSERT INTO partos (id,madre_id,created_at,updated_at) VALUES (%s,%s,now(),now())", (parto, m))
        conn.execute("INSERT INTO pesajes (id,cuy_id,fecha_pesaje,peso_gramos,etapa,parto_id,created_at,updated_at) VALUES (%s,%s,now(),%s,%s,%s,now(),now())", (_u.uuid4(), m, "500.00", "PARTO", parto))
        cria = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (cria, "C"))
        conn.execute("INSERT INTO parto_crias (parto_id,cuy_id) VALUES (%s,%s)", (parto, cria))
        conn.execute("INSERT INTO pesajes (id,cuy_id,fecha_pesaje,peso_gramos,etapa,created_at,updated_at) VALUES (%s,%s,now(),%s,%s,now(),now())", (_u.uuid4(), cria, "80.00", "NACIMIENTO"))
    finally:
        conn.close()


def test_origen_roles_multiples_y_identidad_estable(fresh_db):
    _apply_migration(fresh_db)
    import uuid as _u
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        huella = "abc123"
        conn.execute("INSERT INTO importacion_origenes (huella_archivo,origen_hoja,origen_celda,origen_fila,origen_rol,entidad_tipo) VALUES (%s,%s,%s,%s,%s,%s)", (huella, "H1", "A1", 1, "ANIMAL", "cuye"))
        conn.execute("INSERT INTO importacion_origenes (huella_archivo,origen_hoja,origen_celda,origen_fila,origen_rol,entidad_tipo) VALUES (%s,%s,%s,%s,%s,%s)", (huella, "H1", "A1", 1, "PARTO", "parto"))
        lote = _u.uuid4()
        conn.execute("INSERT INTO importacion_lotes (id,huella_archivo,parser_version,mapeo_version) VALUES (%s,%s,%s,%s)", (lote, huella, "1.0", "1.0"))
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM importacion_origenes WHERE huella_archivo=%s AND origen_rol=%s", (huella, "ANIMAL"))
            origen_id = cur.fetchone()[0]
        ent = _u.uuid4()
        conn.execute("INSERT INTO importacion_correspondencias (origen_id,lote_id,entidad_id,estado,parser_version,mapeo_version) VALUES (%s,%s,%s,%s,%s,%s)", (origen_id, lote, ent, "ACEPTADO", "1.0", "1.0"))
        with pytest.raises(psycopg.errors.UniqueViolation):
            conn.execute("INSERT INTO importacion_correspondencias (origen_id,lote_id,entidad_id,estado,parser_version,mapeo_version) VALUES (%s,%s,%s,%s,%s,%s)", (origen_id, lote, _u.uuid4(), "ACEPTADO", "2.0", "2.0"))
    finally:
        conn.close()


# ---------- C. Ejecutor ----------

def test_segundo_apply_noop(fresh_db):
    first = _apply_migration(fresh_db)
    assert first == EXPECTED_MIGRATION_IDS
    second = _apply_migration(fresh_db)
    assert second == []


def test_checksum_alterado_error(fresh_db, tmp_path):
    import shutil
    src = MIGRATIONS_DIR
    dst = tmp_path / "migs"
    dst.mkdir()
    for f in src.glob("*.sql"):
        shutil.copy(f, dst / f.name)
    _apply_migration(fresh_db)
    (dst / "0001_lope_domain.sql").write_text("-- modified\n", encoding="utf-8")
    with pytest.raises(ValueError, match="Checksum distinto"):
        _apply_migration(fresh_db, directory=dst)


def test_fallo_intermedio_rollback(fresh_db, tmp_path):
    import shutil
    src = MIGRATIONS_DIR
    dst = tmp_path / "migs"
    dst.mkdir()
    for f in src.glob("*.sql"):
        shutil.copy(f, dst / f.name)
    (dst / "0002_bad.sql").write_text("CREATE TABLE foo (id int); INSERT INTO no_existe VALUES (1);", encoding="utf-8")
    _apply_migration(fresh_db)
    with pytest.raises(Exception):
        _apply_migration(fresh_db, directory=dst)
    conn = psycopg.connect(fresh_db)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name='foo'")
            assert cur.fetchone() is None
            cur.execute("SELECT count(*) FROM schema_migrations WHERE id='0002_bad.sql'")
            assert cur.fetchone()[0] == 0
    finally:
        conn.close()


def test_historial_alterado_no_aplica(fresh_db, tmp_path):
    import shutil
    src = MIGRATIONS_DIR
    dst = tmp_path / "migs"
    dst.mkdir()
    for f in src.glob("*.sql"):
        shutil.copy(f, dst / f.name)
    # aplicar original
    _apply_migration(fresh_db)
    # crear migración pendiente
    (dst / "0002_pending.sql").write_text("CREATE TABLE pending_tbl (id int);", encoding="utf-8")
    # alterar historial: registrar un checksum falso para 0001
    conn = psycopg.connect(fresh_db)
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE schema_migrations SET checksum='deadbeef' WHERE id='0001_lope_domain.sql'")
        conn.commit()
    finally:
        conn.close()
    # debe fallar y no aplicar 0002
    with pytest.raises(ValueError):
        _apply_migration(fresh_db, directory=dst)
    conn = psycopg.connect(fresh_db)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name='pending_tbl'")
            assert cur.fetchone() is None
    finally:
        conn.close()


def test_directorio_inexistente_error(fresh_db, tmp_path):
    from tools.db_migrate.runner import apply_migrations
    with pytest.raises(ValueError):
        apply_migrations(fresh_db, directory=tmp_path / "no_existe")


def test_directorio_vacio_error(fresh_db, tmp_path):
    from tools.db_migrate.runner import apply_migrations
    empty = tmp_path / "empty"
    empty.mkdir()
    with pytest.raises(ValueError):
        apply_migrations(fresh_db, directory=empty)


def test_fallo_intermedio_conserva_datos(fresh_db, tmp_path):
    import shutil
    import uuid as _u
    src = MIGRATIONS_DIR
    dst = tmp_path / "migs"
    dst.mkdir()
    for f in src.glob("*.sql"):
        shutil.copy(f, dst / f.name)
    _apply_migration(fresh_db)
    # insert data
    conn = psycopg.connect(fresh_db, autocommit=True)
    try:
        c = _u.uuid4()
        conn.execute("INSERT INTO cuyes (id,codigo_identificacion,created_at,updated_at) VALUES (%s,%s,now(),now())", (c, "KEEP"))
    finally:
        conn.close()
    # bad migration
    (dst / "0002_bad.sql").write_text("CREATE TABLE foo (id int); INSERT INTO no_existe VALUES (1);", encoding="utf-8")
    with pytest.raises(Exception):
        _apply_migration(fresh_db, directory=dst)
    # data preserved
    conn = psycopg.connect(fresh_db)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM cuyes WHERE codigo_identificacion='KEEP'")
            assert cur.fetchone()[0] == 1
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name='foo'")
            assert cur.fetchone() is None
    finally:
        conn.close()


def test_concurrencia_coordinada(fresh_db):
    barrier = threading.Barrier(2)
    results = []
    errors = []

    def worker():
        try:
            barrier.wait(timeout=10)
            r = _apply_migration(fresh_db)
            results.append(r)
        except Exception as e:
            errors.append(e)

    t1 = threading.Thread(target=worker)
    t2 = threading.Thread(target=worker)
    t1.start()
    t2.start()
    t1.join(timeout=30)
    t2.join(timeout=30)
    assert not t1.is_alive() and not t2.is_alive(), "timeout en concurrencia"
    assert errors == [], f"errores: {errors}"
    # exactly one applied + one no-op
    applied_count = sum(1 for r in results if r == EXPECTED_MIGRATION_IDS)
    noop_count = sum(1 for r in results if r == [])
    assert applied_count == 1, f"applied={applied_count}"
    assert noop_count == 1, f"noop={noop_count}"
    conn = psycopg.connect(fresh_db)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM schema_migrations ORDER BY id")
            assert [row[0] for row in cur.fetchall()] == EXPECTED_MIGRATION_IDS
            # schema final correcto
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name='parto_crias'")
            assert cur.fetchone() is not None
    finally:
        conn.close()
