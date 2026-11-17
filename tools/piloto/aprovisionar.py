"""Aprovisiona el piloto local: ámbito, cuentas de la aplicación y rol técnico del ETL.

Reutiliza los servicios existentes (`backend.app.services.auth` y
`backend.app.repositories.auth`) en vez de reimplementar el hashing ni el
acceso a `app_users`. Idempotente: si el ámbito o las cuentas ya existen, los
reutiliza y solo rota lo que se le pida explícitamente.

Las credenciales se escriben en un archivo privado fuera de Git, con acceso
restringido al usuario actual. El script nunca las imprime por stdout.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import string
import subprocess
import sys
from pathlib import Path
from uuid import UUID

from psycopg import sql

REPO_ROOT = Path(__file__).resolve().parents[2]

SCOPE_NAME = "Centro Lope"
APP_DB_ROLE = "cuyielite_etl"

# Tablas que el orquestador de promoción necesita leer y escribir: escribe el dominio,
# publica versiones e historial y cierra el lote. No incluye cuentas,
# sesiones, auditoría de acceso ni dispositivos.
ETL_TABLES = (
    "cuyes",
    "partos",
    "pesajes",
    "eventos",
    "parto_crias",
    "galpones",
    "pozas",
    "sync_scopes",
    "sync_changes",
    "importacion_lotes",
    "importacion_correspondencias",
    "importacion_origenes",
)

ALPHABET = string.ascii_letters + string.digits + "-_"


def _password(length: int = 24) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def _restrict(path: Path) -> None:
    """Restringe el archivo al usuario actual (Windows)."""
    if os.name != "nt":
        try:
            path.chmod(0o600)
        except OSError:
            pass
        return
    user = os.environ.get("USERNAME", "")
    if not user:
        return
    result = subprocess.run(
        ["icacls", str(path), "/inheritance:r", "/grant:r", f"{user}:(R,W)"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Aviso: no se pudo restringir {path.name}: {result.stderr.strip()[:120]}")


def _ensure_scope(conn, scope_name: str) -> UUID:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM sync_scopes WHERE name = %s", (scope_name,))
        row = cur.fetchone()
        if row is not None:
            return UUID(str(row[0]))
        cur.execute(
            "INSERT INTO sync_scopes(name) VALUES (%s) RETURNING id",
            (scope_name,),
        )
        created = UUID(str(cur.fetchone()[0]))
    conn.commit()
    return created


def _ensure_etl_role(conn, role_name: str, password: str) -> None:
    """Crea el rol técnico del ETL con privilegios mínimos sobre su alcance."""
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role_name,))
        exists = cur.fetchone() is not None
        literal = sql.Literal(password)
        if not exists:
            cur.execute(
                sql.SQL('CREATE ROLE {} LOGIN PASSWORD {}').format(
                    sql.Identifier(role_name), literal
                )
            )
        else:
            cur.execute(
                sql.SQL('ALTER ROLE {} LOGIN PASSWORD {}').format(
                    sql.Identifier(role_name), literal
                )
            )
        cur.execute(
            sql.SQL('GRANT CONNECT ON DATABASE {} TO {}').format(
                sql.Identifier(conn.info.dbname), sql.Identifier(role_name)
            )
        )
        cur.execute(
            sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(
                sql.Identifier(role_name)
            )
        )
        grants = sql.SQL(", ").join(sql.Identifier(table) for table in ETL_TABLES)
        cur.execute(
            sql.SQL("GRANT SELECT, INSERT, UPDATE ON {} TO {}").format(
                grants, sql.Identifier(role_name)
            )
        )
        cur.execute(
            sql.SQL("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {}").format(
                sql.Identifier(role_name)
            )
        )
    conn.commit()


def _etl_grants_are_minimal(conn, role_name: str) -> dict[str, bool]:
    """Comprueba que el rol técnico no alcanza tablas de cuentas ni sesiones."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name, has_table_privilege(%s, table_name, 'SELECT')
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
            """,
            (role_name,),
        )
        return {name: bool(allowed) for name, allowed in cur.fetchall()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Aprovisiona el piloto local: ámbito, cuentas y rol técnico del ETL"
    )
    parser.add_argument("--env-file", default=str(REPO_ROOT / ".env"))
    parser.add_argument(
        "--credentials-file",
        required=True,
        help="Ruta absoluta del archivo privado de credenciales (fuera de Git)",
    )
    parser.add_argument("--scope-name", default=SCOPE_NAME)
    parser.add_argument("--admin-user", default="lope.admin")
    parser.add_argument("--viewer-user", default="lope.viewer")
    parser.add_argument(
        "--rotate",
        action="store_true",
        help="Rota las contraseñas de las cuentas de la aplicación",
    )
    args = parser.parse_args(argv)

    env = load_env_file(Path(args.env_file))
    url = env.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL no está en el archivo de entorno", file=sys.stderr)
        return 2
    os.environ["DATABASE_URL"] = url
    for key in ("CUYIELITE_AUTH_JWT_SECRET", "CUYIELITE_AUTH_ISSUER", "CUYIELITE_AUTH_AUDIENCE"):
        if env.get(key):
            os.environ[key] = env[key]

    import psycopg

    from backend.app.repositories import auth as auth_repo
    from backend.app.services import auth as auth_service

    with psycopg.connect(url) as conn:
        scope_id = _ensure_scope(conn, args.scope_name)
        etl_password = _password()
        _ensure_etl_role(conn, APP_DB_ROLE, etl_password)
        grants = _etl_grants_are_minimal(conn, APP_DB_ROLE)

    accounts: list[dict[str, str]] = []
    for username, role in ((args.admin_user, "admin"), (args.viewer_user, "viewer")):
        existing = auth_repo.get_user_by_username(username)
        if existing is not None and not args.rotate:
            accounts.append(
                {
                    "username": username,
                    "role": role,
                    "scope_id": str(existing["scope_id"]),
                    "estado": "existente (sin rotar)",
                    "password": "",
                }
            )
            continue
        password = _password(20)
        if existing is None:
            auth_repo.create_user(
                username,
                auth_service.hash_password(password),
                role,
                scope_id,
                must_change_password=True,
            )
            estado = "creada"
        else:
            auth_repo.update_password(
                UUID(str(existing["id"])),
                auth_service.hash_password(password),
            )
            estado = "contraseña rotada"
        accounts.append(
            {
                "username": username,
                "role": role,
                "scope_id": str(scope_id),
                "estado": estado,
                "password": password,
            }
        )

    payload = {
        "instalacion": "piloto local",
        "ambito": {"nombre": args.scope_name, "scope_id": str(scope_id)},
        "cuentas": accounts,
        "acceso_tecnico_etl": {
            "rol_postgresql": APP_DB_ROLE,
            "password": etl_password,
            "database_url": f"postgresql://{APP_DB_ROLE}:{etl_password}@127.0.0.1:{env.get('DB_PORT', '5434')}/cuyielite",
        },
        "notas": [
            "Este archivo es privado: no subirlo a Git ni pegarlo en tickets.",
            "Cambiar la contraseña de una cuenta: python -m backend.app.auth_cli set-password --usuario <cuenta>.",
        ],
    }

    credentials_path = Path(args.credentials_file)
    credentials_path.parent.mkdir(parents=True, exist_ok=True)
    credentials_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    _restrict(credentials_path)

    print(f"Ámbito '{args.scope_name}': {scope_id}")
    for account in accounts:
        print(f"Cuenta {account['username']} ({account['role']}): {account['estado']}")
    print(f"Rol técnico PostgreSQL: {APP_DB_ROLE}")
    print(f"Credenciales: {credentials_path}")
    print(
        "El rol técnico tiene lectura/escritura solo en: "
        + ", ".join(ETL_TABLES)
    )
    print(
        "Sin acceso a cuentas ni sesiones: "
        + str(
            not any(
                grants.get(table, False)
                for table in ("app_users", "auth_sessions", "auth_audit", "sync_devices")
            )
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
