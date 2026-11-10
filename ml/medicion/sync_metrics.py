"""Summarize synchronization success rate and latency from a CSV log."""

import argparse
import csv
from datetime import datetime
import json
import math
from pathlib import Path
from typing import Any


SYNC_FIELDS = ("id", "inicio", "fin", "exito")
TRUE_VALUES = frozenset({"1", "true", "si", "sí"})
FALSE_VALUES = frozenset({"0", "false", "no"})


def _read_csv(path: Path, expected_fields: tuple[str, ...]) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        fields = reader.fieldnames
        if fields is None:
            raise ValueError(f"{path}: el CSV no tiene encabezado.")
        if len(fields) != len(set(fields)) or set(fields) != set(expected_fields):
            expected = ", ".join(expected_fields)
            raise ValueError(
                f"{path}: encabezados inválidos; se requieren exactamente: {expected}."
            )

        rows = []
        for line_number, row in enumerate(reader, start=2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"{path}:{line_number}: número de columnas inválido.")
            if any(not value.strip() for value in row.values()):
                raise ValueError(f"{path}:{line_number}: hay campos vacíos.")
            rows.append(row)
    if not rows:
        raise ValueError(f"{path}: no hay filas de datos.")
    return rows


def _parse_timestamp(value: str, path: Path, line_number: int) -> datetime:
    normalized = value.strip()
    if normalized.endswith(("Z", "z")):
        normalized = normalized[:-1] + "+00:00"
    try:
        result = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise ValueError(
            f"{path}:{line_number}: inicio/fin debe ser timestamp ISO 8601."
        ) from error
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError(
            f"{path}:{line_number}: el timestamp debe incluir zona horaria."
        )
    return result


def _parse_success(value: str, path: Path, line_number: int) -> bool:
    normalized = value.strip().casefold()
    if normalized in TRUE_VALUES:
        return True
    if normalized in FALSE_VALUES:
        return False
    raise ValueError(
        f"{path}:{line_number}: exito debe ser 1/0, true/false o sí/no."
    )


def _percentile(values: list[float], percentile: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * percentile
    lower = math.floor(position)
    upper = math.ceil(position)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def summarize_sync_csv(path: Path) -> dict[str, Any]:
    """Return aggregate sync success and latency in milliseconds."""
    rows = _read_csv(path, SYNC_FIELDS)
    durations_ms = []
    successes = 0
    for line_number, row in enumerate(rows, start=2):
        started = _parse_timestamp(row["inicio"], path, line_number)
        finished = _parse_timestamp(row["fin"], path, line_number)
        duration_ms = (finished - started).total_seconds() * 1000
        if duration_ms < 0:
            raise ValueError(f"{path}:{line_number}: fin no puede preceder a inicio.")
        durations_ms.append(duration_ms)
        successes += _parse_success(row["exito"], path, line_number)

    return {
        "attempt_count": len(rows),
        "successful_attempts": successes,
        "success_rate_pct": successes * 100 / len(rows),
        "latency_ms": {
            "mean": math.fsum(durations_ms) / len(durations_ms),
            "p50": _percentile(durations_ms, 0.50),
            "p95": _percentile(durations_ms, 0.95),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    args = parser.parse_args()
    try:
        result = summarize_sync_csv(args.csv_path)
    except (OSError, csv.Error, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
