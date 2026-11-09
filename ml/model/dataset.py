"""Load rule-labeled candidate features without exposing animal identifiers."""

from collections import Counter
from dataclasses import dataclass
import hashlib
from pathlib import Path
from typing import Any

import pandas as pd

from ml.etl import config
from ml.etl.extract import extract_individual_workbook


FEATURES_A = (
    "nupar_madre",
    "tcnv",
    "peso_nacimiento_g",
    "peso_destete_g",
    "ratio_destete_nacimiento",
    "ojos",
)
FEATURES_B = (
    "nupar_madre",
    "tcnv",
    "peso_nacimiento_g",
    "ojos",
)
TARGET_LABELS = frozenset({"ELITE", "NORMAL"})
IDENTITY_SENTINELS = frozenset({"", "sin_placa", "none", "nan"})


@dataclass(frozen=True)
class CandidateDataset:
    """Model inputs, labels, and aggregate-only dataset accounting."""

    features_a: pd.DataFrame
    features_b: pd.DataFrame
    labels: pd.Series
    groups: pd.Series | None
    stats: dict[str, Any]
    sha256: str


def _as_model_features(frame: pd.DataFrame, columns: tuple[str, ...]) -> pd.DataFrame:
    features = frame.loc[:, columns].copy()
    for column in columns:
        if column == "ojos":
            features[column] = features[column].astype("string").str.strip()
            features[column] = features[column].replace("", pd.NA)
        else:
            features[column] = pd.to_numeric(features[column], errors="coerce")
    return features


def _usable_identity(value: Any) -> str | None:
    normalized = "" if pd.isna(value) else str(value).strip().casefold()
    return None if normalized in IDENTITY_SENTINELS else normalized


def _mother_groups(
    rows: pd.DataFrame,
    raw_data_dir: Path,
) -> pd.Series | None:
    provenance_columns = {
        "provenance_archivo",
        "provenance_hoja",
        "provenance_fila",
    }
    if not provenance_columns.issubset(rows.columns):
        return None

    required_sources = set(rows["provenance_archivo"].astype(str))
    groups_by_row: dict[tuple[str, str, str], str | None] = {}
    for source in sorted(required_sources):
        source_path = raw_data_dir / source
        if not source_path.is_file():
            raise FileNotFoundError(
                f"No se encontró el Excel requerido para agrupar por madre: "
                f"{source_path}"
            )
        records, _ = extract_individual_workbook(source_path)
        for record in records:
            mother_code = _usable_identity(record.get("mother_code"))
            key = (
                source,
                str(record["source_sheet"]),
                str(record["source_row"]),
            )
            groups_by_row[key] = mother_code

    groups = []
    for row in rows.itertuples(index=False):
        key = (
            str(getattr(row, "provenance_archivo")),
            str(getattr(row, "provenance_hoja")),
            str(getattr(row, "provenance_fila")),
        )
        if key not in groups_by_row:
            raise ValueError(
                "No se encontró la fila de origen requerida para agrupar por madre."
            )
        groups.append(groups_by_row[key])
    return pd.Series(groups, index=rows.index, dtype="string", name="grupo_madre")


def load_dataset(
    path: Path,
    raw_data_dir: Path = config.RAW_DATA_DIR,
) -> CandidateDataset:
    """Read labeled candidates, retain ELITE/NORMAL, and deduplicate by identity."""
    raw_bytes = path.read_bytes()
    frame = pd.read_csv(path, dtype="string", keep_default_na=False)
    required = {*FEATURES_A, "etiqueta", "estado_calidad"}
    missing_columns = sorted(required.difference(frame.columns))
    if missing_columns:
        raise ValueError(f"CSV de candidatas sin columnas requeridas: {missing_columns}")

    labels = frame["etiqueta"].str.strip().str.upper()
    eligible_mask = labels.isin(TARGET_LABELS)
    eligible = frame.loc[eligible_mask].copy()
    eligible["__label"] = labels.loc[eligible_mask]

    duplicate_rows = 0
    duplicate_cross_source_ids: set[str] = set()
    seen_sources: dict[str, str] = {}
    keep_indices = []
    missing_identity = 0
    for index, row in eligible.iterrows():
        identity = _usable_identity(row.get("identidad", ""))
        if identity is None:
            missing_identity += 1
            keep_indices.append(index)
            continue
        source = str(row.get("provenance_archivo", "")).strip()
        if identity in seen_sources:
            duplicate_rows += 1
            if seen_sources[identity] != source:
                duplicate_cross_source_ids.add(identity)
            continue
        seen_sources[identity] = source
        keep_indices.append(index)

    retained = eligible.loc[keep_indices].copy()
    groups = _mother_groups(retained, raw_data_dir)
    rows_excluded_missing_mother = 0
    if groups is not None:
        group_mask = groups.notna()
        rows_excluded_missing_mother = int((~group_mask).sum())
        retained = retained.loc[group_mask].copy()
        groups = groups.loc[group_mask].reset_index(drop=True)

    source_counts = Counter(
        str(value).strip() or "SIN_FUENTE"
        for value in retained.get(
            "provenance_archivo", pd.Series(["SIN_FUENTE"] * len(retained))
        )
    )
    class_counts = Counter(retained["__label"].tolist())
    excluded = frame.loc[~eligible_mask]
    excluded_states = excluded.get(
        "estado_calidad", pd.Series([""] * len(excluded), index=excluded.index)
    ).fillna("").astype(str)
    review_mask = excluded_states.str.contains(r"(?:^|\|)REVISAR(?:\||$)", regex=True)
    no_apply_mask = excluded_states.str.contains(
        r"(?:^|\|)NO_APLICA(?:\||$)", regex=True
    )

    features_a = _as_model_features(retained, FEATURES_A).reset_index(drop=True)
    features_b = _as_model_features(retained, FEATURES_B).reset_index(drop=True)
    target = retained["__label"].reset_index(drop=True).rename("etiqueta")
    if groups is not None:
        groups = groups.rename("grupo_madre")
    stats = {
        "rows_total": int(len(frame)),
        "rows_eligible_before_dedup": int(len(eligible)),
        "rows_used": int(len(retained)),
        "class_counts": dict(sorted(class_counts.items())),
        "excluded_no_aplica": int(no_apply_mask.sum()),
        "excluded_review": int(review_mask.sum()),
        "excluded_other_unlabeled": int((~no_apply_mask & ~review_mask).sum()),
        "duplicate_rows_removed": duplicate_rows,
        "cross_source_duplicate_ids": len(duplicate_cross_source_ids),
        "rows_without_usable_identity": missing_identity,
        "rows_excluded_missing_mother": rows_excluded_missing_mother,
        "mother_groups": int(groups.nunique()) if groups is not None else None,
        "rows_by_source": dict(sorted(source_counts.items())),
    }
    return CandidateDataset(
        features_a=features_a,
        features_b=features_b,
        labels=target,
        groups=groups,
        stats=stats,
        sha256=hashlib.sha256(raw_bytes).hexdigest(),
    )


def reproductive_label_counts(path: Path) -> dict[str, int]:
    """Return class and unlabeled counts for reproductive females."""
    frame = pd.read_csv(path, dtype="string", keep_default_na=False)
    labels = frame.get("etiqueta", pd.Series([""] * len(frame))).str.strip().str.upper()
    counts = Counter(labels.tolist())
    return {
        "total_rows": int(len(frame)),
        "normal": int(counts["NORMAL"]),
        "descarte": int(counts["DESCARTE"]),
        "unlabeled": int(len(frame) - counts["NORMAL"] - counts["DESCARTE"]),
    }
