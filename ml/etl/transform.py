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


def tcn_pattern(value: Any) -> str:
    if _is_missing(value):
        return "VACIO"
    text = str(value).strip().upper()
    if text in config.TCN_UNCONFIRMED_MARKERS:
        return text
    if re.fullmatch(r"\d+(?:\+\d+)*[A-Z]*", text):
        return re.sub(r"\d+", "N", text)
    return "FORMATO_NO_RECONOCIDO"


def parse_tcn(value: Any) -> ParsedTCN:
    pattern = tcn_pattern(value)
    if pattern == "VACIO":
        return ParsedTCN(None, None, None, "VACIO", pattern)
    if config.TCN_INTEGER_IS_TOTAL and re.fullmatch(r"\d+", str(value).strip()):
        return ParsedTCN(float(value), None, None, "PARSEADO_TOTAL", pattern)
    return ParsedTCN(None, None, None, "AMBIGUO", pattern)


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
    has_missing: bool,
    has_unknown_code: bool,
    has_ambiguous_tcn: bool = False,
    has_uninterpreted_tcn: bool = False,
) -> str:
    statuses = []
    if has_ambiguous_tcn:
        statuses.append("AMBIGUO")
    if has_uninterpreted_tcn:
        statuses.append("NO_INTERPRETADO")
    if has_missing:
        statuses.append("REVISAR")
    if has_unknown_code:
        statuses.append(config.UNKNOWN_CODE)
    return "|".join(statuses) if statuses else "OK"


def transform_reproductoras(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    features = []
    for record in records:
        eyes_raw = _clean_raw(record.get("ojos"))
        eyes_text = decode_code(eyes_raw, config.OJOS_CODES)
        dated_litters = [
            litter
            for litter in record["litters"]
            if _valid_parturition_date(litter["date"])
        ]
        parsed = [parse_tcn(litter["tcn"]) for litter in dated_litters]
        totals = [
            value.total
            for value in parsed
            if value.status == "PARSEADO_TOTAL" and value.total is not None
        ]
        lives = [
            value.vivos
            for value in parsed
            if value.status == "PARSEADO_TOTAL" and value.vivos is not None
        ]
        mortality_pairs = [
            (value.muertos, value.total)
            for value in parsed
            if value.muertos is not None and value.total is not None and value.total > 0
        ]
        mortality = (
            sum(dead for dead, _ in mortality_pairs)
            / sum(total for _, total in mortality_pairs)
            if mortality_pairs
            else None
        )
        has_unknown = eyes_text == config.UNKNOWN_CODE
        has_ambiguous_tcn = any(value.status == "AMBIGUO" for value in parsed)
        has_uninterpreted_tcn = any(
            value.status == "PARSEADO_TOTAL"
            and (value.vivos is None or value.muertos is None)
            for value in parsed
        )
        features.append(
            {
                "partos_acumulados": len(dated_litters),
                "tcn_vivos_promedio": _average(lives),
                "tcn_total_promedio": _average(totals),
                "peso_monta_g": _numeric(record.get("peso_monta_g")),
                "tasa_mortalidad_camada": mortality,
                "ojos": eyes_raw,
                "ojos_texto": eyes_text,
                "estado_calidad": _quality_status(
                    has_missing=(
                        eyes_raw is None
                        or _numeric(record.get("peso_monta_g")) is None
                        or any(_is_missing(litter["tcn"]) for litter in dated_litters)
                    ),
                    has_unknown_code=has_unknown,
                    has_ambiguous_tcn=has_ambiguous_tcn,
                    has_uninterpreted_tcn=has_uninterpreted_tcn,
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
            )
        )
        has_unknown = config.UNKNOWN_CODE in (ojos_texto, sexo_texto, destino_texto)
        features.append(
            {
                "nupar_madre": nupar_madre,
                "tcnv": tcnv,
                "tcnm": tcnm,
                "tcnt": tcnt,
                "tasa_mortalidad_camada": mortality_rate(tcnm, tcnt),
                **weights,
                "ojos": ojos_raw,
                "ojos_texto": ojos_texto,
                "sexo": sexo_raw,
                "sexo_texto": sexo_texto,
                "destino": destino_raw,
                "destino_texto": destino_texto,
                "identidad": (
                    "SIN_PLACA" if _code_key(destino_raw) == "SP" else None
                ),
                "estado_calidad": _quality_status(
                    has_missing=has_missing,
                    has_unknown_code=has_unknown,
                ),
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
            "destino": dict(
                Counter(_code_count(row.get("destino"), config.DESTINO_CODES) for row in individual_records)
            ),
            "ojos": dict(
                Counter(_code_count(row.get("ojos"), config.OJOS_CODES) for row in individual_records)
            ),
            "sexo": dict(
                Counter(_code_count(row.get("sexo"), config.SEXO_CODES) for row in individual_records)
            ),
        },
        "reproductoras": {
            "ojos": dict(
                Counter(_code_count(row.get("ojos"), config.OJOS_CODES) for row in reproductive_records)
            )
        },
    }
    return {
        **extraction_stats,
        "tcn_patterns": dict(tcn_patterns),
        "code_counts": code_counts,
        "shapes": {
            "features_reproductoras": list(reproductive_shape),
            "features_crias": list(individual_shape),
        },
    }
