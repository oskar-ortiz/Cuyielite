"""Pruebas sintéticas del parser de auditoría."""

import tempfile
import os
from pathlib import Path

from tools.lope_import.normalize import to_text, to_int, to_decimal, sexo_from_code
from tools.lope_import.report import write_report
from tools.lope_import.models import AuditReport


def test_to_text_preserves_leading_zeros():
    assert to_text("00123") == "00123"
    assert to_text(None) is None
    assert to_text("") is None
    assert to_text("  ") is None


def test_to_int_no_cast_float():
    assert to_int(1.5) is None
    assert to_int(1.0) == 1
    assert to_int("X") is None
    assert to_int("") is None
    assert to_int(0) == 0


def test_to_decimal():
    assert to_decimal("12.50") == __import__("decimal").Decimal("12.50")
    assert to_decimal(None) is None
    assert to_decimal("abc") is None


def test_sexo_from_code():
    assert sexo_from_code(1) == "M"
    assert sexo_from_code(2) == "H"
    assert sexo_from_code(3) is None
    assert sexo_from_code("X") is None
    assert sexo_from_code(None) is None


def test_report_rejects_repo_path():
    import pytest
    report = AuditReport(files=["test.xlsx"])
    repo_root = Path(__file__).resolve().parents[3]
    with pytest.raises(ValueError):
        write_report(report, str(repo_root / "report.json"))


def test_report_accepts_absolute_outside_repo():
    report = AuditReport(files=["test.xlsx"])
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "report.json")
        write_report(report, out)
        assert os.path.exists(out)