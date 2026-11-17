"""Human-reviewed decisions that turn audit proposals into a promotion manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections.abc import Mapping
from pathlib import Path
import re
import sys
from typing import Any
from uuid import UUID, uuid4

from . import AUDIT_CONTRACT, REVIEW_CONTRACT
from .manifest import CONTRACT_VERSION, PROMOTABLE_ENTITIES, parse_manifiesto
from .report import write_report

DECISIONS_CONTRACT = "lope_import_review_decisions/v1"
DECISION_KEYS = frozenset(
    {
        "origin_ref",
        "estado",
        "revisor",
        "evidencia",
        "entidad_id",
        "expected_version",
        "before",
        "after",
    }
)
DECISION_STATUSES = frozenset({"ACEPTADO", "RECHAZADO", "AMBIGUO", "PENDIENTE"})


class DecisionError(ValueError):
    """Invalid human decisions or incompatible review input."""


def _publishable_fields(entity: str) -> tuple[str, ...]:
    from backend.app.services.publication import PUBLISHABLE_FIELDS

    try:
        return PUBLISHABLE_FIELDS[entity]
    except KeyError as error:
        raise DecisionError("Entidad no publicable en el contrato") from error


def _text(value: Any, label: str, *, maximum: int = 500) -> str:
    if not isinstance(value, str) or not value.strip():
        raise DecisionError(f"{label} debe ser texto no vacío")
    result = value.strip()
    if len(result) > maximum:
        raise DecisionError(f"{label} excede el máximo permitido")
    return result


def _uuid(value: Any, label: str) -> UUID:
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise DecisionError(f"{label} inválido") from error


def _parse_origin_ref(origin_ref: Any) -> tuple[str, str, str, int, str, str]:
    if not isinstance(origin_ref, str):
        raise DecisionError("origin_ref debe ser texto")
    parts = origin_ref.split(":")
    if len(parts) != 6 or parts[0] != "sha256":
        raise DecisionError("origin_ref no coincide con el formato de auditoría")
    file_hash, sheet, cell, role, entity = parts[1:]
    if re.fullmatch(r"[0-9a-f]{64}", file_hash) is None:
        raise DecisionError("origin_ref no contiene una huella SHA-256 válida")
    sheet = _text(sheet, "hoja", maximum=100)
    role = _text(role, "rol", maximum=30)
    match = re.fullmatch(r"[A-Z]{1,3}([1-9][0-9]*)", cell)
    if match is None:
        raise DecisionError("origin_ref no contiene una celda válida")
    return file_hash, sheet, cell, int(match.group(1)), role, entity


def _validate_review(
    review: Any,
    source_review_sha256: str,
) -> tuple[str, str, str, dict[str, Mapping[str, Any]]]:
    if not isinstance(review, Mapping) or review.get("contract") != REVIEW_CONTRACT:
        raise DecisionError(f"La entrada debe cumplir {REVIEW_CONTRACT}")
    if review.get("source_contract") != AUDIT_CONTRACT:
        raise DecisionError(f"La entrada debe declarar {AUDIT_CONTRACT}")
    if (
        not isinstance(source_review_sha256, str)
        or re.fullmatch(r"[0-9a-f]{64}", source_review_sha256) is None
    ):
        raise DecisionError("La huella del reporte de revisión no es válida")

    versions = []
    for key in ("parser_version", "mapeo_version"):
        versions.append(_text(review.get(key), key, maximum=20))

    files = review.get("files")
    if not isinstance(files, list) or len(files) != 1:
        raise DecisionError(
            "Cada manifiesto requiere exactamente un archivo de origen por su clave SHA-256"
        )
    source_file = files[0]
    if not isinstance(source_file, Mapping):
        raise DecisionError("El archivo de origen debe ser un objeto")
    file_hash = source_file.get("sha256_before")
    if (
        not isinstance(file_hash, str)
        or re.fullmatch(r"[0-9a-f]{64}", file_hash) is None
        or source_file.get("sha256_after") != file_hash
        or source_file.get("file_id") != f"sha256:{file_hash}"
    ):
        raise DecisionError("La huella del archivo de origen no es consistente")

    proposals = review.get("proposals")
    if not isinstance(proposals, list):
        raise DecisionError("proposals debe ser una lista")
    by_origin: dict[str, Mapping[str, Any]] = {}
    for proposal in proposals:
        if not isinstance(proposal, Mapping):
            raise DecisionError("Cada propuesta debe ser un objeto")
        origin_ref = proposal.get("origin_ref")
        if not isinstance(origin_ref, str) or origin_ref in by_origin:
            raise DecisionError("origin_ref de propuesta inválido o duplicado")
        origin_hash, _, _, _, _, origin_entity = _parse_origin_ref(origin_ref)
        entity = proposal.get("entity")
        if (
            not isinstance(entity, str)
            or entity not in PROMOTABLE_ENTITIES
            or entity != origin_entity
            or origin_hash != file_hash
        ):
            raise DecisionError("La propuesta no coincide con su archivo o entidad de origen")
        if proposal.get("status") != "PENDIENTE_REVISION":
            raise DecisionError("Solo se aceptan propuestas pendientes de revisión humana")
        proposed_fields = proposal.get("proposed_fields")
        if (
            not isinstance(proposed_fields, Mapping)
            or set(proposed_fields) != set(_publishable_fields(entity))
        ):
            raise DecisionError("proposed_fields no coincide con los campos publicables")
        by_origin[origin_ref] = proposal

    return file_hash, versions[0], versions[1], by_origin


def create_decisions_template(
    review: Any,
    source_review_sha256: str,
    *,
    lote_id: UUID | str | None = None,
) -> dict[str, Any]:
    """Create an editable decision file without accepting any proposal."""
    _, _, _, proposals = _validate_review(review, source_review_sha256)
    batch_id = uuid4() if lote_id is None else _uuid(lote_id, "lote_id")
    return {
        "contract": DECISIONS_CONTRACT,
        "source_contract": REVIEW_CONTRACT,
        "source_review_sha256": source_review_sha256,
        "lote_id": str(batch_id),
        "decisions": [
            {
                "origin_ref": origin_ref,
                "estado": "PENDIENTE",
                "revisor": None,
                "evidencia": None,
                "entidad_id": None,
                "expected_version": None,
                "before": None,
                "after": dict(proposal["proposed_fields"]),
            }
            for origin_ref, proposal in proposals.items()
        ],
    }


def build_manifest(
    review: Any,
    decisions_file: Any,
    source_review_sha256: str,
    *,
    scope_id: UUID | str,
    config_alias: str,
) -> dict[str, Any]:
    """Build a promotion manifest from explicit human decisions."""
    file_hash, parser_version, mapping_version, proposals = _validate_review(
        review, source_review_sha256
    )
    scope_uuid = _uuid(scope_id, "scope_id")
    alias = _text(config_alias, "config_alias", maximum=100)

    if not isinstance(decisions_file, Mapping):
        raise DecisionError("El archivo de decisiones debe ser un objeto")
    required_keys = {
        "contract",
        "source_contract",
        "source_review_sha256",
        "lote_id",
        "decisions",
    }
    if set(decisions_file) != required_keys:
        raise DecisionError("El archivo de decisiones no coincide con su contrato")
    if decisions_file["contract"] != DECISIONS_CONTRACT:
        raise DecisionError(f"El archivo debe cumplir {DECISIONS_CONTRACT}")
    if decisions_file["source_contract"] != REVIEW_CONTRACT:
        raise DecisionError(f"El archivo debe declarar {REVIEW_CONTRACT}")
    if decisions_file["source_review_sha256"] != source_review_sha256:
        raise DecisionError("El archivo de decisiones pertenece a otro reporte de revisión")
    lote_id = _uuid(decisions_file["lote_id"], "lote_id")

    entries = decisions_file["decisions"]
    if not isinstance(entries, list):
        raise DecisionError("decisions debe ser una lista")
    decisions_by_origin: dict[str, Mapping[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, Mapping) or set(entry) != set(DECISION_KEYS):
            raise DecisionError("Una decisión no coincide con el contrato")
        origin_ref = entry["origin_ref"]
        if (
            not isinstance(origin_ref, str)
            or origin_ref not in proposals
            or origin_ref in decisions_by_origin
        ):
            raise DecisionError("La decisión tiene un origen desconocido o duplicado")
        status = entry["estado"]
        if not isinstance(status, str) or status not in DECISION_STATUSES:
            raise DecisionError("estado de decisión no admitido")
        decisions_by_origin[origin_ref] = entry

    correspondencias = []
    records = []
    for origin_ref, entry in decisions_by_origin.items():
        status = entry["estado"]
        proposal = proposals[origin_ref]
        entity = proposal["entity"]
        if status != "PENDIENTE":
            reviewer = _text(entry["revisor"], "revisor", maximum=100)
            evidence = _text(entry["evidencia"], "evidencia")
        else:
            reviewer = entry["revisor"]
            evidence = entry["evidencia"]
            if reviewer is not None:
                reviewer = _text(reviewer, "revisor", maximum=100)
            if evidence is not None:
                evidence = _text(evidence, "evidencia")

        if status != "ACEPTADO":
            if any(
                entry[key] is not None
                for key in ("entidad_id", "expected_version", "before")
            ):
                raise DecisionError(
                    "Una decisión no aceptada no puede asignar identidad ni versión"
                )
            continue

        entity_id = _uuid(entry["entidad_id"], "entidad_id")
        expected_version = entry["expected_version"]
        before = entry["before"]
        after = entry["after"]
        fields = set(_publishable_fields(entity))
        if not isinstance(after, Mapping) or set(after) != fields:
            raise DecisionError("after no coincide con los campos publicables")
        if before is not None and (
            not isinstance(before, Mapping) or set(before) != fields
        ):
            raise DecisionError("before no coincide con los campos publicables")
        if before is None:
            if expected_version is not None:
                raise DecisionError("Una fila nueva requiere expected_version=null")
        elif (
            isinstance(expected_version, bool)
            or not isinstance(expected_version, int)
            or expected_version < 1
        ):
            raise DecisionError(
                "Una corrección requiere before y expected_version positivo"
            )

        _, sheet, cell, row, role, origin_entity = _parse_origin_ref(origin_ref)
        if origin_entity != entity:
            raise DecisionError("La entidad de la decisión no coincide con su origen")
        correspondencias.append(
            {
                "origen_id": None,
                "origen": {
                    "hoja": sheet,
                    "celda": cell,
                    "fila": row,
                    "rol": role,
                    "entidad_tipo": entity,
                },
                "estado": "ACEPTADO",
                "entidad_id": str(entity_id),
                "revisor": reviewer,
                "evidencia": evidence,
            }
        )
        records.append(
            {
                "entity": entity,
                "id": str(entity_id),
                "expected_version": expected_version,
                "before": dict(before) if before is not None else None,
                "after": dict(after),
            }
        )

    if not records:
        raise DecisionError("No hay decisiones ACEPTADO; no se genera un manifiesto publicable")

    manifest = {
        "contract_version": CONTRACT_VERSION,
        "batch": {
            "lote_id": str(lote_id),
            "idempotency_key": {
                "huella_archivo": file_hash,
                "parser_version": parser_version,
                "mapeo_version": mapping_version,
            },
        },
        "scope": {"scope_id": str(scope_uuid), "config_alias": alias},
        "correspondencias_aceptadas": correspondencias,
        "registros": records,
    }
    parse_manifiesto(manifest, authorized_scope_id=scope_uuid)
    return manifest


def _read_json(path: str) -> tuple[Any, str]:
    contents = Path(path).read_bytes()
    return json.loads(contents.decode("utf-8")), hashlib.sha256(contents).hexdigest()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Genera decisiones humanas y manifiestos de promoción Lope"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    template = commands.add_parser("template", help="Crea una plantilla pendiente de revisión")
    template.add_argument("review", help="Reporte lope_import_review/v1")
    template.add_argument("--lote-id", help="UUID estable del lote; se genera si se omite")
    template.add_argument("--output", "-o", required=True, help="Ruta absoluta fuera del repositorio")
    build = commands.add_parser("build-manifest", help="Genera lope_promocion/v1 desde decisiones")
    build.add_argument("review", help="Reporte lope_import_review/v1")
    build.add_argument("decisions", help="Archivo lope_import_review_decisions/v1")
    build.add_argument("--scope-id", required=True, help="UUID del ámbito autorizado")
    build.add_argument("--config-alias", required=True, help="Alias descriptivo de la configuración")
    build.add_argument("--output", "-o", required=True, help="Ruta absoluta fuera del repositorio")
    args = parser.parse_args(argv)

    try:
        review, source_review_sha256 = _read_json(args.review)
        if args.command == "template":
            output = create_decisions_template(
                review,
                source_review_sha256,
                lote_id=args.lote_id,
            )
            accepted = 0
        else:
            decisions_file, _ = _read_json(args.decisions)
            output = build_manifest(
                review,
                decisions_file,
                source_review_sha256,
                scope_id=args.scope_id,
                config_alias=args.config_alias,
            )
            accepted = len(output["registros"])
        write_report(output, args.output)
    except (OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2

    if args.command == "template":
        print(f"Plantilla de decisiones escrita en {args.output}")
        print(f"Propuestas pendientes: {len(output['decisions'])}; lote_id: {output['lote_id']}")
    else:
        print(f"Manifiesto escrito en {args.output}")
        print(f"Registros aceptados: {accepted}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
