"""Acceso SQL para la primitiva de publicación de dominio D1."""

from typing import Any
from uuid import UUID

from psycopg.rows import dict_row


def lock_scope(conn, scope_id: UUID) -> int:
    """Lock the scope row and return its current sequence.

    The caller owns the transaction. This function never commits or rolls back.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id = %s FOR UPDATE",
            (scope_id,),
        )
        row = cur.fetchone()
    if row is None:
        raise LookupError("scope not found")
    return int(row["last_sequence"])


def get_record(conn, table: str, record_id: UUID, fields: tuple[str, ...]) -> dict[str, Any] | None:
    """Read the final domain row under the caller's lock."""
    business = tuple(field for field in fields if field != "deleted_at")
    columns = ", ".join(business)
    if table == "parto_crias":
        metadata = "created_at, created_at AS updated_at, NULL::timestamptz AS deleted_at, last_client_edited_at"
    else:
        metadata = "created_at, updated_at, deleted_at, last_client_edited_at"
    sql = f"SELECT id, scope_id, server_version, {metadata}, {columns} FROM {table} WHERE id = %s FOR UPDATE"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, (record_id,))
        return cur.fetchone()


def get_latest_snapshot(
    conn,
    scope_id: UUID,
    entity: str,
    record_id: UUID,
    version: int,
) -> dict[str, Any] | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT snapshot FROM sync_changes "
            "WHERE scope_id = %s AND entity = %s AND record_id = %s AND record_version = %s "
            "ORDER BY sequence DESC LIMIT 1",
            (scope_id, entity, record_id, version),
        )
        row = cur.fetchone()
    return row["snapshot"] if row else None


def update_published_version(conn, table: str, record_id: UUID, scope_id: UUID, version: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE {table} SET server_version = %s WHERE id = %s AND scope_id = %s",
            (version, record_id, scope_id),
        )
        if cur.rowcount != 1:
            raise LookupError("domain row disappeared during publication")


def increment_scope(conn, scope_id: UUID) -> int:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "UPDATE sync_scopes SET last_sequence = last_sequence + 1, updated_at = now() "
            "WHERE id = %s RETURNING last_sequence",
            (scope_id,),
        )
        row = cur.fetchone()
    if row is None:
        raise LookupError("scope not found")
    return int(row["last_sequence"])


def insert_change(
    conn,
    scope_id: UUID,
    sequence: int,
    entity: str,
    record_id: UUID,
    version: int,
    snapshot: dict[str, Any],
) -> None:
    from backend.app.repositories.sync import insert_change as insert_change_json

    insert_change_json(conn, scope_id, sequence, entity, record_id, version, snapshot)


def get_reference_scope(conn, table: str, record_id: UUID) -> UUID | None:
    with conn.cursor() as cur:
        cur.execute(f"SELECT scope_id FROM {table} WHERE id = %s", (record_id,))
        row = cur.fetchone()
    return row[0] if row else None


def get_parto_madre(conn, scope_id: UUID, parto_id: UUID) -> UUID | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT madre_id FROM partos WHERE id = %s AND scope_id = %s",
            (parto_id, scope_id),
        )
        row = cur.fetchone()
    return row[0] if row else None


def get_evento_cuy(conn, scope_id: UUID, evento_id: UUID) -> UUID | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT cuy_id FROM eventos WHERE id = %s AND scope_id = %s",
            (evento_id, scope_id),
        )
        row = cur.fetchone()
    return row[0] if row else None


def parto_tiene_cria(conn, scope_id: UUID, parto_id: UUID, cuy_id: UUID) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM parto_crias WHERE parto_id = %s AND cuy_id = %s AND scope_id = %s",
            (parto_id, cuy_id, scope_id),
        )
        return cur.fetchone() is not None
