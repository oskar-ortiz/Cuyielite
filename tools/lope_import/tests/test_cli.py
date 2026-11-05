"""Pruebas de integración de la CLI de auditoría."""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

import openpyxl
from pathlib import Path

REPO_ROOT = str(Path(__file__).resolve().parents[3])

from tools.lope_import.report import write_report
from tools.lope_import.models import AuditReport


def _make_individual_xlsx(path: str):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Individual"
    ws.append(["GAL No.", "POZA No. ", "ANIMAL No.", "SEXO", "COLOR", "OJOS", "FECHA NACIMIENTO"])
    ws.append([1, 2, "001", 1, "B", "1", "2026-01-01"])
    ws.append([1, 2, "002", 2, "RB", "1", "2026-01-02"])
    ws.append([1, 3, "003", 3, "BR", "1", "2026-01-03"])
    wb.save(path)


def _make_reproductive_xlsx(path: str):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Repro"
    ws["A8"] = "Poza: 1"
    ws["A9"] = "Macho:   B127     Sangre: RB"
    ws["A10"] = "Hembra"
    ws["B10"] = "Peso"
    ws["C10"] = "Color"
    ws["D10"] = "Ojos"
    ws["E10"] = "Parto 1"
    ws["F10"] = "T.C.N."
    ws["G10"] = "Parto 2"
    ws["H10"] = "T.C.N."
    ws["A11"] = ""
    ws["B11"] = " Monta"
    ws["E11"] = "/Fecha"
    ws["G11"] = "/Fecha"
    ws["A12"] = "A1246"
    ws["B12"] = 995
    ws["C12"] = "RB"
    ws["D12"] = 1
    ws["E12"] = "2026-06-12"
    ws["F12"] = "3"
    ws["A13"] = "A1243"
    ws["B13"] = 990
    ws["C13"] = "BBY"
    ws["D13"] = 1
    ws["E13"] = "2026-05-29"
    ws["F13"] = "6M"
    ws["G13"] = "2026-08-24"
    ws["H13"] = "3"
    wb.save(path)


def test_cli_runs_on_individual():
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        _make_individual_xlsx(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        assert os.path.exists(out)


def test_cli_rejects_output_inside_repo():
    repo = REPO_ROOT
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        _make_individual_xlsx(xlsx)
        out = os.path.join(repo, "report.json")
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=repo,
        )
        assert result.returncode != 0
        assert "repos" in result.stderr.lower() or "dentro" in result.stderr.lower() or "repo" in result.stderr.lower()


