"""Contratos HTTP de evaluación persistente, evidencia revisable y alertas."""

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
    """Solo versiones leídas. Los valores del cuerpo son declaraciones."""

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


class CandidateEvaluationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_version: int | None = Field(default=None, ge=0)


class EvidenceRequest(BaseModel):
    """Declaración de un dato. No se acepta aquí ninguna prueba de revisión."""

    model_config = ConfigDict(extra="forbid")

    campo: str = Field(min_length=1, max_length=40)
    valor: Any
    origen: Literal["DECLARADA", "IMPORTACION"] = "DECLARADA"
    archivo_huella: str | None = Field(default=None, max_length=128)
    hoja: str | None = Field(default=None, max_length=80)
    fila: int | None = Field(default=None, ge=1)
    celda: str | None = Field(default=None, max_length=20)
    parser_version: str | None = Field(default=None, max_length=40)
    mapeo_version: str | None = Field(default=None, max_length=40)


class EvidenceReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    campo: str = Field(min_length=1, max_length=40)
    decision: Literal["REVISADA", "RECHAZADA"]
    nota: str | None = Field(default=None, max_length=400)


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


class FundamentoView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    regla_id: str
    caracter: Literal["CONFIRMADO", "PROPUESTO"]
    causa_tipo: str
    causa_id: str | None
    causa_fecha: date | None
    fecha_limite: date | None
    motivo: str


class EvidenceView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    campo: str
    valor: str | None
    origen: str
    estado: str
    archivo_huella: str | None = None
    hoja: str | None = None
    fila: int | None = None
    celda: str | None = None
    parser_version: str | None = None
    mapeo_version: str | None = None
    revisada_at: str | None = None
    nota: str | None = None
    server_version: int = 1


class CategoryView(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clase: str | None
    caracter: str | None = None
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
    evidencias: list[EvidenceView] = Field(default_factory=list)
    evidencia_revisada: list[str] = Field(default_factory=list)
    reglas_version: str


class EvaluationResponse(BaseModel):
    """Wire: calidad, carácter y clase van separados.

    `estado_calidad` conserva el formato de Diery en mayúsculas separadas por
    `|` (CONFIRMADO, REVISAR, PROPUESTA). `caracter` distingue un resultado
    oficial de uno provisional sin volver a interpretar esa cadena.
    """

    model_config = ConfigDict(extra="forbid")

    cuy_id: UUID
    estado_evaluacion: Literal[
        "DEFINITIVA", "PROVISIONAL", "DATOS_INSUFICIENTES", "EVIDENCIA_NO_VALIDADA"
    ]
    caracter: Literal["CONFIRMADO", "PROPUESTO"] | None
    clase: Literal["ELITE", "NORMAL", "DESCARTE"] | None
    clase_informativa: str | None
    estado_calidad: str
    motivos: list[str]
    campos_faltantes: list[str]
    evidencia_pendiente: list[str] = Field(default_factory=list)
    fundamentos: list[FundamentoView] = Field(default_factory=list)
    categoria_persistida: bool
    categoria_historica: bool
    categoria: dict[str, Any]
    alertas: list[AlertView]
    alertas_cerradas: int = 0
    reglas_version: str
    procedencia: dict[str, Any]
    categoria_cambiada: bool
    publicado: bool = False
    derivado_actualizado: bool = False
