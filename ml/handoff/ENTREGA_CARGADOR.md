# Verificación del cargador RF

| Campo | Valor |
|---|---|
| Fecha | 2026-11-17 |
| Commit base inspeccionado | `70eb84cec9251913a523a8928037451f4cad7c96` |
| Estado | Informe de inspección y pruebas; no constituye aprobación del modelo. |

## Cargador y precedencia de reglas

- **CONFIRMADO** — `ml/model/artifact.py::load_verified_model` valida el formato
  del SHA-256 de metadata y compara el hash del artefacto antes de llamar a
  `joblib.load`. Si falta o no coincide, lanza `ModelArtifactError`.
- **CONFIRMADO** — `ml/tests/test_artifact.py` cubre hash válido, metadata sin
  hash y hash incorrecto. La prueba de mismatch falla deliberadamente si se
  intenta deserializar; confirma que `joblib.load` no se ejecuta en ese caso.
- **CONFIRMADO** — `ml/tests/test_prediccion.py` verifica que la clase de las
  reglas se conserva incluso cuando el RF predice una clase distinta. El RF es
  apoyo opcional, no la decisión principal.
- **CONFIRMADO** — `backend/app/services/ml.py::load_candidate_model` llama al
  verificador y adapta los errores; el backend no fue modificado en esta entrega.
- **CONFIRMADO** — El selector de backend pasó con:

  ```powershell
  .\.venv\Scripts\python.exe -m pytest backend\tests\test_ml_adapters.py backend\tests\test_ml_endpoints.py -q
  ```

  Resultado: `16 passed`.
- **CONFIRMADO** — La suite que incluye las pruebas de artefacto y predicción
  pasó con `.\.venv\Scripts\python.exe -m pytest ml -q` (83 passed).
- **CONFIRMADO** — No se requiere `ml/handoff/propuesta_pruebas_cargador.patch`:
  los casos de hash y la precedencia de reglas ya tienen cobertura.

## Validación experta ciega

- **CONFIRMADO** — El paquete existente contiene el protocolo
  `ml/validacion_experta/README.md`, la plantilla vacía
  `ml/validacion_experta/plantilla.csv` y el evaluador
  `ml/validacion_experta/evaluate.py`.
- **CONFIRMADO** — El evaluador calcula exactitud, kappa de Cohen,
  precisión/recall/F1 por clase y matrices de confusión para reglas-experto y
  RF-experto; escribe resultados agregados, sin predicciones por fila.
- **CONFIRMADO** — `ml/tests/test_validacion_experta.py` usa datos sintéticos y
  forma parte de la suite ML indicada arriba.
- **PENDIENTE** — No se ejecutó una validación con clasificaciones expertas.
  Faltan el conjunto ciego autorizado, el revisor y la decisión de dominio;
  ninguna métrica experta queda afirmada por esta entrega.
