"""Transactional promotion of reviewed Lope batches."""

from __future__ import annotations

import argparse
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
import json
import os
from pathlib import Path
import re
import sys
from typing import Any, Protocol
from urllib.parse import urlparse
from uuid import UUID


PROMOTABLE_ENTITIES = frozenset({"cuyes", "partos", "pesajes", "eventos"})
ENTITY_TABLES = {
    "cuyes": "cuyes",
    "partos": "partos",
    "pesajes": "pesajes",
    "eventos": "eventos",
}
ENTITY_ORDER = {"cuyes": 0, "partos": 1, "eventos": 2, "pesajes": 3}
REFERENCE_ENTITIES = {
    "cuyes": {"padre_id": "cuyes", "madre_id": "cuyes"},
    "partos": {"madre_id": "cuyes"},
    "eventos": {"cuy_id": "cuyes", "macho_id": "cuyes"},
    "pesajes": {
        "cuy_id": "cuyes",
        "parto_id": "partos",
        "evento_id": "eventos",
    },
}
RECORD_KEYS = frozenset(
    {
        "correspondencia_id",
        "entity",
        "id",
        "expected_version",
        "before",
        "after",
    }
)
REPO_ROOT = Path(__file__).resolve().parents[2]
PLAN_DIR = REPO_ROOT / "docs" / "datos"
PLAN_FILES = (
    "lope-plan-migracion-validacion.md",
    "lope-diccionario-mapeo.md",
    "lope-identidad-conciliacion.md",
    "lope-modelo-ddl-propuesto.md",
)


class PromocionError(ValueError):
    """Error de validación de la promoción, sin exponer datos de origen."""


class Publicador(Protocol):
    def __call__(
        self,
        conn: Any,
        scope_id: UUID,
        registros: Sequence[Mapping[str, Any]],
    ) -> Sequence[Any]: ...


@dataclass(frozen=True)
class ResultadoPromocion:
    total: int
    changed_count: int
    unchanged_count: int
    changed: bool
    dry_run: bool
    entity_counts: tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class _Registro:
    correspondencia_id: UUID
    entity: str
    id: UUID
    expected_version: int | None
    before: Mapping[str, Any] | None
    after: Mapping[str, Any]


def _uuid(value: Any, label: str) -> UUID:
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise PromocionError(f"{label} inválido") from error


def _publishable_fields(entity: str) -> tuple[str, ...]:
    from backend.app.services.publication import PUBLISHABLE_FIELDS

    try:
        return PUBLISHABLE_FIELDS[entity]
    except KeyError as error:
        raise PromocionError("Entidad no admitida por el plan de promoción") from error


def _normalize_records(records: Sequence[Mapping[str, Any]]) -> list[_Registro]:
    if isinstance(records, (str, bytes)) or not isinstance(records, Sequence):
        raise PromocionError("El lote debe contener una lista de registros")

    normalized: list[_Registro] = []
    seen_correspondences: set[UUID] = set()
    seen_records: set[tuple[str, UUID]] = set()
    for item in records:
        if not isinstance(item, Mapping):
            raise PromocionError("Cada registro debe ser un objeto")
        if "scope_id" in item:
            raise PromocionError("scope_id debe provenir del contexto autorizado")
        if set(item) - RECORD_KEYS:
            raise PromocionError("El registro contiene campos no admitidos")
        if not {"correspondencia_id", "entity", "id", "after"} <= set(item):
            raise PromocionError("Faltan campos de correspondencia o dominio")

        entity = item["entity"]
        if not isinstance(entity, str) or entity not in PROMOTABLE_ENTITIES:
            raise PromocionError("Entidad fuera del alcance aprobado por el plan")

        record_id = _uuid(item["id"], "id")
        correspondence_id = _uuid(item["correspondencia_id"], "correspondencia_id")
        fields = _publishable_fields(entity)
        after = item["after"]
        if not isinstance(after, Mapping) or set(after) != set(fields):
            raise PromocionError("after no coincide con los campos publicables")
        before = item.get("before")
        if before is not None and (
            not isinstance(before, Mapping) or set(before) != set(fields)
        ):
            raise PromocionError("before no coincide con los campos publicables")

        expected_version = item.get("expected_version")
        if expected_version is not None:
            if isinstance(expected_version, bool):
                raise PromocionError("expected_version inválida")
            try:
                parsed_version = int(str(expected_version))
            except (TypeError, ValueError) as error:
                raise PromocionError("expected_version inválida") from error
            if str(expected_version).strip() != str(parsed_version) or parsed_version < 1:
                raise PromocionError("expected_version inválida")
            expected_version = parsed_version

        correspondence_key = correspondence_id
        record_key = (entity, record_id)
        if correspondence_key in seen_correspondences or record_key in seen_records:
            raise PromocionError("El lote contiene correspondencias o entidades duplicadas")
        seen_correspondences.add(correspondence_key)
        seen_records.add(record_key)
        normalized.append(
            _Registro(
                correspondencia_id=correspondence_id,
                entity=entity,
                id=record_id,
                expected_version=expected_version,
                before=before,
                after=dict(after),
            )
        )
    return normalized


