"""Contratos HTTP de evaluación persistente y alertas de descarte."""

from datetime import date
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _reject_bool(value: object, field: str) -> object:
    if isinstance(value, bool):
        raise ValueError(f"{field} debe ser numérico, no booleano")
    return value


class EvaluationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    abortos: int | None = Field(default=None, ge=0)
    peso_monta_g: Decimal | None = None
    base_version: int | None = Field(default=None, ge=0)
    base_partos_version: int | None = Field(default=None, ge=0)

    @field_validator("abortos", "base_version", "base_partos_version", mode="before")
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


class AlertView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    tipo_alerta: str
    regla_id: str | None
    motivo: str | None
    estado: str
    causa_tipo: str | None
    causa_id: str | None
    causa_fecha: date | None
    fecha_limite: date | None
    reglas_version: str | None


class CategoryView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clase: str | None
    categoria_estado: str | None
    motivos: list[str] = Field(default_factory=list)
    faltantes: list[str] = Field(default_factory=list)
    reglas_version: str | None
    evaluada_at: str | None
    procedencia: dict[str, Any] = Field(default_factory=dict)
    server_version: int = 0


class EvaluationContextResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cuy_id: UUID
    aplicable: bool
    motivo_no_aplica: str | None
    base_version: int
    base_partos_version: int
    partos_acumulados: int
    fecha_ultimo_parto: date | None
    cuarto_parto_identificado: bool
    categoria: CategoryView
    alertas: list[AlertView]
    reglas_version: str


class EvaluationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cuy_id: UUID
    estado_evaluacion: Literal["DEFINITIVA", "DATOS_INSUFICIENTES"]
    clase: Literal["NORMAL", "DESCARTE"] | None
    clase_informativa: str | None
    motivos: list[str]
    campos_faltantes: list[str]
    estado_calidad: str
    categoria_persistida: bool
    categoria_historica: bool
    categoria: dict[str, Any]
    alertas: list[AlertView]
    alertas_cerradas: int = 0
    causas_no_reconocidas: list[str] = Field(default_factory=list)
    reglas_version: str
    procedencia: dict[str, Any]
    categoria_cambiada: bool
    publicado: bool = False
    derivado_actualizado: bool = False
