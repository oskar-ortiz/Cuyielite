"""Lectura de archivos Excel en modo solo lectura."""

import openpyxl
import re
from openpyxl.utils import get_column_letter


def load_workbook(path: str, data_only: bool = False, read_only: bool = True):
    """Abre un libro. read_only=True para iteracion rapida; read_only=False para acceso individual."""
    return openpyxl.load_workbook(path, data_only=data_only, read_only=read_only)


def detect_format(ws, data_only: bool = False):
    """Detecta el formato por encabezados (individual o reproductivo)."""
    for row in ws.iter_rows(min_row=1, max_row=20):
        vals = []
        for c in row:
            v = getattr(c, "value", None)
            vals.append(str(v).strip().upper() if v is not None else "")
        joined = " ".join(vals)
        if "ANIMAL" in joined and "NO" in joined:
            return "individual"
        if "HEMBRA" in joined:
            return "reproductive"
    return "unknown"


def read_individual_sheet(ws_formula, ws_cached=None, max_cols: int = 22):
    """Lee filas individuales del formato 'REG IND GALPON'.

    Limita la lectura a max_cols=22 columnas (A:V).
    Valida encabezados antes de procesar.
    Clasifica filas de hembras: solo si ANIMAL No. es un codigo valido.
    Captura formula, cache y procedencia por campo durante la iteracion.
    """
    rows = list(ws_formula.iter_rows(min_row=1, max_col=max_cols))
    if not rows:
        return []
    header = [str(c.value).strip() if c.value is not None else "" for c in rows[0]]
    header_upper = [h.upper() for h in header]
    if "ANIMAL NO." not in header_upper and "ANIMAL No." not in header:
        return []
    animal_idx = None
    for i, h in enumerate(header):
        if h.upper().replace(".", "").replace(" ", "") == "ANIMALNO":
            animal_idx = i
            break
    if animal_idx is None:
        return []

    result = []
    for idx in range(1, len(rows)):
        row = rows[idx]
        values = [c.value for c in row]
        if all(v is None or (isinstance(v, str) and v.strip() == "") for v in values):
            continue
        animal_val = row[animal_idx].value if animal_idx < len(row) else None
        animal_code = str(animal_val).strip() if animal_val is not None else ""
        if not animal_code or animal_code.upper() in ("", "NONE", "NAN"):
            continue
        if any(kw in animal_code.upper() for kw in ("SERVICIO", "CENTRO", "ESLABON", "POZA:", "MACHO:")):
            continue
        record = {}
        for i, h in enumerate(header):
            if i < len(row):
                cell = row[i]
                coord = getattr(cell, "coordinate", f"{get_column_letter(i + 1)}{idx + 1}")
                record[h] = cell.value
                record[f"_ref_{h}"] = coord
                # Capturar valor cacheado durante la iteracion (si ws_cached disponible)
                if ws_cached is not None:
                    try:
                        cached_cell = ws_cached[coord]
                        record[f"_cached_{h}"] = cached_cell.value
                    except Exception:
                        record[f"_cached_{h}"] = None
        # Capturar formula/cache/procedencia por campo
        field_origins = {}
        for field_name in ("T.C.N.V", "T.C.N.M", "T.C.N.T", "PESO PARTO", "PESO NACIMIENTO"):
            ref = record.get(f"_ref_{field_name}")
            if ref:
                formula_val = record.get(field_name)
                cached_val = record.get(f"_cached_{field_name}")
                formula = formula_val if isinstance(formula_val, str) and formula_val.startswith("=") else None
                if formula is not None:
                    source = "formula (calculado)"
                elif cached_val is not None:
                    source = "observado"
                else:
                    source = "desconocido"
                field_origins[field_name] = source
        record["_field_origins"] = field_origins
        # Capturar campos P:V (columnas 16-22)
        pv = {}
        pv_cached = {}
        for col in range(16, 23):
            if col - 1 < len(row):
                cell = row[col - 1]
                letter = get_column_letter(col)
                coord = getattr(cell, "coordinate", f"{letter}{idx + 1}")
                pv[coord] = cell.value
                if ws_cached is not None:
                    try:
                        cached_cell = ws_cached[coord]
                        pv_cached[coord] = cached_cell.value
                    except Exception:
                        pv_cached[coord] = None
        record["_pv"] = pv
        record["_pv_cached"] = pv_cached
        record["_row"] = idx + 1
        result.append(record)
    return result


def read_reproductive_blocks(ws_formula, ws_cached=None, max_cols: int = 12):
    """Lee bloques reproductivos del formato 'REGISTRO REPRODUCTIVO'.

    Limita la lectura a max_cols=12 columnas.
    Detecta bloques 'Poza: X' y filas de hembras con partos.
    Acepta solo filas con patron de identificador de hembra dentro de un bloque valido.
    """
    import re
    blocks = []
    current_poza = None
    current_macho = None
    for idx, row in enumerate(ws_formula.iter_rows(min_row=1, max_col=max_cols), start=1):
        vals = [str(c.value).strip() if c.value is not None else "" for c in row]
        if vals and vals[0].startswith("Poza:"):
            current_poza = vals[0]
            current_macho = None
            continue
        if vals and vals[0].startswith("Macho:"):
            current_macho = vals[0]
            continue
        if vals and vals[0] == "Hembra":
            continue
        if vals and vals[0] and not vals[0].startswith("Poza:") and not vals[0].startswith("Macho:") and not vals[0].startswith("OBSERVACIONE"):
            hembra = vals[0]
            # Patron de identificador de hembra: letras seguidas de digitos
            if not re.match(r"^[A-Za-z]+\d+$", hembra):
                continue
            # Solo dentro de un bloque valido de poza
            if current_poza is None:
                continue
            peso = vals[1] if len(vals) > 1 else None
            color = vals[2] if len(vals) > 2 else None
            ojos = vals[3] if len(vals) > 3 else None
            partos = []
            for j in range(4):
                fecha_idx = 4 + j * 2
                tcn_idx = 5 + j * 2
                fecha = vals[fecha_idx] if fecha_idx < len(vals) else ""
                tcn = vals[tcn_idx] if tcn_idx < len(vals) else ""
                if fecha.strip() and fecha.strip().upper() != "X":
                    coord = f"{get_column_letter(fecha_idx + 1)}{idx}"
                    origin = "observado"
                    partos.append({"parto": j + 1, "fecha": fecha, "tcn": tcn, "ref": f"{ws_formula.title}!{coord}", "origin": origin})
            blocks.append({
                "poza": current_poza,
                "macho": current_macho,
                "hembra": hembra,
                "peso": peso,
                "color": color,
                "ojos": ojos,
                "partos": partos,
                "row": idx,
                "ref": f"{ws_formula.title}!A{idx}",
            })
    return blocks