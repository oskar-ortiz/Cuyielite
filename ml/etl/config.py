"""Source layouts, confirmed catalogs, and provisional interpretation rules."""

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = REPOSITORY_ROOT / "db" / "raw_Lope"
DATA_DIR = REPOSITORY_ROOT / "ml" / "data"

INDIVIDUAL_FILE_GLOB = "REG IND*.xlsx"
REPRODUCTIVE_FILE_GLOB = "REGISTRO REPRODUCTIVO*.xlsx"
HEADER_SCAN_ROWS = 30
INDIVIDUAL_MAX_COLUMNS = 22
REPRODUCTIVE_MAX_COLUMNS = 12

ANIMAL_CODE_PATTERN = r"^[A-Za-z]+\d+$"
FILLER_CODE_PREFIXES = ("SERVICIO", "CENTRO", "ESLABON", "POZA", "MACHO")
EMPTY_DATE_MARKERS = frozenset({"X"})

INDIVIDUAL_HEADER_ALIASES = {
    "animal_code": ("ANIMALNO",),
    "nupar_madre": ("NUPAR",),
    "tcnv": ("TCNV",),
    "tcnm": ("TCNM",),
    "tcnt": ("TCNT",),
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

DESTINO_CODES = {
    "M": "Muerte",
    "D": "Descarte",
    "V": "Vendido",
    "R": "Reemplazado",
    "SP": "Sin placa",
    "L": "Levante",
    "E": "Engorde",
}
OJOS_CODES = {"1": "Negro", "2": "Rojo"}
SEXO_CODES = {"1": "Macho", "2": "Hembra"}
UNKNOWN_CODE = "CODIGO_DESCONOCIDO"

# Confirmed by the user: a T.C.N. cell containing only an integer is a total.
# Composite forms and the meanings of M, AB, and X remain provisional.
TCN_INTEGER_IS_TOTAL = True
TCN_UNCONFIRMED_MARKERS = frozenset({"M", "AB", "X"})
