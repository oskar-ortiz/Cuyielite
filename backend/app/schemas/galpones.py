"""Esquemas de galpones para la API."""

from uuid import UUID

from pydantic import BaseModel, Field


class GalponResponse(BaseModel):
    id: UUID
    nombre: str
    ubicacion: str | None


class GalponesListResponse(BaseModel):
    items: list[GalponResponse]
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)