"""Adapt audit candidates into a review-only domain mapping draft."""

from __future__ import annotations

import argparse
from collections.abc import Mapping
from datetime import date
import json
from pathlib import Path
import re
import sys
from typing import Any

from . import AUDIT_CONTRACT, REVIEW_CONTRACT
from .normalize import to_decimal
from .report import write_report


class AdaptacionError(ValueError):
    """Invalid or incomplete audit input for generating a review draft."""


def _empty_proposed_fields(entity: str) -> dict[str, Any]:
    from backend.app.services.publication import PUBLISHABLE_FIELDS

    return {field: None for field in PUBLISHABLE_FIELDS[entity]}


def _iso_date(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def _validate_audit(report: Any) -> tuple[list[Mapping[str, Any]], list[Mapping[str, Any]]]:
    if not isinstance(report, Mapping) or report.get("contract") != AUDIT_CONTRACT:
        raise AdaptacionError(f"La entrada debe cumplir {AUDIT_CONTRACT}")
    if not all(
        isinstance(report.get(key), str) and report[key].strip()
        for key in ("parser_version", "mapeo_version")
    ):
        raise AdaptacionError("El reporte debe incluir versiones de parser y mapeo")

    summary = report.get("summary")
    if not isinstance(summary, Mapping) or summary.get("files_unchanged") is not True:
        raise AdaptacionError("No se adapta un reporte con archivos modificados durante la auditoría")

    files = report.get("files")
    if not isinstance(files, list) or not files:
        raise AdaptacionError("El reporte debe incluir archivos auditados")
    file_ids = set()
    for source_file in files:
        if not isinstance(source_file, Mapping):
            raise AdaptacionError("Cada archivo auditado debe ser un objeto")
        file_id = source_file.get("file_id")
        before = source_file.get("sha256_before")
        after = source_file.get("sha256_after")
        if (
            not isinstance(before, str)
            or re.fullmatch(r"[0-9a-f]{64}", before) is None
            or after != before
            or file_id != f"sha256:{before}"
        ):
            raise AdaptacionError("La huella de archivo no es consistente")
        file_ids.add(file_id)

    errors = report.get("errors", [])
    if not isinstance(errors, list) or errors:
        raise AdaptacionError("No se adapta un reporte con errores de auditoría")
    candidates = report.get("candidates")
    if not isinstance(candidates, list):
        raise AdaptacionError("candidates debe ser una lista")

    for candidate in candidates:
        if not isinstance(candidate, Mapping):
            raise AdaptacionError("Cada candidato debe ser un objeto")
        candidate_file_id = candidate.get("file_id")
        if not isinstance(candidate_file_id, str) or candidate_file_id not in file_ids:
            raise AdaptacionError("Un candidato no corresponde a un archivo auditado")
        origin_ref = candidate.get("origin_ref")
        if (
            not isinstance(origin_ref, str)
            or not origin_ref.startswith(f"{candidate_file_id}:")
        ):
            raise AdaptacionError("Un candidato no tiene una referencia de origen válida")
        kind = candidate.get("kind")
        if not isinstance(kind, str) or kind not in {"animal", "litter_block"}:
            raise AdaptacionError("Tipo de candidato no soportado por el adaptador")

    return files, candidates


def _animal_proposal(candidate: Mapping[str, Any]) -> dict[str, Any]:
    raw_birth_date = candidate.get("fecha_nacimiento")
    birth_date = _iso_date(raw_birth_date)
    review_required = ["revisar_y_resolver_correspondencia"]
    if raw_birth_date is not None and birth_date is None:
        review_required.append("validar_fecha_nacimiento")
    proposed_fields = _empty_proposed_fields("cuyes")
    proposed_fields.update(
        {
            "codigo_identificacion": candidate.get("animal_no"),
            "sexo": candidate.get("sexo"),
            "fecha_nacimiento": birth_date,
            "color_codigo": candidate.get("color"),
            "ojos_codigo": candidate.get("ojos"),
            "poza_id": None,
        }
    )
    return {
        "origin_ref": candidate["origin_ref"],
        "entity": "cuyes",
        "status": "PENDIENTE_REVISION",
        "source_fields": {
            "animal_no": candidate.get("animal_no"),
            "sexo": candidate.get("sexo"),
            "fecha_nacimiento": raw_birth_date,
            "color": candidate.get("color"),
            "ojos": candidate.get("ojos"),
        },
        "proposed_fields": proposed_fields,
        "review_notes": [
            "poza_id y campos sin evidencia quedan null; no se infiere ubicación actual ni estado.",
        ],
        "review_required": review_required,
    }


def _parto_proposal(
    block: Mapping[str, Any],
    parto: Mapping[str, Any],
) -> dict[str, Any]:
    raw_date = parto.get("fecha")
    review_required = ["resolver_madre_id_y_correspondencia"]
    if raw_date is not None and _iso_date(raw_date) is None:
        review_required.append("validar_fecha_parto")
    proposed_fields = _empty_proposed_fields("partos")
    proposed_fields.update(
        {
            "madre_id": None,
            "fecha_parto": _iso_date(raw_date),
            "numero_parto": None,
            "nacidos_vivos": None,
            "nacidos_muertos": None,
            "tamano_camada_nacida": None,
        }
    )
    return {
        "origin_ref": parto["origin_ref"],
        "entity": "partos",
        "status": "PENDIENTE_REVISION",
        "source_fields": {
            "madre_codigo": block.get("hembra"),
            "poza_contexto": block.get("poza"),
            "fecha": raw_date,
            "tcn_original": parto.get("tcn"),
        },
        "proposed_fields": proposed_fields,
        "review_notes": [
            "numero_parto queda null porque NUPAR no está en esta auditoría.",
            "T.C.N. se conserva en source_fields.tcn_original; los conteos quedan null hasta revisión.",
        ],
        "review_required": review_required,
    }


def _weight_proposal(block: Mapping[str, Any]) -> dict[str, Any] | None:
    raw_weight = block.get("peso")
    if raw_weight is None:
        return None
    decimal_weight = to_decimal(raw_weight)
    if decimal_weight is not None and not decimal_weight.is_finite():
        decimal_weight = None
    review_required = ["resolver_cuy_id_y_correspondencia"]
    if decimal_weight is None:
        review_required.append("validar_peso_gramos")
    proposed_fields = _empty_proposed_fields("pesajes")
    proposed_fields.update(
        {
            "cuy_id": None,
            "fecha_pesaje": None,
            "peso_gramos": (
                format(decimal_weight, "f") if decimal_weight is not None else None
            ),
            "etapa": "MONTA",
            "parto_id": None,
            "evento_id": None,
        }
    )
    return {
        "origin_ref": block["peso_origin_ref"],
        "entity": "pesajes",
        "status": "PENDIENTE_REVISION",
        "source_fields": {
            "madre_codigo": block.get("hembra"),
            "peso_original": raw_weight,
        },
        "proposed_fields": proposed_fields,
        "review_notes": [
            "fecha_pesaje queda null: el bloque no aporta fecha de monta.",
        ],
        "review_required": review_required,
    }


def adapt_audit(report: Any) -> dict[str, Any]:
    files, candidates = _validate_audit(report)
    proposals = []
    seen_origins = set()

    def add_proposal(proposal: dict[str, Any]) -> None:
        origin_ref = proposal["origin_ref"]
        if origin_ref in seen_origins:
            raise AdaptacionError("La entrada contiene referencias de origen duplicadas")
        seen_origins.add(origin_ref)
        proposals.append(proposal)

    for candidate in candidates:
        if candidate["kind"] == "animal":
            add_proposal(_animal_proposal(candidate))
            continue

        partos = candidate.get("partos")
        if not isinstance(partos, list):
            raise AdaptacionError("Los bloques reproductivos deben incluir partos")
        weight_origin = candidate.get("peso_origin_ref")
        if not isinstance(weight_origin, str) or not weight_origin.startswith(
            f"{candidate['file_id']}:"
        ):
            raise AdaptacionError("El peso del bloque no tiene una referencia de origen válida")
        for parto in partos:
            if not isinstance(parto, Mapping):
                raise AdaptacionError("Cada parto candidato debe ser un objeto")
            origin_ref = parto.get("origin_ref")
            if not isinstance(origin_ref, str) or not origin_ref.startswith(
                f"{candidate['file_id']}:"
            ):
                raise AdaptacionError("Un parto candidato no tiene una referencia de origen válida")
            add_proposal(_parto_proposal(candidate, parto))
        weight = _weight_proposal(candidate)
        if weight is not None:
            add_proposal(weight)

    warnings = report.get("warnings", [])
    if not isinstance(warnings, list):
        raise AdaptacionError("warnings debe ser una lista")
    error_cells = report.get("celdas_error", [])
    if not isinstance(error_cells, list):
        raise AdaptacionError("celdas_error debe ser una lista")
    not_inferred = [
        {
            "entity": "eventos",
            "reason": "La auditoría actual no extrae eventos de dominio revisables.",
        },
        {
            "entity": "parto_crias",
            "reason": "Requiere conciliar una cría individual con un parto; no se infiere el vínculo.",
        },
    ]
    if error_cells:
        not_inferred.append(
            {
                "entity": "conteos_reproductivos",
                "reason": (
                    "Hay resultados de error guardados (#VALUE!) en celdas reproductivas; "
                    "se entregan como celdas_error para revisión y no se convierten en cero "
                    "ni autorizan una cantidad confirmada."
                ),
            }
        )
    return {
        "contract": REVIEW_CONTRACT,
        "source_contract": AUDIT_CONTRACT,
        "parser_version": report["parser_version"],
        "mapeo_version": report["mapeo_version"],
        "files": [dict(source_file) for source_file in files],
        "proposals": proposals,
        "not_inferred": not_inferred,
        "celdas_error": error_cells,
        "warnings": warnings,
        "summary": {
            "proposal_count": len(proposals),
            "accepted_correspondences": 0,
            "promotion_records": 0,
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Adapta una auditoría Lope a propuestas de dominio pendientes de revisión"
    )
    parser.add_argument("audit", help="Reporte lope_import_audit/v1")
    parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="Ruta absoluta de salida fuera del repositorio",
    )
    args = parser.parse_args(argv)
    try:
        audit = json.loads(Path(args.audit).read_text(encoding="utf-8"))
        review = adapt_audit(audit)
        write_report(review, args.output)
    except (OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2
    print(f"Propuestas de revisión: {review['summary']['proposal_count']}")
    print(f"Reporte de revisión escrito en {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
