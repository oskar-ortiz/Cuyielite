"""Acceso SQL para evaluación persistente, alertas y feed derivado.

Todas las funciones reciben una conexión con transacción abierta. No confirman
ni revierten: el servicio que orquesta decide el COMMIT.
"""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row


CATEGORY_COLUMNS = (
    "categoria_ml",
    "categoria_estado",
    "categoria_motivos",
    "categoria_faltantes",
    "categoria_reglas_version",
    "categoria_evaluada_at",
    "categoria_procedencia",
    "categoria_server_version",
)


def get_animal_for_update(conn, scope_id: UUID, cuy_id: UUID) -> dict[str, Any] | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, sexo, estado, deleted_at, server_version, "
            + ", ".join(CATEGORY_COLUMNS)
            + " FROM cuyes WHERE id = %s AND scope_id = %s FOR UPDATE",
            (cuy_id, scope_id),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def partos_summary(conn, scope_id: UUID, madre_id: UUID) -> dict[str, Any]:
    """Resumen central de partos: total, último parto y el cuarto declarado.

    `cuarto` solo se completa cuando `numero_parto = 4` identifica sin ambigüedad
    el evento causal; si la columna es nula no se infiere.
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT count(*) AS total, max(fecha_parto) AS ultima_fecha, "
            "max(server_version) AS max_version "
            "FROM partos WHERE madre_id = %s AND scope_id = %s AND deleted_at IS NULL",
            (madre_id, scope_id),
        )
        summary = dict(cur.fetchone() or {})
        cur.execute(
            "SELECT id FROM partos WHERE madre_id = %s AND scope_id = %s "
            "AND deleted_at IS NULL ORDER BY fecha_parto DESC NULLS LAST, id DESC LIMIT 1",
            (madre_id, scope_id),
        )
        latest = cur.fetchone()
        cur.execute(
            "SELECT id, fecha_parto FROM partos "
            "WHERE madre_id = %s AND scope_id = %s AND deleted_at IS NULL AND numero_parto = 4 "
            "ORDER BY fecha_parto NULLS LAST, id LIMIT 2",
            (madre_id, scope_id),
        )
        cuartos = [dict(row) for row in cur.fetchall()]
    return {
        "total": int(summary.get("total") or 0),
        "ultima_fecha": summary.get("ultima_fecha"),
        "ultimo_parto_id": latest["id"] if latest else None,
        "max_version": int(summary.get("max_version") or 0),
        "cuarto": cuartos[0] if len(cuartos) == 1 else None,
        "cuarto_ambiguo": len(cuartos) > 1,
    }


def update_category(
    conn,
    scope_id: UUID,
    cuy_id: UUID,
    *,
    clase: str,
    estado: str,
    motivos: list[str],
    faltantes: list[str],
    reglas_version: str,
    procedencia: str,
    bump_version: bool,
) -> int:
    """Escribe la categoría definitiva y su procedencia.

    `bump_version` solo es cierto cuando cambia el contenido que se publica en el
    feed derivado; una re-evaluación idéntica no crea versión nueva.
    """
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE cuyes SET categoria_ml = %s, categoria_estado = %s, "
            "categoria_motivos = %s::jsonb, categoria_faltantes = %s::jsonb, "
            "categoria_reglas_version = %s, categoria_evaluada_at = now(), "
            "categoria_procedencia = %s::jsonb, "
            "categoria_server_version = categoria_server_version + %s, "
            "updated_at = now() "
            "WHERE id = %s AND scope_id = %s "
            "RETURNING categoria_server_version",
            (
                clase,
                estado,
                _json(motivos),
                _json(faltantes),
                reglas_version,
                procedencia,
                1 if bump_version else 0,
                cuy_id,
                scope_id,
            ),
        )
        row = cur.fetchone()
    if row is None:
        raise LookupError("cuy desapareció durante la evaluación")
    return int(row[0])


def mark_category_historical(conn, scope_id: UUID, cuy_id: UUID) -> int:
    """Marca la categoría previa como no confirmada sin borrarla."""
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE cuyes SET categoria_estado = 'HISTORICA', "
            "categoria_evaluada_at = now(), "
            "categoria_server_version = categoria_server_version + 1, "
            "updated_at = now() "
            "WHERE id = %s AND scope_id = %s AND categoria_ml IS NOT NULL AND "
            "categoria_estado IS DISTINCT FROM 'HISTORICA' "
            "RETURNING categoria_server_version",
            (cuy_id, scope_id),
        )
        row = cur.fetchone()
    return int(row[0]) if row else 0


def latest_derived(
    conn, scope_id: UUID, entity: str, record_id: UUID
) -> dict[str, Any] | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT record_version, snapshot FROM sync_derived_changes "
            "WHERE scope_id = %s AND entity = %s AND record_id = %s "
            "ORDER BY sequence DESC LIMIT 1",
            (scope_id, entity, record_id),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def list_alerts(conn, scope_id: UUID, cuy_id: UUID | None = None) -> list[dict[str, Any]]:
    sql = (
        "SELECT id, cuy_id, tipo_alerta, regla_id, motivo, estado, causa_tipo, "
        "causa_id, causa_fecha, fecha_limite, reglas_version, server_version, "
        "derived_sequence, created_at, updated_at, closed_at, closed_reason "
        "FROM alertas WHERE scope_id = %s AND deleted_at IS NULL"
    )
    params: list[Any] = [scope_id]
    if cuy_id is not None:
        sql += " AND cuy_id = %s"
        params.append(cuy_id)
    sql += " ORDER BY created_at, id"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def active_alerts(conn, scope_id: UUID, cuy_id: UUID) -> list[dict[str, Any]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, cuy_id, tipo_alerta, regla_id, motivo, estado, causa_tipo, "
            "causa_id, causa_fecha, fecha_limite, reglas_version, server_version "
            "FROM alertas WHERE scope_id = %s AND cuy_id = %s AND estado = 'activa' "
            "AND deleted_at IS NULL ORDER BY id",
            (scope_id, cuy_id),
        )
        return [dict(row) for row in cur.fetchall()]


def insert_alert(
    conn,
    scope_id: UUID,
    cuy_id: UUID,
    *,
    tipo_alerta: str,
    regla_id: str,
    motivo: str,
    causa_tipo: str,
    causa_id: UUID | None,
    causa_fecha: date | None,
    fecha_limite: date | None,
    reglas_version: str,
) -> dict[str, Any]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "INSERT INTO alertas (cuy_id, scope_id, tipo_alerta, regla_id, motivo, estado, "
            "causa_tipo, causa_id, causa_fecha, fecha_limite, reglas_version, server_version) "
            "VALUES (%s, %s, %s, %s, %s, 'activa', %s, %s, %s, %s, %s, 1) "
            "RETURNING id, cuy_id, tipo_alerta, regla_id, motivo, estado, causa_tipo, "
            "causa_id, causa_fecha, fecha_limite, reglas_version, server_version",
            (
                cuy_id,
                scope_id,
                tipo_alerta,
                regla_id,
                motivo,
                causa_tipo,
                causa_id,
                causa_fecha,
                fecha_limite,
                reglas_version,
            ),
        )
        return dict(cur.fetchone())


def close_alert(conn, alerta_id: UUID, reason: str) -> dict[str, Any]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "UPDATE alertas SET estado = 'obsoleta', closed_at = now(), closed_reason = %s, "
            "server_version = server_version + 1, updated_at = now() "
            "WHERE id = %s AND estado = 'activa' "
            "RETURNING id, cuy_id, tipo_alerta, regla_id, motivo, estado, causa_tipo, "
            "causa_id, causa_fecha, fecha_limite, reglas_version, server_version",
            (reason, alerta_id),
        )
        row = cur.fetchone()
    if row is None:
        raise LookupError("la alerta ya no estaba activa")
    return dict(row)


def next_derived_sequence(conn, scope_id: UUID) -> int:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sync_scopes SET derived_sequence = derived_sequence + 1 "
            "WHERE id = %s RETURNING derived_sequence",
            (scope_id,),
        )
        row = cur.fetchone()
    if row is None:
        raise LookupError("scope not found")
    return int(row[0])


def insert_derived(
    conn,
    scope_id: UUID,
    entity: str,
    record_id: UUID,
    record_version: int,
    snapshot: dict[str, Any],
) -> int:
    from psycopg.types.json import Jsonb

    sequence = next_derived_sequence(conn, scope_id)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO sync_derived_changes "
            "(scope_id, sequence, entity, record_id, record_version, snapshot) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (scope_id, sequence, entity, record_id, record_version, Jsonb(snapshot)),
        )
    return sequence


def set_alert_sequence(conn, alerta_id: UUID, sequence: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE alertas SET derived_sequence = %s WHERE id = %s",
            (sequence, alerta_id),
        )


def list_derived_changes(
    scope_id: UUID, after: int, through: int, limit: int
) -> list[dict[str, Any]]:
    from backend.app.database import get_connection

    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT sequence, entity, record_id, record_version, snapshot, committed_at "
                "FROM sync_derived_changes "
                "WHERE scope_id = %s AND sequence > %s AND sequence <= %s "
                "ORDER BY sequence LIMIT %s",
                (scope_id, after, through, limit),
            )
            rows = [dict(row) for row in cur.fetchall()]
        conn.rollback()
    return rows


def derived_high_watermark(scope_id: UUID) -> int | None:
    from backend.app.database import get_connection

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT derived_sequence FROM sync_scopes WHERE id = %s", (scope_id,)
            )
            row = cur.fetchone()
        conn.rollback()
    return int(row[0]) if row else None


def _json(value: Any) -> str:
    import json

    return json.dumps(value, ensure_ascii=False, sort_keys=True)
