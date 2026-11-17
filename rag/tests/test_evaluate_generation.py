from rag.eval.evaluate_generation import _rating_counts, refresh_review_summary


def test_rating_counts_normalize_existing_labels_and_pending():
    assert _rating_counts([" ok ", "parcial", "mal", ""]) == {
        "correcta": 1,
        "parcial": 1,
        "incorrecta": 1,
        "pendiente": 1,
    }


def test_refresh_summary_counts_without_changing_manual_ratings(tmp_path):
    report = tmp_path / "report.md"
    table = (
        "| 1 | pregunta sintética | extractivo | 1 | respuesta | ok |\n"
        "| 2 | fuera de corpus | abstención | 1 | no encontrada | parcial |\n"
        "| 3 | pendiente | extractivo | 1 | respuesta |  |\n"
    )
    report.write_text(
        "# Reporte\n\n- Estado: generado.\n\n"
        "| # | Pregunta | Modo | Tiempo | Respuesta | Calificación |\n"
        "|---|---|---|---:|---|---|\n"
        + table,
        encoding="utf-8",
    )

    counts = refresh_review_summary(report)
    updated = report.read_text(encoding="utf-8")

    assert counts == {
        "correcta": 1,
        "parcial": 1,
        "incorrecta": 0,
        "pendiente": 1,
    }
    assert "- Estado de calificación: calificación parcial (2/3); 1 pendiente(s)" in updated
    assert "- Fecha de calificación: No registrada en el informe." in updated
    assert "- Revisor de calificación: No identificado en el informe." in updated
    assert table in updated

    refresh_review_summary(report)
    assert report.read_text(encoding="utf-8").count("- Estado de calificación:") == 1
