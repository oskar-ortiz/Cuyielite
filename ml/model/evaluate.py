"""Nested repeated cross-validation and aggregate classification metrics."""

from collections import Counter, defaultdict
import json
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import (
    GridSearchCV,
    StratifiedGroupKFold,
)
from sklearn.pipeline import Pipeline
from sklearn.dummy import DummyClassifier
from sklearn.metrics import make_scorer
from sklearn.preprocessing import OneHotEncoder


DEFAULT_PARAM_GRID = {
    "classifier__n_estimators": (100, 200),
    "classifier__max_depth": (None, 8),
    "classifier__min_samples_leaf": (1, 5),
}
METRICS = ("precision", "recall", "f1")
LABEL_ORDER = ("NORMAL", "ELITE")
ELITE_F1_SCORER = make_scorer(
    f1_score,
    pos_label="ELITE",
    zero_division=0,
)


def build_pipeline(features: tuple[str, ...]) -> Pipeline:
    categorical = ["ojos"] if "ojos" in features else []
    numeric = [feature for feature in features if feature not in categorical]
    transformers = []
    if numeric:
        transformers.append(
            (
                "numeric",
                Pipeline([("imputer", SimpleImputer(strategy="median"))]),
                numeric,
            )
        )
    if categorical:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical,
            )
        )
    preprocessor = ColumnTransformer(transformers, remainder="drop")
    classifier = RandomForestClassifier(
        class_weight="balanced",
        random_state=42,
        n_jobs=1,
    )
    return Pipeline([("preprocessor", preprocessor), ("classifier", classifier)])


def _metrics(
    y_true: pd.Series,
    y_pred: np.ndarray,
    pos_label: str = "ELITE",
) -> dict[str, float]:
    return {
        "precision": float(
            precision_score(y_true, y_pred, pos_label=pos_label, zero_division=0)
        ),
        "recall": float(
            recall_score(y_true, y_pred, pos_label=pos_label, zero_division=0)
        ),
        "f1": float(f1_score(y_true, y_pred, pos_label=pos_label, zero_division=0)),
    }


def _mean_std(values: list[float]) -> dict[str, float]:
    return {
        "mean": float(np.mean(values)),
        "std": float(np.std(values, ddof=1)) if len(values) > 1 else 0.0,
    }


def _summarize_folds(folds: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        metric: _mean_std([fold[metric] for fold in folds])
        for metric in METRICS
    }


def _feature_importance(
    estimator: Pipeline,
    features: tuple[str, ...],
) -> dict[str, float]:
    encoded_names = estimator.named_steps["preprocessor"].get_feature_names_out()
    importances = estimator.named_steps["classifier"].feature_importances_
    totals = dict.fromkeys(features, 0.0)
    for encoded_name, importance in zip(encoded_names, importances, strict=True):
        raw_name = str(encoded_name).split("__", 1)[-1]
        source_feature = next(
            (
                feature
                for feature in features
                if raw_name == feature or raw_name.startswith(f"{feature}_")
            ),
            raw_name,
        )
        totals[source_feature] = totals.get(source_feature, 0.0) + float(importance)
    return totals


def _baseline_evaluation(
    features: pd.DataFrame,
    labels: pd.Series,
    groups: pd.Series,
    splits: list[tuple[np.ndarray, np.ndarray]],
    baseline: str,
) -> dict[str, Any]:
    folds = []
    fold_metrics = []
    class_folds = {label: [] for label in LABEL_ORDER}
    pooled_true = []
    pooled_pred = []
    fold_groups = []
    for train_indices, test_indices in splits:
        if baseline == "majority":
            estimator = DummyClassifier(strategy="most_frequent")
            estimator.fit(features.iloc[train_indices], labels.iloc[train_indices])
            predictions = estimator.predict(features.iloc[test_indices])
        elif baseline == "rule_b":
            predictions = _simple_rule(features.iloc[test_indices])
        else:
            raise ValueError(f"Línea base desconocida: {baseline}")
        truth = labels.iloc[test_indices]
        fold_groups.append(
            {
                "rows": int(len(test_indices)),
                "groups": int(groups.iloc[test_indices].nunique()),
            }
        )
        metrics = _metrics(truth, predictions)
        folds.append(metrics)
        class_metrics = {}
        for label in LABEL_ORDER:
            class_metrics[label] = _metrics(truth, predictions, label)
            class_folds[label].append(class_metrics[label])
        fold_metrics.append(
            {
                "rows": int(len(test_indices)),
                "groups": fold_groups[-1]["groups"],
                "metrics": metrics,
                "metrics_by_class": class_metrics,
            }
        )
        pooled_true.extend(truth.tolist())
        pooled_pred.extend(predictions.tolist())
    matrix = confusion_matrix(pooled_true, pooled_pred, labels=LABEL_ORDER)
    return {
        "metrics": _summarize_folds(folds),
        "metrics_by_class": {
            label: _summarize_folds(class_folds[label])
            for label in LABEL_ORDER
        },
        "confusion_matrix_pooled": matrix.tolist(),
        "folds": len(folds),
        "fold_metrics": fold_metrics,
        "fold_sizes": fold_groups,
    }


def _simple_rule(features: pd.DataFrame) -> np.ndarray:
    """Apply the four birth-time criteria used by Experiment B."""
    nupar = pd.to_numeric(features["nupar_madre"], errors="coerce")
    tcnv = pd.to_numeric(features["tcnv"], errors="coerce")
    birth_weight = pd.to_numeric(features["peso_nacimiento_g"], errors="coerce")
    eyes = features["ojos"].astype("string").str.strip().str.upper()
    elite = (
        nupar.isin({2, 3})
        & tcnv.isin({3, 4})
        & birth_weight.ge(135)
        & eyes.isin({"1", "NEGRO"})
    )
    return np.where(elite.fillna(False), "ELITE", "NORMAL")


