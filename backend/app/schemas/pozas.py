"""Esquemas de pozas para la API."""

from uuid import UUID

from pydantic import BaseModel, Field


class PozaResponse(BaseModel):
    id: UUID
    galpon_id: UUID
    codigo: str
    tipo: str
    capacidad_maxima: int


class PozasListResponse(BaseModel):
    items: list[PozaResponse]
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)