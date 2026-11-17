"""Adaptadores de plataforma para ML y RAG (D5a).

No duplican reglas ni umbrales: validan entrada/salida y delegan en las
funciones entregadas. Los imports pesados son perezosos.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
import math
import os
from typing import Any, Callable

from backend.app.schemas.ml import ApoyoModeloResponse, CandidataResponse, HembraResponse


class MlError(Exception):
    def __init__(self, codigo: str, mensaje: str):
        self.codigo = codigo
        self.mensaje = mensaje
        super().__init__(f"{codigo}: {mensaje}")


class MlNoDisponible(MlError):
    def __init__(self, mensaje: str = "El servicio de inferencia no está disponible"):
        super().__init__("ML_NO_DISPONIBLE", mensaje)


class MlFalloInterno(MlError):
    def __init__(self, mensaje: str = "El modelo devolvió una salida inválida o falló"):
        super().__init__("ML_FALLO_INTERNO", mensaje)


class MlNoAplica(MlError):
    def __init__(self, mensaje: str):
        super().__init__("NO_APLICA", mensaje)


class MlDatosInsuficientes(MlError):
    def __init__(self, mensaje: str):
        super().__init__("DATOS_INSUFICIENTES", mensaje)


class RagNoDisponible(MlError):
    def __init__(self, mensaje: str = "El asistente no está disponible"):
        super().__init__("RAG_NO_DISPONIBLE", mensaje)


def survival_from_estado(estado: str | None) -> str:
    """Deriva supervivencia del estado central; desconocida no es viva."""
    if not estado:
        return "desconocida"
    normalized = estado.strip().upper()
    if normalized == "ACTIVO":
        return "viva"
    if normalized in {"MUERTO", "MUERTA", "FALLECIDO", "FALLECIDA"}:
        return "muerta"
    return "desconocida"


def ensure_applicable(animal: dict[str, Any], *, hembra_muerta: bool | None = None) -> None:
    sexo = animal.get("sexo")
    if sexo is None:
        raise MlDatosInsuficientes("El sexo del animal es desconocido; no se puede inferir")
    if str(sexo).upper() != "H":
        raise MlNoAplica("La predicción solo aplica a hembras")
    survival = survival_from_estado(animal.get("estado"))
    if survival == "desconocida":
        raise MlDatosInsuficientes("La supervivencia del animal es desconocida; no se puede inferir")
    if survival == "muerta":
        raise MlNoAplica("La predicción requiere una hembra viva")
    if hembra_muerta is True:
        raise MlNoAplica("El cuerpo declara una hembra muerta y contradice el registro central")


def _finite_number(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise MlFalloInterno(f"{field} no es numérico en la salida del modelo")
    number = float(value)
    if not math.isfinite(number):
        raise MlFalloInterno(f"{field} no es finito en la salida del modelo")
    return number


def validate_hembra_output(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise MlFalloInterno("La salida de hembra no es un objeto")
    clase = data.get("clase")
    motivos = data.get("motivos")
    estado = data.get("estado_calidad")
    fecha = data.get("fecha_descarte_sugerida")
    rango = data.get("peso_monta_en_rango_900_1000")
    if clase not in {"NORMAL", "DESCARTE"}:
        raise MlFalloInterno("clase de hembra inválida")
    if not isinstance(motivos, list) or not all(isinstance(item, str) for item in motivos):
        raise MlFalloInterno("motivos de hembra inválidos")
    if not isinstance(estado, str) or not estado.strip():
        raise MlFalloInterno("estado_calidad de hembra inválido")
    if fecha is not None and not isinstance(fecha, str):
        raise MlFalloInterno("fecha_descarte_sugerida inválida")
    if rango is not None and not isinstance(rango, bool):
        raise MlFalloInterno("peso_monta_en_rango inválido")
    return {
        "clase": clase,
        "motivos": motivos,
        "estado_calidad": estado,
        "fecha_descarte_sugerida": fecha,
        "peso_monta_en_rango_900_1000": rango,
    }


def validate_candidata_output(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise MlFalloInterno("La salida de candidata no es un objeto")
    clase = data.get("clase")
    motivos = data.get("motivos")
    estado = data.get("estado_calidad")
    apoyo = data.get("apoyo_modelo")
    if clase not in {"ELITE", "NORMAL"}:
        raise MlFalloInterno("clase de candidata inválida")
    if not isinstance(motivos, list) or not all(isinstance(item, str) for item in motivos):
        raise MlFalloInterno("motivos de candidata inválidos")
    if not isinstance(estado, str) or not estado.strip():
        raise MlFalloInterno("estado_calidad de candidata inválido")
    validated_apoyo = None
    if apoyo is not None:
        if not isinstance(apoyo, dict) or apoyo.get("clase") not in {"ELITE", "NORMAL"}:
            raise MlFalloInterno("apoyo_modelo inválido")
        probabilities = apoyo.get("probabilidades")
        if not isinstance(probabilities, dict) or not probabilities:
            raise MlFalloInterno("probabilidades del modelo inválidas")
        total = 0.0
        for key, value in probabilities.items():
            if not isinstance(key, str):
                raise MlFalloInterno("clave de probabilidad inválida")
            number = _finite_number(value, f"probabilidad {key}")
            if number < 0 or number > 1:
                raise MlFalloInterno("probabilidad fuera de rango")
            total += number
        if abs(total - 1.0) > 1e-6:
            raise MlFalloInterno("las probabilidades no suman 1")
        validated_apoyo = {"clase": apoyo["clase"], "probabilidades": probabilities}
    return {"clase": clase, "motivos": motivos, "estado_calidad": estado, "apoyo_modelo": validated_apoyo}


_UNSET = object()


def load_candidate_model(path: str | None = None) -> Any | None:
    """Carga opcional del artefacto RF. Sin ruta configurada no hay apoyo."""
    configured = path if path is not None else os.environ.get("CUYIELITE_RF_MODEL_PATH")
    if not configured:
        return None
    if not os.path.exists(configured):
        raise MlFalloInterno("El artefacto del modelo está configurado pero no existe")
    try:
        import joblib  # type: ignore[import-not-found]
    except ImportError as error:
        raise MlFalloInterno("joblib no está disponible para cargar el modelo") from error
    try:
        return joblib.load(configured)
    except Exception as error:  # artefacto defectuoso ≠ ausencia
        raise MlFalloInterno("No se pudo cargar el artefacto del modelo") from error


def _real_hembra(datos: dict[str, Any]) -> Any:
    try:
        from ml.prediccion import predecir_hembra
    except ImportError as error:
        raise MlNoDisponible("El módulo de predicción no está instalado") from error
    return predecir_hembra(datos)


def _real_candidata(datos: dict[str, Any], model: Any) -> Any:
    try:
        from ml.prediccion import predecir_candidata
    except ImportError as error:
        raise MlNoDisponible("El módulo de predicción no está instalado") from error
    return predecir_candidata(datos, modelo=model)


def predecir_hembra_para(
    animal: dict[str, Any],
    datos: dict[str, Any],
    *,
    predictor: Callable[[dict[str, Any]], Any] | None = None,
) -> dict[str, Any]:
    ensure_applicable(animal, hembra_muerta=datos.get("hembra_muerta"))
    payload = {key: value for key, value in datos.items() if key != "hembra_muerta"}
    payload["hembra_muerta"] = False
    try:
        raw = (predictor or _real_hembra)(payload)
    except MlError:
        raise
    except ValueError as error:
        raise MlFalloInterno(f"Fallo interno de reglas: {error}") from error
    except Exception as error:
        raise MlFalloInterno("Fallo interno del modelo de hembra") from error
    return validate_hembra_output(raw)


def predecir_candidata_para(
    animal: dict[str, Any],
    datos: dict[str, Any],
    *,
    model: Any = _UNSET,
    predictor: Callable[[dict[str, Any], Any], Any] | None = None,
) -> dict[str, Any]:
    ensure_applicable(animal)
    selected = load_candidate_model() if model is _UNSET else model
    try:
        raw = (predictor or _real_candidata)(datos, selected)
    except MlError:
        raise
    except ValueError as error:
        raise MlFalloInterno(f"Fallo interno de reglas: {error}") from error
    except Exception as error:
        raise MlFalloInterno("Fallo interno del modelo de candidata") from error
    return validate_candidata_output(raw)


def _real_consultar(pregunta: str, top_k: int) -> Any:
    try:
        from rag.src.retrieve import consultar
    except ImportError as error:
        raise RagNoDisponible("El pipeline RAG no está disponible") from error
    return consultar(pregunta, top_k)


def consultar_asistente(
    pregunta: str,
    top_k: int,
    *,
    consultar_fn: Callable[[str, int], Any] | None = None,
) -> dict[str, Any]:
    try:
        raw = (consultar_fn or _real_consultar)(pregunta, top_k)
    except MlError:
        raise
    except ValueError as error:
        raise MlFalloInterno(f"Fallo interno del asistente: {error}") from error
    except Exception as error:
        raise RagNoDisponible("No se pudo consultar el asistente") from error
    if not isinstance(raw, dict):
        raise MlFalloInterno("La salida del asistente no es un objeto")
    respuesta = raw.get("respuesta")
    fuentes = raw.get("fuentes")
    if not isinstance(respuesta, str) or not respuesta.strip():
        raise MlFalloInterno("respuesta del asistente inválida")
    if not isinstance(fuentes, list) or not all(isinstance(item, str) for item in fuentes):
        raise MlFalloInterno("fuentes del asistente inválidas")
    return {"respuesta": respuesta, "fuentes": fuentes}


def fecha_iso(value: str | None) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise MlFalloInterno("fecha_descarte_sugerida inválida") from error


def to_hembra_response(cuy_id: Any, data: dict[str, Any]) -> HembraResponse:
    return HembraResponse(
        cuy_id=cuy_id,
        clase=data["clase"],
        motivos=data["motivos"],
        estado_calidad=data["estado_calidad"],
        fecha_descarte_sugerida=fecha_iso(data["fecha_descarte_sugerida"]),
        peso_monta_en_rango_900_1000=data["peso_monta_en_rango_900_1000"],
    )


def to_candidata_response(cuy_id: Any, data: dict[str, Any]) -> CandidataResponse:
    apoyo = data["apoyo_modelo"]
    return CandidataResponse(
        cuy_id=cuy_id,
        clase=data["clase"],
        motivos=data["motivos"],
        estado_calidad=data["estado_calidad"],
        apoyo_modelo=ApoyoModeloResponse(**apoyo) if apoyo else None,
    )
