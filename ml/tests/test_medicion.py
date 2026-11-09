import csv

import pytest

from ml.medicion.sus_metrics import score_sus, summarize_sus_csv
from ml.medicion.sync_metrics import summarize_sync_csv


def _write_csv(path, headers, rows):
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(headers)
        writer.writerows(rows)


def test_sync_metrics_summarize_success_and_all_attempt_latencies(tmp_path):
    path = tmp_path / "sync.csv"
    _write_csv(
        path,
        ["id", "inicio", "fin", "exito"],
        [
            ["s1", "2026-11-09T08:00:00Z", "2026-11-09T08:00:00.100Z", "true"],
            ["s2", "2026-11-09T08:01:00Z", "2026-11-09T08:01:00.200Z", "0"],
            ["s3", "2026-11-09T08:02:00Z", "2026-11-09T08:02:00.300Z", "si"],
            ["s4", "2026-11-09T08:03:00Z", "2026-11-09T08:03:00.400Z", "false"],
        ],
    )

    result = summarize_sync_csv(path)

    assert result == {
        "attempt_count": 4,
        "successful_attempts": 2,
        "success_rate_pct": 50.0,
        "latency_ms": {"mean": 250.0, "p50": 250.0, "p95": 385.0},
    }


@pytest.mark.parametrize(
    ("started", "finished", "success", "message"),
    [
        ("2026-11-09T08:00:00", "2026-11-09T08:00:01", "true", "zona horaria"),
        (
            "2026-11-09T08:00:02Z",
            "2026-11-09T08:00:01Z",
            "true",
            "fin no puede preceder",
        ),
        (
            "2026-11-09T08:00:00Z",
            "2026-11-09T08:00:01Z",
            "maybe",
            "exito debe ser",
        ),
    ],
)
def test_sync_metrics_reject_invalid_rows(
    tmp_path, started, finished, success, message
):
    path = tmp_path / "sync.csv"
    _write_csv(
        path,
        ["id", "inicio", "fin", "exito"],
        [["s1", started, finished, success]],
    )

    with pytest.raises(ValueError, match=message):
        summarize_sync_csv(path)


def test_sus_scores_each_user_and_mean(tmp_path):
    path = tmp_path / "sus.csv"
    headers = ["usuario_id", *(f"item{index}" for index in range(1, 11))]
    _write_csv(
        path,
        headers,
        [
            ["persona-sintetica-01", 1, 5, 3, 2, 4, 1, 5, 3, 2, 4],
            ["persona-sintetica-02", 5, 1, 5, 1, 5, 1, 5, 1, 5, 1],
        ],
    )

    result = summarize_sus_csv(path)

    assert result == {
        "respondent_count": 2,
        "mean_score": 75.0,
        "responses": [
            {"usuario_id": "persona-sintetica-01", "score": 50.0},
            {"usuario_id": "persona-sintetica-02", "score": 100.0},
        ],
    }


def test_sus_rejects_duplicate_users_and_out_of_scale_values(tmp_path):
    path = tmp_path / "sus.csv"
    headers = ["usuario_id", *(f"item{index}" for index in range(1, 11))]
    _write_csv(
        path,
        headers,
        [
            ["persona-sintetica", *([3] * 10)],
            ["persona-sintetica", *([3] * 10)],
        ],
    )
    with pytest.raises(ValueError, match="aparece más de una vez"):
        summarize_sus_csv(path)

    _write_csv(path, headers, [["persona-sintetica", *([6] * 10)]])
    with pytest.raises(ValueError, match="entre 1 y 5"):
        summarize_sus_csv(path)


@pytest.mark.parametrize(
    ("answers", "expected"),
    [([1, 5] * 5, 0.0), ([5, 1] * 5, 100.0)],
)
def test_sus_score_scale_extremes(answers, expected):
    assert score_sus(answers) == expected


def test_sus_score_rejects_non_integer_values():
    with pytest.raises(ValueError, match="entero"):
        score_sus([3.5] + [3] * 9)
