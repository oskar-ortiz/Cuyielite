"""Rule-first prediction functions for the two ML endpoint contracts."""

from collections.abc import Sequence
from datetime import date
import math
from typing import Literal, Protocol, TypedDict

import numpy as np
import pandas as pd
from numpy.typing import NDArray

from ml.rules.clasificar import clasificar_candidata, clasificar_reproductora


class DatosHembra(TypedDict, total=False):
    """JSON-compatible inputs for a living reproductive female."""

    partos_acumulados: int | float | None
    abortos: int | float | None
    peso_monta_g: int | float | None
    fecha_ultimo_parto: date | str | None
    hembra_muerta: bool
    estado_calidad: str


class DatosCandidata(TypedDict, total=False):
    """Inputs for a female candidate, including fields learned after birth."""

    nupar_madre: int | float | None
    tcnv: int | float | None
    peso_nacimiento_g: int | float | None
    peso_destete_g: int | float | None
    dias_destete: int | float | None
    peso_monta_g: int | float | None
    ojos: int | str | None
    estado_calidad: str


class ApoyoModelo(TypedDict):
    """Uncalibrated model estimate, separate from the rule-based class."""

    clase: Literal["ELITE", "NORMAL"]
    probabilidades: dict[str, float]


class PrediccionHembra(TypedDict):
    clase: Literal["NORMAL", "DESCARTE"]
    motivos: list[str]
    estado_calidad: str
    fecha_descarte_sugerida: str | None
    peso_monta_en_rango_900_1000: bool | None


class PrediccionCandidata(TypedDict):
    clase: Literal["ELITE", "NORMAL"]
    motivos: list[str]
    estado_calidad: str
    apoyo_modelo: ApoyoModelo | None


class ModeloCandidata(Protocol):
    """Minimal interface required from a fitted candidate model."""

    classes_: Sequence[str]

    def predict_proba(
        self,
        X: pd.DataFrame,
        /,
    ) -> NDArray[np.float64]: ...


def _missing(value: object) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _number(
    value: int | float | None,
    name: str,
    *,
    integer: bool = False,
    positive: bool = False,
) -> int | float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError(f"{name} debe ser un número, no un booleano.")
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{name} debe ser un número finito.") from error
    if not math.isfinite(number):
        raise ValueError(f"{name} debe ser un número finito.")
    if number < 0 or (positive and number == 0):
        raise ValueError(f"{name} debe ser positivo.")
    if integer and not number.is_integer():
        raise ValueError(f"{name} debe ser un entero no negativo.")
    return int(number) if number.is_integer() else number


def _append_review(status: str) -> str:
    values = list(dict.fromkeys(part for part in status.split("|") if part))
    if "REVISAR" not in values:
        values.append("REVISAR")
    return "|".join(values)


def _model_support(
    data: dict[str, int | float | str | None],
    model: ModeloCandidata | None,
) -> ApoyoModelo | None:
    if model is None:
        return None
    feature_names = ("nupar_madre", "tcnv", "peso_nacimiento_g", "ojos")
    if any(data.get(name) is None for name in feature_names):
        return None

    classes = [str(label) for label in model.classes_]
    if set(classes) != {"ELITE", "NORMAL"}:
        raise ValueError("El modelo de candidatas debe exponer ELITE y NORMAL.")
    features = pd.DataFrame(
        [
            {
                name: data[name]
                for name in feature_names
            }
        ],
        columns=feature_names,
    )
    probabilities = np.asarray(model.predict_proba(features), dtype=float)
    if (
        probabilities.shape != (1, len(classes))
        or not np.isfinite(probabilities).all()
        or (probabilities < 0).any()
        or (probabilities > 1).any()
        or not np.isclose(probabilities.sum(), 1.0)
    ):
        raise ValueError("El modelo devolvió probabilidades inválidas.")

    class_index = int(np.argmax(probabilities[0]))
    predicted_class = classes[class_index]
    if predicted_class == "ELITE":
        model_class: Literal["ELITE", "NORMAL"] = "ELITE"
    else:
        model_class = "NORMAL"
    return {
        "clase": model_class,
        "probabilidades": {
            label: float(probabilities[0, index])
            for index, label in enumerate(classes)
        },
    }


