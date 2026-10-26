---
name: ml
description: Guía el dataset, entrenamiento y evaluación del clasificador Random Forest y su contrato de predicción; se activa al trabajar en ML.
---

# ml

## Propósito
Construir el dataset zootécnico, entrenar y evaluar el Random Forest y mantener su integración con `PredictionService`.

## Stack
Python 3.12 (versión usada por la CI de backend), scikit-learn (`RandomForestClassifier` y `sklearn.metrics`), pandas y joblib. Aún no hay dependencias propias de ML declaradas.

## Convenciones
- Variables de entrada: TCN promedio, partos acumulados, peso promedio y tasa de mortalidad de camada. La etiqueta del criterio experto zootécnico del SENA es el objetivo, nunca una variable de entrada (evitar fuga de datos).
- Evaluar contra el criterio experto con matriz de confusión, precisión, recall y F1. Usar semilla fija y dataset versionado para reproducibilidad.
- Clases `ELITE`, `NORMAL` y `DESCARTE`, alineadas con el `CHECK` de `cuyes.categoria_ml`.
- Tratar `PredictionRequest` y `PredictionResponse` de Arquitectura §10 como contrato congelado. Guardar informes de métricas en `ml/reports/`; el artefacto entrenado no se sube (`.gitignore` bloquea `*.pkl` y `*.joblib`).

## Comandos
Entrenamiento y evaluación: a crear; actualmente no existen scripts ni comandos propios de ML.

## Qué no tocar
No modificar `backend/requirements.txt` (coordinar con Oskar), el esquema Pydantic de `/ml/predict/hembra` ni `backend/` en general.

## Pendientes / abiertos
- Crear dependencias propias para scikit-learn, pandas y joblib, además de scripts de entrenamiento y evaluación.
- No hay workflow de CI para `ml/**`; `backend.yml` cubre `backend/**` y `db/**`.
- Definir en una futura decisión de arquitectura las reglas/umbrales para asignar clases.
