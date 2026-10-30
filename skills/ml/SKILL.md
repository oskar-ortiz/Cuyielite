---
name: ml
description: "Usa este skill al preparar datos, entrenar o evaluar el Random Forest, o trabajar con PredictionService y su contrato de predicción."
---

# ml

## Propósito
Construir el dataset con TCN, partos acumulados, peso promedio y tasa de mortalidad de camada; entrenar y evaluar el clasificador y mantener su contrato con `PredictionService`.

## Stack
Python 3.12, scikit-learn (`RandomForestClassifier` y `sklearn.metrics`), pandas y joblib. Evaluar con matriz de confusión, precisión, recall y F1 frente al criterio experto zootécnico del SENA.

## Convenciones
- Usar semilla fija y dataset versionado para reproducibilidad. La etiqueta del criterio experto es el objetivo, nunca una entrada. Si la etiqueta deriva de una regla, excluir como entradas las variables que la componen o reportar explícitamente resultados con y sin ellas.
- Las clases son `ELITE`, `NORMAL` y `DESCARTE`, alineadas con el `CHECK` de `cuyes.categoria_ml`.
- Mantener congelados los contratos `PredictionRequest` y `PredictionResponse` de Arquitectura §10.
- Guardar el informe de métricas en `ml/reports/`. No subir el artefacto entrenado: `.gitignore` bloquea `*.pkl` y `*.joblib`.

## Comandos
No hay comandos propios de ML; los scripts y comandos de entrenamiento y evaluación están **a crear**. Hoy no existe CI para `ml/**`.

## Qué no tocar
- No cambiar `backend/requirements.txt` sin coordinar con Oskar.
- No cambiar el esquema Pydantic de `/ml/predict/hembra` ni `backend/` en general.

## Pendientes/abiertos
- `ml/` solo contiene `.gitkeep`; faltan dataset, scripts e informe de métricas. No hay CI para `ml/**`.
- Aún no hay dependencias propias de ML declaradas; crear su declaración y los scripts de entrenamiento y evaluación.
- Acordar y documentar con el experto el criterio de clasificación para `ELITE`, `NORMAL` y `DESCARTE`.
- Si las etiquetas derivan de reglas, acordar sus umbrales y reportar resultados con y sin las variables de esas reglas.
- La ejecución de PostgreSQL en Android sigue sin validar y condiciona el diseño de la persistencia local.