def publicar_con_d1(
    conn: Any,
    scope_id: UUID,
    registros: Sequence[Mapping[str, Any]],
) -> Sequence[Any]:
    """Adapt the deferred D1 import to the injected publisher interface."""
    from backend.app.services.publication import RegistroPublicacion, publicar_cambios

    publication_records = [
        RegistroPublicacion(
            entity=record["entity"],
            id=record["id"],
            expected_version=record["expected_version"],
            before=record["before"],
            after=record["after"],
        )
        for record in registros
    ]
    return publicar_cambios(conn, scope_id, publication_records)


def _ensure_connection_ready(conn: Any) -> None:
    from psycopg.pq import TransactionStatus

    if conn.closed:
        raise PromocionError("La conexión está cerrada")
    if conn.autocommit:
        raise PromocionError("La conexión debe tener autocommit deshabilitado")
    if conn.info.transaction_status != TransactionStatus.IDLE:
        raise PromocionError("La conexión debe estar fuera de una transacción previa")


def _canonical_value(field: str, value: Any) -> Any:
    if value is None:
        return None
    from backend.app.services.publication import (
        DATE_FIELDS,
        DATETIME_FIELDS,
        DECIMAL_FIELDS,
        INTEGER_FIELDS,
        UUID_FIELDS,
    )

    if field in UUID_FIELDS:
        return UUID(str(value)).hex
    if field in DATE_FIELDS:
        if isinstance(value, datetime):
            value = value.date()
        return date.fromisoformat(str(value)).isoformat()
    if field in DATETIME_FIELDS:
        if isinstance(value, datetime):
            parsed = value
        else:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.isoformat()
    if field in DECIMAL_FIELDS:
        return Decimal(str(value)).normalize()
    if field in INTEGER_FIELDS:
        return int(str(value))
    return value


def _record_matches_row(conn: Any, record: _Registro, scope_id: UUID) -> bool:
    table = ENTITY_TABLES[record.entity]
    fields = _publishable_fields(record.entity)
    columns = ", ".join(fields)
    row = conn.execute(
        f"SELECT scope_id, {columns} FROM {table} WHERE id = %s",
        (record.id,),
    ).fetchone()
    if row is None or row[0] != scope_id:
        return False
    for field, actual in zip(fields, row[1:]):
        try:
            if _canonical_value(field, actual) != _canonical_value(
                field, record.after[field]
            ):
                return False
        except (ArithmeticError, TypeError, ValueError):
            return False
    return True


def _summary(
    records: Sequence[_Registro],
    changed_count: int,
    dry_run: bool,
) -> ResultadoPromocion:
    counts = Counter(record.entity for record in records)
    unchanged_count = len(records) - changed_count
    return ResultadoPromocion(
        total=len(records),
        changed_count=changed_count,
        unchanged_count=unchanged_count,
        changed=changed_count > 0,
        dry_run=dry_run,
        entity_counts=tuple(sorted(counts.items())),
    )


def _order_records(records: Sequence[_Registro]) -> list[_Registro]:
    by_key = {(record.entity, record.id): record for record in records}
    remaining = set(by_key)
    ordered: list[_Registro] = []
    while remaining:
        ready = []
        for key in remaining:
            record = by_key[key]
            unresolved = any(
                (referenced_entity, _uuid(record.after[field], field)) in remaining
                for field, referenced_entity in REFERENCE_ENTITIES[record.entity].items()
                if record.after[field] is not None
            )
            if not unresolved:
                ready.append(key)
        if not ready:
            raise PromocionError("Las referencias del lote contienen un ciclo")
        key = min(ready, key=lambda value: ENTITY_ORDER[value[0]])
        ordered.append(by_key[key])
        remaining.remove(key)
    return ordered