def test_reproductive_block_groups_litter():
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "repro.xlsx")
        out = os.path.join(tmp, "report.json")
        _make_reproductive_xlsx(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        # Debe tener candidatos de bloque reproductivo
        blocks = [c for c in data["candidates"] if isinstance(c, dict) and c.get("type") == "litter_block"]
        assert len(blocks) >= 2  # dos hembras
        # Verificar que se detectaron partos
        assert any(b["partos"] for b in blocks)
        # Verificar que T.C.N. con X no genera parto
        for b in blocks:
            for p in b["partos"]:
                assert p["fecha"].strip().upper() != "X"


def test_individual_format_detected():
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        _make_individual_xlsx(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        animals = [c for c in data["candidates"] if hasattr(c, "animal_no") or (isinstance(c, dict) and "animal_no" in c)]
        assert len(animals) >= 3


def test_individual_source_fields():
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        _make_individual_xlsx(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        # Verificar que los candidatos tienen campo source y field_origins
        for c in data["candidates"]:
            if isinstance(c, dict) and "animal_no" in c:
                assert "source" in c
                assert "field_origins" in c


def test_individual_rejects_institutional_rows():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Individual"
    ws.append(["GAL No.", "POZA No. ", "ANIMAL No.", "SEXO", "COLOR", "OJOS", "FECHA NACIMIENTO"])
    ws.append(["SERVICIO NACIONAL", None, None, None, None, None, None])
    ws.append([1, 2, "C001", 1, "B", "1", "2026-01-01"])
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        wb.save(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        animals = [c for c in data["candidates"] if isinstance(c, dict) and "animal_no" in c]
        assert len(animals) == 1
        assert animals[0]["animal_no"] == "C001"


def test_individual_reads_pv_columns():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Individual"
    headers = ["GAL No.", "POZA No. ", "ANIMAL No.", "SEXO", "COLOR", "OJOS", "FECHA NACIMIENTO"] + [""] * 8 + [f"COL{i}" for i in range(16, 23)]
    ws.append(headers)
    row = [1, 2, "C001", 1, "B", "1", "2026-01-01"] + [""] * 8 + [f"extra{i}" for i in range(16, 23)]
    ws.append(row)
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        wb.save(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        animals = [c for c in data["candidates"] if isinstance(c, dict) and "animal_no" in c]
        assert len(animals) == 1
        # Verificar que los campos P:V se conservaron con valores concretos
        extra = animals[0].get("extra_fields", {})
        assert extra.get("P2", {}).get("cached") == "extra16"
        assert extra.get("Q2", {}).get("cached") == "extra17"
        assert extra.get("U2", {}).get("cached") == "extra21"


def test_formula_source_individual():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Individual"
    ws.append(["GAL No.", "POZA No. ", "ANIMAL No.", "SEXO", "COLOR", "OJOS", "FECHA NACIMIENTO", "T.C.N.V", "T.C.N.M", "T.C.N.T"])
    ws.append([1, 2, "C001", 1, "B", "1", "2026-01-01", "=G2+1", 3, "=H2+I2"])
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        wb.save(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        animals = [c for c in data["candidates"] if isinstance(c, dict) and "animal_no" in c]
        assert len(animals) == 1
        fo = animals[0].get("field_origins", {})
        # T.C.N.V tiene formula =G2+1, T.C.N.T tiene formula =H2+I2
        assert fo.get("T.C.N.V") == "formula (calculado)"
        assert fo.get("T.C.N.T") == "formula (calculado)"
        # T.C.N.M tiene valor literal 3
        assert fo.get("T.C.N.M") == "observado"


def test_formula_cached_same_cell():
    """XLSX con formula y valor cacheado en la misma celda."""
    import zipfile, os, tempfile, re
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Individual"
    ws.append(["GAL No.", "POZA No. ", "ANIMAL No.", "SEXO", "COLOR", "OJOS", "FECHA NACIMIENTO", "T.C.N.V"])
    ws.append([1, 2, "C001", 1, "B", "1", "2026-01-01", 0])
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "cached.xlsx")
        out = os.path.join(tmp, "report.json")
        wb.save(xlsx)
        # Inyectar formula + cached value en H2 via XML
        zin = zipfile.ZipFile(xlsx, "r")
        items = {name: zin.read(name) for name in zin.namelist()}
        zin.close()
        sheet_xml = items["xl/worksheets/sheet1.xml"].decode("utf-8")
        sheet_xml = re.sub(r'<c r="H2"[^>]*>.*?</c>', '<c r="H2" s="0"><f>G2+1</f><v>42</v></c>', sheet_xml, count=1, flags=re.DOTALL)
        items["xl/worksheets/sheet1.xml"] = sheet_xml.encode("utf-8")
        with zipfile.ZipFile(xlsx, "w", zipfile.ZIP_DEFLATED) as zout:
            for name, data in items.items():
                zout.writestr(name, data)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        animals = [c for c in data["candidates"] if isinstance(c, dict) and "animal_no" in c]
        assert len(animals) == 1
        cand = animals[0]
        # Verificar field_origins marca formula
        fo = cand.get("field_origins", {})
        assert fo.get("T.C.N.V") == "formula (calculado)"


def test_excludes_institutional_headers():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Individual"
    ws.append(["GAL No.", "POZA No. ", "ANIMAL No.", "SEXO", "COLOR", "OJOS", "FECHA NACIMIENTO"])
    ws.append(["SERVICIO NACIONAL DE APRENDIZAJE", None, None, None, None, None, None])
    ws.append(["CENTRO INTERNACIONAL", None, None, None, None, None, None])
    ws.append([1, 2, "C001", 1, "B", "1", "2026-01-01"])
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        wb.save(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        animals = [c for c in data["candidates"] if isinstance(c, dict) and "animal_no" in c]
        assert len(animals) == 1
        assert animals[0]["animal_no"] == "C001"


def test_row_after_2000():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Individual"
    ws.append(["GAL No.", "POZA No. ", "ANIMAL No.", "SEXO", "COLOR", "OJOS", "FECHA NACIMIENTO"])
    # Insertar 2001 filas vacias y una valida al final
    for _ in range(2001):
        ws.append([None] * 7)
    ws.append([1, 2, "C999", 1, "B", "1", "2026-01-01"])
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        wb.save(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        animals = [c for c in data["candidates"] if isinstance(c, dict) and "animal_no" in c]
        assert len(animals) == 1
        assert animals[0]["animal_no"] == "C999"


def test_formula_cached_same_field():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Individual"
    ws.append(["GAL No.", "POZA No. ", "ANIMAL No.", "SEXO", "COLOR", "OJOS", "FECHA NACIMIENTO", "T.C.N.V", "T.C.N.M", "T.C.N.T"])
    ws.append([1, 2, "C001", 1, "B", "1", "2026-01-01", "=G2+1", 3, "=H2+I2"])
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "ind.xlsx")
        out = os.path.join(tmp, "report.json")
        wb.save(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        animals = [c for c in data["candidates"] if isinstance(c, dict) and "animal_no" in c]
        assert len(animals) == 1
        fo = animals[0].get("field_origins", {})
        assert fo.get("T.C.N.V") == "formula (calculado)"
        assert fo.get("T.C.N.T") == "formula (calculado)"
        assert fo.get("T.C.N.M") == "observado"


def test_reproductive_ambiguous_codes_reported():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Repro"
    ws["A8"] = "Poza: 1"
    ws["A9"] = "Macho:   B127"
    ws["A10"] = "Hembra"
    ws["B10"] = "Peso"
    ws["A11"] = ""
    ws["B11"] = " Monta"
    ws["A12"] = "A1246"
    ws["B12"] = 995
    ws["A13"] = "A1246"  # mismo codigo en otra fila
    ws["B13"] = 990
    ws["C10"] = "Color"
    ws["D10"] = "Ojos"
    with tempfile.TemporaryDirectory() as tmp:
        xlsx = os.path.join(tmp, "repro.xlsx")
        out = os.path.join(tmp, "report.json")
        wb.save(xlsx)
        result = subprocess.run(
            [sys.executable, "-m", "tools.lope_import", xlsx, "--output", out],
            capture_output=True, text=True,
            cwd=REPO_ROOT,
        )
        assert result.returncode == 0, result.stderr
        import json
        with open(out) as f:
            data = json.load(f)
        # Debe reportar ambiguedad de codigo coincidente
        assert any("coincidente" in w for w in data["warnings"])