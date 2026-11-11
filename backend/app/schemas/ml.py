"""Contratos HTTP para predicción ML y asistente RAG (D5)."""

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _reject_bool(value: object, field: str) -> object:
    if isinstance(value, bool):
        raise ValueError(f"{field} debe ser numérico, no booleano")
    return value


class HembraRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cuy_id: UUID
    partos_acumulados: int | None = Field(default=None, ge=0)
    abortos: int | None = Field(default=None, ge=0)
    fecha_ultimo_parto: date | None = None
    peso_monta_g: Decimal | None = None
    hembra_muerta: bool | None = None

    @field_validator("partos_acumulados", "abortos", mode="before")
    @classmethod
    def _integers(cls, value: object, info):
        return _reject_bool(value, info.field_name)

    @field_validator("peso_monta_g", mode="before")
    @classmethod
    def _weight(cls, value: object):
        value = _reject_bool(value, "peso_monta_g")
        if value is not None and Decimal(str(value)) <= 0:
            raise ValueError("peso_monta_g debe ser positivo")
        return value


class CandidataRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cuy_id: UUID
    nupar_madre: int | None = Field(default=None, ge=0)
    tcnv: int | None = Field(default=None, ge=0)
    peso_nacimiento_g: Decimal | None = None
    peso_destete_g: Decimal | None = None
    dias_destete: int | None = Field(default=None, ge=0)
    peso_monta_g: Decimal | None = None
    ojos: str | None = None

    @field_validator("nupar_madre", "tcnv", "dias_destete", mode="before")
    @classmethod
    def _integers(cls, value: object, info):
        return _reject_bool(value, info.field_name)

    @field_validator("peso_nacimiento_g", "peso_destete_g", "peso_monta_g", mode="before")
    @classmethod
    def _weights(cls, value: object, info):
        value = _reject_bool(value, info.field_name)
        if value is not None and Decimal(str(value)) <= 0:
            raise ValueError(f"{info.field_name} debe ser positivo")
        return value

    @field_validator("ojos")
    @classmethod
    def _eyes(cls, value: str | None):
        if value is None:
            return None
        if value not in {"1", "Negro", "2", "Rojo"}:
            raise ValueError("ojos debe ser 1/Negro o 2/Rojo")
        return value


class ApoyoModeloResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clase: Literal["ELITE", "NORMAL"]
    probabilidades: dict[str, float]


class HembraResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cuy_id: UUID
    clase: Literal["NORMAL", "DESCARTE"]
    motivos: list[str]
    estado_calidad: str
    fecha_descarte_sugerida: date | None
    peso_monta_en_rango_900_1000: bool | None


class CandidataResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cuy_id: UUID
    clase: Literal["ELITE", "NORMAL"]
    motivos: list[str]
    estado_calidad: str
    apoyo_modelo: ApoyoModeloResponse | None


class AssistantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pregunta: str = Field(min_length=3, max_length=500)
    top_k: int = Field(default=5, ge=1, le=20)

    @field_validator("pregunta")
    @classmethod
    def _trim(cls, value: str):
        trimmed = value.strip()
        if len(trimmed) < 3:
            raise ValueError("pregunta debe tener entre 3 y 500 caracteres")
        return trimmed


class AssistantResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    respuesta: str
    fuentes: list[str]

    @model_validator(mode="after")
    def _non_empty(self):
        if not self.respuesta.strip():
            raise ValueError("respuesta no puede estar vacía")
        return self
