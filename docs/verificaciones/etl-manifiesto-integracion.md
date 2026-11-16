# Evidencia: integración sintética del contrato ETL con la publicación (2026-11-16)

Estado: **tramo cerrado con una regresión marcada**. El manifiesto acordado `lope_promocion/v1` atraviesa el orquestador real (`promote_batch`), el publicador real (`publicar_cambios` sobre la misma conexión) y el pull v2 contra PostgreSQL temporal aislado, con datos sintéticos.

Base: `dev` `2d8751d` (PR #152 fusionado). Rama: `test/etl-manifiesto-integracion`.

## 1. Qué se corrigió

| Hallazgo | Corrección |
| --- | --- |
| El orquestador excluía `parto_crias` de `PROMOTABLE_ENTITIES`, `ENTITY_TABLES`, `ENTITY_ORDER` y `REFERENCE_ENTITIES`, aunque el publicador central y el ejemplo acordado sí cubren esa quinta entidad | Se añadió `parto_crias` al orquestador, con manejo de la tabla sin `updated_at`/`deleted_at` (`TABLES_WITHOUT_TIMESTAMPS`), igual que hace la capa de publicación |
| El CLI solo aceptaba el manifiesto heredado `{"records": [...]}` | El CLI acepta el formato acordado; el heredado sigue funcionando |
| Los registros del manifiesto acordado no llevan `correspondencia_id` y el orquestador lo exige | Nuevo adaptador `tools/lope_import/manifest.py`: resuelve lote, orígenes y correspondencias y devuelve los registros en el formato interno |
| La tupla de idempotencia es única de forma global pero no había forma de saber a qué ámbito pertenecía el lote | Migración `0009_importacion_lotes_scope.sql`: `importacion_lotes.scope_id`; un lote sin ámbito o de otro ámbito se rechaza |

## 2. Correspondencia entre manifiesto, orquestador y publicación

| Capa | Entrada | Salida |
| --- | --- | --- |
| Manifiesto acordado | `contract_version`, `batch` (lote + tupla), `scope`, `correspondencias_aceptadas`, `registros` | Identidades separadas: ámbito, idempotencia, origen, dominio |
| Adaptador (`manifest.py`) | Manifiesto + ámbito autorizado | Lote, orígenes y correspondencias registrados en la misma transacción; registros con `correspondencia_id` |
| Orquestador (`promote_batch`) | Registros normalizados | Dominio escrito, `publicar_cambios` llamado con la misma conexión, lote y correspondencias confirmados |
| Publicador central | `RegistroPublicacion` (before/after/expected_version) | Versiones, historial, contador y recibos de publicación |

Reglas aplicadas: el ámbito se resuelve del contexto autorizado y el del manifiesto solo se valida; solo `ACEPTADO` entra en registros; `before=null`/`expected_version=null` obligatorios en primera publicación; la corrección exige `before` vigente y `expected_version` leído bajo bloqueo; no-op sin versión ni historial; fallo de publicación revierte dominio, lote y correspondencias.

## 3. Comandos reproducibles (sin secretos)

```bash
docker run -d --name cuyelite-etl-lab -e POSTGRES_USER=cuyielite \
  -e POSTGRES_PASSWORD=<temporal> -e POSTGRES_DB=postgres -p 55446:5432 pgvector/pgvector:pg16
docker exec cuyelite-etl-lab psql -U cuyielite -d postgres -c "CREATE DATABASE cuyelite_etl_lab"

export TEST_DATABASE_URL=postgresql://cuyielite:<temporal>@127.0.0.1:55446/cuyelite_etl_lab
export DATABASE_URL=$TEST_DATABASE_URL
python -m pytest tools/lope_import/tests tools/db_migrate/tests -q
```

La suite crea bases desechables propias a partir de `TEST_DATABASE_URL` y aplica el bootstrap central más **todas** las migraciones vigentes, incluida la nueva `0009`.

## 4. Matriz de casos

| Caso | Componentes | Resultado |
| --- | --- | --- |
| Manifiesto con las cinco entidades y sus relaciones | reales | **HECHO** |
| Correspondencia no aceptada / sin entidad | reales | **HECHO** (rechazo antes de escribir) |
| Dry-run no persiste dominio, lote, correspondencias, historial ni contador | reales | **HECHO** |
| Promoción confirmada escribe dominio y publica en la misma conexión | reales | **HECHO** |
| Registros nuevos publicados con versión 1 | reales | **HECHO** |
| Pull v2 con ámbito, UUID, versiones, decimales, fechas y referencias | reales | **PENDIENTE** (ver §6) |
| Repetir el mismo manifiesto no duplica filas, historial ni secuencias | reales | **PENDIENTE** (ver §6) |
| Misma tupla de idempotencia en otro ámbito | reales | **HECHO** (rechazo sin cambios parciales) |
| Corrección efectiva incrementa versión y publica una vez | reales | **HECHO** (versión 2 y un cambio) |
| No-op sin versiones ni historial | reales | **HECHO** |
| Fallo de publicación revierte dominio y lote | reales + publicador falso | **HECHO** |
| Referencias cruzadas entre ámbitos | reales | **HECHO** (rechazo) |
| Manifiesto por archivo con el formato acordado | reales | **HECHO** |
| Evidencia DECLARADA no habilita evaluación oficial | backend | **HECHO** en la suite de evaluación existente |

## 5. Componentes reales frente a dobles

- Reales: `promote_batch`, `publicar_cambios`, `pull_changes` v2, PostgreSQL, el adaptador del manifiesto.
- Doble: solo el publicador que falla a propósito, para comprobar la reversión total.

## 6. Pendiente real

Dos casos quedan marcados como `xfail` con motivo explícito, no omitidos:

- **Repetición del mismo manifiesto** y **pull v2**: al promover dos veces el mismo manifiesto, la segunda promoción choca con la tupla de idempotencia global de `importacion_lotes` (`La tupla de idempotencia ya pertenece a otro lote`). La causa probable es que la tupla `(huella_archivo, parser_version, mapeo_version)` sea única de forma global mientras la nueva columna `scope_id` se valida después; el replay del mismo lote debe resolverse por `lote_id`, no por la tupla. **No se ha corregido en esta entrega**: requiere decidir si la tupla pasa a ser única por ámbito o si el replay se reconoce primero por `lote_id`.

## 7. Límites

- Esta prueba no acredita los Excel reales, ni RF, ni RAG.
- No se ejecutó carga real ni se tocó ninguna base existente: solo el contenedor temporal `cuyelite-etl-lab` y bases `cuyielite_lope_manifest_*` creadas y destruidas por la propia suite.
- El `cuyelite-s3-test` preexistente no se usó ni se modificó.
