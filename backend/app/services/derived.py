"""Feed derivado de solo lectura: categorías definitivas y alertas.

No comparte `sync_changes` ni `last_sequence` con v1/v2. Los clientes desplegados
siguen recibiendo exactamente lo mismo; una entidad desconocida en su protocolo
les provoca un fallo determinista y no avanzan el cursor. Este feed usa su propio
contador (`derived_sequence`) y un cursor firmado con protocolo 3.
"""

from __future__ import annotations

from uuid import UUID

from backend.app.repositories import evaluation as repo
from backend.app.sync_cursor import (
    InvalidSyncCursor,
    cursor_key,
    decode_cursor,
    encode_cursor,
)

PROTOCOL = 3
DERIVED_ENTITIES = ("categoria", "alerta")


class DerivedUnavailable(LookupError):
    pass


def context(scope_id: UUID, device_id: UUID) -> dict:
    watermark = repo.derived_high_watermark(scope_id)
    if watermark is None:
        raise DerivedUnavailable("scope not found")
    return {
        "protocol_version": PROTOCOL,
        "scope_id": str(scope_id),
        "device_id": str(device_id),
        "supported_entities": list(DERIVED_ENTITIES),
        "limits": {"pull_default": 50, "pull_max": 100},
    }


def pull(scope_id: UUID, cursor: str | None, limit: int) -> dict:
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1 or limit > 100:
        raise InvalidSyncCursor("LIMIT_INVALID")
    signing_key = cursor_key()
    watermark = repo.derived_high_watermark(scope_id)
    if watermark is None:
        raise DerivedUnavailable("scope not found")

    if cursor is None:
        after = 0
        through = None
    else:
        position = decode_cursor(cursor, scope_id, signing_key, PROTOCOL)
        after = position.after
        through = position.through

    if through is None:
        if after > watermark:
            raise InvalidSyncCursor("CURSOR_INVALID")
        through = watermark
    elif through > watermark or after > through:
        raise InvalidSyncCursor("CURSOR_INVALID")

    rows = repo.list_derived_changes(scope_id, after, through, limit + 1)
    has_more = len(rows) > limit
    page = rows[:limit]

    items = []
    for row in page:
        snapshot = row["snapshot"]
        if not isinstance(snapshot, dict):
            raise RuntimeError("Snapshot derivado inválido")
        if row["entity"] not in DERIVED_ENTITIES:
            raise RuntimeError("Entidad derivada desconocida")
        if str(snapshot.get("id")) != str(row["record_id"]):
            raise RuntimeError("Snapshot derivado no coincide con su registro")
        if str(snapshot.get("version")) != str(row["record_version"]):
            raise RuntimeError("Versión derivada no coincide con su secuencia")
        items.append(
            {"seq": str(row["sequence"]), "entity": row["entity"], "record": snapshot}
        )

    if has_more:
        next_after = int(page[-1]["sequence"])
        next_through: int | None = through
    else:
        next_after = through
        next_through = None
    return {
        "protocol_version": PROTOCOL,
        "scope_id": str(scope_id),
        "items": items,
        "next_cursor": encode_cursor(scope_id, next_after, next_through, signing_key, PROTOCOL),
        "has_more": has_more,
    }
