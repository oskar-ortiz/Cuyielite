# Evaluación RAG — conjunto de validación

- Fecha: 2026-11-16.
- Umbral aplicado sin recalibrar: `0.807566308073`.
- Embeddings: `intfloat/multilingual-e5-base`.
- Procedencia de las preguntas: conjunto nuevo preparado y versionado por Diery en `67e09e3`. Las preguntas válidas se contrastan con páginas de `produccion_cuyes.pdf` (SENA / Centro Internacional de Producción Limpia – Lope, 2018, ISBN 978-958-15-0336-0); las páginas esperadas son referencias de recuperación, no una calificación de la respuesta. Las preguntas fuera de corpus y en dominio sin respuesta son sondas de abstención, no citas del manual. No consta revisión zootécnica independiente.

## Procedencia por pregunta

| ID | Tipo | Redactor | Fecha (redaccion) | Fuente | Verificador | Fecha (verificacion) | Usada para calibrar umbral |
|---|---|---|---|---|---|---|---|
| A1 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 15) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A2 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 18, 19, 69) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A3 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 71) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A4 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 27) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A5 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 79, 80) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A6 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 39, 40) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A7 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 43) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A8 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 20, 32) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A9 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 71, 72) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| A10 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 51) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B1 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 71, 85) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B2 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 32) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B3 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 31) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B4 | en_dominio_sin_respuesta | Diery | POR COMPLETAR (Diery) | dominio cuy; sin respuesta en el manual (sonda de abstencion) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B5 | en_dominio_sin_respuesta | Diery | POR COMPLETAR (Diery) | dominio cuy; sin respuesta en el manual (sonda de abstencion) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B6 | en_dominio_sin_respuesta | Diery | POR COMPLETAR (Diery) | dominio cuy; sin respuesta en el manual (sonda de abstencion) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B7 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 31, 32, 33) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B8 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 28) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B9 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 85) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| B10 | valida | Diery | POR COMPLETAR (Diery) | produccion_cuyes.pdf (p. 12, 85) | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| AF1 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| AF2 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| AF3 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| AF4 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| AF5 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| BF1 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| BF2 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| BF3 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| BF4 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |
| BF5 | fuera_de_corpus | Diery | POR COMPLETAR (Diery) | sonda de abstencion; no del manual | POR COMPLETAR (Diery) | POR COMPLETAR (Diery) | No |

## Métricas por grupo

- Válidas (n=17): hit@1=0.8235; hit@3=0.8824; hit@5=0.9412; MRR=0.8578; abstención=0/17 (0.0000).
- Fuera de corpus (n=10): abstención=7/10 (0.7000).
- En dominio sin respuesta (n=3): abstención=0/3 (0.0000).

## Resultado por pregunta (sin texto de preguntas ni fragmentos)

| Grupo | N.º | Página(s) esperada(s) | Posición | Similitud esperada | Primera página | Similitud primera | Abstención |
|---|---|---:|---:|---:|---:|---:|---|
| válidas | A1 | 15 | 1 | 0.867443 | 15 | 0.867443 | no |
| válidas | A2 | 18, 19, 69 | 1 | 0.867268 | 19 | 0.867268 | no |
| válidas | A3 | 71 | 4 | 0.836153 | 26 | 0.848557 | no |
| válidas | A4 | 27 | 1 | 0.883467 | 27 | 0.883467 | no |
| válidas | A5 | 79, 80 | 1 | 0.851487 | 79 | 0.851487 | no |
| válidas | A6 | 39, 40 | 1 | 0.872771 | 39 | 0.872771 | no |
| válidas | A7 | 43 | 1 | 0.872443 | 43 | 0.872443 | no |
| válidas | A8 | 20, 32 | 1 | 0.872031 | 20 | 0.872031 | no |
| válidas | A9 | 71, 72 | 1 | 0.856755 | 71 | 0.856755 | no |
| válidas | A10 | 51 | 1 | 0.884515 | 51 | 0.884515 | no |
| válidas | B1 | 71, 85 | 1 | 0.826535 | 85 | 0.826535 | no |
| válidas | B2 | 32 | 3 | 0.848624 | 31 | 0.854666 | no |
| válidas | B3 | 31 | 1 | 0.858475 | 31 | 0.858475 | no |
| válidas | B7 | 31, 32, 33 | 1 | 0.843977 | 32 | 0.843977 | no |
| válidas | B8 | 28 | 1 | 0.868794 | 28 | 0.868794 | no |
| válidas | B9 | 85 | — | — | 28 | 0.836597 | no |
| válidas | B10 | 12, 85 | 1 | 0.837886 | 12 | 0.837886 | no |
| fuera_de_corpus | AF1 | — | — | — | 75 | 0.816929 | no |
| fuera_de_corpus | AF2 | — | — | — | 85 | 0.821882 | no |
| fuera_de_corpus | AF3 | — | — | — | — | — | sí |
| fuera_de_corpus | AF4 | — | — | — | 29 | 0.840959 | no |
| fuera_de_corpus | AF5 | — | — | — | — | — | sí |
| fuera_de_corpus | BF1 | — | — | — | — | — | sí |
| fuera_de_corpus | BF2 | — | — | — | — | — | sí |
| fuera_de_corpus | BF3 | — | — | — | — | — | sí |
| fuera_de_corpus | BF4 | — | — | — | — | — | sí |
| fuera_de_corpus | BF5 | — | — | — | — | — | sí |
| en_dominio_sin_respuesta | B4 | — | — | — | 85 | 0.846679 | no |
| en_dominio_sin_respuesta | B5 | — | — | — | 28 | 0.836011 | no |
| en_dominio_sin_respuesta | B6 | — | — | — | 28 | 0.843171 | no |

## Desviaciones observadas

- Válidas con abstención: ninguna.
- Válidas sin página esperada entre los resultados: B9 (esperada: 85; primera: página 28, similitud 0.836597).
- Fuera de corpus con resultados: AF1, AF2, AF4.
- En dominio sin respuesta con resultados: B4, B5, B6.

## Discrepancia RAG / ruta del backend

`rag/src/retrieve.py` usa `E5Embedder` (`rag/src/embed.py`) con los prefijos `query: `/`passage: `, el modelo por defecto `intfloat/multilingual-e5-base` y el umbral `DEFAULT_MIN_SIMILARITY = 0.807566308073`; `rag/eval/evaluate_validation.py` usa el mismo embedder y el mismo umbral por defecto (vía `RAG_MIN_SIMILARITY`). La ruta del backend (`backend/app/services/ml.py::_real_consultar`) delega en `rag.src.retrieve.consultar` sin pasar embedder ni umbral, por lo que depende de `RAG_EMBEDDING_MODEL` y `RAG_MIN_SIMILARITY` del entorno: si esas variables difieren de las usadas en la evaluación, la consulta en producción puede usar modelo o umbral distintos aunque el código compartido sea idéntico. No se detectó discrepancia en el código fuente revisado; la posible discrepancia es de configuración de entorno.

## Limitaciones

- Conjunto pequeño.
- El umbral fue calibrado previamente con otro conjunto y no se recalibró aquí.
