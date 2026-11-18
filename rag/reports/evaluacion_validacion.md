# Evaluación RAG — conjunto de validación

- Fecha: 2026-11-16.
- Umbral aplicado sin recalibrar: `0.807566308073`.
- Embeddings: `intfloat/multilingual-e5-base`.
- Procedencia de las preguntas: conjunto nuevo preparado y versionado por Diery en `67e09e3`. Las preguntas válidas se contrastan con páginas de `produccion_cuyes.pdf` (SENA / Centro Internacional de Producción Limpia – Lope, 2018, ISBN 978-958-15-0336-0); las páginas esperadas son referencias de recuperación, no una calificación de la respuesta. Las preguntas fuera de corpus y en dominio sin respuesta son sondas de abstención, no citas del manual. No consta revisión zootécnica independiente.

## Procedencia por pregunta

| ID | Tipo | Redactor | Fecha (redaccion) | Fuente | Verificador | Fecha (verificacion) | Usada para calibrar umbral |
|---|---|---|---|---|---|---|---|
| A1 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 15) | Diery| 2026-11-17 | No |
| A2 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 18, 19, 69) | Diery | 2026-11-17 | No |
| A3 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 71) | Diery | 2026-11-17 | No |
| A4 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 27) | Diery | 2026-11-17 | No |
| A5 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 79, 80) | Diery | 2026-11-17 | No |
| A6 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 39, 40) | Diery | 2026-11-17 | No |
| A7 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 43) | Diery | 2026-11-17 | No |
| A8 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 20, 32) | Diery | 2026-11-17 | No |
| A9 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 71, 72) | Diery | 2026-11-17 | No |
| A10 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 51) | Diery | 2026-11-17 | No |
| B1 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 71, 85) | Diery | 2026-11-17 | No |
| B2 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 32) | Diery | 2026-11-17 | No |
| B3 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 31) | Diery | 2026-11-17 | No |
| B4 | en_dominio_sin_respuesta | Diery | 2026-11-16 | dominio cuy; sin respuesta en el manual (sonda de abstencion) | Diery | 2026-11-17 | No |
| B5 | en_dominio_sin_respuesta | Diery | 2026-11-16 | dominio cuy; sin respuesta en el manual (sonda de abstencion) | Diery | 2026-11-17 | No |
| B6 | en_dominio_sin_respuesta | Diery | 2026-11-16 | dominio cuy; sin respuesta en el manual (sonda de abstencion) | Diery | 2026-11-17 | No |
| B7 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 31, 32, 33) | Diery | 2026-11-17 | No |
| B8 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 28) | Diery | 2026-11-17 | No |
| B9 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 85) | Diery | 2026-11-17 | No |
| B10 | valida | Diery | 2026-11-16 | produccion_cuyes.pdf (p. 12, 85) | Diery | 2026-11-17 | No |
| AF1 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| AF2 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| AF3 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| AF4 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| AF5 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| BF1 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| BF2 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| BF3 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| BF4 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |
| BF5 | fuera_de_corpus | Diery | 2026-11-16 | sonda de abstencion; no del manual | Diery | 2026-11-17 | No |

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
## Medición con la configuración de la app

- Fecha: 2026-11-18.
- Modelo: `intfloat/multilingual-e5-base`.
- Umbral aplicado sin recalibrar: `0.807566308073`.
- Configuración principal: `top_k=5`; diagnóstico adicional: `top_k=3, 10, 20`.
- Diferencia con la evaluación previa: la app usa `top_k=5` por defecto (selector 3/5/10; el backend admite hasta 20), mientras que la evaluación anterior usó `top_k=20`. `top_k` cuenta fragmentos; las citas se deduplican por página como en `rag/src/retrieve.py:101-103` y las métricas se calculan sobre páginas únicas.
- Oskar confirmó la configuración actual del código, no el entorno de la corrida original del piloto.
- No hay generación de respuestas; la abstención se mide igual que antes.
- Las cifras de las secciones anteriores no se modificaron.

