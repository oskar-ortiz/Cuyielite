"""Transform extracted rows into model-feature CSV records."""

from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime
import math
import re
from typing import Any

from ml.etl import config


@dataclass(frozen=True)
class ParsedTCN:
    total: float | None
    vivos: float | None
    muertos: float | None
    status: str
    pattern: str


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    return isinstance(value, float) and math.isnan(value)


def _clean_raw(value: Any) -> Any:
    return value.strip() if isinstance(value, str) and value.strip() else (
        None if isinstance(value, str) else value
    )


def _code_key(value: Any) -> str | None:
    if _is_missing(value):
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip().upper()


def decode_code(value: Any, catalog: dict[str, str]) -> str | None:
    key = _code_key(value)
    if key is None:
        return None
    return catalog.get(key, config.UNKNOWN_CODE)


def _numeric(value: Any) -> int | float | None:
    if _is_missing(value) or isinstance(value, bool):
        return None
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return int(number) if number.is_integer() else number


def _average(values: list[int | float]) -> float | None:
    return sum(values) / len(values) if values else None


def _valid_parturition_date(value: Any) -> bool:
    if _is_missing(value):
        return False
    if isinstance(value, (date, datetime)):
        return True
    return str(value).strip().upper() not in config.EMPTY_DATE_MARKERS


def _is_countable_parturition(litter: dict[str, Any], parsed: ParsedTCN) -> bool:
    has_parturition_date = _valid_parturition_date(litter["date"])
    is_abortion = parsed.pattern == config.TCN_ABORT_PATTERN
    return (
        (has_parturition_date or is_abortion)
        and parsed.pattern not in config.TCN_IGNORED_PATTERNS
    )


def tcn_pattern(value: Any) -> str:
    if _is_missing(value):
        return "VACIO"
    if isinstance(value, bool):
        return config.UNKNOWN_CODE
    if isinstance(value, int):
        text = str(value)
    elif isinstance(value, float) and value.is_integer():
        text = str(int(value))
    else:
        text = re.sub(r"\s+", "", str(value).strip().upper())
    if "AB" in text and re.search(r"\d", text):
        return "NO_INTERPRETADO_AB_CON_CANTIDAD"
    if re.fullmatch(r"\d+\+\d+M", text):
        return "N+NM"
    if re.fullmatch(r"\d+M", text):
        return "NM"
    if re.fullmatch(r"\d+", text):
        return "N"
    if text in config.TCN_CONFIRMED_PATTERNS:
        return text
    return config.UNKNOWN_CODE


def parse_tcn(value: Any) -> ParsedTCN:
    pattern = tcn_pattern(value)
    if pattern == "VACIO":
        return ParsedTCN(None, None, None, config.SIN_CONFIRMAR, pattern)
    if pattern == "N+NM":
        text = re.sub(r"\s+", "", str(value).strip().upper())
        match = re.fullmatch(r"(\d+)\+(\d+)M", text)
        if match is not None:
            vivos, muertos = (int(value) for value in match.groups())
            return ParsedTCN(
                vivos + muertos, vivos, muertos, config.CONFIRMADO, pattern
            )
    if pattern == "NM":
        text = re.sub(r"\s+", "", str(value).strip().upper())
        match = re.fullmatch(r"(\d+)M", text)
        if match is not None:
            muertos = int(match.group(1))
            return ParsedTCN(
                muertos, 0, muertos, config.CONFIRMADO, pattern
            )
    if pattern == "N":
        text = (
            str(int(value))
            if isinstance(value, float) and value.is_integer()
            else str(value).strip()
        )
        total = int(text)
        return ParsedTCN(
            total, total, 0, config.TCN_INTEGER_STATUS, pattern
        )
    if pattern in {"AB", "M"}:
        return ParsedTCN(None, None, None, config.CONFIRMADO, pattern)
    if pattern == "NO_INTERPRETADO_AB_CON_CANTIDAD":
        return ParsedTCN(None, None, None, config.SIN_CONFIRMAR, pattern)
    if pattern in config.TCN_IGNORED_PATTERNS:
        return ParsedTCN(None, None, None, "IGNORADO", pattern)
    return ParsedTCN(None, None, None, config.SIN_CONFIRMAR, pattern)


def mortality_rate(deaths: Any, total: Any) -> float | None:
    dead_value = _numeric(deaths)
    total_value = _numeric(total)
    if dead_value is None or total_value is None or total_value <= 0:
        return None
    if dead_value < 0 or dead_value > total_value:
        return None
    return dead_value / total_value


