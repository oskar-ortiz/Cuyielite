"""Source layouts, confirmed catalogs, and provisional interpretation rules."""

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = REPOSITORY_ROOT / "db" / "raw_Lope"
DATA_DIR = REPOSITORY_ROOT / "ml" / "data"

INDIVIDUAL_FILE_GLOB = "REG IND*.xlsx"
REPRODUCTIVE_FILE_GLOB = "REGISTRO REPRODUCTIVO*.xlsx"
HEADER_SCAN_ROWS = 30
INDIVIDUAL_MAX_COLUMNS = 22
REPRODUCTIVE_MAX_COLUMNS = 22

ANIMAL_CODE_PATTERN = r"^[A-Za-z]+\d+$"
FILLER_CODE_PREFIXES = ("SERVICIO", "CENTRO", "ESLABON", "POZA", "MACHO")
EMPTY_DATE_MARKERS = frozenset({"X"})

INDIVIDUAL_HEADER_ALIASES = {
    "animal_code": ("ANIMALNO",),
    "nupar_madre": ("NUPAR",),
    "tcnv": ("TCNV",),
    "tcnm": ("TCNM",),
    "tcnt": ("TCNT",),
    "fecha_nacimiento": ("FECHANACIMIENTO",),
    "fecha_destete": ("FECHADESTETE",),
    "peso_nacimiento_g": ("PESONACIMIENTO",),
    "peso_destete_g": ("PESODESTETE",),
    "peso_4_semanas_g": ("PESO4SEMANAS",),
    "ojos": ("OJOS",),
    "sexo": ("SEXO",),
    "destino": ("DESTINO",),
}

# Reproductive sheet column indexes are zero-based and live in config so the
# extractor does not depend on workbook sheet names.
REPRODUCTIVE_COLUMNS = {
    "female_code": 0,
    "peso_monta_g": 1,
    "ojos": 3,
    "partos": ((4, 5), (6, 7), (8, 9), (10, 11)),
}
REPRODUCTIVE_HEADER_ALIASES = {
    "female_code": "HEMBRA",
    "peso_monta_g": "PESO",
    "ojos": "OJOS",
}
REPRODUCTIVE_OPTIONAL_HEADER_ALIASES = {
    "observations": ("OBSERVACIONES", "OBSERVACION"),
}

DESTINO_CODES = {
    "M": "Muerte",
    "D": "Descarte",
    "V": "Vendido",
    "R": "Reemplazo",
    "SP": "Sin placa",
    "L": "Levante",
    "E": "Engorde",
}
OJOS_CODES = {"1": "Negro", "2": "Rojo"}
SEXO_CODES = {"1": "Macho", "2": "Hembra"}
UNKNOWN_CODE = "CODIGO_DESCONOCIDO"

CONFIRMADO = "CONFIRMADO"
INFERIDO_POR_DATOS = "INFERIDO_POR_DATOS"
SIN_CONFIRMAR = "SIN_CONFIRMAR"

TCN_INTEGER_STATUS = INFERIDO_POR_DATOS
TCN_CONFIRMED_PATTERNS = frozenset({"N+NM", "NM", "AB", "M", "X"})
TCN_IGNORED_PATTERNS = frozenset({"X"})
TCN_ABORT_PATTERN = "AB"
TCN_DEAD_OBSERVATION_MARKER = "M"
NUPAR_STATUS = INFERIDO_POR_DATOS
