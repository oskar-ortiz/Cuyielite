# Evaluación de la selección extractiva genérica

## Alcance

Esta entrega concluye la selección del extracto mostrado, con resultados antes/después, sin modificar la recuperación. Queda concluida esta repetición local de la evaluación de extracción y recuperación. No se concluye la pertinencia global del asistente: este cambio no valida al asistente en general ni resuelve todas las consultas.

Antecedentes verificados localmente: PR #186 (`e3a2ad1a686ca0162885adf5cc2edea5b1b9666d`, MERGED) y PR #188 (`9123c63633d179f8e91b6f7459e8040caafd28b7`, MERGED). La discrepancia histórica de índices queda como antecedente, no como problema abierto.

No se cambiaron el corpus, el modelo `intfloat/multilingual-e5-base`, el umbral `0.807566308073`, `top_k=5`, los YAML de preguntas, `backend/`, las migraciones, la matriz ni los cuatro documentos Lope aprobados. No se escribió en bases persistentes; la medición usó el mismo corpus en memoria y el mismo `evaluate_validation` con `retrieve_fn`, sin reindexar en almacenamiento persistente.

## Criterio implementado

`rag/src/select.py` splita cada fragmento ya recuperado en oraciones literales, tokeniza con normalización unicode y sin stopwords, calcula IDF sobre las oraciones de los fragmentos recuperados y puntúa cada oración por solapamiento léxico normalizado con la pregunta. Se conservan las dos oraciones mejor puntuadas, en el orden original de recuperación; cada una conserva la cita de su fragmento. No hay reglas por tema ni texto generado. La abstención sigue en `rag/src/generate.py` y `rag/src/retrieve.py`.

## evaluate_validation antes y después

Mismo arnés, `top_k=5`, umbral sin recalibrar. `evaluate_validation` no consume el generador, por lo que la selección no puede alterar estas cifras.

| Medición | hit@1 | hit@3 | hit@5 | MRR | Abstención válidas | Fuera de corpus | En dominio sin respuesta |
|---|---:|---:|---:|---:|---:|---:|---:|
| Antes | 0.8235 | 0.8824 | 0.9412 | 0.8676 | 0/17 | 7/10 | 0/3 |
| Después | 0.8235 | 0.8824 | 0.9412 | 0.8676 | 0/17 | 7/10 | 0/3 |

No hay regresión en recuperación ni en abstención.

## Tres casos del handoff

Las citas son páginas físicas del PDF (impresa + 1).

### 1. Gestación, variante Android

Pregunta exacta (`docs/verificaciones/android-rag-recorrido-observado.md`): `Cuál es la duración de la gestación de los cuyes?`

- Páginas físicas recuperadas: 28, 25, 26, 85, 80.
- Antes: el extracto comenzaba con `de aluminio galvanizado flexible, de calibre 40…` (p. 28) y seguía con el resto de fragmentos; la frase verificada no encabezaba la respuesta.
- Después: `Gestación y parto La gestación dura entre 63 y 70 días.` [produccion_cuyes.pdf, p. 26]; segunda frase: `Producción sostenible de cuyes.` [produccion_cuyes.pdf, p. 85].
- La frase de referencia de la p. 26 física (impresa 25) ahora sí aparece, sin forzar ninguna otra cifra.

### 2. Gestación, variante HTTP

Pregunta exacta (`docs/integracion/handoff-diery-pertinencia-rag.md`): `¿Cuál es la duración de la gestación de los cuyes?`

- Páginas físicas recuperadas: 28, 85, 26, 25, 80.
- Antes: el mismo inicio sobre placas de identificación (p. 28).
- Después: `Producción sostenible de cuyes.` [p. 85] y `Gestación y parto La gestación dura entre 63 y 70 días.` [p. 26]. El orden de las dos frases sigue el orden de recuperación; la frase pertinente está incluida.

### 3. Vitamina C

Pregunta exacta: `¿Por qué los cuyes necesitan vitamina C en su alimentación?`

- Páginas físicas recuperadas: 31, 28, 85, 32, 12.
- Antes: el extracto comenzaba con `A O S CONSTRUYENDO PAZ El cuy es un animal herbívoro monogástrico…` (p. 31) y no mostraba la fila de vitamina C.
- Después: `Alimentación alternativa en la producción de cuyes.` [p. 85] y el renglón `… Vitamina C 200 200 200 …` [p. 32].
- El manual sí da el requerimiento en la p. 32 física (impresa 31) y la suplementación en la p. 42 física (impresa 41), pero no explica el porqué fisiológico. Esa limitación persiste: no se construyó una explicación sin respaldo.

### 4. Control, impresora Wi-Fi

Pregunta exacta: `¿Cómo configuro una impresora Wi-Fi?`

- Antes: abstención `No encontré esta información en los manuales.`, sin fuentes.
- Después: la misma abstención, sin fuentes. No hay regresión.

## Heurística sobre las 17 preguntas válidas

Heurística, no calificación zootécnica: «el extracto proviene de una página citada» significa que al menos una de las dos frases seleccionadas salió de una página presente en el top 5. Todas las frases salen de fragmentos recuperados; 15/17 casos incluyen además una página esperada.

| ID | Esperadas | Citadas | Seleccionadas | ¿Esperada en selección? | Caracteres |
|---|---|---|---|---|---:|
| A1 | 15 | 15, 16, 18, 70, 21 | 15, 18 | sí | 747 |
| A2 | 18, 19, 69 | 19, 16, 69, 15, 48 | 19, 48 | sí | 208 |
| A3 | 71 | 26, 28, 70, 71, 25 | 70, 71 | sí | 252 |
| A4 | 27 | 27, 28, 29, 25, 80 | 27, 28 | sí | 395 |
| A5 | 79, 80 | 79, 80, 29, 26, 15 | 79, 80 | sí | 228 |
| A6 | 39, 40 | 39, 28, 80, 25, 32 | 39, 80 | sí | 329 |
| A7 | 43 | 43, 44, 45, 42, 34 | 34, 43 | sí | 574 |
| A8 | 20, 32 | 20, 74, 32, 83, 40 | 32, 83 | sí | 412 |
| A9 | 71, 72 | 71, 72, 73, 74 | 71, 72 | sí | 553 |
| A10 | 51 | 51, 49, 85, 39, 70 | 49, 51 | sí | 244 |
| B1 | 71, 85 | 85, 12, 28 | 12, 85 | sí | 394 |
| B2 | 32 | 31, 32, 28, 85, 12 | 32, 85 | sí | 447 |
| B3 | 31 | 31, 85, 33, 12, 28 | 31, 85 | sí | 384 |
| B7 | 31, 32, 33 | 32, 28, 80, 31, 70 | 31, 32 | sí | 656 |
| B8 | 28 | 28, 12, 80, 85, 70 | 70, 80 | no | 205 |
| B9 | 85 | 28, 12 | 12, 28 | no | 384 |
| B10 | 12, 85 | 12, 85, 28 | 12, 85 | sí | 220 |

## Regresiones y límites explícitos

- B8: la p. 28 esperada sí se recuperó, pero el criterio léxico prefirió frases de las pp. 70 y 80. Es una desviación de la heurística, no una pérdida de recuperación.
- B9: la p. 85 esperada no aparece en el top 5; la selección no puede compensar una omisión de recuperación.
- Vitamina C: la p. 42 no aparece en el top 5 y el manual no explica el porqué; la limitación documentada permanece.
- La selección acorta el extracto y prioriza frases literales, pero no añade evidencia nueva ni valida respuestas.