def _write_domain_row(
    conn: Any,
    scope_id: UUID,
    record: _Registro,
    correspondence_entity_id: UUID | None,
) -> None:
    table = ENTITY_TABLES[record.entity]
    fields = _publishable_fields(record.entity)
    current = conn.execute(
        f"SELECT scope_id, server_version FROM {table} WHERE id = %s FOR UPDATE",
        (record.id,),
    ).fetchone()

    if current is None:
        if record.expected_version is not None or record.before is not None:
            raise PromocionError("La corrección requiere un registro publicado existente")
        if correspondence_entity_id is not None and correspondence_entity_id != record.id:
            raise PromocionError("La correspondencia apunta a otra entidad")
        columns = ("id", "scope_id", *fields)
        column_sql = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        values = (record.id, scope_id, *(record.after[field] for field in fields))
        conn.execute(
            f"INSERT INTO {table} ({column_sql}) VALUES ({placeholders})",
            values,
        )
        return

    current_scope, current_version = current
    current_version = int(current_version or 0)
    if current_scope != scope_id:
        raise PromocionError("La entidad existente está fuera del ámbito autorizado")
    if correspondence_entity_id not in (None, record.id):
        raise PromocionError("La correspondencia apunta a otra entidad")
    if current_version == 0:
        if record.expected_version is not None or record.before is not None:
            raise PromocionError("El registro aún no publicado no admite before/version")
    else:
        if correspondence_entity_id != record.id:
            raise PromocionError("Falta la correspondencia con la entidad publicada")
        if record.expected_version != current_version or record.before is None:
            raise PromocionError("La versión o evidencia anterior no coincide")

    assignments = ", ".join(f"{field} = %s" for field in fields)
    values = tuple(record.after[field] for field in fields)
    conn.execute(
        f"UPDATE {table} SET {assignments}, updated_at = now() WHERE id = %s",
        (*values, record.id),
    )


def promote_batch(
    conn: Any,
    scope_id: UUID | str,
    batch_id: UUID | str,
    records: Sequence[Mapping[str, Any]],
    publicador: Publicador = publicar_con_d1,
    *,
    dry_run: bool = True,
) -> ResultadoPromocion:
    """Promote all accepted rows atomically; dry-run always rolls back."""
    _ensure_connection_ready(conn)
    authorized_scope_id = _uuid(scope_id, "scope_id")
    lote_id = _uuid(batch_id, "batch_id")
    normalized = _normalize_records(records)

    with conn.transaction(force_rollback=dry_run):
        scope = conn.execute(
            "SELECT id FROM sync_scopes WHERE id = %s FOR UPDATE",
            (authorized_scope_id,),
        ).fetchone()
        if scope is None:
            raise PromocionError("El ámbito autorizado no existe")

        batch = conn.execute(
            "SELECT estado FROM importacion_lotes WHERE id = %s FOR UPDATE",
            (lote_id,),
        ).fetchone()
        if batch is None:
            raise PromocionError("El lote no existe")

        accepted = conn.execute(
            "SELECT id, entidad_id FROM importacion_correspondencias "
            "WHERE lote_id = %s AND estado = 'ACEPTADO' ORDER BY id FOR UPDATE",
            (lote_id,),
        ).fetchall()
        accepted_by_id = {row[0]: row[1] for row in accepted}
        record_ids = {record.correspondencia_id for record in normalized}
        if record_ids != set(accepted_by_id):
            raise PromocionError(
                "Los registros no cubren exactamente las correspondencias aceptadas"
            )
        for record in normalized:
            linked_entity_id = accepted_by_id[record.correspondencia_id]
            if linked_entity_id is not None and linked_entity_id != record.id:
                raise PromocionError("La correspondencia apunta a otra entidad")

        if batch[0] == "APLICADO":
            if any(
                accepted_by_id[record.correspondencia_id] != record.id
                or not _record_matches_row(conn, record, authorized_scope_id)
                for record in normalized
            ):
                raise PromocionError("El lote aplicado no coincide con el contenido recibido")
            result = _summary(normalized, 0, dry_run)
            return result
        if batch[0] != "PENDIENTE":
            raise PromocionError("El lote no está pendiente de promoción")

        for record in _order_records(normalized):
            _write_domain_row(
                conn,
                authorized_scope_id,
                record,
                accepted_by_id[record.correspondencia_id],
            )

        publication_records = [
            {
                "entity": record.entity,
                "id": record.id,
                "expected_version": record.expected_version,
                "before": record.before,
                "after": record.after,
            }
            for record in normalized
        ]
        publication_results = publicador(
            conn,
            authorized_scope_id,
            publication_records,
        )
        if len(publication_results) != len(normalized):
            raise PromocionError("El publicador devolvió un resultado incompleto")
        changed_count = 0
        for publication_result in publication_results:
            changed = (
                publication_result.get("changed")
                if isinstance(publication_result, Mapping)
                else getattr(publication_result, "changed", None)
            )
            if not isinstance(changed, bool):
                raise PromocionError("El publicador devolvió un resultado inválido")
            changed_count += changed

        for record in normalized:
            updated = conn.execute(
                "UPDATE importacion_correspondencias SET entidad_id = %s "
                "WHERE id = %s AND lote_id = %s AND estado = 'ACEPTADO' "
                "AND (entidad_id IS NULL OR entidad_id = %s)",
                (
                    record.id,
                    record.correspondencia_id,
                    lote_id,
                    record.id,
                ),
            )
            if updated.rowcount != 1:
                raise PromocionError("No se pudo confirmar una correspondencia")

        updated = conn.execute(
            "UPDATE importacion_lotes SET estado = 'APLICADO', aplicado_at = now() "
            "WHERE id = %s AND estado = 'PENDIENTE'",
            (lote_id,),
        )
        if updated.rowcount != 1:
            raise PromocionError("No se pudo confirmar el lote")

        result = _summary(normalized, changed_count, dry_run)
        return result


