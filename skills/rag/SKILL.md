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
- `VECTOR(1536)` es provisional; la dimensión elegida debe coincidir entre `embeddings_sena.embedding` y el índice HNSW.
- Candidatos actuales por evaluar, sin selección: `all-MPNet-base-v2` y `mxbai-embed-large`.
- Por confirmar: evaluar modelos de embeddings multilingües (español) frente a los candidatos actuales.
- Al elegir el modelo de embeddings, registrar la decisión en `docs/decisiones/` y actualizar `db/ddl/` y Arquitectura §5 en el mismo PR.
- El corpus original de manuales SENA no se versiona; su ubicación local queda por confirmar. Los datos reales no se versionan; su uso es académico, con autorización del SENA. Al repositorio solo se suben código, scripts y reportes agregados.

## Comandos
- Por confirmar: definir comandos y rutas de indexación, consulta y evaluación; `rag/` aún no contiene módulos ejecutables.

## Qué no tocar
- No añadir la extensión `vector` ni `embeddings_sena` a la base local del cliente SQLite.
- No usar el corpus del SENA fuera de su uso interno declarado (Sección 3 §3.5 del Trabajo de Grado).
- No fijar modelo de embeddings ni dimensión hasta que se decida en `docs/decisiones/`.

## Pendientes/abiertos
- [x] Definir contrato de AssistantQueryRequest/Response en Arquitectura §10 (ya definido).
- [ ] Evaluar los candidatos de embeddings y registrar la decisión en `docs/decisiones/`.
- [ ] Por confirmar: elegir LLM local o vía API y registrar la decisión.
- [ ] Por confirmar: definir la ubicación local del corpus de manuales SENA y asegurar que no se versionen los documentos originales.
- [ ] Ejecutar pipeline de indexación y validar que `embeddings_sena` se populate en base central PostgreSQL.
- [ ] Probar consulta RAG con 20 preguntas de evaluación del SENA y validar precisión de recuperación y citación de fuentes.
- [ ] Crear workflow de CI para `rag/**` cuando existan scripts definidos.