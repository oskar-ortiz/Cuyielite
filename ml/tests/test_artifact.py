import json

import joblib
import pandas as pd
import pytest
from sklearn.dummy import DummyClassifier

from backend.app.services.ml import MlFalloInterno, load_candidate_model
from ml.model.artifact import (
    METADATA_PATH_ENV,
    MODEL_PATH_ENV,
    ModelArtifactError,
    load_verified_model,
    sha256_file,
    write_model_metadata,
)
from ml.model.dataset import CandidateDataset
import ml.model.train as train_module
from ml.model.train import _aggregate_dataset_stats


def _synthetic_model():
    model = DummyClassifier(strategy="most_frequent")
    model.fit(pd.DataFrame({"feature": [0, 1]}), ["NORMAL", "ELITE"])
    return model


def test_metadata_records_hash_and_aggregate_counts(tmp_path):
    model_path = tmp_path / "synthetic.joblib"
    metadata_path = tmp_path / "metadata.json"
    joblib.dump(_synthetic_model(), model_path)
    stats = {
        "rows_used": 2,
        "class_counts": {"ELITE": 1, "NORMAL": 1},
        "rows_by_source": {"sensitive-file-name.xlsx": 2},
    }

    registered = write_model_metadata(
        model_path,
        {
            "random_seed": 42,
            "versions": {"python": "synthetic", "scikit_learn": "synthetic"},
            "dataset": _aggregate_dataset_stats(stats),
            "metrics": {"synthetic": 1.0},
        },
        metadata_path,
    )
    persisted = json.loads(metadata_path.read_text(encoding="utf-8"))

    assert registered["model_sha256"] == sha256_file(model_path)
    assert persisted["model_sha256"] == registered["model_sha256"]
    assert "rows_by_source" not in persisted["dataset"]
    assert "sensitive-file-name.xlsx" not in json.dumps(persisted)


def test_loader_verifies_hash_before_deserializing(tmp_path, monkeypatch):
    model_path = tmp_path / "synthetic.joblib"
    metadata_path = tmp_path / "metadata.json"
    joblib.dump(_synthetic_model(), model_path)
    write_model_metadata(model_path, {}, metadata_path)
    assert load_verified_model(model_path, metadata_path) is not None

    def unexpected_deserialization(path):
        pytest.fail("El modelo no debe deserializarse si el hash no coincide.")

    monkeypatch.setattr("ml.model.artifact.joblib.load", unexpected_deserialization)
    model_path.write_bytes(model_path.read_bytes() + b"tampered")
    with pytest.raises(ModelArtifactError, match="SHA256_MISMATCH|SHA-256"):
        load_verified_model(model_path, metadata_path)


def test_loader_rejects_metadata_without_hash(tmp_path):
    model_path = tmp_path / "synthetic.joblib"
    metadata_path = tmp_path / "metadata.json"
    joblib.dump(_synthetic_model(), model_path)
    metadata_path.write_text("{}", encoding="utf-8")

    with pytest.raises(ModelArtifactError, match="SHA-256"):
        load_verified_model(model_path, metadata_path)


def test_platform_service_fails_clearly_on_hash_mismatch(tmp_path, monkeypatch):
    model_path = tmp_path / "synthetic.joblib"
    metadata_path = tmp_path / "metadata.json"
    joblib.dump(_synthetic_model(), model_path)
    metadata_path.write_text(json.dumps({"model_sha256": "0" * 64}), encoding="utf-8")
    monkeypatch.setenv("CUYIELITE_RF_MODEL_PATH", str(model_path))
    monkeypatch.setenv("CUYIELITE_RF_METADATA_PATH", str(metadata_path))

    with pytest.raises(MlFalloInterno, match="RF_MODEL_SHA256_MISMATCH"):
        load_candidate_model()


def test_training_orchestrator_writes_authorized_artifact_and_complete_metadata(
    tmp_path,
    monkeypatch,
):
    features = pd.DataFrame({"synthetic": [0, 1]})
    dataset = CandidateDataset(
        features_a=features,
        features_b=features,
        labels=pd.Series(["NORMAL", "ELITE"]),
        groups=pd.Series(["group-a", "group-b"]),
        stats={
            "rows_total": 2,
            "rows_eligible_before_dedup": 2,
            "rows_used": 2,
            "class_counts": {"ELITE": 1, "NORMAL": 1},
            "excluded_no_aplica": 0,
            "excluded_review": 0,
            "excluded_duplicate_conflict": 0,
            "excluded_other_unlabeled": 0,
            "duplicate_rows_removed": 0,
            "cross_source_duplicate_ids": 0,
            "rows_without_usable_identity": 0,
            "rows_excluded_missing_mother": 0,
            "mother_groups": 2,
            "rows_by_source": {"private-source.xlsx": 2},
        },
        sha256="a" * 64,
        training_row_keys_sha256="b" * 64,
    )
    artifact_path = tmp_path / "authorized" / "synthetic.joblib"
    metadata_path = tmp_path / "authorized" / "metadata.json"
    report_path = tmp_path / "authorized" / "report.md"
    environment_path = tmp_path / "authorized" / "environment.txt"
    monkeypatch.setenv(MODEL_PATH_ENV, str(artifact_path))
    monkeypatch.setenv(METADATA_PATH_ENV, str(metadata_path))
    monkeypatch.setattr(train_module, "load_dataset", lambda path: dataset)
    monkeypatch.setattr(
        train_module,
        "evaluate_experiment",
        lambda *args, **kwargs: {"synthetic_metric": 0.75},
    )
    monkeypatch.setattr(
        train_module,
        "fit_final_model",
        lambda *args, **kwargs: type(
            "SearchResult",
            (),
            {"best_estimator_": _synthetic_model(), "best_params_": {"seed": 42}},
        )(),
    )
    monkeypatch.setattr(
        train_module,
        "reproductive_label_counts",
        lambda path: {"total_rows": 0, "normal": 0, "descarte": 0, "unlabeled": 0},
    )
    monkeypatch.setattr(
        train_module,
        "render_report",
        lambda metadata: f"model sha256: {metadata['model_sha256']}\n",
    )

    metadata = train_module.train(
        data_dir=tmp_path,
        model_dir=tmp_path / "models",
        report_path=report_path,
        training_code_commit="base-synthetic",
        environment_report_path=environment_path,
    )

    assert artifact_path.is_file()
    assert metadata_path.is_file()
    assert environment_path.is_file()
    assert metadata["model_sha256"] == sha256_file(artifact_path)
    assert metadata["model_sha256"] in report_path.read_text(encoding="utf-8")
    assert metadata["training_row_keys_sha256"] == "b" * 64
    assert metadata["training_code_commit"] == "base-synthetic"
    assert metadata["random_seed"] == 42
    assert {"python", "scikit_learn", "numpy", "pandas", "joblib"} == set(
        metadata["versions"]
    )
    assert metadata["date"]
    assert metadata["experiments"]["A_completo"]["synthetic_metric"] == 0.75
    assert metadata["dataset"]["rows_used"] == 2
    assert "rows_by_source" not in metadata["dataset"]
    assert "private-source.xlsx" not in json.dumps(metadata)
