# Pipeline RAG local

Pipeline de indexación y consulta interna del manual del SENA. Las respuestas
se generan localmente con Ollama cuando se habilita `LLM_PROVIDER=ollama`, con
respaldo extractivo y citas `Documento, p. N`. Por defecto no se invoca un LLM.
`consultar(pregunta, top_k)` entrega `respuesta` y `fuentes`.

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

## Generación local con Ollama

Instala Ollama para Windows desde [ollama.com/download](https://ollama.com/download)
y, en una terminal, descarga el modelo configurado:

```powershell
ollama pull qwen2.5:7b-instruct
```

Ollama expone por defecto `http://localhost:11434`. Copia las variables RAG de
`.env.example` a tu `.env` local y activa el proveedor:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
LLM_TIMEOUT_S=60
LLM_TEMPERATURE=0.1
```

La llamada es a `/api/chat` con `stream=false`. El prompt limita la respuesta al
contexto, pide citas `[1]`, `[2]` y prohíbe inventar cifras. El código traduce
solo índices existentes a citas de documento y página. Sin fragmentos sobre el
umbral no se llama a Ollama; si el proveedor está desactivado o falla, se usa
respuesta extractiva. No se transmite el corpus a servicios externos.

## Evaluación y pruebas

`rag/eval/preguntas.yaml` contiene preguntas y páginas esperadas. Revisa las
preguntas y sus páginas antes de interpretar el informe. Para calcular métricas,
indexa el corpus y ejecuta:

```powershell
rag\.venv\Scripts\python -m rag.ask evaluate
```

El informe guarda solo acierto@1, acierto@3, acierto@5 y MRR agregados en
`rag/reports/evaluacion.md`.

Para generar la tabla de revisión manual de las 25 preguntas:

```powershell
$env:RAG_DATABASE_URL = "postgresql://..."
$env:LLM_PROVIDER = "ollama"
rag\.venv\Scripts\python -m rag.eval.evaluate_generation
```

El informe queda en `rag/reports/evaluacion_generacion.md`; sus respuestas se
acortan y la columna de calificación se deja vacía.

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
