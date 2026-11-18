"""El controlador del backend no debe confiar en un PID reutilizado."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

from tools.piloto import servidor


class FakeProcess:
    def __init__(self, pid: int = 4242) -> None:
        self.pid = pid


def test_start_descarta_pid_ajeno(monkeypatch, tmp_path: Path):
    pid_file = tmp_path / "backend.pid"
    pid_file.write_text("999", encoding="utf-8")
    monkeypatch.setattr(servidor, "PID_FILE", pid_file)
    monkeypatch.setattr(servidor, "_alive", lambda pid: True)
    monkeypatch.setattr(servidor, "_is_expected_backend", lambda pid: False)

    answers = iter([None, '{"status":"ok"}'])
    monkeypatch.setattr(servidor, "_health", lambda url: next(answers))
    launched = []
    monkeypatch.setattr(
        servidor.subprocess,
        "Popen",
        lambda *args, **kwargs: launched.append((args, kwargs)) or FakeProcess(),
    )

    assert servidor.start(8000) == 0
    assert len(launched) == 1
    assert pid_file.read_text(encoding="utf-8") == "4242"


def test_start_no_lanza_duplicado_si_health_responde(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(servidor, "PID_FILE", tmp_path / "backend.pid")
    monkeypatch.setattr(servidor, "_health", lambda url: '{"status":"ok"}')
    launched = []
    monkeypatch.setattr(
        servidor.subprocess,
        "Popen",
        lambda *args, **kwargs: launched.append((args, kwargs)) or FakeProcess(),
    )
    assert servidor.start(8000) == 0
    assert launched == []


def test_stop_no_mata_proceso_ajeno(monkeypatch, tmp_path: Path):
    pid_file = tmp_path / "backend.pid"
    pid_file.write_text("999", encoding="utf-8")
    monkeypatch.setattr(servidor, "PID_FILE", pid_file)
    monkeypatch.setattr(servidor, "_alive", lambda pid: True)
    monkeypatch.setattr(servidor, "_is_expected_backend", lambda pid: False)
    called = []
    monkeypatch.setattr(
        servidor.subprocess,
        "run",
        lambda *args, **kwargs: called.append(args) or pytest.fail("no debía llamar a subprocess.run"),
    )
    assert servidor.stop() == 0
    assert called == []
    assert not pid_file.exists()


def test_stop_limpia_pid_obsoleto(monkeypatch, tmp_path: Path):
    pid_file = tmp_path / "backend.pid"
    pid_file.write_text("999", encoding="utf-8")
    monkeypatch.setattr(servidor, "PID_FILE", pid_file)
    monkeypatch.setattr(servidor, "_alive", lambda pid: False)
    called = []
    monkeypatch.setattr(
        servidor.subprocess,
        "run",
        lambda *args, **kwargs: called.append(args) or pytest.fail("no debía llamar a subprocess.run"),
    )
    assert servidor.stop() == 0
    assert called == []
    assert not pid_file.exists()


def test_reconoce_solo_el_comando_del_backend(monkeypatch):
    monkeypatch.setattr(servidor, "_command_line", lambda pid: "python -m uvicorn backend.app.main:app --port 8000")
    assert servidor._is_expected_backend(1) is True
    monkeypatch.setattr(servidor, "_command_line", lambda pid: "python -m uvicorn otro.app:app --port 8000")
    assert servidor._is_expected_backend(1) is False
