"""Prepara auditoría, revisión y decisiones pendientes para fuentes Lope reales.

Ejecuta los CLI existentes, un archivo a la vez, porque el contrato
`lope_import_review_decisions/v1` exige exactamente un archivo de origen por
manifiesto. No promueve nada: todas las decisiones quedan `PENDIENTE`.

Las salidas deben estar fuera de Git (se valida con `write_report`).

Uso:

    python -m tools.lope_import.preparar_revision \
        --entradas C:\\...\\entradas --reportes C:\\...\\reportes
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

REPO_ROOT = Path(__file__).resolve().parents[2]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _slug(name: str) -> str:
    stem = Path(name).stem
    cleaned = "".join(char if char.isalnum() else "-" for char in stem.lower())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-")


def _run(args: list[str]) -> str:
    result = subprocess.run(
        [sys.executable, "-m", *args],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONPATH": str(REPO_ROOT), "PYTHONIOENCODING": "utf-8"},
    )
    if result.returncode != 0:
        raise RuntimeError(f"falló {' '.join(args)}: {result.stderr.strip()}")
    return result.stdout.strip()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prepara la revisión humana de los Excel Lope")
    parser.add_argument("--entradas", required=True, help="Carpeta privada de archivos de entrada")
    parser.add_argument("--reportes", required=True, help="Carpeta privada de reportes (fuera de Git)")
    parser.add_argument("--pattern", default="*.xlsx", help="Patrón de archivos")
    args = parser.parse_args(argv)

    inputs = sorted(Path(args.entradas).glob(args.pattern))
    if not inputs:
        print("No hay archivos que coincidan con el patrón", file=sys.stderr)
        return 2
    reports = Path(args.reportes).resolve()
    reports.mkdir(parents=True, exist_ok=True)

    index: list[dict] = []
    for source in inputs:
        digest = _sha256(source)
        lote_id = str(uuid5(NAMESPACE_URL, f"cuyielite-lote:{digest}"))
        slug = _slug(source.name)
        audit_path = reports / f"auditoria-{slug}.json"
        review_path = reports / f"revision-{slug}.json"
        decisions_path = reports / f"decisiones-pendientes-{slug}.json"

        print(f"Procesando {source.name} (sha256 {digest[:12]}…)")
        _run(["tools.lope_import", str(source), "--output", str(audit_path)])
        _run(["tools.lope_import.adapt", str(audit_path), "--output", str(review_path)])
        _run(
            [
                "tools.lope_import.decisions",
                "template",
                str(review_path),
                "--lote-id",
                lote_id,
                "--output",
                str(decisions_path),
            ]
        )

        audit = json.loads(audit_path.read_text(encoding="utf-8"))
        review = json.loads(review_path.read_text(encoding="utf-8"))
        decisions = json.loads(decisions_path.read_text(encoding="utf-8"))
        index.append(
            {
                "archivo": source.name,
                "sha256": digest,
                "lote_id": lote_id,
                "parser_version": audit["parser_version"],
                "mapeo_version": audit["mapeo_version"],
                "candidatos": len(audit["candidates"]),
                "propuestas": len(review["proposals"]),
                "decisiones_pendientes": sum(
                    1 for item in decisions["decisions"] if item["estado"] == "PENDIENTE"
                ),
                "celdas_error": audit.get("celdas_error", []),
                "warnings": audit.get("warnings", []),
                "files_unchanged": audit["summary"]["files_unchanged"],
                "reportes": {
                    "auditoria": str(audit_path),
                    "revision": str(review_path),
                    "decisiones": str(decisions_path),
                },
            }
        )

    index_path = reports / "indice-revision.json"
    index_path.write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Índice de revisión: {index_path}")
    for item in index:
        print(
            f"  {item['archivo']}: {item['propuestas']} propuestas, "
            f"{item['decisiones_pendientes']} pendientes, "
            f"{len(item['celdas_error'])} celdas con error"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
