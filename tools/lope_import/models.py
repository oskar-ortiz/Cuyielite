"""Modelos tipados para candidatos de importación."""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from . import AUDIT_CONTRACT, MAPPING_VERSION, __version__


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
    kind: str = "animal"
    file_id: str | None = None
    origin_ref: str | None = None
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
    contract: str = AUDIT_CONTRACT
    parser_version: str = __version__
    mapeo_version: str = MAPPING_VERSION
    files: list[dict[str, str]] = field(default_factory=list)
    candidates: list[Any] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    summary: dict = field(default_factory=dict)