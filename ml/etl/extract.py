"""Read-only extraction of individual and reproductive source workbooks."""

from collections import Counter
from pathlib import Path
import re
from typing import Any

import openpyxl

from ml.etl import config


def _is_present(value: Any) -> bool:
    return value is not None and (
        not isinstance(value, str) or bool(value.strip())
    )


def _header_key(value: Any) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value).upper()) if value is not None else ""


def _has_valid_code(value: Any) -> bool:
    code = str(value).strip() if value is not None else ""
    return bool(re.fullmatch(config.ANIMAL_CODE_PATTERN, code))


def _is_filler_code(value: Any) -> bool:
    code = str(value).strip().upper() if value is not None else ""
    return any(code.startswith(prefix) for prefix in config.FILLER_CODE_PREFIXES)


def _find_individual_header(rows: list[tuple[Any, ...]]) -> tuple[int, dict[str, int]] | None:
    aliases = {
        alias: field
        for field, names in config.INDIVIDUAL_HEADER_ALIASES.items()
        for alias in names
    }
    for row_index, row in enumerate(rows[: config.HEADER_SCAN_ROWS]):
        columns = {
            aliases[key]: column_index
            for column_index, value in enumerate(row)
            if (key := _header_key(value)) in aliases
        }
        if "animal_code" in columns:
            return row_index, columns
    return None


def _find_reproductive_header(
    rows: list[tuple[Any, ...]],
) -> tuple[int, dict[str, int]] | None:
    required = {
        field: _header_key(value)
        for field, value in config.REPRODUCTIVE_HEADER_ALIASES.items()
    }
    for row_index, row in enumerate(rows[: config.HEADER_SCAN_ROWS]):
        columns = {
            field: index
            for field, alias in required.items()
            for index, value in enumerate(row)
            if _header_key(value) == alias
        }
        if set(required).issubset(columns):
            optional_aliases = {
                field: {_header_key(alias) for alias in aliases}
                for field, aliases in config.REPRODUCTIVE_OPTIONAL_HEADER_ALIASES.items()
            }
            for field, aliases in optional_aliases.items():
                match = next(
                    (
                        index
                        for index, value in enumerate(row)
                        if _header_key(value) in aliases
                    ),
                    None,
                )
                if match is not None:
                    columns[field] = match
            return row_index, columns
    return None


def _source_provenance(path: Path, sheet: str, row_number: int) -> dict[str, Any]:
    return {
        "source_file": path.name,
        "source_sheet": sheet,
        "source_row": row_number,
    }


