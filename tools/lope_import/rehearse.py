"""Ensayo del procedimiento de carga con datos sintéticos.

Ejecuta el flujo real de la cadena acordada:

    Excel sintético -> auditoría -> revisión -> decisiones -> manifiesto
    -> dry-run -> promoción -> verificación -> respaldo -> restauración

El archivo de entrada es sintético y se genera aquí; nunca se leen fuentes
reales. El destino es una base aislada que el ensayo crea y destruye.

Uso:

    python -m tools.lope_import.rehearse --base-url postgresql://... \\
        --workdir C:\\...\\rehearsal
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

REPO_ROOT = Path(__file__).resolve().parents[2]


def _run(args: list[str], cwd: Path) -> str:
    """Ejecuta una herramienta del repositorio y devuelve su salida."""
    result = subprocess.run(
        [sys.executable, *args],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONPATH": str(REPO_ROOT), "PYTHONIOENCODING": "utf-8"},
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"falló {' '.join(args)}\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result.stdout


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_workbook(path: Path) -> None:
    """Libro sintético con el formato individual y el reproductivo."""
    from openpyxl import Workbook

    workbook = Workbook()
    individual = workbook.active
    individual.title = "Individual"
    individual.append(
        [
            "ANIMAL No.",
            "SEXO",
            "FECHA NACIMIENTO",
            "COLOR",
            "OJOS",
            "T.C.N.V",
            "T.C.N.M",
            "PESO NACIMIENTO",
            "PESO PARTO",
        ]
    )
    individual.append(["C001", "H", "2025-03-12", "B", "1", 4, 1, 150, 320])
    individual.append(["C002", "H", "2025-04-02", "A", "2", 3, 0, 145, 300])
    individual.append(["M001", "M", "2025-03-20", "B", "1", "", "", 150, ""])

    reproductive = workbook.create_sheet("Reproductivo")
    reproductive.append(["Poza: 3"])
    reproductive.append(["Macho: 045"])
    reproductive.append(["Hembra"])
    reproductive.append(["C001", 980, "B", "1", "2026-01-20", "4+1M", "X", "X", "X", "X", "X", "X"])
    reproductive.append(["C002", 940, "A", "2", "X", "X", "X", "X", "X", "X", "X", "X"])
    workbook.save(path)


def _fill_decisions(
    review_path: Path,
    decisions_path: Path,
    *,
    lote_id: str,
    accepted_origin: str | None,
) -> dict[str, int]:
    """Simula la revisión humana: acepta una propuesta y deja el resto fuera."""
    review = json.loads(review_path.read_text(encoding="utf-8"))
    decisions = json.loads(decisions_path.read_text(encoding="utf-8"))
    counts = {"ACEPTADO": 0, "RECHAZADO": 0, "PENDIENTE": 0}
    for entry in decisions["decisions"]:
        origin_ref = entry["origin_ref"]
        if accepted_origin is not None and origin_ref == accepted_origin:
            entry["estado"] = "ACEPTADO"
            entry["revisor"] = "revisor-sintetico"
            entry["evidencia"] = "Ficha individual revisada contra el registro reproductivo."
            entry["entidad_id"] = str(uuid.uuid4())
            entry["expected_version"] = None
            entry["before"] = None
            counts["ACEPTADO"] += 1
        else:
            entry["estado"] = "RECHAZADO"
            entry["revisor"] = "revisor-sintetico"
            entry["evidencia"] = "No coincide con la revisión de campo."
            entry["entidad_id"] = None
            entry["expected_version"] = None
            entry["before"] = None
            counts["RECHAZADO"] += 1
    decisions_path.write_text(
        json.dumps(decisions, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return counts


def _prepare_destination(base_url: str, scope_id: str) -> None:
    """Aplica bootstrap y migraciones, y deja existir el ámbito autorizado."""
    import psycopg

    from tools.db_migrate.runner import apply_migrations

    parsed = base_url.rsplit("/", 1)
    with psycopg.connect(base_url, autocommit=True) as conn:
        for path in sorted((REPO_ROOT / "db" / "ddl" / "central").glob("*.sql")):
            conn.execute(path.read_text(encoding="utf-8"))
    apply_migrations(base_url)
    with psycopg.connect(base_url) as conn:
        conn.execute(
            "INSERT INTO sync_scopes (id, name) VALUES (%s, %s) "
            "ON CONFLICT (id) DO NOTHING",
            (scope_id, "Ensayo sintetico"),
        )
        conn.commit()


def _verify(base_url: str, scope_id: str) -> dict[str, int]:
    """Consulta de solo lectura sobre el resultado de la promoción."""
    import psycopg

    with psycopg.connect(base_url) as conn:
        cuyes = conn.execute(
            "SELECT count(*) FROM cuyes WHERE scope_id=%s", (scope_id,)
        ).fetchone()[0]
        cambios = conn.execute(
            "SELECT count(*) FROM sync_changes WHERE scope_id=%s", (scope_id,)
        ).fetchone()[0]
        secuencia = conn.execute(
            "SELECT last_sequence FROM sync_scopes WHERE id=%s", (scope_id,)
        ).fetchone()[0]
        lotes = conn.execute(
            "SELECT count(*) FROM importacion_lotes WHERE scope_id=%s", (scope_id,)
        ).fetchone()[0]
        alerted = conn.execute(
            "SELECT count(*) FROM importacion_correspondencias c "
            "JOIN importacion_lotes l ON l.id=c.lote_id WHERE l.scope_id=%s",
            (scope_id,),
        ).fetchone()[0]
    return {
        "cuyes": cuyes,
        "cambios": cambios,
        "secuencia": secuencia,
        "lotes": lotes,
        "correspondencias": alerted,
    }


def _backup_and_restore(base_url: str, scope_id: str, restore_name: str) -> dict[str, int]:
    """Respaldo lógico con plantilla y restauración en otra base aislada."""
    import psycopg

    parsed = base_url.rsplit("/", 1)
    admin_url = parsed[0] + "/postgres"
    with psycopg.connect(admin_url, autocommit=True) as admin:
        admin.execute(f'DROP DATABASE IF EXISTS "{restore_name}" WITH (FORCE)')
        admin.execute(f'CREATE DATABASE "{restore_name}" TEMPLATE "{parsed[1]}"')
    with psycopg.connect(admin_url.rsplit("/", 1)[0] + "/" + restore_name) as conn:
        cuyes = conn.execute(
            "SELECT count(*) FROM cuyes WHERE scope_id=%s", (scope_id,)
        ).fetchone()[0]
        cambios = conn.execute(
            "SELECT count(*) FROM sync_changes WHERE scope_id=%s", (scope_id,)
        ).fetchone()[0]
        conn.rollback()
    return {"cuyes": cuyes, "cambios": cambios}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ensayo sintético de la carga Lope")
    parser.add_argument("--base-url", required=True, help="Base PostgreSQL aislada")
    parser.add_argument("--workdir", required=True, help="Directorio temporal fuera del repo")
    parser.add_argument("--scope-id", default=None, help="Ámbito sintético a usar")
    args = parser.parse_args(argv)

    workdir = Path(args.workdir).resolve()
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True)

    scope_id = args.scope_id or str(uuid.uuid4())
    workbook = workdir / "registro-individual-sintetico.xlsx"
    audit = workdir / "audit.json"
    review = workdir / "review.json"
    decisions = workdir / "decisions.json"
    manifest = workdir / "manifiesto.json"

    _prepare_destination(args.base_url, scope_id)
    print(f"0. Destino preparado: {args.base_url.rsplit('/', 1)[1]}")

    _write_workbook(workbook)
    print(f"1. Inventario: {workbook.name} sha256={_sha256(workbook)}")

    out = _run(
        ["-m", "tools.lope_import", str(workbook), "--output", str(audit)], workdir
    )
    print(f"2. Auditoría: {out.strip()}")
    out = _run(["-m", "tools.lope_import.adapt", str(audit), "--output", str(review)], workdir)
    print(f"3. Revisión: {out.strip()}")
    out = _run(
        [
            "-m",
            "tools.lope_import.decisions",
            "template",
            str(review),
            "--lote-id",
            str(uuid.uuid4()),
            "--output",
            str(decisions),
        ],
        workdir,
    )
    print(f"4. Plantilla de decisiones: {out.strip()}")

    review_payload = json.loads(review.read_text(encoding="utf-8"))
    proposals = review_payload["proposals"]
    accepted = next(
        (item["origin_ref"] for item in proposals if item["entity"] == "cuyes"),
        None,
    )
    counts = _fill_decisions(decisions, decisions, lote_id=str(uuid.uuid4()), accepted_origin=accepted)
    print(f"5. Decisiones: {counts}")

    out = _run(
        [
            "-m",
            "tools.lope_import.decisions",
            "build-manifest",
            str(review),
            str(decisions),
            "--scope-id",
            scope_id,
            "--config-alias",
            "SINTETICO",
            "--output",
            str(manifest),
        ],
        workdir,
    )
    print(f"6. Manifiesto: {out.strip()}")

    out = _run(
        [
            "-m",
            "tools.lope_import.promote",
            "--manifiesto",
            str(manifest),
            "--scope-id",
            scope_id,
            "--database-url-env",
            "LOPE_LAB_URL",
        ],
        workdir,
    )
    print(f"7. Dry-run: {out.strip()}")
    despues_dry_run = _verify(args.base_url, scope_id)
    print(f"   Estado tras el dry-run: {despues_dry_run}")
    if despues_dry_run["cuyes"] or despues_dry_run["cambios"]:
        raise RuntimeError("el dry-run persistió datos")

    out = _run(
        [
            "-m",
            "tools.lope_import.promote",
            "--manifiesto",
            str(manifest),
            "--scope-id",
            scope_id,
            "--database-url-env",
            "LOPE_LAB_URL",
            "--commit",
        ],
        workdir,
    )
    print(f"8. Promoción: {out.strip()}")
    tras_promocion = _verify(args.base_url, scope_id)
    print(f"   Estado tras la promoción: {tras_promocion}")

    restaurado = _backup_and_restore(
        args.base_url, scope_id, "cuyelite_lope_restaurado"
    )
    print(f"9. Respaldo y restauración: {restaurado}")
    print(f"Artefactos del ensayo en {workdir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
