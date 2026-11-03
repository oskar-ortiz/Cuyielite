"""Repositorio de galpones y pozas sobre PostgreSQL."""

from uuid import UUID

import psycopg

from backend.app.database import get_connection


def list_galpones(limit: int, offset: int) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, nombre, ubicacion FROM galpones "
                "WHERE deleted_at IS NULL ORDER BY nombre, id "
                "LIMIT %s OFFSET %s",
                (limit, offset),
            )
            rows = cur.fetchall()
    return [{"id": r[0], "nombre": r[1], "ubicacion": r[2]} for r in rows]


def count_galpones() -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM galpones WHERE deleted_at IS NULL")
            return cur.fetchone()[0]


def galpon_exists_active(galpon_id: UUID) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM galpones WHERE id = %s AND deleted_at IS NULL",
                (galpon_id,),
            )
            return cur.fetchone() is not None


def list_pozas_by_galpon(galpon_id: UUID, limit: int, offset: int) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, galpon_id, codigo, tipo, capacidad_maxima "
                "FROM pozas WHERE galpon_id = %s AND deleted_at IS NULL "
                "ORDER BY codigo, id LIMIT %s OFFSET %s",
                (galpon_id, limit, offset),
            )
            rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "galpon_id": r[1],
            "codigo": r[2],
            "tipo": r[3],
            "capacidad_maxima": r[4],
        }
        for r in rows
    ]