def predecir_hembra(datos: DatosHembra) -> PrediccionHembra:
    """Classify a reproductive female as NORMAL or DESCARTE using ADR 0004."""
    if datos.get("hembra_muerta", False):
        raise ValueError("predecir_hembra requiere una reproductora viva.")

    row = dict(datos)
    for field in ("partos_acumulados", "abortos"):
        row[field] = _number(
            datos.get(field),
            field,
            integer=True,
        )
    row["peso_monta_g"] = _number(
        datos.get("peso_monta_g"),
        "peso_monta_g",
        positive=True,
    )
    decision = clasificar_reproductora(row)
    if decision["estado_calidad"] == "NO_APLICA":
        raise ValueError("predecir_hembra solo aplica a reproductoras vivas.")

    clase = decision["clase"] or "NORMAL"
    motivos = list(decision["motivos"])
    estado = decision["estado_calidad"]
    if not decision["clase"]:
        motivos.append("clase por defecto NORMAL; datos insuficientes")
        estado = _append_review(estado)
    return {
        "clase": clase,
        "motivos": motivos,
        "estado_calidad": estado,
        "fecha_descarte_sugerida": decision["fecha_descarte_sugerida"],
        "peso_monta_en_rango_900_1000": decision[
            "peso_monta_en_rango_900_1000"
        ],
    }


def predecir_candidata(
    datos: DatosCandidata,
    *,
    modelo: ModeloCandidata | None = None,
) -> PrediccionCandidata:
    """Classify a female candidate by rules and optionally attach RF support."""
    row = dict(datos)
    numeric_fields = (
        "nupar_madre",
        "tcnv",
        "peso_nacimiento_g",
        "peso_destete_g",
        "dias_destete",
        "peso_monta_g",
    )
    for field in numeric_fields:
        row[field] = _number(
            datos.get(field),
            field,
            integer=field in {"nupar_madre", "tcnv", "dias_destete"},
            positive=field in {
                "peso_nacimiento_g",
                "peso_destete_g",
                "peso_monta_g",
            },
        )

    eye = datos.get("ojos")
    if _missing(eye):
        eyes_code = None
        eyes_text = None
    elif isinstance(eye, bool):
        raise ValueError("ojos debe ser 1/Negro o 2/Rojo.")
    elif str(eye).strip().casefold() in {"1", "negro"}:
        eyes_code, eyes_text = "1", "Negro"
    elif str(eye).strip().casefold() in {"2", "rojo"}:
        eyes_code, eyes_text = "2", "Rojo"
    else:
        raise ValueError("ojos debe ser 1/Negro o 2/Rojo.")

    row.update(
        {
            "sexo": "2",
            "sexo_texto": "Hembra",
            "ojos": eyes_code,
            "ojos_texto": eyes_text,
        }
    )
    decision = clasificar_candidata(row)
    if decision["estado_calidad"] == "NO_APLICA":
        raise ValueError("predecir_candidata solo aplica a crías hembras.")

    motivos = list(decision["motivos"])
    estado = decision["estado_calidad"]
    clase = decision["clase"] or "NORMAL"
    missing_adr_fields = False
    days_to_weaning = row["dias_destete"]
    if days_to_weaning is None:
        motivos.append("dato faltante: dias_destete")
        missing_adr_fields = True
    elif days_to_weaning != 15:
        motivos.append("destete distinto de 15 días")
        clase = "NORMAL"

    mating_weight = row["peso_monta_g"]
    if mating_weight is None:
        motivos.append("dato faltante: peso_monta_g")
        missing_adr_fields = True
    elif not 900 <= mating_weight <= 1000:
        motivos.append("peso de empadre fuera de 900 a 1000 g")
        clase = "NORMAL"
    if missing_adr_fields:
        clase = "NORMAL"
        estado = _append_review(estado)
    if not decision["clase"]:
        motivos.append("clase por defecto NORMAL; datos insuficientes")
        estado = _append_review(estado)

    model_data: dict[str, int | float | str | None] = {
        "nupar_madre": row["nupar_madre"],
        "tcnv": row["tcnv"],
        "peso_nacimiento_g": row["peso_nacimiento_g"],
        "ojos": eyes_code,
    }
    return {
        "clase": clase,
        "motivos": motivos,
        "estado_calidad": estado,
        "apoyo_modelo": _model_support(model_data, modelo),
    }
