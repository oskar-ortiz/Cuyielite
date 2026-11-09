"""Load rule-labeled candidate features without exposing animal identifiers."""

from collections import Counter
from dataclasses import dataclass
import hashlib
from pathlib import Path
from typing import Any

import pandas as pd


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


def load_dataset(path: Path) -> CandidateDataset:
    """Read labeled candidates, retain ELITE/NORMAL, and deduplicate by identity."""
    raw_bytes = path.read_bytes()
    frame = pd.read_csv(path, dtype="string", keep_default_na=False)
    required = {*FEATURES_A, "etiqueta", "estado_calidad"}
    missing_columns = sorted(required.difference(frame.columns))
    if missing_columns:
        raise ValueError(f"CSV de candidatas sin columnas requeridas: {missing_columns}")

    labels = frame["etiqueta"].str.strip().str.upper()
    quality_states = frame["estado_calidad"].fillna("").astype(str)
    conflict_mask = quality_states.str.contains(
        r"(?:^|\|)CONFLICTO_DUPLICADO(?:\||$)", regex=True
    )
    eligible_mask = labels.isin(TARGET_LABELS) & ~conflict_mask
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
    conflict_excluded_mask = excluded_states.str.contains(
        r"(?:^|\|)CONFLICTO_DUPLICADO(?:\||$)", regex=True
    )

    features_a = _as_model_features(retained, FEATURES_A).reset_index(drop=True)
    features_b = _as_model_features(retained, FEATURES_B).reset_index(drop=True)
    target = retained["__label"].reset_index(drop=True).rename("etiqueta")
    stats = {
        "rows_total": int(len(frame)),
        "rows_eligible_before_dedup": int(len(eligible)),
        "rows_used": int(len(retained)),
        "class_counts": dict(sorted(class_counts.items())),
        "excluded_no_aplica": int(no_apply_mask.sum()),
        "excluded_review": int(review_mask.sum()),
        "excluded_duplicate_conflict": int(conflict_mask.sum()),
        "excluded_other_unlabeled": int(
            (~no_apply_mask & ~review_mask & ~conflict_excluded_mask).sum()
        ),
        "duplicate_rows_removed": duplicate_rows,
        "cross_source_duplicate_ids": len(duplicate_cross_source_ids),
        "rows_without_usable_identity": missing_identity,
        "rows_by_source": dict(sorted(source_counts.items())),
    }
    return CandidateDataset(
        features_a=features_a,
        features_b=features_b,
        labels=target,
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
