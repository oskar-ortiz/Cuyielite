from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import uuid

import pytest

from backend.app.services.publication import PUBLISHABLE_FIELDS
from tools.lope_import import AUDIT_CONTRACT, REVIEW_CONTRACT
from tools.lope_import.decisions import (
    DECISIONS_CONTRACT,
    DecisionError,
    build_manifest,
    create_decisions_template,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
SOURCE_HASH = "a" * 64
REVIEW_SHA256 = hashlib.sha256(b"synthetic review").hexdigest()


def _review() -> dict:
    cuy_fields = {field: None for field in PUBLISHABLE_FIELDS["cuyes"]}
    cuy_fields.update(
        {
            "codigo_identificacion": "SYN-001",
            "sexo": "H",
            "fecha_nacimiento": "2026-01-01",
        }
    )
    parto_fields = {field: None for field in PUBLISHABLE_FIELDS["partos"]}
    parto_fields["fecha_parto"] = "2026-01-02"
    return {
        "contract": REVIEW_CONTRACT,
        "source_contract": AUDIT_CONTRACT,
        "parser_version": "p1.0.0",
        "mapeo_version": "m1.0.0",
        "files": [
            {
                "file_id": f"sha256:{SOURCE_HASH}",
                "sha256_before": SOURCE_HASH,
                "sha256_after": SOURCE_HASH,
            }
        ],
        "proposals": [
            {
                "origin_ref": f"sha256:{SOURCE_HASH}:Individual:C2:ANIMAL:cuyes",
                "entity": "cuyes",
                "status": "PENDIENTE_REVISION",
                "proposed_fields": cuy_fields,
            },
            {
                "origin_ref": f"sha256:{SOURCE_HASH}:Repro:E4:PARTO:partos",
                "entity": "partos",
                "status": "PENDIENTE_REVISION",
                "proposed_fields": parto_fields,
            },
        ],
    }


def _accepted(decisions: dict, index: int = 0) -> dict:
    decision = decisions["decisions"][index]
    decision.update(
        {
            "estado": "ACEPTADO",
            "revisor": "revisor-sintetico",
            "evidencia": "Conciliación humana sintética.",
            "entidad_id": str(uuid.uuid4()),
        }
    )
    return decision


def test_build_manifest_includes_only_accepted_human_decisions():
    review = _review()
    decisions = create_decisions_template(
        review, REVIEW_SHA256, lote_id=uuid.uuid4()
    )
    accepted = _accepted(decisions)
    decisions["decisions"][1].update(
        {
            "estado": "AMBIGUO",
            "revisor": "revisor-sintetico",
            "evidencia": "Identidad pendiente de conciliación.",
        }
    )

    manifest = build_manifest(
        review,
        decisions,
        REVIEW_SHA256,
        scope_id=uuid.uuid4(),
        config_alias="LOPE-SINTETICO",
    )

    assert manifest["contract_version"] == "lope_promocion/v1"
    assert manifest["batch"]["idempotency_key"] == {
        "huella_archivo": SOURCE_HASH,
        "parser_version": "p1.0.0",
        "mapeo_version": "m1.0.0",
    }
    assert len(manifest["correspondencias_aceptadas"]) == 1
    assert manifest["correspondencias_aceptadas"][0]["entidad_id"] == accepted["entidad_id"]
    assert manifest["registros"][0]["id"] == accepted["entidad_id"]
    assert manifest["registros"][0]["after"] == accepted["after"]
    assert manifest["correspondencias_aceptadas"][0]["origen"] == {
        "hoja": "Individual",
        "celda": "C2",
        "fila": 2,
        "rol": "ANIMAL",
        "entidad_tipo": "cuyes",
    }


def test_build_manifest_rejects_stale_review_and_incomplete_acceptance():
    review = _review()
    decisions = create_decisions_template(
        review, REVIEW_SHA256, lote_id=uuid.uuid4()
    )
    accepted = _accepted(decisions)

    with pytest.raises(DecisionError, match="otro reporte"):
        build_manifest(
            review,
            decisions,
            hashlib.sha256(b"different review").hexdigest(),
            scope_id=uuid.uuid4(),
            config_alias="LOPE-SINTETICO",
        )

    accepted["evidencia"] = None
    with pytest.raises(DecisionError, match="evidencia"):
        build_manifest(
            review,
            decisions,
            REVIEW_SHA256,
            scope_id=uuid.uuid4(),
            config_alias="LOPE-SINTETICO",
        )


def test_template_rejects_multiple_files_and_manifest_requires_acceptance():
    review = _review()
    review["files"].append(dict(review["files"][0]))
    with pytest.raises(DecisionError, match="exactamente un archivo"):
        create_decisions_template(review, REVIEW_SHA256)

    review = _review()
    decisions = create_decisions_template(review, REVIEW_SHA256)
    with pytest.raises(DecisionError, match="No hay decisiones ACEPTADO"):
        build_manifest(
            review,
            decisions,
            REVIEW_SHA256,
            scope_id=uuid.uuid4(),
            config_alias="LOPE-SINTETICO",
        )


def test_build_manifest_requires_before_and_version_together():
    review = _review()
    decisions = create_decisions_template(
        review, REVIEW_SHA256, lote_id=uuid.uuid4()
    )
    accepted = _accepted(decisions)
    accepted["before"] = {
        field: None for field in PUBLISHABLE_FIELDS["cuyes"]
    }

    with pytest.raises(DecisionError, match="expected_version positivo"):
        build_manifest(
            review,
            decisions,
            REVIEW_SHA256,
            scope_id=uuid.uuid4(),
            config_alias="LOPE-SINTETICO",
        )


def test_decisions_cli_creates_template_and_manifest(tmp_path):
    review = _review()
    review_path = tmp_path / "review.json"
    decisions_path = tmp_path / "decisions.json"
    manifest_path = tmp_path / "manifest.json"
    review_path.write_text(json.dumps(review), encoding="utf-8")
    lote_id = str(uuid.uuid4())

    template = subprocess.run(
        [
            sys.executable,
            "-m",
            "tools.lope_import",
            "decisions",
            "template",
            str(review_path),
            "--lote-id",
            lote_id,
            "--output",
            str(decisions_path),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert template.returncode == 0, template.stderr
    decisions = json.loads(decisions_path.read_text(encoding="utf-8"))
    assert decisions["contract"] == DECISIONS_CONTRACT
    assert decisions["lote_id"] == lote_id
    _accepted(decisions)
    decisions_path.write_text(json.dumps(decisions), encoding="utf-8")

    build = subprocess.run(
        [
            sys.executable,
            "-m",
            "tools.lope_import",
            "decisions",
            "build-manifest",
            str(review_path),
            str(decisions_path),
            "--scope-id",
            str(uuid.uuid4()),
            "--config-alias",
            "LOPE-SINTETICO",
            "--output",
            str(manifest_path),
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert build.returncode == 0, build.stderr
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["batch"]["lote_id"] == lote_id
    assert len(manifest["registros"]) == 1
