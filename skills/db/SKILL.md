---
name: db
description: "Usa este skill al diseñar o modificar el modelo de datos, DDL de PostgreSQL, sincronización delta o seeds sintéticos de CuyiElite."
---

# db

## Propósito
Definir y mantener el DDL de PostgreSQL central y local, los campos de control delta y los seeds sintéticos.

## Stack
PostgreSQL 16 + pgvector (`pgvector/pgvector:pg16`), puerto `5432`, base y usuario `cuyielite`; DBeaver como cliente de administración.

## Convenciones
- Mantener DDL numerado y ejecutable en orden en `db/ddl/`, separado para las bases central y local. La base local no incluye `embeddings_sena` ni la extensión `vector`.
- Toda tabla sincronizable incluye `created_at`, `updated_at`, `synced_at` y `deleted_at`; usar `TIMESTAMPTZ` y UUID.
- Guardar solo datos sintéticos en `db/seeds/`. No incluir datos reales del Centro Lope: aplica la Ley 1581 de 2012 y `.gitignore` bloquea `db/seeds/real_*`.

## Comandos
- `docker compose up -d`: inicia PostgreSQL con pgvector.
- Ejecutar el DDL con `psql` o DBeaver cuando existan scripts en `db/ddl/`.
- La CI de `backend.yml` no valida el esquema; solo instala dependencias y ejecuta `pytest backend`.

## Qué no tocar
- No cambiar el DDL de Arquitectura §5–§6 sin sincronizarlo con `db/ddl/`.
- No incluir datos reales, credenciales ni artefactos `*.pkl` o `*.joblib`.

## Pendientes/abiertos
- `db/ddl/` y `db/seeds/` solo contienen `.gitkeep`; faltan DDL y seeds sintéticos.
- No hay validación de esquema en CI.
- Bloqueante: validar la ejecución de PostgreSQL en Android, lo que condiciona el DDL local.
- Coordinar con Oskar quién asigna `updated_at` para resolver conflictos LWW.
- Mantener sincronizados el DDL y la documentación de Arquitectura.
