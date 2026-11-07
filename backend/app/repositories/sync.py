"""Repositorio de sincronización sobre PostgreSQL."""

from uuid import UUID

import psycopg
import json

from backend.app.database import get_connection


def get_scope(scope_id: UUID) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, last_sequence FROM sync_scopes WHERE id = %s",
                (scope_id,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "name": row[1], "last_sequence": row[2]}


def create_scope(name: str) -> UUID:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO sync_scopes (name) VALUES (%s) RETURNING id",
                (name,),
            )
            scope_id = cur.fetchone()[0]
        conn.commit()
    return scope_id


def get_device(scope_id: UUID, token_hash: str) -> UUID | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM sync_devices WHERE scope_id = %s AND token_hash = %s",
                (scope_id, token_hash),
            )
            row = cur.fetchone()
    return row[0] if row else None


def get_device_identity_by_token_hash(token_hash: str) -> dict | None:
    """Resolve a provisioned bearer token to exactly one scope and device.

    Tokens are expected to be unique across scopes. The schema currently only
    enforces uniqueness within a scope, so ambiguous matches fail closed.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT scope_id, id FROM sync_devices WHERE token_hash = %s LIMIT 2",
                (token_hash,),
            )
            rows = cur.fetchall()
    if len(rows) != 1:
        return None
    return {"scope_id": rows[0][0], "device_id": rows[0][1]}


def register_device(scope_id: UUID, token_hash: str) -> UUID:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO sync_devices (scope_id, token_hash) VALUES (%s, %s) "
                "ON CONFLICT (scope_id, token_hash) DO NOTHING RETURNING id",
                (scope_id, token_hash),
            )
            row = cur.fetchone()
            if row is None:
                cur.execute(
                    "SELECT id FROM sync_devices WHERE scope_id = %s AND token_hash = %s",
                    (scope_id, token_hash),
                )
                row = cur.fetchone()
        conn.commit()
    return row[0]


def get_receipt(scope_id: UUID, device_id: UUID, operation_id: UUID) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT request_hash, response FROM sync_receipts "
                "WHERE scope_id = %s AND device_id = %s AND operation_id = %s",
                (scope_id, device_id, operation_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {"request_hash": row[0], "response": row[1]}


def save_receipt(scope_id: UUID, device_id: UUID, operation_id: UUID,
                 request_hash: str, response: dict) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO sync_receipts (scope_id, device_id, operation_id, request_hash, response) "
                "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (scope_id, device_id, operation_id) DO NOTHING",
                (scope_id, device_id, operation_id, request_hash, json.dumps(response)),
            )
        conn.commit()


def lock_scope(conn, scope_id: UUID) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s FOR UPDATE",
            (scope_id,),
        )


def increment_scope(conn, scope_id: UUID) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sync_scopes SET last_sequence = last_sequence + 1, updated_at = now() "
            "WHERE id = %s RETURNING last_sequence",
            (scope_id,),
        )
        return cur.fetchone()[0]


def get_galpon(scope_id: UUID, galpon_id: UUID) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, nombre, ubicacion, server_version, deleted_at "
                "FROM galpones WHERE id = %s AND scope_id = %s",
                (galpon_id, scope_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "nombre": row[1], "ubicacion": row[2],
            "version": row[3], "deleted_at": row[4]}


def upsert_galpon(scope_id: UUID, galpon_id: UUID, nombre: str, ubicacion: str | None,
                  version: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO galpones (id, scope_id, nombre, ubicacion, server_version, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, now(), now()) "
                "ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, "
                "ubicacion = EXCLUDED.ubicacion, server_version = EXCLUDED.server_version, "
                "updated_at = now()",
                (galpon_id, scope_id, nombre, ubicacion, version),
            )
        conn.commit()


def get_poza(scope_id: UUID, poza_id: UUID) -> dict | None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, galpon_id, codigo, tipo, capacidad_maxima, server_version, deleted_at "
                "FROM pozas WHERE id = %s AND scope_id = %s",
                (poza_id, scope_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "galpon_id": row[1], "codigo": row[2], "tipo": row[3],
            "capacidad": row[4], "version": row[5], "deleted_at": row[6]}


def upsert_poza(scope_id: UUID, poza_id: UUID, galpon_id: UUID, codigo: str, tipo: str,
                capacidad: int, version: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO pozas (id, scope_id, galpon_id, codigo, tipo, capacidad_maxima, "
                "server_version, created_at, updated_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, now(), now()) "
                "ON CONFLICT (id) DO UPDATE SET codigo = EXCLUDED.codigo, tipo = EXCLUDED.tipo, "
                "capacidad_maxima = EXCLUDED.capacidad_maxima, server_version = EXCLUDED.server_version, "
                "updated_at = now()",
                (poza_id, scope_id, galpon_id, codigo, tipo, capacidad, version),
            )
        conn.commit()


def insert_change(conn, scope_id: UUID, sequence: int, entity: str, record_id: UUID,
                  version: int, snapshot: dict) -> None:
    import json
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO sync_changes (scope_id, sequence, entity, record_id, record_version, snapshot) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (scope_id, sequence, entity, record_id, version, json.dumps(snapshot)),
        )


def get_receipt_conn(conn, scope_id, device_id, operation_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT request_hash, response FROM sync_receipts "
            "WHERE scope_id = %s AND device_id = %s AND operation_id = %s",
            (scope_id, device_id, operation_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"request_hash": row[0], "response": row[1]}


def save_receipt_conn(conn, scope_id, device_id, operation_id, request_hash, response):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO sync_receipts (scope_id, device_id, operation_id, request_hash, response) "
            "VALUES (%s, %s, %s, %s, %s) ON CONFLICT (scope_id, device_id, operation_id) DO NOTHING",
            (scope_id, device_id, operation_id, request_hash, __import__("json").dumps(response)),
        )


def get_galpon_conn(conn, scope_id, galpon_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, nombre, ubicacion, server_version, deleted_at, last_client_edited_at, created_at, updated_at "
            "FROM galpones WHERE id = %s AND scope_id = %s",
            (galpon_id, scope_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "nombre": row[1], "ubicacion": row[2],
            "version": row[3], "deleted_at": row[4], "last_client_edited_at": row[5],
            "created_at": row[6], "updated_at": row[7]}


def get_poza_conn(conn, scope_id, poza_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, galpon_id, codigo, tipo, capacidad_maxima, server_version, deleted_at, last_client_edited_at, created_at, updated_at "
            "FROM pozas WHERE id = %s AND scope_id = %s",
            (poza_id, scope_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "galpon_id": row[1], "codigo": row[2], "tipo": row[3],
            "capacidad": row[4], "version": row[5], "deleted_at": row[6],
            "last_client_edited_at": row[7], "created_at": row[8], "updated_at": row[9]}


def upsert_galpon_conn(conn, scope_id, galpon_id, nombre, ubicacion, version):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO galpones (id, scope_id, nombre, ubicacion, server_version, created_at, updated_at, last_client_edited_at) "
            "VALUES (%s, %s, %s, %s, %s, now(), now(), now()) "
            "ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, "
            "ubicacion = EXCLUDED.ubicacion, server_version = EXCLUDED.server_version, "
            "updated_at = now(), last_client_edited_at = now()",
            (galpon_id, scope_id, nombre, ubicacion, version),
        )


def upsert_poza_conn(conn, scope_id, poza_id, galpon_id, codigo, tipo, capacidad, version):
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO pozas (id, scope_id, galpon_id, codigo, tipo, capacidad_maxima, "
            "server_version, created_at, updated_at, last_client_edited_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, now(), now(), now()) "
            "ON CONFLICT (id) DO UPDATE SET codigo = EXCLUDED.codigo, tipo = EXCLUDED.tipo, "
            "capacidad_maxima = EXCLUDED.capacidad_maxima, server_version = EXCLUDED.server_version, "
            "updated_at = now(), last_client_edited_at = now()",
            (poza_id, scope_id, galpon_id, codigo, tipo, capacidad, version),
        )


def galpon_exists_conn(conn, scope_id, galpon_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM galpones WHERE id = %s AND scope_id = %s AND deleted_at IS NULL",
            (galpon_id, scope_id),
        )
        return cur.fetchone() is not None
