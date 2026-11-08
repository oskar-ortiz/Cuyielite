"""Classification thresholds and their evidence status."""

from dataclasses import dataclass
from typing import Any


SOURCE = "ADR 0004, instructor 2026-11-07"
CONFIRMADO = "CONFIRMADO"
PROPUESTA = "PROPUESTA"


@dataclass(frozen=True)
class Criterio:
    valor: Any
    fuente: str = SOURCE
    estado: str = CONFIRMADO


CRITERIOS = {
    "sexo_candidata": Criterio("Hembra"),
    "nupar_madre_elite": Criterio(frozenset({2, 3})),
    "tcnv_elite": Criterio(frozenset({3, 4})),
    "peso_nacimiento_min_g": Criterio(135),
    "multiplicador_peso_destete": Criterio(2),
    "ojos_elite": Criterio("Negro"),
    "partos_reproductora_descarte": Criterio(4),
    "dias_hasta_salida_despues_parto": Criterio(20),
    "abortos_repetidos_descarte": Criterio(2, estado=PROPUESTA),
    "abortos_uno_observacion": Criterio(1),
    "peso_monta_rango_g": Criterio((900, 1000)),
    "peso_monta_ideal_g": Criterio(950),
}
