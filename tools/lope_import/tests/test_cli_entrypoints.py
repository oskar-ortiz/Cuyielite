"""Los puntos de entrada de línea de comandos deben ser ejecutables.

Regresión: `adapt` y `decisions` no tenían guard `__main__`, así que
`python -m tools.lope_import.adapt` terminaba sin hacer nada y sin error.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def _help(module: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", module, "--help"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={
            **os.environ,
            "PYTHONPATH": str(REPO_ROOT),
            "PYTHONIOENCODING": "utf-8",
        },
    )


def test_audit_tiene_punto_de_entrada():
    result = _help("tools.lope_import")
    assert result.returncode == 0, result.stderr
    assert "--output" in result.stdout


def test_adapt_tiene_punto_de_entrada():
    result = _help("tools.lope_import.adapt")
    assert result.returncode == 0, result.stderr
    assert "--output" in result.stdout


def test_decisions_tiene_punto_de_entrada():
    result = _help("tools.lope_import.decisions")
    assert result.returncode == 0, result.stderr
    assert "build-manifest" in result.stdout
    assert "template" in result.stdout


def test_promote_tiene_punto_de_entrada():
    result = _help("tools.lope_import.promote")
    assert result.returncode == 0, result.stderr
    assert "--manifiesto" in result.stdout
    assert "--scope-id" in result.stdout
