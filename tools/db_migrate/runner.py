"""Ejecutor transaccional de migraciones centrales PostgreSQL."""

import hashlib
import os
from pathlib import Path
from typing import List

import psycopg

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "db" / "migrations" / "central"
LOCK_KEY = 0x43555949  # advisory lock key

EXPECTED_TABLES = ["galpones", "pozas", "cuyes", "partos", "pesajes", "mortalidad"]
EXPECTED_COLUMNS = {
    "cuyes": ["id", "poza_id", "codigo_identificacion", "sexo", "fecha_nacimiento",
               "estado", "created_at", "updated_at"],
    "partos": ["id", "madre_id", "fecha_parto", "tamano_camada_nacida",
               "nacidos_vivos", "nacidos_muertos", "created_at", "updated_at"],
    "pesajes": ["id", "cuy_id", "fecha_pesaje", "peso_gramos", "created_at", "updated_at"],
}
EXPECTED_UNIQUE = {
    "cuyes": "cuyes_codigo_identificacion_key",
}


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _ensure_schema_migrations(conn) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )"""
    )


def list_migrations(directory: Path) -> List[Path]:
    if not directory.exists():
        raise ValueError(f"Directorio de migraciones inexistente: {directory}")
    files = sorted(directory.glob("*.sql"))
    if not files:
        raise ValueError(f"Directorio de migraciones vacio: {directory}")
    return files


def validate_precondition(conn) -> None:
    """Verifica columnas y restricciones del esquema esperado (bootstrap 001-005)."""
    with conn.cursor() as cur:
        for t in EXPECTED_TABLES:
            cur.execute(
                "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=%s",
                (t,),
            )
            if cur.fetchone() is None:
                raise ValueError(f"Precondicion incumplida: falta tabla {t}")
        for table, cols in EXPECTED_COLUMNS.items():
            for col in cols:
                cur.execute(
                    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=%s AND column_name=%s",
                    (table, col),
                )
                if cur.fetchone() is None:
                    raise ValueError(f"Precondicion incumplida: falta columna {table}.{col}")
        # Verificar UNIQUE esperado en cuyes.codigo_identificacion
        cur.execute(
            """SELECT 1 FROM information_schema.table_constraints
               WHERE table_schema='public' AND table_name='cuyes'
               AND constraint_type='UNIQUE' AND constraint_name=%s""",
            (EXPECTED_UNIQUE["cuyes"],),
        )
        if cur.fetchone() is None:
            raise ValueError(
                "Precondicion incumplida: falta restriccion UNIQUE cuyes_codigo_identificacion_key"
            )


def validate_history(conn, directory: Path) -> None:
    """Valida todo el historial conocido: archivos presentes y checksums coincidentes."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, checksum FROM schema_migrations")
        rows = cur.fetchall()
    for mig_id, checksum in rows:
        path = directory / mig_id
        if not path.exists():
            raise ValueError(f"Migracion aplicada ausente en directorio: {mig_id}")
        actual = _sha256_file(path)
        if actual != checksum:
            raise ValueError(f"Checksum distinto para migracion aplicada: {mig_id}")


def apply_migrations(database_url: str, directory: Path = None) -> List[str]:
    if directory is None:
        directory = MIGRATIONS_DIR
    directory = Path(directory)
    files = list_migrations(directory)  # raises if missing/empty

    applied: List[str] = []
    conn = psycopg.connect(database_url, autocommit=False)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(%s)", (LOCK_KEY,))
        _ensure_schema_migrations(conn)
        conn.commit()

        # Validate precondition only on fresh bootstrap (no migrations applied yet)
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM schema_migrations")
            mig_count = cur.fetchone()[0]
        if mig_count == 0:
            validate_precondition(conn)
        # Validate full history
        validate_history(conn, directory)
        conn.commit()

        for path in files:
            mig_id = path.name
            checksum = _sha256_file(path)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT checksum FROM schema_migrations WHERE id = %s", (mig_id,)
                )
                row = cur.fetchone()
            if row is not None:
                if row[0] != checksum:
                    raise ValueError(f"Checksum distinto para migracion ya aplicada: {mig_id}")
                continue  # no-op
            try:
                sql = path.read_text(encoding="utf-8")
                conn.execute(sql)
                conn.execute(
                    "INSERT INTO schema_migrations (id, checksum) VALUES (%s, %s)",
                    (mig_id, checksum),
                )
                conn.commit()
                applied.append(mig_id)
            except Exception:
                conn.rollback()
                raise
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(%s)", (LOCK_KEY,))
        conn.commit()
    finally:
        conn.close()
    return applied