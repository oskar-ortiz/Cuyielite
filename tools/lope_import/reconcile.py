"""Agrupación de camadas, referencias y ambigüedades (sin fusionar)."""


def group_litter(candidates: list) -> dict:
    """Agrupa candidatos por poza/madre; no fusiona identidades."""
    groups = {}
    for c in candidates:
        key = getattr(c, "poza_no", None) or getattr(c, "madre_no", None) or "unknown"
        groups.setdefault(key, []).append(c)
    return groups


def find_duplicates(candidates: list, key_fn) -> list:
    """Encuentra candidatos con clave duplicada (solo reporte, no fusión)."""
    seen = {}
    dupes = []
    for c in candidates:
        k = key_fn(c)
        if k in seen:
            dupes.append((c, seen[k]))
        else:
            seen[k] = c
    return dupes


def reconcile_litters(blocks: list) -> dict:
    """Agrupa bloques reproductivos por poza.

    No fusiona entidades. Reporta ambigüedades (códigos coincidentes).
    Devuelve dict con grupos y lista de ambigüedades.
    """
    groups = {}
    ambiguities = []
    for b in blocks:
        key = b.get("poza") or "unknown"
        groups.setdefault(key, []).append(b)
        # Detectar códigos de hembra coincidentes entre bloques
    seen_codes = {}
    for b in blocks:
        code = b.get("hembra")
        if code and code in seen_codes:
            ambiguities.append({
                "code": code,
                "ref1": seen_codes[code],
                "ref2": b.get("ref"),
                "note": "codigo coincidente en bloques distintos; no fusionar sin validacion",
            })
        else:
            seen_codes[code] = b.get("ref")
    return {"groups": groups, "ambiguities": ambiguities, "reconcilable": False}