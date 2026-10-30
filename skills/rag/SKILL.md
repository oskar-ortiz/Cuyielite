---
name: rag
description: "Usa este skill al indexar manuales zootécnicos del SENA o implementar consultas RAG con recuperación y citación de fuentes."
---

# rag

## Propósito
Indexar manuales zootécnicos del SENA y consultarlos mediante recuperación aumentada, con respuesta y citación de fuentes.

## Stack
PostgreSQL + pgvector, tabla `embeddings_sena` e índice HNSW con distancia coseno.

## Convenciones
- Seguir el pipeline: extracción → limpieza → chunking → embeddings → recuperación coseno → respuesta con cita (Arquitectura §9).
- Respetar `AssistantQueryRequest`: `top_k` entre 1 y 20. La respuesta siempre incluye `fuentes`, una lista de strings (Arquitectura §10).
- `VECTOR(1536)` es un ejemplo provisional, no una dimensión confirmada. La copia actual de Arquitectura §5 muestra `VECTOR(384)`, por lo que hay una discrepancia documental que resolver. La dimensión elegida debe coincidir entre `embeddings_sena.embedding` y el índice HNSW; cambiarla requiere recrear la columna y el índice y re-indexar el corpus.
- Al elegir el modelo de embeddings, registrar la decisión en `docs/decisiones/` y actualizar `db/ddl/` y Arquitectura §5 en el mismo PR. No fijar un modelo ni una dimensión antes de esa decisión.

## Comandos
A definir tras elegir el modelo de embeddings y el LLM (local vs API). No escribir comandos de indexación hasta entonces.

## Qué no tocar
- No añadir la extensión `vector` ni `embeddings_sena` a la base local del cliente.
- No usar el corpus del SENA fuera de su uso interno declarado (Sección 3 §3.5).

## Pendientes/abiertos
- `rag/` solo contiene `.gitkeep`; faltan el proceso de indexación y la consulta. No hay CI para `rag/**`.
- Elegir el modelo de embeddings y el LLM (local o API); registrar las decisiones en `docs/decisiones/` y resolver la discrepancia documental antes de indexar.
- Validar la calidad de recuperación antes de indexar con unas 20 preguntas de evaluación del SENA, dentro del uso interno declarado.
- Crear el workflow de CI cuando existan scripts.
- La ejecución de PostgreSQL en Android sigue sin validar y condiciona el diseño de la persistencia local.
