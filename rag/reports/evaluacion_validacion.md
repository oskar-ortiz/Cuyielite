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

## Medición final de ligaduras y ranking

- Fecha: 2026-11-18.
- Modelo: `intfloat/multilingual-e5-base`; `top_k=5`.
- Umbral: `0.807566308073`, calibrado con el texto previo y mantenido sin recalibrar.
- Se midió una sola vez al final sobre los mismos 76 fragmentos reconstruidos en memoria; no se consultó ni escribió en PostgreSQL.
- Antes significa extracción previa a la normalización; después, el extractor del commit `09d7e248aac42287ab9d2021b04445719b7596a3`.

| Condición | hit@1 | hit@3 | hit@5 | MRR | Abstención fuera de corpus | Abstención en dominio sin respuesta |
|---|---:|---:|---:|---:|---:|---:|
| Antes de normalizar | 0.8235 | 0.8824 | 0.9412 | 0.8578 | 7/10 | 0/3 |
| Después de normalizar | 0.8235 | 0.8824 | 0.9412 | 0.8676 | 7/10 | 0/3 |

Cambió la decisión de abstención en 0 de las 13 sondas (10 fuera de corpus y 3
en dominio sin respuesta). La métrica de ranking que mejoró fue MRR; el umbral
y las etiquetas no cambiaron.

### Selección previa en calibración y desarrollo

Las alternativas se compararon solo con `rag/eval/preguntas.yaml` (20 válidas
y 5 fuera de corpus) y el conjunto de desarrollo de dos consultas piloto, todas
con `top_k=5` y el mismo umbral. Las páginas probables del piloto siguen
**pendientes de verificar por Diery**: gestación, 26/32/71; vitamina C, 32/42.

| Conjunto y condición | hit@1 | hit@3 | hit@5 | MRR | Abstención fuera de corpus |
|---|---:|---:|---:|---:|---:|
| Calibración, texto previo | 0.7500 | 0.9500 | 0.9500 | 0.8333 | 5/5 |
| Calibración, ligaduras normalizadas | 0.8500 | 0.9500 | 0.9500 | 0.8917 | 5/5 |
| Piloto, texto previo | 0.0000 | 0.5000 | 0.5000 | 0.2500 | — |
| Piloto, ligaduras normalizadas | 0.5000 | 0.5000 | 0.5000 | 0.5000 | — |

Una única variante adicional, fusión RRF de BM25 y ranking semántico con
constante 60 y compuerta del mismo umbral, se probó solo en esos dos conjuntos.
Con ligaduras normalizadas dio hit@1=0.7500, hit@3=0.9500, hit@5=0.9500 y
MRR=0.8333 en calibración (abstención 5/5); en piloto dio
0.5000/0.5000/0.5000 y MRR=0.5000. Se **descartó**: empeoró la calibración y no
mejoró el piloto; no se midió en validación ni se incorporó al recuperador.

En la reconstrucción local actual, las páginas devueltas para las consultas de
desarrollo después de normalizar fueron gestación: 68; vitamina C: 42, 75, 71,
76, 83. Estos resultados no sustituyen las páginas probables pendientes de
verificación ni las salidas Android registradas anteriormente; no se ajustó el
umbral a partir de ellos.

La pregunta válida cuya página esperada es 85 (B9) permanece sin cambios; esa
página es bibliografía y su etiqueta queda pendiente de revisión manual por
Diery. No se editaron las etiquetas ni las páginas esperadas del conjunto de
validación.

## Comprobación final con consultas completas de Android

- Fecha: 2026-11-18.
- Modelo: `intfloat/multilingual-e5-base`; umbral: `0.807566308073`; `top_k=5`.
- Consultas exactas tomadas de `docs/integracion/handoff-diery-pertinencia-rag.md`.
- El texto de los 76 fragmentos no cambió respecto de la regeneración anterior
  (`fragments.json` SHA-256 `bd1acac99bbd6c4af588d847ca9abe3c6c2b2aa51dfa9d960994f897b21b680f`);
  por eso no se re-midió la validación de 17/10/3. Se informa la abstención sobre
  estas consultas.
- Antes significa extracción previa a la normalización; después, el extractor
  acotado de esta rama. Ambas corridas se hicieron en memoria, sin PostgreSQL.

| Consulta exacta | Páginas esperadas (probables, pendientes de verificar por Diery) | Antes: páginas devueltas (similitud) | Después: páginas devueltas (similitud) | Esperadas en top 5 |
|---|---|---|---|---|
| `¿Cuál es la duración de la gestación de los cuyes?` | 26 (probables 32, 71) | 28 (0.882710), 85 (0.839569), 26 (0.837789), 80 (0.834542), 25 (0.831932) | 28 (0.882710), 85 (0.839569), 26 (0.837789), 80 (0.834542), 25 (0.831932) | 26 sí; 32 y 71 no |
| `¿Por qué los cuyes necesitan vitamina C en su alimentación?` | 32, 42 | 31 (0.857437), 28 (0.853332), 85 (0.848907), 32 (0.848079), 12 (0.843784) | 31 (0.857437), 28 (0.853332), 85 (0.848907), 32 (0.848079), 12 (0.843784) | 32 sí; 42 no |
| `¿Cómo configuro una impresora Wi-Fi?` | ninguna (fuera de corpus) | 15 (0.781993), 17 (0.781667), 52 (0.773322), 50 (0.772398), 16 (0.772029) | 15 (0.781993), 17 (0.781667), 52 (0.773322), 50 (0.772398), 16 (0.772029) | abstención: todas por debajo del umbral |

- Abstención: la consulta Wi-Fi no devuelve resultados por encima del umbral.
  Las dos consultas en dominio no se abstienen, pero sus páginas esperadas no
  encabezan el top 5 (26 y 32 aparecen, 42 y 71 no).
