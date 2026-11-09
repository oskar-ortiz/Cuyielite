# Pipeline RAG local

Pipeline de indexación y consulta interna del manual del SENA. Las respuestas
son extractivas y presentan citas `Documento, p. N`; no se implementa ni se
invoca un LLM. `consultar(pregunta, top_k)` entrega `respuesta` y `fuentes`,
compatibles con `AssistantQueryResponse`.

## Preparación

Desde la raíz del repositorio, crea un entorno dentro de `rag/` e instala solo
las dependencias de este pipeline:

```powershell
py -m venv rag\.venv
rag\.venv\Scripts\python -m pip install -r rag\requirements.txt
```

El PDF se lee directamente desde `db/raw_Lope/produccion_cuyes.pdf`; no se copia
a `rag/` ni se versiona. Configura `RAG_DATABASE_URL` para una base PostgreSQL
central con la extensión pgvector y el esquema actualizado. No uses la base
`cuyielite` para pruebas. El pipeline no crea el esquema: aplica primero DDL y
migraciones con la herramienta del proyecto a la base elegida.

## Indexación y consulta

```powershell
rag\.venv\Scripts\python -m rag.ask index
rag\.venv\Scripts\python -m rag.ask ask "¿Qué prácticas recomienda el manual?" --top-k 5
```

El modelo predeterminado es `intfloat/multilingual-e5-base`, descargado bajo
`rag/.cache/`. Para evaluar velocidad, `RAG_EMBEDDING_MODEL` permite seleccionar
otro nombre; el pipeline valida que produzca 768 dimensiones. `multilingual-e5-small`
produce 384 y requiere una decisión/migración de esquema antes de poder usarse.
Las consultas llevan `query: ` y los pasajes `passage: `. El umbral semántico
predeterminado es `0.807566308073`, calibrado con las 20 preguntas válidas y 5 fuera de
corpus de `eval/preguntas.yaml`; `RAG_MIN_SIMILARITY` permite ajustarlo para
evaluación controlada.

Para este PDF se excluyen las páginas PDF 1–11, que contienen portada, licencia,
créditos, índice y agradecimientos. La numeración conservada en las citas es la
del PDF.

La respuesta se genera mediante `ExtractiveGenerator`, inyectable por la
interfaz `AnswerGenerator`; una implementación futura de LLM puede conectarse
sin cambiar la recuperación ni el contrato. No se conecta un LLM en este
pipeline.

## Evaluación y pruebas

`rag/eval/preguntas.yaml` contiene preguntas y páginas esperadas. Revisa las
preguntas y sus páginas antes de interpretar el informe. Para calcular métricas,
indexa el corpus y ejecuta:

```powershell
rag\.venv\Scripts\python -m rag.ask evaluate
```

El informe guarda solo acierto@1, acierto@3, acierto@5 y MRR agregados en
`rag/reports/evaluacion.md`.

La línea base léxica no requiere PostgreSQL ni modelos:

```powershell
rag\.venv\Scripts\python -m rag.eval.evaluate --mode lexical
```

Para calcular el informe comparativo cuando los embeddings estén disponibles,
ejecuta `rag\.venv\Scripts\python -m rag.eval.evaluate --mode all`.

```powershell
rag\.venv\Scripts\python -m pytest -m "not db"
```

La prueba de idempotencia está marcada `db` y requiere `RAG_TEST_DATABASE_URL`
que apunte a una base temporal cuyo nombre incluya `rag_test`, con pgvector
instalado. Nunca la apuntes a la base de desarrollo o producción.