def _quality_status(
    *,
    data_statuses: set[str],
    has_missing: bool,
    has_unknown_code: bool,
) -> str:
    statuses = set(data_statuses)
    if has_missing:
        statuses.add(config.SIN_CONFIRMAR)
    if has_unknown_code:
        statuses.add(config.SIN_CONFIRMAR)
    if not statuses:
        statuses.add(config.SIN_CONFIRMAR)
    ordered_statuses = [
        status
        for status in (
            config.CONFIRMADO,
            config.INFERIDO_POR_DATOS,
            config.SIN_CONFIRMAR,
        )
        if status in statuses
    ]
    if has_missing:
        ordered_statuses.append("REVISAR")
    if has_unknown_code:
        ordered_statuses.append(config.UNKNOWN_CODE)
    return "|".join(ordered_statuses)


def _as_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    for date_format in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, date_format).date()
        except ValueError:
            continue
    return None


def _has_dead_marker(value: Any) -> bool | None:
    if _is_missing(value):
        return None
    return bool(
        re.search(
            rf"\b{re.escape(config.TCN_DEAD_OBSERVATION_MARKER)}\b",
            str(value).upper(),
        )
    )


def transform_reproductoras(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    features = []
    for record in records:
        eyes_raw = _clean_raw(record.get("ojos"))
        eyes_text = decode_code(eyes_raw, config.OJOS_CODES)
        parsed_litters = [
            (litter, parse_tcn(litter["tcn"]))
            for litter in record["litters"]
        ]
        parturitions = [
            (litter, parsed)
            for litter, parsed in parsed_litters
            if _is_countable_parturition(litter, parsed)
        ]
        numeric_events = [
            parsed for _, parsed in parturitions if parsed.total is not None
        ]
        totals = [value.total for value in numeric_events]
        lives = [
            value.vivos
            for value in numeric_events
            if value.vivos is not None
        ]
        mortality_pairs = [
            (value.muertos, value.total)
            for value in numeric_events
            if value.muertos is not None
            and value.total is not None
            and value.total > 0
        ]
        mortality = (
            sum(dead for dead, _ in mortality_pairs)
            / sum(total for _, total in mortality_pairs)
            if mortality_pairs
            else None
        )
        abortos = sum(
            parsed.pattern == config.TCN_ABORT_PATTERN
            for _, parsed in parsed_litters
        )
        observations = record.get("observations")
        has_unknown = eyes_text == config.UNKNOWN_CODE
        data_statuses = {
            parsed.status
            for _, parsed in parsed_litters
            if parsed.status
            in {
                config.CONFIRMADO,
                config.INFERIDO_POR_DATOS,
                config.SIN_CONFIRMAR,
            }
        }
        if eyes_text is not None and not has_unknown:
            data_statuses.add(config.CONFIRMADO)
        features.append(
            {
                "etapa": "reproductora",
                "partos_acumulados": len(parturitions),
                "tcn_vivos_promedio": _average(lives),
                "tcn_total_promedio": _average(totals),
                "peso_monta_g": _numeric(record.get("peso_monta_g")),
                "tasa_mortalidad_camada": mortality,
                "abortos": abortos,
                "hembra_muerta": _has_dead_marker(observations),
                "ojos": eyes_raw,
                "ojos_texto": eyes_text,
                "estado_calidad": _quality_status(
                    has_missing=(
                        eyes_raw is None
                        or _numeric(record.get("peso_monta_g")) is None
                        or observations is None
                        or any(
                            _is_missing(litter["tcn"])
                            for litter, _ in parturitions
                        )
                    ),
                    has_unknown_code=has_unknown,
                    data_statuses=data_statuses,
                ),
                "provenance_archivo": record["source_file"],
                "provenance_hoja": record["source_sheet"],
                "provenance_fila": record["source_row"],
                "etiqueta": "",
            }
        )
    return features


def transform_crias(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    features = []
    for record in records:
        tcnv = _numeric(record.get("tcnv"))
        tcnm = _numeric(record.get("tcnm"))
        tcnt = _numeric(record.get("tcnt"))
        nupar_madre = _clean_raw(record.get("nupar_madre"))
        ojos_raw = _clean_raw(record.get("ojos"))
        sexo_raw = _clean_raw(record.get("sexo"))
        destino_raw = _clean_raw(record.get("destino"))
        ojos_texto = decode_code(ojos_raw, config.OJOS_CODES)
        sexo_texto = decode_code(sexo_raw, config.SEXO_CODES)
        destino_texto = decode_code(destino_raw, config.DESTINO_CODES)
        weights = {
            "peso_nacimiento_g": _numeric(record.get("peso_nacimiento_g")),
            "peso_destete_g": _numeric(record.get("peso_destete_g")),
            "peso_4_semanas_g": _numeric(record.get("peso_4_semanas_g")),
        }
        birth_date = _as_date(record.get("fecha_nacimiento"))
        weaning_date = _as_date(record.get("fecha_destete"))
        days_to_weaning = (
            (weaning_date - birth_date).days
            if birth_date is not None and weaning_date is not None
            else None
        )
        ratio = (
            weights["peso_destete_g"] / weights["peso_nacimiento_g"]
            if weights["peso_destete_g"] is not None
            and weights["peso_nacimiento_g"] is not None
            and weights["peso_nacimiento_g"] > 0
            else None
        )
        has_missing = any(
            value is None
            for value in (
                nupar_madre,
                tcnv,
                tcnm,
                tcnt,
                ojos_raw,
                sexo_raw,
                destino_raw,
                *weights.values(),
                days_to_weaning,
            )
        )
        has_unknown = config.UNKNOWN_CODE in (ojos_texto, sexo_texto, destino_texto)
        data_statuses = set()
        if nupar_madre is not None:
            data_statuses.add(config.NUPAR_STATUS)
        if all(value is not None for value in (tcnv, tcnm, tcnt)):
            data_statuses.add(config.CONFIRMADO)
        if any(
            value is not None and value != config.UNKNOWN_CODE
            for value in (ojos_texto, sexo_texto, destino_texto)
        ):
            data_statuses.add(config.CONFIRMADO)
        quality_status = _quality_status(
            data_statuses=data_statuses,
            has_missing=has_missing,
            has_unknown_code=has_unknown,
        )
        if record.get("duplicate_conflict"):
            quality_status = f"{quality_status}|CONFLICTO_DUPLICADO"
        features.append(
            {
                "etapa": "candidata",
                "nupar_madre": nupar_madre,
                "tcnv": tcnv,
                "tcnm": tcnm,
                "tcnt": tcnt,
                "tasa_mortalidad_camada": mortality_rate(tcnm, tcnt),
                **weights,
                "ratio_destete_nacimiento": ratio,
                "dias_destete": days_to_weaning,
                "ojos": ojos_raw,
                "ojos_texto": ojos_texto,
                "sexo": sexo_raw,
                "sexo_texto": sexo_texto,
                "destino": destino_raw,
                "destino_texto": destino_texto,
                "identidad": (
                    "SIN_PLACA" if _code_key(destino_raw) == "SP" else None
                ),
                "estado_calidad": quality_status,
                "provenance_archivo": record["source_file"],
                "provenance_hoja": record["source_sheet"],
                "provenance_fila": record["source_row"],
                "etiqueta": "",
            }
        )
    return features


def _code_count(value: Any, catalog: dict[str, str]) -> str:
    key = _code_key(value)
    if key is None:
        return "FALTANTE"
    return key if key in catalog else config.UNKNOWN_CODE


def _catalog_counts(
    records: list[dict[str, Any]],
    field: str,
    catalog: dict[str, str],
) -> dict[str, int]:
    counts = {code: 0 for code in catalog}
    counts.update(
        Counter(_code_count(record.get(field), catalog) for record in records)
    )
    return counts


def build_aggregate_report(
    reproductive_records: list[dict[str, Any]],
    individual_records: list[dict[str, Any]],
    extraction_stats: dict[str, Any],
    reproductive_shape: tuple[int, int],
    individual_shape: tuple[int, int],
) -> dict[str, Any]:
    tcn_patterns = Counter(
        tcn_pattern(value)
        for record in reproductive_records
        for value in record["tcn_values"]
    )
    code_counts = {
        "crias": {
            "destino": _catalog_counts(
                individual_records, "destino", config.DESTINO_CODES
            ),
            "ojos": _catalog_counts(
                individual_records, "ojos", config.OJOS_CODES
            ),
            "sexo": _catalog_counts(
                individual_records, "sexo", config.SEXO_CODES
            ),
        },
        "reproductoras": {
            "ojos": _catalog_counts(
                reproductive_records, "ojos", config.OJOS_CODES
            )
        },
    }
    reproductive_by_file: dict[str, dict[str, Any]] = {}
    for record in reproductive_records:
        filename = record["source_file"]
        file_summary = reproductive_by_file.setdefault(
            filename,
            {
                "filas_hembras": 0,
                "hembras_por_partos": {
                    "0": 0,
                    "1": 0,
                    "2": 0,
                    "3": 0,
                    "4+": 0,
                },
                "observaciones_con_empadre": 0,
            },
        )
        file_summary["filas_hembras"] += 1
        partos = sum(
            _is_countable_parturition(litter, parse_tcn(litter["tcn"]))
            for litter in record["litters"]
        )
        partos_bucket = str(partos) if partos < 4 else "4+"
        file_summary["hembras_por_partos"][partos_bucket] += 1
        observations = record.get("observations")
        if (
            isinstance(observations, str)
            and "EMPADRE" in observations.upper()
        ):
            file_summary["observaciones_con_empadre"] += 1

    return {
        **extraction_stats,
        "tcn_patterns": dict(tcn_patterns),
        "code_counts": code_counts,
        "reproductoras_por_archivo": reproductive_by_file,
        "observaciones_con_empadre": sum(
            summary["observaciones_con_empadre"]
            for summary in reproductive_by_file.values()
        ),
        "shapes": {
            "features_reproductoras": list(reproductive_shape),
            "features_crias": list(individual_shape),
        },
    }
