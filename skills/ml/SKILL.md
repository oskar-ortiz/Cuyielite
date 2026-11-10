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
- Usar semilla fija y mantener reproducibles las transformaciones y el entrenamiento; no versionar datasets con datos reales. La etiqueta del criterio experto es el objetivo, nunca una entrada. Si la etiqueta deriva de una regla, excluir como entradas las variables que la componen o reportar explícitamente resultados con y sin ellas.
- Las clases son `ELITE`, `NORMAL` y `DESCARTE`, alineadas con el `CHECK` de `cuyes.categoria_ml`.
- Mantener congelados los contratos `PredictionRequest` y `PredictionResponse` de Arquitectura §10.
- Los seeds sintéticos solo sirven como prueba de humo del código; nunca se usan para entrenar ni reportar métricas.
- Los datos reales del SENA se usan para ETL, entrenamiento y métricas desde `db/raw_Lope/`, en local e ignorados por Git. Los datos reales no se versionan; su uso es académico, con autorización del SENA. Al repositorio solo se suben código, scripts y reportes agregados.
- No subir el artefacto entrenado: `.gitignore` bloquea `*.pkl` y `*.joblib`.
- Las variables de entrada deben ser features derivadas del esquema de base de datos, nunca columnas raw sin procesar.

## Comandos
- ETL y pruebas: ver [ml/README.md](../../ml/README.md); el ETL local requiere fuentes autorizadas en `db/raw_Lope/`.
- Entrenamiento: `python -m ml.model.train`, después de generar los CSV de características etiquetadas.

## Qué no tocar
- No cambiar `backend/requirements.txt` sin coordinar con Oskar.
- No cambiar los contratos Pydantic de predicción ni `backend/` en general.

## Pendientes/abiertos
- [x] Diseñar schema de dataset ML (TCN, partos, peso, mortalidad) alineado con esquema DB.
- [ ] Definir ETL para extraer las variables del modelo CuySchema (TCN acumulado, partos totales, peso promedio de las últimas 3 camadas, tasa de mortalidad = mortalidad/tamaño_camada) desde datos reales autorizados.
- [ ] Entrenar Random Forest con semilla fija (random_state=42) y evaluar matriz de confusión, precisión, recall, F1.
- [ ] Validar clasificacion ELITE/NORMAL/DESCARTE contra criterio experto zootécnico del SENA.
- [ ] Definir dónde guardar el reporte agregado de métricas y persistir el modelo fuera del repositorio.
- [ ] Implementar la predicción con PredictionService; la ruta HTTP queda por confirmar.
- [ ] Generar alerta automática para hembras en categoría DESCARTE (persistir en tabla ALERTAS).
- [ ] Documentar umbrales de clasificación y acordar con experto zootécnico si las etiquetas derivan de reglas.
- [x] Crear CI para ejecutar `ml/tests` sin Docker ni acceso a datos o modelos reales.
