"""Load rule-labeled candidate features without exposing animal identifiers."""

from collections import Counter
from dataclasses import dataclass
import hashlib
import json
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
    training_row_keys_sha256: str | None


def _training_row_keys_sha256(rows: pd.DataFrame) -> str | None:
    key_columns = (
        "provenance_archivo",
        "provenance_hoja",
        "provenance_fila",
    )
    if not set(key_columns).issubset(rows.columns):
        return None
    keys = sorted(
        tuple(str(value) for value in values)
        for values in rows.loc[:, key_columns].itertuples(index=False, name=None)
    )
    payload = json.dumps(keys, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


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
    quality_states = frame["estado_calidad"].fillna("").astype(str)
    conflict_mask = quality_states.str.contains(
        r"(?:^|\|)CONFLICTO_DUPLICADO(?:\||$)", regex=True
    )
    review_mask = quality_states.str.contains(
        r"(?:^|\|)REVISAR(?:\||$)", regex=True
    )
    no_apply_mask = quality_states.str.contains(
        r"(?:^|\|)NO_APLICA(?:\||$)", regex=True
    )
    eligible_mask = labels.isin(TARGET_LABELS) & ~conflict_mask
    eligible = frame.loc[eligible_mask].copy()
    eligible["__label"] = labels.loc[eligible_mask]

    duplicate_rows = 0
    duplicate_cross_source_ids: set[str] = set()
    seen_sources: dict[str, str] = {}
    keep_indices = []
    duplicate_indices: set[int] = set()
    missing_identity = 0
    missing_identity_indices: set[int] = set()
    for index, row in eligible.iterrows():
        identity = _usable_identity(row.get("identidad", ""))
        if identity is None:
            missing_identity += 1
            missing_identity_indices.add(index)
            keep_indices.append(index)
            continue
        source = str(row.get("provenance_archivo", "")).strip()
        if identity in seen_sources:
            duplicate_rows += 1
            duplicate_indices.add(index)
            if seen_sources[identity] != source:
                duplicate_cross_source_ids.add(identity)
            continue
        seen_sources[identity] = source
        keep_indices.append(index)

    retained = eligible.loc[keep_indices].copy()
    groups = _mother_groups(retained, raw_data_dir)
    rows_excluded_missing_mother = 0
    missing_mother_indices: set[int] = set()
    if groups is not None:
        group_mask = groups.notna()
        rows_excluded_missing_mother = int((~group_mask).sum())
        missing_mother_indices.update(retained.index[~group_mask].tolist())
        retained = retained.loc[group_mask].copy()
        groups = groups.loc[group_mask].reset_index(drop=True)

    source_values = frame.get(
        "provenance_archivo", pd.Series(["SIN_FUENTE"] * len(frame), index=frame.index)
    ).fillna("").astype(str).str.strip()
    source_values = source_values.replace("", "SIN_FUENTE")
    source_names = sorted(source_values.unique().tolist())
    source_aliases = {
        source: f"origen_{index:02d}"
        for index, source in enumerate(source_names, start=1)
    }
    lineage_by_source = {
        alias: {
            "rows_read": 0,
            "excluded_duplicate_conflict": 0,
            "excluded_no_aplica": 0,
            "excluded_review": 0,
            "excluded_other_unlabeled_or_stage": 0,
            "eligible_before_dedup": 0,
            "duplicate_rows_removed": 0,
            "rows_without_usable_identity": 0,
            "rows_excluded_missing_mother": 0,
            "rows_with_missing_features_imputed": 0,
            "rows_used": 0,
        }
        for alias in source_aliases.values()
    }
    source_alias_by_index = {
        index: source_aliases[source]
        for index, source in source_values.items()
    }
    for index, alias in source_alias_by_index.items():
        lineage_by_source[alias]["rows_read"] += 1

    def count_indices(indices: set[int], field: str) -> None:
        for index in indices:
            lineage_by_source[source_alias_by_index[index]][field] += 1

    excluded_no_apply_mask = no_apply_mask & ~eligible_mask & ~conflict_mask
    excluded_review_mask = (
        review_mask & ~eligible_mask & ~conflict_mask & ~no_apply_mask
    )
    excluded_other_mask = (
        ~eligible_mask & ~conflict_mask & ~no_apply_mask & ~review_mask
    )
    count_indices(set(frame.index[conflict_mask]), "excluded_duplicate_conflict")
    count_indices(
        set(frame.index[excluded_no_apply_mask]),
        "excluded_no_aplica",
    )
    count_indices(
        set(frame.index[excluded_review_mask]),
        "excluded_review",
    )
    count_indices(set(frame.index[excluded_other_mask]), "excluded_other_unlabeled_or_stage")
    count_indices(set(eligible.index), "eligible_before_dedup")
    count_indices(duplicate_indices, "duplicate_rows_removed")
    count_indices(missing_identity_indices, "rows_without_usable_identity")
    count_indices(missing_mother_indices, "rows_excluded_missing_mother")

    features_a = _as_model_features(retained, FEATURES_A).reset_index(drop=True)
    features_b = _as_model_features(retained, FEATURES_B).reset_index(drop=True)
    used_sources = retained.get(
        "provenance_archivo",
        pd.Series(["SIN_FUENTE"] * len(retained), index=retained.index),
    ).fillna("").astype(str).str.strip().replace("", "SIN_FUENTE")
    missing_features = features_b.isna().any(axis=1).tolist()
    for source, has_missing in zip(used_sources.tolist(), missing_features, strict=True):
        alias = source_aliases.get(source, source_aliases.get("SIN_FUENTE"))
        if has_missing and alias is not None:
            lineage_by_source[alias]["rows_with_missing_features_imputed"] += 1
        if alias is not None:
            lineage_by_source[alias]["rows_used"] += 1

    source_counts = Counter(used_sources.tolist())
    rows_by_source = {
        source_aliases[source]: count
        for source, count in sorted(source_counts.items())
        if source in source_aliases
    }
    for alias, counts in lineage_by_source.items():
        counts["rows_after_dedup"] = (
            counts["eligible_before_dedup"] - counts["duplicate_rows_removed"]
        )
    training_row_keys_sha256 = _training_row_keys_sha256(retained)
    class_counts = Counter(retained["__label"].tolist())

    target = retained["__label"].reset_index(drop=True).rename("etiqueta")
    if groups is not None:
        groups = groups.rename("grupo_madre")
    stats = {
        "rows_total": int(len(frame)),
        "rows_eligible_before_dedup": int(len(eligible)),
        "rows_used": int(len(retained)),
        "class_counts": dict(sorted(class_counts.items())),
        "excluded_no_aplica": int(excluded_no_apply_mask.sum()),
        "excluded_review": int(excluded_review_mask.sum()),
        "excluded_duplicate_conflict": int(conflict_mask.sum()),
        "excluded_other_unlabeled": int(excluded_other_mask.sum()),
        "duplicate_rows_removed": duplicate_rows,
        "cross_source_duplicate_ids": len(duplicate_cross_source_ids),
        "rows_without_usable_identity": missing_identity,
        "rows_excluded_missing_mother": rows_excluded_missing_mother,
        "mother_groups": int(groups.nunique()) if groups is not None else None,
        "rows_by_source": rows_by_source,
        "lineage_by_source": lineage_by_source,
    }
    return CandidateDataset(
        features_a=features_a,
        features_b=features_b,
        labels=target,
        groups=groups,
        stats=stats,
        sha256=hashlib.sha256(raw_bytes).hexdigest(),
        training_row_keys_sha256=training_row_keys_sha256,
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
