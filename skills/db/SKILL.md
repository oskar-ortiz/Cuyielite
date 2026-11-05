---
name: db
description: "Usa este skill al diseñar o modificar el modelo de datos central PostgreSQL, el DDL local SQLite, la sincronización delta o los seeds sintéticos de CuyiElite."
---

# db

## Propósito
Definir y mantener el DDL de PostgreSQL central y SQLite local, los campos de control delta y los seeds sintéticos.

## Stack
Base central: PostgreSQL 16 + pgvector (`pgvector/pgvector:pg16`), puerto `5432`, base y usuario `cuyielite`; DBeaver como cliente de administración. Base local del cliente: SQLite, según ADR 0002.

## Convenciones
- Mantener DDL numerado y ejecutable en orden en `db/ddl/`, separado entre PostgreSQL central y SQLite local. El DDL SQLite no incluye `embeddings_sena` ni la extensión `vector`.
- Toda tabla sincronizable incluye `created_at`, `updated_at`, `synced_at` y `deleted_at`; usar tipos TEXT para SQLite (UUID, marcas de tiempo ISO8601) y mantener compatibilidad con el esquema central PostgreSQL.
- Los seeds de `db/seeds/` son solo sintéticos y sirven como prueba de humo del código; nunca se usan para entrenar ni reportar métricas.
- Los datos reales del SENA se usan para ETL, entrenamiento y métricas, y viven en `db/raw_Lope/` (local e ignorado por Git). Los datos reales no se versionan; su uso es académico, con autorización del SENA. Al repositorio solo se suben código, scripts y reportes agregados.

## Comandos
- `docker compose up -d`: inicia PostgreSQL con pgvector.
- Ejecutar el DDL central con `psql` o DBeaver cuando existan scripts en `db/ddl/central/`.
- Para SQLite local: los scripts están en `db/ddl/local/001_sqlite.sql`.
- Por confirmar: definir un comando reproducible para cargar el seed SQLite; no hay una herramienta de carga implementada.

## Qué no tocar
- No cambiar el DDL de Arquitectura §5–§6 sin sincronizarlo con `db/ddl/`.
- No versionar datos reales ni incluir credenciales o artefactos `*.pkl` o `*.joblib`.
- Los paths `db/raw_Lope/` y `db/seeds/real_*` están bloqueados en `.gitignore`.

## Pendientes/abiertos
- [x] Diseñar DDL SQLite adaptado desde esquema central (archivo `db/ddl/local/001_sqlite.sql` creado).
- [x] Crear seeds sintéticos en `db/seeds/` con estructura completa (4 galpones, 7 pozas, 15 cuyes, 4 partos, 10 pesajes, 2 mortalidad, 2 alertas).
- [x] Validar la carga del seed SQLite contra el DDL local.
- [ ] Sincronizar el DDL local con el central para campos de control delta (LWW: `updated_at > synced_at`).
- [ ] Definir estrategia de asignación de `updated_at` entre cliente local y servidor central.
- [ ] Coordinar con Oskar la política de sincronización delta y resolución de conflictos LWW.
- [ ] Mantener sincronizados el DDL local y la documentación de Arquitectura.