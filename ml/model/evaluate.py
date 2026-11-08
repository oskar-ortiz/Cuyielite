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
    RepeatedStratifiedKFold,
    StratifiedKFold,
)
from sklearn.pipeline import Pipeline
from sklearn.dummy import DummyClassifier
from sklearn.metrics import make_scorer
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier


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


def _metrics(y_true: pd.Series, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "precision": float(
            precision_score(y_true, y_pred, pos_label="ELITE", zero_division=0)
        ),
        "recall": float(
            recall_score(y_true, y_pred, pos_label="ELITE", zero_division=0)
        ),
        "f1": float(f1_score(y_true, y_pred, pos_label="ELITE", zero_division=0)),
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
    splits: list[tuple[np.ndarray, np.ndarray]],
    baseline: str,
) -> dict[str, Any]:
    folds = []
    pooled_true = []
    pooled_pred = []
    for train_indices, test_indices in splits:
        if baseline == "majority":
            estimator = DummyClassifier(strategy="most_frequent")
        else:
            estimator = DecisionTreeClassifier(
                max_depth=1,
                class_weight="balanced",
                random_state=42,
            )
        estimator.fit(features.iloc[train_indices], labels.iloc[train_indices])
        predictions = estimator.predict(features.iloc[test_indices])
        truth = labels.iloc[test_indices]
        folds.append(_metrics(truth, predictions))
        pooled_true.extend(truth.tolist())
        pooled_pred.extend(predictions.tolist())
    matrix = confusion_matrix(pooled_true, pooled_pred, labels=LABEL_ORDER)
    return {
        "metrics": _summarize_folds(folds),
        "confusion_matrix_pooled": matrix.tolist(),
        "folds": len(folds),
    }


def evaluate_experiment(
    features: pd.DataFrame,
    labels: pd.Series,
    feature_names: tuple[str, ...],
    *,
    n_splits: int = 5,
    n_repeats: int = 3,
    inner_splits: int = 3,
    random_state: int = 42,
    param_grid: dict[str, tuple[Any, ...]] | None = None,
) -> dict[str, Any]:
    """Tune inside each training fold and evaluate on repeated held-out folds."""
    grid = param_grid or DEFAULT_PARAM_GRID
    outer = RepeatedStratifiedKFold(
        n_splits=n_splits,
        n_repeats=n_repeats,
        random_state=random_state,
    )
    splits = list(outer.split(features, labels))
    inner = StratifiedKFold(
        n_splits=inner_splits,
        shuffle=True,
        random_state=random_state,
    )

    folds = []
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
        search.fit(features.iloc[train_indices], labels.iloc[train_indices])
        predictions = search.predict(features.iloc[test_indices])
        truth = labels.iloc[test_indices]
        folds.append(_metrics(truth, predictions))
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
            features, labels, splits, "majority"
        ),
        "decision_tree_depth_1": _baseline_evaluation(
            features, labels, splits, "tree"
        ),
    }
    return {
        "feature_names": list(feature_names),
        "folds": len(folds),
        "metrics": _summarize_folds(folds),
        "confusion_matrix_pooled": matrix.tolist(),
        "confusion_matrix_label_order": list(LABEL_ORDER),
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
    *,
    inner_splits: int = 5,
    random_state: int = 42,
    param_grid: dict[str, tuple[Any, ...]] | None = None,
) -> GridSearchCV:
    """Tune and refit the deployable B model on all eligible candidates."""
    search = GridSearchCV(
        estimator=build_pipeline(feature_names),
        param_grid=param_grid or DEFAULT_PARAM_GRID,
        scoring=ELITE_F1_SCORER,
        cv=StratifiedKFold(
            n_splits=inner_splits,
            shuffle=True,
            random_state=random_state,
        ),
        n_jobs=1,
        refit=True,
        error_score="raise",
    )
    search.fit(features, labels)
    return search