def _real_load_prerequisites_met(plan_dir: Path = PLAN_DIR) -> bool:
    contents: dict[str, str] = {}
    for file_name in PLAN_FILES:
        path = plan_dir / file_name
        if not path.is_file():
            return False
        contents[file_name] = path.read_text(encoding="utf-8")
        if not re.search(r"^Estado:\s*APROBADO\s*$", contents[file_name], re.MULTILINE):
            return False

    plan = contents["lope-plan-migracion-validacion.md"]
    return bool(
        re.search(
            r"^\s*-\s*Respaldo registrado:\s*(?!pendiente\b|todo\b|n/?a\b)\S.*$",
            plan,
            re.IGNORECASE | re.MULTILINE,
        )
    )


def validate_commit_target(
    database_url: str,
    *,
    commit: bool,
    permitir_base_real: bool = False,
    plan_dir: Path = PLAN_DIR,
) -> None:
    if not commit:
        return
    parsed = urlparse(database_url)
    database_name = parsed.path.lstrip("/")
    local_host = parsed.hostname in {"localhost", "127.0.0.1"}
    if local_host and database_name != "cuyielite":
        return
    if not permitir_base_real:
        raise PromocionError("Commit bloqueado: destino real o no local")
    if not _real_load_prerequisites_met(plan_dir):
        raise PromocionError(
            "Commit real bloqueado: documentos aprobados y respaldo registrado requeridos"
        )


def _reject_raw_source(path: Path) -> None:
    resolved = path.resolve()
    raw_directories = (REPO_ROOT / "db" / "raw_Lope", REPO_ROOT / "db" / "raw_ Lope")
    for raw_directory in raw_directories:
        try:
            resolved.relative_to(raw_directory.resolve())
        except ValueError:
            continue
        raise PromocionError("No se admite leer fuentes privadas de Lope")


def _load_manifest(path: Path) -> list[Mapping[str, Any]]:
    _reject_raw_source(path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, Mapping) or set(payload) != {"records"}:
        raise PromocionError("El manifiesto debe contener únicamente records")
    if not isinstance(payload["records"], list):
        raise PromocionError("records debe ser una lista")
    return payload["records"]


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Promueve correspondencias Lope aceptadas en una transacción."
    )
    parser.add_argument("--manifiesto", required=True, help="JSON de registros aceptados")
    parser.add_argument("--batch-id", required=True, help="UUID del lote revisado")
    parser.add_argument(
        "--scope-id",
        required=True,
        help="UUID del ámbito autorizado, proporcionado fuera del manifiesto",
    )
    parser.add_argument(
        "--database-url-env",
        default="TEST_DATABASE_URL",
        help="Variable de entorno con la URL PostgreSQL",
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Confirma la transacción; por defecto se ejecuta dry-run y rollback",
    )
    parser.add_argument(
        "--permitir-base-real",
        action="store_true",
        help="Requiere documentos APROBADO y respaldo registrado en el plan",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    if args.permitir_base_real and not args.commit:
        print("--permitir-base-real requiere --commit", file=sys.stderr)
        return 2
    database_url = os.environ.get(args.database_url_env)
    if not database_url:
        print("Promoción cancelada: variable de conexión no definida.", file=sys.stderr)
        return 2

    try:
        validate_commit_target(
            database_url,
            commit=args.commit,
            permitir_base_real=args.permitir_base_real,
        )
        records = _load_manifest(Path(args.manifiesto))
        from psycopg import connect

        with connect(database_url, autocommit=False) as conn:
            result = promote_batch(
                conn,
                args.scope_id,
                args.batch_id,
                records,
                dry_run=not args.commit,
            )
    except Exception as error:
        print(
            f"Promoción cancelada ({type(error).__name__}); no se publicaron detalles.",
            file=sys.stderr,
        )
        return 1

    mode = "dry-run (rollback)" if result.dry_run else "commit"
    print(
        f"Modo: {mode}; registros: {result.total}; "
        f"cambios: {result.changed_count}; sin cambios: {result.unchanged_count}"
    )
    if result.entity_counts:
        counts = ", ".join(f"{entity}={count}" for entity, count in result.entity_counts)
        print(f"Conteos por entidad: {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
