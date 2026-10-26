---
name: db
description: Define y mantiene el DDL PostgreSQL central/local y los seeds sintéticos; se activa al trabajar con esquema, persistencia o datos de prueba.
---

# db

## Propósito
Mantener el modelo relacional PostgreSQL central y local, sus campos de control delta y los seeds sintéticos.

## Stack
PostgreSQL 16 + pgvector (`pgvector/pgvector:pg16`), puerto `5432`, base y usuario `cuyielite`; DBeaver como cliente de administración.

## Convenciones
- Mantener scripts DDL numerados y ejecutables en orden en `db/ddl/`, diferenciando central y local. La base local no lleva la extensión `vector` ni `embeddings_sena`.
- Todas las tablas sincronizables incluyen `created_at`, `updated_at`, `synced_at` y `deleted_at`, con `TIMESTAMPTZ`; usar UUID como identificador.
- Guardar únicamente datos sintéticos en `db/seeds/`. La Ley 1581 de 2012 y `.gitignore` (patrón `db/seeds/real_*`) prohíben publicar datos reales del Centro Lope.

## Comandos
`docker compose up -d` inicia PostgreSQL con pgvector. Ejecutar los DDL desde DBeaver o `psql`: a crear cuando existan scripts en `db/ddl/`.

## Qué no tocar
No modificar el DDL embebido en Arquitectura §5–§6 sin sincronizarlo con `db/ddl/`; no incorporar datos reales, credenciales, ni artefactos `*.pkl` o `*.joblib`.

## Pendientes / abiertos
- `db/ddl/` y `db/seeds/` están vacíos (solo contienen `.gitkeep`); crear scripts y seeds sintéticos.
- La CI no valida el esquema: `backend.yml` solo instala dependencias y ejecuta `pytest backend`.
- Acordar con Oskar quién asigna `updated_at` para la resolución LWW.
- Bloqueante: validar PostgreSQL en Android, pendiente de Arquitectura §0, antes de cerrar el DDL local.
