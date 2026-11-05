"""Conversiones explícitas y normalización de valores."""

from decimal import Decimal, InvalidOperation


def to_text(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        return s if s else None
    return str(value).strip() or None


def to_int(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value != int(value):
            return None
        return int(value)
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return int(s)
        except ValueError:
            return None
    return None


def to_decimal(value) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        try:
            return Decimal(str(value))
        except (InvalidOperation, ValueError):
            return None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return Decimal(s)
        except (InvalidOperation, ValueError):
            return None
    return None


def sexo_from_code(code) -> str | None:
    """Mapeo 1->M, 2->H. Otro valor queda None (pendiente)."""
    if code == 1 or (isinstance(code, str) and code.strip() == "1"):
        return "M"
    if code == 2 or (isinstance(code, str) and code.strip() == "2"):
        return "H"
    return None