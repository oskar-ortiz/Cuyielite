"""Esquema de la respuesta de salud del servicio."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
