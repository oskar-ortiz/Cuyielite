"""Primitiva de publicación de cambios de dominio (D1).

La conexión y la transacción pertenecen al orquestador del ETL. Esta función
solo valida y publica metadatos, historial y contador sobre esa transacción.
No abre conexiones, no inicia transacciones, no confirma ni revierte y no
escribe campos de negocio.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
import math
from typing import Any
from uuid import UUID

from psycopg.pq import TransactionStatus

from backend.app.repositories import publication as repo


class PublicacionError(ValueError):
    """Error de contrato de publicación; el llamador debe revertir la transacción."""

    def __init__(self, codigo: str, mensaje: str):
        self.codigo = codigo
        self.mensaje = mensaje
        super().__init__(f"{codigo}: {mensaje}")


@dataclass(frozen=True)
class RegistroPublicacion:
    entity: str
    id: UUID | str
    expected_version: int | str | None
    before: Mapping[str, Any] | None
    after: Mapping[str, Any]


@dataclass(frozen=True)
class ResultadoPublicacion:
    entity: str
    id: UUID
    version: int
    sequence: int | None
    changed: bool


# Nombres de contrato. Los dos identificadores v1 (galpon|poza) no se incluyen:
# su publicación sigue en el servicio existente y v1 no se modifica en D1.
ENTITY_TABLES = {
    "cuyes": "cuyes",
    "partos": "partos",
    "pesajes": "pesajes",
    "eventos": "eventos",
    "parto_crias": "parto_crias",
}

PUBLISHABLE_FIELDS: dict[str, tuple[str, ...]] = {
    "cuyes": (
        "poza_id",
        "galpon_origen_id",
        "codigo_identificacion",
        "sexo",
        "fecha_nacimiento",
        "color_codigo",
        "ojos_codigo",
        "pelaje_original",
        "padre_id",
        "madre_id",
        "categoria_ml",
        "ultimo_peso_g",
        "estado",
        "deleted_at",
    ),
    "partos": (
        "madre_id",
        "fecha_parto",
        "numero_parto",
        "nacidos_vivos",
        "nacidos_muertos",
        "tamano_camada_nacida",
        "deleted_at",
    ),
    "pesajes": (
        "cuy_id",
        "fecha_pesaje",
        "peso_gramos",
        "etapa",
        "parto_id",
        "evento_id",
        "deleted_at",
    ),
    "eventos": (
        "cuy_id",
        "tipo",
        "fecha",
        "macho_id",
        "poza_origen_id",
        "poza_destino_id",
        "detalle",
        "deleted_at",
    ),
    "parto_crias": ("parto_id", "cuy_id", "rol"),
}

REFERENCE_FIELDS: dict[str, dict[str, str]] = {
    "cuyes": {
        "poza_id": "pozas",
        "galpon_origen_id": "galpones",
        "padre_id": "cuyes",
        "madre_id": "cuyes",
    },
    "partos": {"madre_id": "cuyes"},
    "pesajes": {"cuy_id": "cuyes", "parto_id": "partos", "evento_id": "eventos"},
    "eventos": {
        "cuy_id": "cuyes",
        "macho_id": "cuyes",
        "poza_origen_id": "pozas",
        "poza_destino_id": "pozas",
    },
    "parto_crias": {"parto_id": "partos", "cuy_id": "cuyes"},
}

UUID_FIELDS = frozenset(
    {
        "poza_id",
        "galpon_origen_id",
        "padre_id",
        "madre_id",
        "cuy_id",
        "parto_id",
        "evento_id",
        "macho_id",
        "poza_origen_id",
        "poza_destino_id",
    }
)
DATE_FIELDS = frozenset({"fecha_nacimiento", "fecha_parto", "fecha_pesaje", "fecha"})
DATETIME_FIELDS = frozenset({"deleted_at"})
DECIMAL_FIELDS = frozenset({"ultimo_peso_g", "peso_gramos"})
INTEGER_FIELDS = frozenset(
    {"numero_parto", "nacidos_vivos", "nacidos_muertos", "tamano_camada_nacida"}
)



def _fail(codigo: str, mensaje: str) -> None:
    raise PublicacionError(codigo, mensaje)


def _as_uuid(value: Any, field: str) -> UUID:
    if isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except (TypeError, ValueError) as error:
        raise PublicacionError("IDENTIFICADOR_INVALIDO", f"{field} no es UUID") from error


def _as_version(value: Any, field: str) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise PublicacionError("VERSION_INVALIDA", f"{field} no es un entero")
    try:
        number = int(str(value))
    except (TypeError, ValueError) as error:
        raise PublicacionError("VERSION_INVALIDA", f"{field} no es un entero") from error
    if str(value).strip() not in {str(number), str(number) + ".0"} or number < 1:
        raise PublicacionError("VERSION_INVALIDA", f"{field} debe ser un entero positivo")
    return number


def _canonical(value: Any, field: str) -> Any:
    if value is None:
        return ("null",)
    if field in UUID_FIELDS:
        try:
            return ("uuid", str(UUID(str(value))).lower())
        except (TypeError, ValueError) as error:
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es UUID") from error
    if field in DATE_FIELDS:
        if isinstance(value, datetime):
            return ("date", value.date().isoformat())
        if isinstance(value, date):
            return ("date", value.isoformat())
        try:
            return ("date", date.fromisoformat(str(value)).isoformat())
        except (TypeError, ValueError) as error:
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es fecha ISO") from error
    if field in DATETIME_FIELDS:
        if isinstance(value, datetime):
            return ("datetime", value.isoformat())
        if isinstance(value, date):
            return ("datetime", datetime.combine(value, datetime.min.time()).isoformat())
        try:
            return ("datetime", datetime.fromisoformat(str(value).replace("Z", "+00:00")).isoformat())
        except (TypeError, ValueError) as error:
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es timestamp ISO") from error
    if field in DECIMAL_FIELDS:
        try:
            number = Decimal(str(value))
        except (ArithmeticError, ValueError) as error:
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es decimal") from error
        if not number.is_finite():
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es finito")
        return ("number", str(number.normalize()))
    if field in INTEGER_FIELDS:
        if isinstance(value, bool):
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es entero")
        try:
            number = int(str(value))
        except (TypeError, ValueError) as error:
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es entero") from error
        if str(value).strip() not in {str(number), str(number) + ".0"}:
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es entero")
        return ("int", number)
    if isinstance(value, bool):
        return ("bool", value)
    if isinstance(value, (int, float, Decimal)):
        if isinstance(value, float) and not math.isfinite(value):
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es finito")
        return ("number", str(Decimal(str(value)).normalize()))
    if isinstance(value, UUID):
        return ("uuid", str(value).lower())
    if isinstance(value, datetime):
        return ("datetime", value.isoformat())
    if isinstance(value, date):
        return ("date", value.isoformat())
    if isinstance(value, str):
        return ("str", value)
    raise PublicacionError("VALOR_INVALIDO", f"{field} no es un valor escalar publicable")


def _json_value(value: Any, field: str) -> Any:
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, (int, float, Decimal)):
        if isinstance(value, float) and not math.isfinite(value):
            raise PublicacionError("VALOR_INVALIDO", f"{field} no es finito")
        if isinstance(value, Decimal):
            return format(value, "f")
        return value
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    raise PublicacionError("VALOR_INVALIDO", f"{field} no se puede serializar")


def _fields(entity: str) -> tuple[str, ...]:
    if entity not in PUBLISHABLE_FIELDS:
        _fail("ENTIDAD_NO_PERMITIDA", f"entidad no publicable en D1: {entity}")
    return PUBLISHABLE_FIELDS[entity]


def _validate_record(entity: str, value: Mapping[str, Any] | None, label: str) -> dict[str, Any] | None:
    if value is None:
        return None
    if not isinstance(value, Mapping):
        _fail("CAMPOS_INVALIDOS", f"{label} debe ser un objeto")
    expected = set(_fields(entity))
    present = set(value)
    if present != expected:
        missing = sorted(expected - present)
        extra = sorted(present - expected)
        _fail(
            "CAMPOS_INVALIDOS",
            f"{label} no coincide con {entity}; faltan={missing}, sobran={extra}",
        )
    return {field: value[field] for field in _fields(entity)}


def _same(left: Mapping[str, Any], right: Mapping[str, Any], entity: str) -> bool:
    for field in _fields(entity):
        if _canonical(left.get(field), field) != _canonical(right.get(field), field):
            return False
    return True


def _row_fields(row: Mapping[str, Any], entity: str) -> dict[str, Any]:
    return {field: row[field] for field in _fields(entity)}


def _snapshot(row: Mapping[str, Any], entity: str, version: int) -> dict[str, Any]:
    data = {
        field: _json_value(row[field], field)
        for field in _fields(entity)
        if field != "deleted_at"
    }
    return {
        "id": str(row["id"]),
        "version": str(version),
        "created_at": _json_value(row["created_at"], "created_at"),
        "updated_at": _json_value(row.get("updated_at") or row["created_at"], "updated_at"),
        "deleted_at": _json_value(row.get("deleted_at"), "deleted_at") if "deleted_at" in _fields(entity) else None,
        "last_client_edited_at": _json_value(row.get("last_client_edited_at"), "last_client_edited_at"),
        "data": data,
    }


def _snapshot_fields(snapshot: Mapping[str, Any], entity: str) -> dict[str, Any]:
    data = snapshot.get("data")
    if not isinstance(data, Mapping):
        _fail("HISTORIAL_INCONSISTENTE", "snapshot sin data")
    result = {field: data.get(field) for field in _fields(entity) if field != "deleted_at"}
    if "deleted_at" in _fields(entity):
        result["deleted_at"] = snapshot.get("deleted_at")
    return result


def _ensure_transaction(conn) -> None:
    if conn.closed:
        _fail("SIN_TRANSACCION", "la conexión está cerrada")
    if conn.autocommit:
        _fail("SIN_TRANSACCION", "la conexión no puede estar en autocommit")
    if conn.info.transaction_status != TransactionStatus.INTRANS:
        _fail("SIN_TRANSACCION", "el llamador debe tener una transacción activa")


def _validate_references(conn, scope_id: UUID, entity: str, after: Mapping[str, Any]) -> None:
    for field, table in REFERENCE_FIELDS[entity].items():
        value = after.get(field)
        if value is None:
            continue
        referenced_id = _as_uuid(value, field)
        reference_scope = repo.get_reference_scope(conn, table, referenced_id)
        if reference_scope is None:
            _fail("REFERENCIA_INVALIDA", f"{entity}.{field} no existe en {table}")
        if reference_scope != scope_id:
            _fail("REFERENCIA_FUERA_DE_AMBITO", f"{entity}.{field} no pertenece al ámbito")
    if entity == "pesajes" and after.get("parto_id") is not None and after.get("evento_id") is not None:
        _fail("VINCULO_INVALIDO", "un pesaje admite a lo sumo parto_id o evento_id")
    if entity == "pesajes":
        cuy_id = _as_uuid(after["cuy_id"], "cuy_id")
        if after.get("parto_id") is not None:
            parto_id = _as_uuid(after["parto_id"], "parto_id")
            madre = repo.get_parto_madre(conn, scope_id, parto_id)
            if madre != cuy_id and not repo.parto_tiene_cria(conn, scope_id, parto_id, cuy_id):
                _fail(
                    "RELACION_INCONSISTENTE",
                    "el parto del pesaje no corresponde al animal medido",
                )
        if after.get("evento_id") is not None:
            evento_id = _as_uuid(after["evento_id"], "evento_id")
            if repo.get_evento_cuy(conn, scope_id, evento_id) != cuy_id:
                _fail(
                    "RELACION_INCONSISTENTE",
                    "el evento del pesaje no corresponde al animal medido",
                )
    if entity == "parto_crias":
        parto_id = _as_uuid(after["parto_id"], "parto_id")
        cuy_id = _as_uuid(after["cuy_id"], "cuy_id")
        if repo.get_parto_madre(conn, scope_id, parto_id) == cuy_id:
            _fail("RELACION_INCONSISTENTE", "la madre no puede ser cría de su propio parto")


def _normalize_registro(item: RegistroPublicacion | Mapping[str, Any]) -> RegistroPublicacion:
    if isinstance(item, RegistroPublicacion):
        return item
    if not isinstance(item, Mapping):
        _fail("REGISTRO_INVALIDO", "cada registro debe ser RegistroPublicacion o mapping")
    try:
        return RegistroPublicacion(
            entity=item["entity"],
            id=item["id"],
            expected_version=item.get("expected_version"),
            before=item.get("before"),
            after=item["after"],
        )
    except KeyError as error:
        raise PublicacionError("REGISTRO_INVALIDO", f"falta {error.args[0]}") from error


def publicar_cambios(
    conn,
    scope_id: UUID | str,
    registros: Sequence[RegistroPublicacion | Mapping[str, Any]],
) -> list[ResultadoPublicacion]:
    """Publish effective domain changes using the caller's open transaction.

    ``conn`` must have an active transaction and ``autocommit=False``. The
    function never commits, rolls back, closes, opens a connection, or writes
    business fields. Errors propagate so the caller can roll back the whole lot.
    """
    _ensure_transaction(conn)
    scope_uuid = _as_uuid(scope_id, "scope_id")
    try:
        repo.lock_scope(conn, scope_uuid)
    except LookupError as error:
        raise PublicacionError("AMBITO_INEXISTENTE", "el ámbito no existe") from error

    prepared: list[tuple[RegistroPublicacion, UUID, dict[str, Any], int | None, bool]] = []
    seen: set[tuple[str, UUID]] = set()
    for raw in registros:
        item = _normalize_registro(raw)
        if item.entity not in ENTITY_TABLES:
            _fail("ENTIDAD_NO_PERMITIDA", f"entidad no publicable en D1: {item.entity}")
        record_id = _as_uuid(item.id, "id")
        key = (item.entity, record_id)
        if key in seen:
            _fail("REGISTRO_DUPLICADO", f"duplicado {item.entity}/{record_id}")
        seen.add(key)

        after = _validate_record(item.entity, item.after, "after")
        assert after is not None
        before = _validate_record(item.entity, item.before, "before")
        expected = _as_version(item.expected_version, "expected_version")

        row = repo.get_record(conn, ENTITY_TABLES[item.entity], record_id, _fields(item.entity))
        if row is None:
            _fail("REGISTRO_INEXISTENTE", f"{item.entity}/{record_id} no existe")
        if row["scope_id"] is None:
            _fail("SCOPE_NO_ASIGNADO", f"{item.entity}/{record_id} no tiene ámbito revisado")
        if row["scope_id"] != scope_uuid:
            _fail("SCOPE_INVALIDO", f"{item.entity}/{record_id} pertenece a otro ámbito")

        current = int(row["server_version"] or 0)
        if not _same(_row_fields(row, item.entity), after, item.entity):
            _fail("FILA_FINAL_INCONSISTENTE", f"after no coincide con la fila final de {item.entity}/{record_id}")

        if current == 0:
            if expected is not None:
                _fail("VERSION_INCONSISTENTE", "un registro no publicado no admite expected_version")
            if before is not None:
                _fail("EVIDENCIA_INCONSISTENTE", "un registro nuevo debe tener before=null")
            _validate_references(conn, scope_uuid, item.entity, after)
            prepared.append((item, record_id, after, 1, True))
            continue

        if expected is None:
            _fail("VERSION_REQUERIDA", "un registro publicado requiere expected_version")
        if expected != current:
            _fail("VERSION_OBSOLETA", f"versión esperada {expected}, actual {current}")
        if before is None:
            _fail("EVIDENCIA_INCONSISTENTE", "un registro existente requiere before")
        snapshot = repo.get_latest_snapshot(conn, scope_uuid, item.entity, record_id, current)
        if snapshot is None:
            _fail("HISTORIAL_INCONSISTENTE", "no existe snapshot de la versión actual")
        if not _same(before, _snapshot_fields(snapshot, item.entity), item.entity):
            _fail("EVIDENCIA_INCONSISTENTE", "before no coincide con el último snapshot publicado")
        _validate_references(conn, scope_uuid, item.entity, after)
        changed = not _same(before, after, item.entity)
        prepared.append((item, record_id, after, current + 1 if changed else current, changed))

    results: list[ResultadoPublicacion] = []
    for item, record_id, after, version, changed in prepared:
        if not changed:
            results.append(ResultadoPublicacion(item.entity, record_id, version, None, False))
            continue
        table = ENTITY_TABLES[item.entity]
        repo.update_published_version(conn, table, record_id, scope_uuid, version)
        sequence = repo.increment_scope(conn, scope_uuid)
        row = repo.get_record(conn, table, record_id, _fields(item.entity))
        if row is None:
            _fail("REGISTRO_INEXISTENTE", f"{item.entity}/{record_id} desapareció al publicar")
        if not _same(_row_fields(row, item.entity), after, item.entity):
            _fail("FILA_FINAL_INCONSISTENTE", f"la fila cambió durante la publicación de {item.entity}/{record_id}")
        repo.insert_change(conn, scope_uuid, sequence, item.entity, record_id, version, _snapshot(row, item.entity, version))
        results.append(ResultadoPublicacion(item.entity, record_id, version, sequence, True))
    return results
