"""Controla la API del piloto local como proceso separado.

Uso:

    python -m tools.piloto.servidor start
    python -m tools.piloto.servidor stop
    python -m tools.piloto.servidor status

`start` usa CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS en Windows para que
la API sobreviva al shell que la lanza y no retenga sus descriptores.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_DIR = Path(os.environ["LOCALAPPDATA"]) / "CuyiElite" / "piloto-local" / "estado"
LOG_DIR = Path(os.environ["LOCALAPPDATA"]) / "CuyiElite" / "piloto-local" / "logs"
PID_FILE = STATE_DIR / "backend.pid"
STDOUT_LOG = LOG_DIR / "backend.out.log"
STDERR_LOG = LOG_DIR / "backend.err.log"


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def _alive(pid: int) -> bool:
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
            capture_output=True,
            text=True,
        )
        return str(pid) in result.stdout
    except OSError:
        return False


def _health(url: str) -> str | None:
    try:
        with urllib.request.urlopen(f"{url}/health", timeout=3) as response:
            return response.read().decode("utf-8", "replace")
    except (urllib.error.URLError, OSError):
        return None


def start(port: int) -> int:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    url = f"http://127.0.0.1:{port}"
    if _health(url) is not None:
        print(f"Backend ya activo en {url}")
        return 0
    if PID_FILE.exists() and _alive(int(PID_FILE.read_text().strip())):
        print("Hay un PID de backend vivo pero no responde /health; revisa los logs.")
        return 1

    env = load_env(REPO_ROOT / ".env")
    child_env = {**os.environ, **env}

    # La API importa `rag.src.retrieve` en el mismo proceso: debe usar el
    # intérprete que tiene las dependencias del pipeline RAG instaladas.
    venv = REPO_ROOT / "rag" / ".venv" / "Scripts" / "python.exe"
    interpreter = str(venv) if venv.exists() else sys.executable

    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    with STDERR_LOG.open("ab") as err, STDOUT_LOG.open("ab") as out:
        process = subprocess.Popen(
            [
                interpreter,
                "-m",
                "uvicorn",
                "backend.app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=str(REPO_ROOT),
            env=child_env,
            stdout=out,
            stderr=err,
            creationflags=flags,
            close_fds=True,
        )
    PID_FILE.write_text(str(process.pid), encoding="utf-8")
    for _ in range(30):
        body = _health(url)
        if body is not None:
            print(f"Backend listo en {url} (PID {process.pid}): {body[:120]}")
            return 0
        time.sleep(1)
    print(f"El backend no respondio en 30 s; revisa {STDERR_LOG}", file=sys.stderr)
    return 1


def stop() -> int:
    if not PID_FILE.exists():
        print("Backend: sin PID registrado; nada que detener.")
        return 0
    pid = int(PID_FILE.read_text().strip())
    if not _alive(pid):
        print(f"Backend: PID {pid} no estaba vivo.")
        PID_FILE.unlink(missing_ok=True)
        return 0
    result = subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, text=True
    )
    PID_FILE.unlink(missing_ok=True)
    print(f"Backend detenido (PID {pid}, rc={result.returncode}).")
    return 0


def status(port: int) -> int:
    url = f"http://127.0.0.1:{port}"
    body = _health(url)
    pid = PID_FILE.read_text().strip() if PID_FILE.exists() else "-"
    print(json.dumps({"url": url, "pid": pid, "health": body}, ensure_ascii=False))
    return 0 if body is not None else 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Control de la API del piloto local")
    parser.add_argument("action", choices=("start", "stop", "status", "restart"))
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args(argv)
    if args.action == "start":
        return start(args.port)
    if args.action == "stop":
        return stop()
    if args.action == "restart":
        stop()
        return start(args.port)
    return status(args.port)


if __name__ == "__main__":
    sys.exit(main())