- La ligadura se acepta como mejora de extracción. La pertinencia que sigue
  fallando queda pendiente.

## Repetición local con las variantes literales de Android y HTTP

- Fecha: 2026-11-18.
- Modelo: `intfloat/multilingual-e5-base`; `top_k=5`; umbral sin cambios:
  `0.807566308073`.
- PDF: SHA-256
  `c33392cb1422bfe50b0f44ccfcc2917888b4aa9b0329830d2b13db3a289a91ea`.
- Se regeneró localmente el índice en memoria: 76 fragmentos, cuyo SHA-256
  volvió a ser `bd1acac99bbd6c4af588d847ca9abe3c6c2b2aa51dfa9d960994f897b21b680f`.
  Los embeddings regenerados tienen SHA-256
  `d5fef42582abbe015cf3bc1a1781aba68a773b7e5ed69e207c61a2806bad44a4`.
- «Antes» reconstruye los fragmentos con el extractor previo a la normalización
  (`9cd9d00`); «después» usa el extractor actual y los embeddings regenerados.
  Ambas mediciones son locales y en memoria, sin PostgreSQL.
- Como el texto y el hash de los fragmentos no cambiaron, no se repitió la
  evaluación de validación 17/10/3.

### Consultas y resultados

Las preguntas se conservaron literalmente. Cada resultado muestra página y
similitud coseno, en el orden de recuperación; en Wi-Fi no hubo páginas
devueltas porque las puntuaciones quedaron debajo del umbral.

| Pregunta exacta | Antes: texto sin normalizar | Después: extractor actual |
|---|---|---|
| Android, gestación: `Cuál es la duración de la gestación de los cuyes?` | p. 28 (0.882193), p. 80 (0.833646), p. 85 (0.833463), p. 26 (0.832882), p. 12 (0.828432) | p. 28 (0.884517), p. 25 (0.833045), p. 26 (0.832882), p. 85 (0.832491), p. 80 (0.831892) |
| HTTP, gestación: `¿Cuál es la duración de la gestación de los cuyes?` | p. 28 (0.882710), p. 85 (0.839569), p. 26 (0.837789), p. 80 (0.834542), p. 25 (0.831932) | p. 28 (0.885213), p. 85 (0.838537), p. 26 (0.837789), p. 25 (0.837672), p. 80 (0.832791) |
| Vitamina C: `¿Por qué los cuyes necesitan vitamina C en su alimentación?` | p. 31 (0.857437), p. 28 (0.853332), p. 85 (0.848907), p. 32 (0.848079), p. 12 (0.843784) | p. 31 (0.856362), p. 28 (0.854396), p. 85 (0.849156), p. 32 (0.846605), p. 12 (0.841044) |
| Control: `¿Cómo configuro una impresora Wi-Fi?` | Ninguna: abstención. Los cinco más cercanos, todos bajo el umbral: p. 15 (0.781993), p. 17 (0.781667), p. 52 (0.773322), p. 50 (0.772398), p. 16 (0.772029). | Ninguna: abstención. Los cinco más cercanos, todos bajo el umbral: p. 17 (0.781667), p. 15 (0.780958), p. 52 (0.773322), p. 50 (0.772398), p. 27 (0.771830). |

La pregunta Android de gestación omite el signo inicial `¿`; se comparó
explícitamente con la variante HTTP que sí lo contiene. En el índice local,
antes las listas difieren tanto en orden como en páginas. Después comparten las
mismas cinco páginas, pero el orden sigue siendo diferente: Android
`28, 25, 26, 85, 80`; HTTP `28, 85, 26, 25, 80`.

El handoff registra para la reproducción **HTTP** las páginas de gestación
`28, 85, 26, 80, 25` y de vitamina C `31, 28, 85, 32, 12`. No registra
puntuaciones para esas listas. La lista local HTTP de gestación coincide en
orden antes de normalizar y difiere después (p. 25 y p. 80 intercambian
posición); vitamina C conserva el mismo orden del handoff antes y después.
La diferencia de orden de gestación después de normalizar puede deberse a una
diferencia entre el índice local en memoria y el índice del piloto; no se
atribuye a una causa confirmada ni se fuerza un ajuste.

La captura Android solo mostró citas a las páginas 28 y 80 para gestación y a
la página 32 para vitamina C. No hay puntuaciones recuperables de la app; la
lista HTTP del handoff no se atribuye a esa pantalla.

### Páginas de referencia indicadas por Diery

Las páginas y la revisión siguientes se marcan como **verificadas por Diery**,
según la información aportada para esta comprobación. Se informan como
referencias y no se calcula hit@k con ellas.

- **Gestación — p. 25, 26, 31 y 70. Veredicto: responde.** Frase indicada:
  «La gestación dura entre 63 y 70 días. Se recomienda que este grupo de
  animales no se manipulen y permanezcan en un ambiente tranquilo hasta el
  momento del parto.»
- **Vitamina C — p. 41 y 31. Veredicto: parcial** (da requerimiento, no
  explica el porqué). En la evidencia indicada por Diery, el libro **no**
  explica la razón fisiológica; aporta el requerimiento y la suplementación:
  «El concentrado es una mezcla de materias primas altamente ricas en
  nutrientes, que pueden administrarse como fuente única de la ración (en el
  que se deberá proporcionar agua y vitaminas adicionales, ricas en vitamina
  C) o como complemento (cuando se mezcla con forraje), los cuales cubren los
  requerimientos nutricionales, dependiendo de cada especie, edad, estado
  productivo y tipo de explotación a que se destina el animal.»

La ligadura se acepta como mejora de extracción. La pertinencia que siga
fallando queda pendiente.
