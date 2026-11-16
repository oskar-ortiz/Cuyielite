"""Revisión acotada de alertas creadas por la causa propuesta de dos abortos.

Diery confirmó que dos abortos es una PROPUESTA y no un criterio oficial. Las
alertas que se hayan generado antes con esa regla deben revisarse de forma
explícita: este comando no barre la base, no toca alertas confirmadas y no usa
`atendida`. Por defecto solo informa (dry-run).

Uso:
    python -m backend.app.alertas_cli --scope <UUID>                 # dry-run
    python -m backend.app.alertas_cli --scope <UUID> --apply --responsable "Nombre y apellido"

Solo cierra alertas ACTIVAS con regla exactamente `abortos_repetidos_descarte`.
Si un registro no coincide con esa regla, se deja intacto y se informa.
"""

from __future__ import annotations

import argparse
import json
import sys
from uuid import UUID

from backend.app.database import get_connection
from backend.app.repositories import evaluation as repo
from backend.app.services import evaluation as evaluation_service

REGLA_PROPUESTA = "abortos_repetidos_descarte"
MOTIVO_CIERRE = "CAUSA_PROPUESTA_NO_OFICIAL"


def _afectadas(conn, scope_id: UUID, cuy_id: UUID | None) -> list[dict]:
    sql = (
        "SELECT id, cuy_id, regla_id, motivo, estado, causa_tipo, causa_id, created_at "
        "FROM alertas WHERE scope_id = %s AND tipo_alerta = 'DESCARTE_REPRODUCTORA' "
        "AND estado = 'activa' AND deleted_at IS NULL"
    )
    params: list = [scope_id]
    if cuy_id is not None:
        sql += " AND cuy_id = %s"
        params.append(cuy_id)
    sql += " ORDER BY created_at, id"
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        columns = [item[0] for item in cur.description]
    return [dict(zip(columns, row)) for row in rows]


def _auditar(conn, scope_id: UUID, alerta: dict, responsable: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO auth_audit (event, user_id, device_id, scope_id, ip, detail) "
            "VALUES ('alerta_propuesta_obsoleta', NULL, NULL, %s, NULL, %s)",
            (
                scope_id,
                json.dumps(
                    {
                        "alerta_id": str(alerta["id"]),
                        "cuy_id": str(alerta["cuy_id"]),
                        "regla_id": alerta["regla_id"],
                        "causa": alerta["motivo"],
                        "responsable": responsable,
                        "motivo_cierre": MOTIVO_CIERRE,
                    },
                    ensure_ascii=False,
                ),
            ),
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Revisión de alertas de la causa propuesta")
    parser.add_argument("--scope", required=True, help="UUID del ámbito")
    parser.add_argument("--cuy", default=None, help="Limitar a un animal")
    parser.add_argument("--apply", action="store_true", help="Ejecuta el cierre (sin esto es dry-run)")
    parser.add_argument("--responsable", default=None, help="Responsable de la revisión (obligatorio con --apply)")
    args = parser.parse_args(argv)

    scope_id = UUID(args.scope)
    cuy_id = UUID(args.cuy) if args.cuy else None
    if args.apply and not (args.responsable or "").strip():
        print("Falta --responsable: una corrección auditable exige responsable.", file=sys.stderr)
        return 2

    with get_connection() as conn:
        alertas = _afectadas(conn, scope_id, cuy_id)
        propuestas = [item for item in alertas if item["regla_id"] == REGLA_PROPUESTA]
        otras = [item for item in alertas if item["regla_id"] != REGLA_PROPUESTA]

        print(f"Ámbito {scope_id}: {len(propuestas)} alerta(s) de la causa propuesta.")
        for item in propuestas:
            print(
                f"  - {item['id']} cuy={item['cuy_id']} regla={item['regla_id']} "
                f"causa={item['causa_tipo']} motivo={item['motivo']!r} creada={item['created_at']}"
            )
        if otras:
            print(f"  {len(otras)} alerta(s) activas con otra regla: se dejan intactas.")
            for item in otras:
                print(f"  = {item['id']} regla={item['regla_id']} (no se modifica)")

        if not args.apply:
            print("Dry-run: no se modificó nada. Repetir con --apply --responsable para ejecutar.")
            conn.rollback()
            return 0

        for item in propuestas:
            cerrada = repo.close_alert(conn, item["id"], MOTIVO_CIERRE)
            repo.insert_derived(
                conn,
                scope_id,
                "alerta",
                cerrada["id"],
                int(cerrada["server_version"]),
                evaluation_service._alert_snapshot(cerrada, evaluation_service._now_iso()),
            )
            _auditar(conn, scope_id, item, args.responsable.strip())
        conn.commit()
        print(f"Aplicado: {len(propuestas)} alerta(s) marcadas como obsoletas por {args.responsable}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
