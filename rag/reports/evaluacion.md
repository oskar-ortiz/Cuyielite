# Evaluación de recuperación RAG

- Preguntas válidas evaluadas: 20
- Preguntas fuera de corpus: 5; usadas solo para calibrar abstención.
- Se excluyeron del corpus las páginas PDF 1–11 (portada, licencia, créditos, índice y agradecimientos).
- Relevancia: coincidencia entre páginas recuperadas y páginas esperadas.

| Métrica | Léxico (BM25) | Embeddings |
|---|---:|---:|
| hit@1 | 0.4000 | 0.8000 |
| hit@3 | 0.6500 | 0.9500 |
| hit@5 | 0.8000 | 0.9500 |
| MRR | 0.5517 | 0.8667 |

- Modelo de embeddings: `intfloat/multilingual-e5-base`.
- BM25: tokenización léxica en español, sin embeddings ni stemming.
- Umbral semántico calibrado: `0.807566308073`; se eligió maximizando la exactitud balanceada entre recuperar páginas esperadas en preguntas válidas y abstenerse en preguntas fuera de corpus (desempate: más aciertos válidos, más abstenciones y luego mayor umbral).
- Abstención fuera de corpus: 5/5.
- Preguntas válidas perdidas por el umbral: 0/20 (página esperada presente antes del umbral y ausente después).
- Exactitud balanceada de calibración: 1.0000.
- Limitaciones: corpus de un solo manual; muestra pequeña y umbral calibrado con las mismas preguntas reportadas. Diery debe revisar las preguntas y páginas esperadas.
