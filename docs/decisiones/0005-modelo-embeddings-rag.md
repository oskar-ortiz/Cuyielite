# ADR 0005: Modelo de embeddings y generación del RAG

- Estado: ACEPTADA aprobada por ambos;
- Fecha: 2026-11-08

## Contexto

El motor RAG debe recuperar fragmentos del corpus zootécnico del SENA en español,
con búsqueda coseno y citas por documento y página. El contrato de consulta
devuelve `respuesta` y `fuentes`; el uso del corpus es exclusivamente para
indexación interna y consulta del propio sistema.

## Decisión

- Usar `intfloat/multilingual-e5-base` local mediante `sentence-transformers`,
  con embeddings de 768 dimensiones. Las consultas se prefijan con `query: ` y
  los fragmentos del corpus con `passage: `.
- Si `base` resulta demasiado lento, `intfloat/multilingual-e5-small` (384
  dimensiones) es la alternativa a evaluar. No es intercambiable con el esquema
  de 768 dimensiones: adoptarlo requiere una decisión y migración de esquema
  compatibles antes de indexar.
- La generación predeterminada es extractiva y no invoca un LLM: la respuesta
  presenta los fragmentos recuperados junto con sus citas. El generador se
  inyecta mediante una interfaz pequeña para permitir conectar uno en el futuro.
- `embeddings_sena.embedding` usa `VECTOR(768)` y un índice HNSW con distancia
  coseno. La indexación es idempotente mediante SHA-256 del fragmento y sus
  metadatos de origen.

## Consecuencias

- El modelo se descarga en la máquina local; el corpus, los embeddings, las
  cachés y los pesos no se versionan.
- Cualquier cambio de modelo o dimensión debe mantener sincronizados el
  esquema, la migración y el pipeline, y validarse antes de indexar.
- El informe de evaluación contiene métricas agregadas; Diery debe revisar las
  preguntas y páginas esperadas antes de usarlo como evidencia.
