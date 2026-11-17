"""Persist and verify Random Forest artifacts against aggregate metadata."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from pathlib import Path
import re
from typing import Any

import joblib


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL_PATH = (
    REPOSITORY_ROOT / "ml" / "models" / "candidate_random_forest_b.joblib"
)
DEFAULT_METADATA_PATH = REPOSITORY_ROOT / "ml" / "models" / "metadata.json"
MODEL_PATH_ENV = "CUYIELITE_RF_MODEL_PATH"
METADATA_PATH_ENV = "CUYIELITE_RF_METADATA_PATH"


class ModelArtifactError(ValueError):
    """Raised when an artifact cannot be verified against its metadata."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_model_metadata(
    model_path: Path,
    metadata: dict[str, Any],
    metadata_path: Path = DEFAULT_METADATA_PATH,
) -> dict[str, Any]:
    if not model_path.is_file():
        raise FileNotFoundError(f"No existe el artefacto RF: {model_path}")
    registered = {
        **metadata,
        "artifact_file": model_path.name,
        "model_sha256": sha256_file(model_path),
    }
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(
        json.dumps(registered, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return registered


def load_verified_model(
    model_path: str | Path | None = None,
    metadata_path: str | Path | None = None,
) -> Any | None:
    configured_model = model_path or os.getenv(MODEL_PATH_ENV)
    if not configured_model:
        return None
    artifact = Path(configured_model).expanduser()
    if not artifact.is_file():
        raise ModelArtifactError(f"RF_MODEL_NOT_FOUND: no existe el artefacto {artifact}.")

    configured_metadata = (
        metadata_path
        or os.getenv(METADATA_PATH_ENV)
        or DEFAULT_METADATA_PATH
    )
    metadata_file = Path(configured_metadata).expanduser()
    try:
        metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ModelArtifactError(
            f"RF_METADATA_UNAVAILABLE: no se pudo leer metadata en {metadata_file}."
        ) from error
    if not isinstance(metadata, dict):
        raise ModelArtifactError("RF_METADATA_INVALID: metadata debe ser un objeto JSON.")

    expected_hash = metadata.get("model_sha256")
    if not isinstance(expected_hash, str) or re.fullmatch(r"[0-9a-fA-F]{64}", expected_hash) is None:
        raise ModelArtifactError(
            "RF_MODEL_SHA256_MISSING: metadata no contiene un SHA-256 válido."
        )
    actual_hash = sha256_file(artifact)
    if not hmac.compare_digest(expected_hash.lower(), actual_hash):
        raise ModelArtifactError(
            "RF_MODEL_SHA256_MISMATCH: el hash del artefacto no coincide con metadata "
            f"(esperado {expected_hash.lower()}, obtenido {actual_hash})."
        )
    return joblib.load(artifact)
