"""Clasify candidates and reproductive females with short, fixed reasons."""

from datetime import date, datetime, timedelta
import math
from typing import Any

from ml.rules import criterios


def _missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float):
        return math.isnan(value)
    if isinstance(value, str):
        return not value.strip()
    return False


def _number(value: Any) -> int | float | None:
    if _missing(value) or isinstance(value, bool):
        return None
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return int(number) if number.is_integer() else number


def _normalized(value: Any) -> str:
    return "" if _missing(value) else str(value).strip().upper()


def _estado_origen(row: dict[str, Any]) -> str:
    status = _normalized(row.get("estado_calidad"))
    return status or criterios.CONFIRMADO


def _date(value: Any) -> date | None:
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


def _result(
    clase: str,
    motivos: list[str],
    estado_calidad: str,
    **extra: Any,
) -> dict[str, Any]:
    return {
        "clase": clase,
        "motivos": motivos,
        "estado_calidad": estado_calidad,
        **extra,
    }


def _female(value: Any) -> bool:
    return _normalized(value) in {"HEMBRA", "2"}


def _male(value: Any) -> bool:
    return _normalized(value) in {"MACHO", "1"}


def _black_eyes(value: Any) -> bool:
    return _normalized(value) in {"NEGRO", "1"}


def _is_death_destination(row: dict[str, Any]) -> bool:
    return _normalized(row.get("destino")) == "M" or _normalized(
        row.get("destino_texto")
    ) == "MUERTE"


def clasificar_candidata(fila: dict[str, Any]) -> dict[str, Any]:
    """Return ELITE/NORMAL, an empty class for review, or NO_APLICA."""
    estado = _estado_origen(fila)
    if "CONFLICTO_DUPLICADO" in estado.split("|"):
        return _result(
            "",
            ["no clasificable: duplicado con datos en conflicto"],
            estado,
        )

    sex = fila.get("sexo_texto")
    if _missing(sex):
        sex = fila.get("sexo")
    if _male(sex):
        return _result("", ["no aplica: macho"], "NO_APLICA")
    if _is_death_destination(fila):
        return _result("", ["no aplica: destino muerte"], "NO_APLICA")

    criteria = (
        ("sexo", sex),
        ("nupar_madre", fila.get("nupar_madre")),
        ("tcnv", fila.get("tcnv")),
        ("peso_nacimiento_g", fila.get("peso_nacimiento_g")),
        ("peso_destete_g", fila.get("peso_destete_g")),
        ("ojos", fila.get("ojos_texto") or fila.get("ojos")),
    )
    missing = [name for name, value in criteria if _missing(value)]
    if missing:
        reasons = [f"dato faltante: {name}" for name in missing]
        return _result("", reasons, "REVISAR")

    nupar = _number(fila.get("nupar_madre"))
    tcnv = _number(fila.get("tcnv"))
    birth_weight = _number(fila.get("peso_nacimiento_g"))
    weaning_weight = _number(fila.get("peso_destete_g"))
    reasons = []
    if not _female(sex):
        reasons.append("sexo distinto de hembra")
    if nupar not in criterios.CRITERIOS["nupar_madre_elite"].valor:
        reasons.append("NUPAR de la madre fuera de 2 o 3")
    if tcnv not in criterios.CRITERIOS["tcnv_elite"].valor:
        reasons.append("nacidos vivos fuera de 3 o 4")
    if (
        birth_weight is None
        or birth_weight < criterios.CRITERIOS["peso_nacimiento_min_g"].valor
    ):
        reasons.append("peso al nacimiento menor de 135 g")
    elif (
        weaning_weight is None
        or weaning_weight
        < criterios.CRITERIOS["multiplicador_peso_destete"].valor
        * birth_weight
    ):
        reasons.append("peso al destete menor al doble del nacimiento")
    eyes = fila.get("ojos_texto") or fila.get("ojos")
    if not _black_eyes(eyes):
        reasons.append("ojos distintos de negros")

    clase = "NORMAL" if reasons else "ELITE"
    if not reasons:
        reasons = ["cumple todos los criterios ELITE"]
    return _result(clase, reasons, _estado_origen(fila))


def clasificar_reproductora(fila: dict[str, Any]) -> dict[str, Any]:
    """Return NORMAL/DESCARTE with review and applicability states."""
    if fila.get("hembra_muerta") is True or _normalized(
        fila.get("hembra_muerta")
    ) in {"TRUE", "1", "SI", "SÍ"}:
        return _result(
            "",
            ["no aplica: hembra muerta"],
            "NO_APLICA",
            peso_monta_en_rango_900_1000=None,
            fecha_descarte_sugerida=None,
        )

    partos = _number(fila.get("partos_acumulados"))
    abortos = _number(fila.get("abortos"))
    if partos is None or partos < 0:
        return _result(
            "",
            ["dato faltante o inválido: partos_acumulados"],
            "REVISAR",
            peso_monta_en_rango_900_1000=None,
            fecha_descarte_sugerida=None,
        )

    weight_at_mating = _number(fila.get("peso_monta_g"))
    weight_range = criterios.CRITERIOS["peso_monta_rango_g"].valor
    in_weight_range = (
        None
        if weight_at_mating is None
        else weight_range[0] <= weight_at_mating <= weight_range[1]
    )
    reasons = []
    suggested_date = None
    if partos >= criterios.CRITERIOS["partos_reproductora_descarte"].valor:
        reasons.append("ciclo completo")
        last_parturition = _date(fila.get("fecha_ultimo_parto"))
        if last_parturition is not None:
            suggested_date = (
                last_parturition
                + timedelta(
                    days=criterios.CRITERIOS[
                        "dias_hasta_salida_despues_parto"
                    ].valor
                )
            ).isoformat()
        return _result(
            "DESCARTE",
            reasons,
            _estado_origen(fila),
            peso_monta_en_rango_900_1000=in_weight_range,
            fecha_descarte_sugerida=suggested_date,
        )

    if abortos is None or abortos < 0:
        return _result(
            "",
            ["dato faltante o inválido: abortos"],
            "REVISAR",
            peso_monta_en_rango_900_1000=in_weight_range,
            fecha_descarte_sugerida=None,
        )

    if abortos >= criterios.CRITERIOS["abortos_repetidos_descarte"].valor:
        return _result(
            "DESCARTE",
            ["problema repetido (se dejó un parto más)"],
            f"{_estado_origen(fila)}|PROPUESTA",
            peso_monta_en_rango_900_1000=in_weight_range,
            fecha_descarte_sugerida=None,
        )
    if abortos == criterios.CRITERIOS["abortos_uno_observacion"].valor:
        reasons.append("observación: 1 aborto")
    else:
        reasons.append("sin criterio de descarte")
    return _result(
        "NORMAL",
        reasons,
        _estado_origen(fila),
        peso_monta_en_rango_900_1000=in_weight_range,
        fecha_descarte_sugerida=None,
    )