def _validate_disjoint_groups(
    groups: pd.Series,
    splits: list[tuple[np.ndarray, np.ndarray]],
) -> list[dict[str, int]]:
    fold_groups = []
    seen_test_groups: set[str] = set()
    for train_indices, test_indices in splits:
        train_groups = set(groups.iloc[train_indices].astype(str))
        test_groups = set(groups.iloc[test_indices].astype(str))
        if train_groups & test_groups:
            raise ValueError("Un grupo de madre aparece en train y test.")
        if seen_test_groups & test_groups:
            raise ValueError("Un grupo de madre aparece en más de un pliegue test.")
        seen_test_groups.update(test_groups)
        fold_groups.append(
            {
                "train": len(train_groups),
                "test": len(test_groups),
            }
        )
    if len(seen_test_groups) != groups.nunique():
        raise ValueError("La validación no asignó todos los grupos de madres.")
    return fold_groups


def evaluate_experiment(
    features: pd.DataFrame,
    labels: pd.Series,
    feature_names: tuple[str, ...],
    groups: pd.Series,
    *,
    n_splits: int = 5,
    inner_splits: int = 3,
    random_state: int = 42,
    param_grid: dict[str, tuple[Any, ...]] | None = None,
) -> dict[str, Any]:
    """Tune and evaluate with mother groups held out from every fold."""
    features = features.reset_index(drop=True)
    labels = labels.reset_index(drop=True)
    groups = groups.reset_index(drop=True)
    if not (len(features) == len(labels) == len(groups)):
        raise ValueError("Features, etiquetas y grupos deben tener igual longitud.")
    if groups.isna().any():
        raise ValueError("La validación agrupada requiere madre identificada.")
    if groups.nunique() < n_splits:
        raise ValueError("No hay suficientes madres para los pliegues solicitados.")

    grid = param_grid or DEFAULT_PARAM_GRID
    outer = StratifiedGroupKFold(
        n_splits=n_splits,
        shuffle=True,
        random_state=random_state,
    )
    splits = list(outer.split(features, labels, groups))
    fold_groups = _validate_disjoint_groups(groups, splits)
    inner = StratifiedGroupKFold(
        n_splits=inner_splits,
        shuffle=True,
        random_state=random_state,
    )

    folds = []
    class_folds = {label: [] for label in LABEL_ORDER}
    pooled_true = []
    pooled_pred = []
    importances = defaultdict(list)
    parameter_counts = Counter()
    for train_indices, test_indices in splits:
        search = GridSearchCV(
            estimator=build_pipeline(feature_names),
            param_grid=grid,
            scoring=ELITE_F1_SCORER,
            cv=inner,
            n_jobs=1,
            refit=True,
            error_score="raise",
        )
        search.fit(
            features.iloc[train_indices],
            labels.iloc[train_indices],
            groups=groups.iloc[train_indices],
        )
        predictions = search.predict(features.iloc[test_indices])
        truth = labels.iloc[test_indices]
        folds.append(_metrics(truth, predictions))
        for label in LABEL_ORDER:
            class_folds[label].append(_metrics(truth, predictions, label))
        pooled_true.extend(truth.tolist())
        pooled_pred.extend(predictions.tolist())
        parameter_counts[
            json.dumps(search.best_params_, sort_keys=True, default=str)
        ] += 1
        for name, value in _feature_importance(
            search.best_estimator_, feature_names
        ).items():
            importances[name].append(value)

    matrix = confusion_matrix(pooled_true, pooled_pred, labels=LABEL_ORDER)
    importance_summary = [
        {
            "feature": feature,
            **_mean_std(values),
        }
        for feature, values in importances.items()
    ]
    importance_summary.sort(key=lambda item: (-item["mean"], item["feature"]))
    baselines = {
        "majority_class": _baseline_evaluation(
            features, labels, groups, splits, "majority"
        ),
        "regla_simple_B": _baseline_evaluation(
            features, labels, groups, splits, "rule_b"
        ),
    }
    return {
        "feature_names": list(feature_names),
        "folds": len(folds),
        "fold_metrics": fold_metrics,
        "metrics": _summarize_folds(folds),
        "metrics_by_class": {
            label: _summarize_folds(class_folds[label])
            for label in LABEL_ORDER
        },
        "confusion_matrix_pooled": matrix.tolist(),
        "confusion_matrix_label_order": list(LABEL_ORDER),
        "grouped_by": "MADRE No.",
        "groups_by_fold": fold_groups,
        "feature_importance": importance_summary,
        "selected_params_by_outer_fold": [
            {"params": json.loads(params), "fold_count": count}
            for params, count in sorted(parameter_counts.items())
        ],
        "baselines": baselines,
    }


def fit_final_model(
    features: pd.DataFrame,
    labels: pd.Series,
    feature_names: tuple[str, ...],
    groups: pd.Series,
    *,
    inner_splits: int = 5,
    random_state: int = 42,
    param_grid: dict[str, tuple[Any, ...]] | None = None,
) -> GridSearchCV:
    """Tune and refit the deployable B model with mother-grouped folds."""
    search = GridSearchCV(
        estimator=build_pipeline(feature_names),
        param_grid=param_grid or DEFAULT_PARAM_GRID,
        scoring=ELITE_F1_SCORER,
        cv=StratifiedGroupKFold(
            n_splits=inner_splits,
            shuffle=True,
            random_state=random_state,
        ),
        n_jobs=1,
        refit=True,
        error_score="raise",
    )
    search.fit(features, labels, groups=groups)
    return search