def extract_individual_workbook(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    records: list[dict[str, Any]] = []
    stats: dict[str, Any] = {
        "rows_read": 0,
        "rows_accepted": 0,
        "rows_rejected": Counter(),
        "sheets_processed": 0,
    }
    try:
        for worksheet in workbook.worksheets:
            rows = list(
                worksheet.iter_rows(
                    max_col=config.INDIVIDUAL_MAX_COLUMNS,
                    values_only=True,
                )
            )
            header = _find_individual_header(rows)
            if header is None:
                continue
            stats["sheets_processed"] += 1
            header_index, columns = header
            for row_index in range(header_index + 1, len(rows)):
                row = rows[row_index]
                if not any(_is_present(value) for value in row):
                    continue
                stats["rows_read"] += 1
                code_index = columns["animal_code"]
                code = row[code_index] if code_index < len(row) else None
                if _is_filler_code(code):
                    stats["rows_rejected"]["filler_code"] += 1
                    continue
                if not _has_valid_code(code):
                    stats["rows_rejected"]["invalid_animal_code"] += 1
                    continue

                values = {
                    field: row[index] if index < len(row) else None
                    for field, index in columns.items()
                    if field != "animal_code"
                }
                records.append(
                    {
                        **values,
                        **_source_provenance(path, worksheet.title, row_index + 1),
                    }
                )
                stats["rows_accepted"] += 1
    finally:
        workbook.close()
    return records, stats


def extract_reproductive_workbook(path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    records: list[dict[str, Any]] = []
    stats: dict[str, Any] = {
        "rows_read": 0,
        "rows_accepted": 0,
        "rows_rejected": Counter(),
        "sheets_processed": 0,
    }
    try:
        for worksheet in workbook.worksheets:
            rows = list(
                worksheet.iter_rows(
                    max_col=config.REPRODUCTIVE_MAX_COLUMNS,
                    values_only=True,
                )
            )
            header = _find_reproductive_header(rows)
            if header is None:
                continue

            _, header_columns = header
            stats["sheets_processed"] += 1
            in_poza_block = False
            for row_index, row in enumerate(rows):
                if not any(_is_present(value) for value in row):
                    continue
                first = str(row[0]).strip() if row else ""
                first_upper = first.upper()
                if first_upper.startswith("POZA:"):
                    in_poza_block = True
                    continue
                if (
                    first_upper.startswith("MACHO:")
                    or _header_key(first) == _header_key(
                        config.REPRODUCTIVE_HEADER_ALIASES["female_code"]
                    )
                    or first_upper.startswith("OBSERVACIONE")
                ):
                    continue

                stats["rows_read"] += 1
                if not in_poza_block:
                    stats["rows_rejected"]["outside_poza_block"] += 1
                    continue
                if _is_filler_code(first):
                    stats["rows_rejected"]["filler_code"] += 1
                    continue
                if not _has_valid_code(first):
                    stats["rows_rejected"]["invalid_animal_code"] += 1
                    continue

                litter_cells = []
                tcn_values = []
                for date_index, tcn_index in config.REPRODUCTIVE_COLUMNS["partos"]:
                    date_value = row[date_index] if date_index < len(row) else None
                    tcn_value = row[tcn_index] if tcn_index < len(row) else None
                    litter_cells.append({"date": date_value, "tcn": tcn_value})
                    tcn_values.append(tcn_value)

                records.append(
                    {
                        "female_code": first,
                        "peso_monta_g": (
                            row[config.REPRODUCTIVE_COLUMNS["peso_monta_g"]]
                            if len(row) > config.REPRODUCTIVE_COLUMNS["peso_monta_g"]
                            else None
                        ),
                        "ojos": (
                            row[config.REPRODUCTIVE_COLUMNS["ojos"]]
                            if len(row) > config.REPRODUCTIVE_COLUMNS["ojos"]
                            else None
                        ),
                        "observations": (
                            row[header_columns["observations"]]
                            if "observations" in header_columns
                            and len(row) > header_columns["observations"]
                            else None
                        ),
                        "litters": litter_cells,
                        "tcn_values": tcn_values,
                        **_source_provenance(path, worksheet.title, row_index + 1),
                    }
                )
                stats["rows_accepted"] += 1
    finally:
        workbook.close()
    return records, stats


def _merge_stats(target: dict[str, Any], source: dict[str, Any]) -> None:
    target["rows_read"] += source["rows_read"]
    target["rows_accepted"] += source["rows_accepted"]
    target["rows_rejected"].update(source["rows_rejected"])
    target["sheets_processed"] += source["sheets_processed"]


def _matching_workbooks(
    directory: Path,
    patterns: str | tuple[str, ...],
) -> list[Path]:
    if isinstance(patterns, str):
        patterns = (patterns,)
    matches = {
        path
        for pattern in patterns
        for path in directory.glob(pattern)
        if path.is_file() and not path.name.startswith("~$")
    }
    return sorted(matches)


def extract_all(
    input_dir: Path = config.RAW_DATA_DIR,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    if not input_dir.is_dir():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    individual_files = _matching_workbooks(input_dir, config.INDIVIDUAL_FILE_GLOB)
    reproductive_files = _matching_workbooks(
        input_dir, config.REPRODUCTIVE_FILE_GLOBS
    )
    if not individual_files:
        raise FileNotFoundError("No individual source workbooks matched the configured pattern.")
    if not reproductive_files:
        raise FileNotFoundError("No reproductive source workbooks matched the configured pattern.")

    individual_records: list[dict[str, Any]] = []
    reproductive_records: list[dict[str, Any]] = []
    report: dict[str, Any] = {
        "individual": {
            "rows_read": 0,
            "rows_accepted": 0,
            "rows_rejected": Counter(),
            "sheets_processed": 0,
        },
        "reproductive": {
            "rows_read": 0,
            "rows_accepted": 0,
            "rows_rejected": Counter(),
            "sheets_processed": 0,
        },
        "source_file_counts": {
            "individual": len(individual_files),
            "reproductive": len(reproductive_files),
        },
    }
    for path in individual_files:
        records, stats = extract_individual_workbook(path)
        individual_records.extend(records)
        _merge_stats(report["individual"], stats)
    for path in reproductive_files:
        records, stats = extract_reproductive_workbook(path)
        reproductive_records.extend(records)
        _merge_stats(report["reproductive"], stats)

    if not individual_records:
        raise ValueError("No valid individual records were found.")
    if not reproductive_records:
        raise ValueError("No valid reproductive records were found.")
    return reproductive_records, individual_records, report
