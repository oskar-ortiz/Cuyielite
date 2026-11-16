"""Acceso SQL para evaluaciÃ³n persistente, alertas y feed derivado.

Todas las funciones reciben una conexiÃ³n con transacciÃ³n abierta. No confirman
ni revierten: el servicio que orquesta decide el COMMIT.
"""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row


CATEGORY_COLUMNS = (
    "categoria_ml",
    "categoria_caracter",
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
    """Resumen central de partos: total, Ãºltimo parto y el cuarto declarado.

    `cuarto` solo se completa cuando `numero_parto = 4` identifica sin ambigÃ¼edad
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
    caracter: str | None,
    motivos: list[str],
    faltantes: list[str],
    reglas_version: str,
    procedencia: str,
    bump_version: bool,
) -> int:
    """Escribe la categorÃ­a definitiva y su procedencia.

    `bump_version` solo es cierto cuando cambia el contenido que se publica en el
    feed derivado; una re-evaluaciÃ³n idÃ©ntica no crea versiÃ³n nueva.
    """
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE cuyes SET categoria_ml = %s, categoria_estado = %s, categoria_caracter = %s, "
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
                caracter,
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
        raise LookupError("cuy desapareciÃ³ durante la evaluaciÃ³n")
    return int(row[0])


def mark_category_historical(conn, scope_id: UUID, cuy_id: UUID) -> int:
    """Marca la categorÃ­a previa como no confirmada sin borrarla."""
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


EVIDENCE_COLUMNS = (
    "id",
    "campo",
    "valor",
    "origen",
    "archivo_huella",
    "hoja",
    "fila",
    "celda",
    "parser_version",
    "mapeo_version",
    "estado",
    "declarada_por",
    "revisada_por",
    "revisada_at",
    "nota",
    "server_version",
    "updated_at",
)


def list_evidence(conn, scope_id: UUID, cuy_id: UUID) -> list[dict[str, Any]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT " + ", ".join(EVIDENCE_COLUMNS) + " FROM evidencias_evaluacion "
            "WHERE scope_id = %s AND cuy_id = %s ORDER BY campo",
            (scope_id, cuy_id),
        )
        return [dict(row) for row in cur.fetchall()]


def reviewed_evidence(conn, scope_id: UUID, cuy_id: UUID) -> dict[str, str]:
    """Solo evidencia REVISADA y con valor; el resto no autoriza persistencia."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT campo, valor FROM evidencias_evaluacion "
            "WHERE scope_id = %s AND cuy_id = %s AND estado = 'REVISADA' AND valor IS NOT NULL",
            (scope_id, cuy_id),
        )
        return {row["campo"]: row["valor"] for row in cur.fetchall()}


def upsert_evidence(
    conn,
    scope_id: UUID,
    cuy_id: UUID,
    campo: str,
    valor: str | None,
    *,
    origen: str,
    declarada_por: UUID | None,
    archivo_huella: str | None = None,
    hoja: str | None = None,
    fila: int | None = None,
    celda: str | None = None,
    parser_version: str | None = None,
    mapeo_version: str | None = None,
) -> dict[str, Any]:
    """Registra una declaraciÃ³n. Vuelve a DECLARADA: una declaraciÃ³n nueva no
    conserva la revisiÃ³n anterior."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "INSERT INTO evidencias_evaluacion "
            "(scope_id, cuy_id, campo, valor, origen, archivo_huella, hoja, fila, celda, "
            "parser_version, mapeo_version, estado, declarada_por) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'DECLARADA', %s) "
            "ON CONFLICT (scope_id, cuy_id, campo) DO UPDATE SET "
            "valor = excluded.valor, origen = excluded.origen, "
            "archivo_huella = excluded.archivo_huella, hoja = excluded.hoja, fila = excluded.fila, "
            "celda = excluded.celda, parser_version = excluded.parser_version, "
            "mapeo_version = excluded.mapeo_version, estado = 'DECLARADA', "
            "declarada_por = excluded.declarada_por, revisada_por = NULL, revisada_at = NULL, "
            "nota = NULL, server_version = evidencias_evaluacion.server_version + 1, "
            "updated_at = now() "
            "RETURNING " + ", ".join(EVIDENCE_COLUMNS),
            (
                scope_id,
                cuy_id,
                campo,
                valor,
                origen,
                archivo_huella,
                hoja,
                fila,
                celda,
                parser_version,
                mapeo_version,
                declarada_por,
            ),
        )
        return dict(cur.fetchone())


def review_evidence(
    conn,
    scope_id: UUID,
    cuy_id: UUID,
    campo: str,
    decision: str,
    reviewer: UUID | None,
    nota: str | None,
) -> dict[str, Any] | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "UPDATE evidencias_evaluacion SET estado = %s, revisada_por = %s, "
            "revisada_at = now(), nota = %s, "
            "server_version = server_version + 1, updated_at = now() "
            "WHERE scope_id = %s AND cuy_id = %s AND campo = %s "
            "RETURNING " + ", ".join(EVIDENCE_COLUMNS),
            (decision, reviewer, nota, scope_id, cuy_id, campo),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def get_evidence(conn, scope_id: UUID, cuy_id: UUID, campo: str) -> dict[str, Any] | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT " + ", ".join(EVIDENCE_COLUMNS) + " FROM evidencias_evaluacion "
            "WHERE scope_id = %s AND cuy_id = %s AND campo = %s",
            (scope_id, cuy_id, campo),
        )
        row = cur.fetchone()
    return dict(row) if row else None

def get_animal(conn, scope_id: UUID, cuy_id: UUID) -> dict[str, Any] | None:
    """Lectura sin bloqueo, con la misma forma que get_animal_for_update."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT id, sexo, estado, deleted_at, server_version, "
            + ", ".join(CATEGORY_COLUMNS)
            + " FROM cuyes WHERE id = %s AND scope_id = %s",
            (cuy_id, scope_id),
        )
        row = cur.fetchone()
    return dict(row) if row else None