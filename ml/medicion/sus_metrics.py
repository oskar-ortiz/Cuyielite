"""Calculate per-respondent and mean SUS scores from a CSV."""

import argparse
import csv
import json
from pathlib import Path
import statistics
from typing import Any


ITEM_FIELDS = tuple(f"item{index}" for index in range(1, 11))
USER_FIELD = "usuario_id"
SUS_FIELDS = (USER_FIELD, *ITEM_FIELDS)


def _read_responses(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        fields = reader.fieldnames
        if fields is None:
            raise ValueError(f"{path}: el CSV no tiene encabezado.")
        if len(fields) != len(set(fields)) or set(fields) != set(SUS_FIELDS):
            expected = ", ".join(SUS_FIELDS)
            raise ValueError(
                f"{path}: encabezados inválidos; se requieren exactamente: {expected}."
            )

        rows = []
        seen_users = set()
        for line_number, row in enumerate(reader, start=2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"{path}:{line_number}: número de columnas inválido.")
            user_id = row[USER_FIELD].strip()
            if not user_id:
                raise ValueError(f"{path}:{line_number}: usuario_id está vacío.")
            if user_id in seen_users:
                raise ValueError(
                    f"{path}:{line_number}: usuario_id aparece más de una vez."
                )
            seen_users.add(user_id)
            rows.append(row)
    if not rows:
        raise ValueError(f"{path}: no hay respuestas.")
    return rows


def score_sus(answers: list[int]) -> float:
    """Score one ten-item SUS response, mapping the standard 1–5 scale to 0–100."""
    if len(answers) != 10:
        raise ValueError("SUS requiere exactamente 10 respuestas.")
    if any(
        isinstance(value, bool)
        or not isinstance(value, int)
        or not 1 <= value <= 5
        for value in answers
    ):
        raise ValueError("Cada respuesta SUS debe ser un entero entre 1 y 5.")
    contribution_sum = sum(
        value - 1 if index % 2 == 0 else 5 - value
        for index, value in enumerate(answers)
    )
    return contribution_sum * 2.5


def summarize_sus_csv(path: Path) -> dict[str, Any]:
    """Return each respondent's SUS score and the arithmetic mean."""
    responses = []
    for line_number, row in enumerate(_read_responses(path), start=2):
        answers = []
        for field in ITEM_FIELDS:
            value = row[field].strip()
            try:
                answer = int(value)
            except ValueError as error:
                raise ValueError(
                    f"{path}:{line_number}: {field} debe ser un entero de 1 a 5."
                ) from error
            if not 1 <= answer <= 5:
                raise ValueError(
                    f"{path}:{line_number}: {field} debe estar entre 1 y 5."
                )
            answers.append(answer)
        responses.append(
            {
                USER_FIELD: row[USER_FIELD].strip(),
                "score": score_sus(answers),
            }
        )
    return {
        "respondent_count": len(responses),
        "mean_score": statistics.fmean(item["score"] for item in responses),
        "responses": responses,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    args = parser.parse_args()
    try:
        result = summarize_sus_csv(args.csv_path)
    except (OSError, csv.Error, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
