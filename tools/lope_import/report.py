"""Generación de informe privado por fila/celda."""

import json
import subprocess
from pathlib import Path


def _git_roots(path: Path) -> list[Path]:
    """Obtiene las raíces de todos los repositorios/worktrees Git conocidos."""
    roots = set()
    cwd = str(path.parent)
    # Repo actual y sus worktrees
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=cwd,
            capture_output=True, text=True, timeout=5,
        )
        if out.returncode == 0:
            roots.add(Path(out.stdout.strip()))
            # Listar todos los worktrees del repo
            wt = subprocess.run(
                ["git", "worktree", "list", "--porcelain"],
                cwd=cwd,
                capture_output=True, text=True, timeout=5,
            )
            if wt.returncode == 0:
                for line in wt.stdout.splitlines():
                    if line.startswith("worktree "):
                        roots.add(Path(line[len("worktree "):].strip()))
    except Exception:
        pass
    # Directorio padre de worktrees (fallback conocido)
    worktrees_parent = Path(__file__).resolve().parents[2].parent
    if worktrees_parent.exists():
        roots.add(worktrees_parent)
    # Repo root del módulo
    roots.add(Path(__file__).resolve().parents[2])
    return list(roots)


def write_report(report, output_path: str) -> None:
    """Escribe el informe en una ruta fuera del repositorio y de los worktrees."""
    path = Path(output_path)
    if not path.is_absolute():
        raise ValueError("La ruta de salida debe ser absoluta y fuera del repositorio.")
    for base in _git_roots(path):
        try:
            path.resolve().relative_to(base)
            inside = True
        except ValueError:
            inside = False
        if inside:
            raise ValueError("La ruta de salida no puede estar dentro del repositorio ni de un worktree.")

    def _serialize(obj):
        if hasattr(obj, "__dataclass_fields__"):
            return {k: _serialize(v) for k, v in obj.__dict__.items()}
        if isinstance(obj, list):
            return [_serialize(i) for i in obj]
        if isinstance(obj, dict):
            return {k: _serialize(v) for k, v in obj.items()}
        return obj

    payload = _serialize(report.__dict__ if hasattr(report, "__dict__") else report)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, default=str)