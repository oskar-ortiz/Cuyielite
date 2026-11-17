"""Regresión: los errores guardados en celdas reproductivas son visibles.

Los reproductivos reales guardan `#VALUE!` en columnas O/P/Q, fuera del
recorrido de 12 columnas del parser. Antes de esta corrección la auditoría los
omitía sin aviso, de modo que el revisor no podía decidir sobre ellos y existía
el riesgo de tratarlos como cero. Los casos usan un libro sintético.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import openpyxl

REPO_ROOT = Path(__file__).resolve().parents[3]

from tools.lope_import.adapt import adapt_audit


def _synthetic_workbook(path: Path) -> None:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Repro"
    sheet["A8"] = "Poza: 1"
    sheet["A9"] = "Macho: B127"
    sheet["A10"] = "Hembra"
    sheet["E10"] = "Parto 1"
    sheet["F10"] = "T.C.N."
    sheet["A11"] = "A1246"
    sheet["E11"] = "2026-06-12"
    sheet["F11"] = "3"
    # Resultado guardado por una fórmula inválida: no es una cantidad.
    sheet["P11"] = "#VALUE!"
    workbook.save(path)


def test_auditoria_registra_celda_de_error(tmp_path: Path):
    xlsx = tmp_path / "reproductivo-sintetico.xlsx"
    report_path = tmp_path / "audit.json"
    _synthetic_workbook(xlsx)
    result = subprocess.run(
        [sys.executable, "-m", "tools.lope_import", str(xlsx), "--output", str(report_path)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    assert result.returncode == 0, result.stderr
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["celdas_error"] == [
        {
            "sheet": "Repro",
            "cell": "P11",
            "value": "#VALUE!",
            "formula": None,
            "file_id": "sha256:" + report["files"][0]["sha256_before"],
        }
    ]
    assert any("P11" in warning and "no convertir en cero" in warning for warning in report["warnings"])

    review = adapt_audit(report)
    assert review["celdas_error"] == report["celdas_error"]
    assert any(item["entity"] == "conteos_reproductivos" for item in review["not_inferred"])

    for proposal in review["proposals"]:
        assert proposal["status"] == "PENDIENTE_REVISION"
        if proposal["entity"] == "partos":
            assert proposal["proposed_fields"]["nacidos_vivos"] is None
            assert proposal["proposed_fields"]["nacidos_muertos"] is None