### Métricas de recuperación

| Medición | hit@1 | hit@3 | hit@5 | MRR |
|---|---:|---:|---:|---:|
| top_k=5 (principal) | 0.8235 | 0.8824 | 0.9412 | 0.8578 |
| top_k=3 (diagnóstico) | 0.8235 | 0.8824 | 0.8824 | 0.8431 |
| top_k=10 (diagnóstico) | 0.8235 | 0.8824 | 0.9412 | 0.8578 |
| top_k=20 (diagnóstico) | 0.8235 | 0.8824 | 0.9412 | 0.8578 |

- Comparación de cortes: `top_k=20` → hit@1=0.8235, hit@3=0.8824, hit@5=0.9412, MRR=0.8578; `top_k=5` → hit@1=0.8235, hit@3=0.8824, hit@5=0.9412, MRR=0.8578. Las cifras de `top_k=20` coinciden con la evaluación previa.

- Abstención principal (`top_k=5`): válidas=0/17; fuera_de_corpus=7/10; en_dominio_sin_respuesta=0/3.

### Preguntas válidas con `top_k=5`

| ID | Páginas esperadas | Posición | Similitud | ¿Página en 5? | Cobertura de términos | ¿Todos? |
|---|---:|---:|---:|---|---:|---|
| A1 | 15 | 1 | 0.867443 | sí | 1.00 | sí |
| A2 | 18, 19, 69 | 1 | 0.867268 | sí | 0.50 | no |
| A3 | 71 | 4 | 0.836153 | sí | 1.00 | sí |
| A4 | 27 | 1 | 0.883467 | sí | 1.00 | sí |
| A5 | 79, 80 | 1 | 0.851487 | sí | 0.50 | no |
| A6 | 39, 40 | 1 | 0.872771 | sí | 0.50 | no |
| A7 | 43 | 1 | 0.872443 | sí | 1.00 | sí |
| A8 | 20, 32 | 1 | 0.872031 | sí | 0.50 | no |
| A9 | 71, 72 | 1 | 0.856755 | sí | 0.50 | no |
| A10 | 51 | 1 | 0.884515 | sí | 1.00 | sí |
| B1 | 71, 85 | 1 | 0.826535 | sí | 0.67 | no |
| B2 | 32 | 3 | 0.848624 | sí | 1.00 | sí |
| B3 | 31 | 1 | 0.858475 | sí | 0.00 | no |
| B7 | 31, 32, 33 | 1 | 0.843977 | sí | 1.00 | sí |
| B8 | 28 | 1 | 0.868794 | sí | 1.00 | sí |
| B9 | 85 | — | — | no | 0.00 | no |
| B10 | 12, 85 | 1 | 0.837886 | sí | 0.00 | no |

- Preguntas con la página correcta fuera de las 5 citas: B9.
- La cobertura de términos es una heurística de solapamiento léxico con términos clave definidos manualmente para cada pregunta; no es una validación semántica de la respuesta ni una revisión experta.

### Consultas Android con `top_k=5`

| Consulta | Páginas devueltas (similitud) |
|---|---|
| `gestación` | 65 (0.843255); 67 (0.836926); 17 (0.835437); 66 (0.832289); 16 (0.830511) |
| `vitamina C` | 71 (0.821071); 42 (0.819587); 75 (0.818508); 76 (0.816332); 84 (0.815263) |

- `gestación` y `vitamina C` se miden sin respuesta esperada verificada: solo se registran páginas y puntuaciones, sin comparar ni declarar acierto.

### Limitaciones de esta medición

- Conjunto pequeño y sin revisión zootécnica independiente.
- La heurística de términos puede marcar una cita correcta como incompleta si el fragmento no repite todos los términos de la pregunta.
- Entorno: el índice PostgreSQL no estaba accesible en este entorno; se reconstruyó el mismo corpus con extract_pages + chunk_pages (76 fragmentos) y se ejecutó la misma recuperación en memoria, sin reindexar.
