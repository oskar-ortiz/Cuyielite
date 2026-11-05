"""Modelos tipados para candidatos de importación."""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any


@dataclass
class CellRef:
    sheet: str
    cell: str


@dataclass
class CandidateAnimal:
    animal_no: str
    sexo: str | None
    fecha_nacimiento: str | None
    color: str | None
    ojos: str | None
    ref: CellRef
    source: str  # "formula" | "cached" | "literal"
    field_origins: dict = field(default_factory=dict)
    extra_fields: dict = field(default_factory=dict)


@dataclass
class CandidateLitter:
    poza_no: str
    macho_no: str | None
    madre_no: str | None
    fecha_parto: str | None
    nacidos_vivos: int | None
    nacidos_muertos: int | None
    tamano_camada: int | None
    ref: CellRef
    source: str


@dataclass
class AuditReport:
    files: list[str] = field(default_factory=list)
    candidates: list[Any] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    summary: dict = field(default_factory=dict)