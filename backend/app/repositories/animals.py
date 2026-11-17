"""Consulta de animales autorizados por ámbito para ML (D5)."""

from uuid import UUID

from backend.app.database import get_connection


def get_animal_for_scope(scope_id: UUID, animal_id: UUID) -> dict | None:
    """Return only central applicability fields; a foreign id is not found."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, sexo, estado, deleted_at FROM cuyes "
                "WHERE id = %s AND scope_id = %s AND deleted_at IS NULL",
                (animal_id, scope_id),
            )
            row = cur.fetchone()
    if row is None:
        return None
    return {"id": row[0], "sexo": row[1], "estado": row[2], "deleted_at": row[3]}
