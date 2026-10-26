---
name: rag
description: Guía la indexación de manuales zootécnicos del SENA y la consulta RAG con citación; se activa al trabajar en recuperación aumentada.
---

# rag

## Propósito
Indexar manuales zootécnicos del SENA y responder consultas con fuentes citadas, para uso interno declarado.

## Stack
PostgreSQL + pgvector, tabla `embeddings_sena` e índice HNSW con distancia coseno. La dimensión vigente es `VECTOR(384)`, según el ADR 0002.

## Convenciones
- Pipeline de indexación: extracción → limpieza → chunking → embeddings → pgvector.
- Respetar el contrato de `AssistantQueryRequest`: `top_k` entre 1 y 20. La respuesta siempre incluye una lista de fuentes.

## Dimensión del embedding
`VECTOR(384)` deriva de los modelos locales de embeddings de 384 dimensiones considerados en el ADR 0002; la dimensión se deriva del modelo y nunca se fija a mano. Cualquier cambio de modelo obliga a recrear `embeddings_sena` y re-embeder todo el corpus. Verificar que exista el ADR antes de ejecutar `CREATE TABLE`. Al cambiar el modelo, actualizar en el mismo PR el DDL, el ADR, este skill y la documentación.

## Comandos
Indexación y consulta: a definir; no hay scripts ni comandos implementados en `rag/`.

## Qué no tocar
No crear la extensión `vector` ni la tabla `embeddings_sena` en la base local del cliente. No usar el corpus del SENA fuera de su uso interno declarado en la Sección 3 §3.5.

## Pendientes / abiertos
- Elegir el LLM generador (Ollama local vs. API) y documentarlo en `docs/decisiones/0003-llm-rag.md`; no crear ese archivo todavía.
- Validar la calidad de recuperación con unas 20 preguntas reales del SENA antes de indexar. Si no alcanza, escalar al modelo base correspondiente de 768 dimensiones y reindexar (ADR 0002).
- No existe workflow de CI para `rag/`; definirlo cuando existan scripts.
