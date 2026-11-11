"""CLI de auditoría de solo lectura."""

import argparse
import hashlib
import json
import sys
from pathlib import Path

from .models import AuditReport, CandidateAnimal, CellRef
from .normalize import to_text, sexo_from_code
from .readers import (
    load_workbook,
    detect_format,
    read_individual_sheet,
    read_reproductive_blocks,
)
from .reconcile import reconcile_litters
from .report import write_report


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def audit_file(path: str, report: AuditReport):
    """Audita un archivo Excel y agrega candidatos e incidencias al reporte."""
    wb_formula = load_workbook(path, data_only=False, read_only=True)
    wb_cached = load_workbook(path, data_only=True, read_only=False)

    for ws_f in wb_formula.worksheets:
        ws_c = wb_cached[ws_f.title]
        fmt = detect_format(ws_f)
        if fmt == "individual":
            rows = read_individual_sheet(ws_f, ws_c)
            for r in rows:
                animal_no = to_text(r.get("ANIMAL No."))
                if animal_no:
                    field_origins = r.get("_field_origins", {})
                    pv = {coord: val for coord, val in r.get("_pv", {}).items() if val is not None}
                    pv_cached = r.get("_pv_cached", {})
                    # Conservar ambas vistas por campo P:V
                    extra = {}
                    for coord, val in pv.items():
                        extra[coord] = {
                            "formula": val if isinstance(val, str) and val.startswith("=") else None,
                            "cached": pv_cached.get(coord),
                            "source": "formula (calculado)" if (isinstance(val, str) and val.startswith("=")) else "observado",
                        }
                    cand = CandidateAnimal(
                        animal_no=animal_no,
                        sexo=sexo_from_code(r.get("SEXO")),
                        fecha_nacimiento=to_text(r.get("FECHA NACIMIENTO")),
                        color=to_text(r.get("COLOR")),
                        ojos=to_text(r.get("OJOS")),
                        ref=CellRef(sheet=ws_f.title, cell=f"A{r['_row']}"),
                        source="observado",
                    )
                    cand.field_origins = field_origins
                    cand.extra_fields = extra
                    report.candidates.append(cand)
                if r.get("ANIMAL No.") is None:
                    report.warnings.append(f"{ws_f.title}!A{r['_row']}: fila sin codigo de animal")
                if r.get("SEXO") is None:
                    report.warnings.append(f"{ws_f.title}!A{r['_row']}: sexo no informado")
        elif fmt == "reproductive":
            blocks = read_reproductive_blocks(ws_f, ws_c)
            recon = reconcile_litters(blocks)
            for b in blocks:
                report.candidates.append({
                    "type": "litter_block",
                    "poza": b["poza"],
                    "macho": b["macho"],
                    "hembra": b["hembra"],
                    "peso": b["peso"],
                    "color": b["color"],
                    "ojos": b["ojos"],
                    "partos": b["partos"],
                    "ref": b["ref"],
                    "source": "observado",
                    "field_origins": {},
                    "reconcilable": False,
                    "reconciliation_note": "No se puede reconciliar automaticamente; pendiente de validacion",
                })
                if not b["partos"]:
                    report.warnings.append(f"{b['ref']}: bloque sin partos")
            for amb in recon["ambiguities"]:
                report.warnings.append(
                    f"{amb['ref2']}: codigo coincidente '{amb['code']}' con {amb['ref1']} — no fusionar sin validacion"
                )
        else:
            report.warnings.append(f"{ws_f.title}: formato no reconocido")

    wb_formula.close()
    wb_cached.close()


def main(argv=None):
    if argv is None:
        argv = sys.argv[1:]
    if argv and argv[0] == "promote":
        from .promote import main as promote_main

        return promote_main(argv[1:])

    parser = argparse.ArgumentParser(description="Auditoria de solo lectura de fuentes Excel")
    parser.add_argument("files", nargs="+", help="Rutas explicitas de archivos Excel")
    parser.add_argument("--output", "-o", required=True, help="Ruta absoluta de salida del reporte (fuera del repo)")
    args = parser.parse_args(argv)

    before = {f: _sha256(f) for f in args.files}

    report = AuditReport(files=args.files)
    for f in args.files:
        audit_file(f, report)

    after = {f: _sha256(f) for f in args.files}
    report.summary["sha256_before"] = before
    report.summary["sha256_after"] = after
    report.summary["files_unchanged"] = before == after

    write_report(report, args.output)
    print(f"Reporte escrito en {args.output}")
    print(f"Archivos auditados: {len(args.files)}")
    print(f"Candidatos: {len(report.candidates)}")
    print(f"Incidencias: {len(report.warnings) + len(report.errors)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())