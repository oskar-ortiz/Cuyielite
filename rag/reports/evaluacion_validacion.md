# Evaluación RAG — conjunto de validación

- Fecha: 2026-11-16.
- Umbral aplicado sin recalibrar: `0.807566308073`.
- Embeddings: `intfloat/multilingual-e5-base`.
- Procedencia de las preguntas: [completar por Diery]

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

## Limitaciones

- Conjunto pequeño.
- El umbral fue calibrado previamente con otro conjunto y no se recalibró aquí.
