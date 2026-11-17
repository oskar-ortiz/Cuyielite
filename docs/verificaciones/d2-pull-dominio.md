# D2: descarga de entidades de dominio por pull

Estado: **IMPLEMENTADO Y VERIFICADO EN LABORATORIO** sobre PostgreSQL temporal con datos sintéticos. Sin commit, push ni PR. No agrega DDL ni backfill; la migración `0004` de D1 se conserva y `0005_pesajes_check.sql` sigue siendo de Diery.

Actualización 2026-11-12: el push v2 de dominio ya está implementado en backend con cursor independiente. Ver [sync-domain-push-v2-backend](sync-domain-push-v2-backend.md). El cliente v2 ya integra ese contrato y el recorrido nativo Windows/Android quedó verificado.

Rama: `feat/d2-pull-dominio`, desde el HEAD de D1 (`2377411`), que parte de `origin/dev` `8496b29`.

## Alcance

D2 habilita la **descarga** del delta de dominio por `GET /sync/pull`. No integra la carga ETL de Diery, no cambia el push v1, no modifica la UI y no aplica registros en SQLite.

| Capa | Cambio |
| --- | --- |
| `backend/app/schemas/sync.py` | `DOMAIN_ENTITY_NAMES`, `PULL_ENTITY_NAMES` y `PULL_ENTITY_PATTERN`; `SyncPullItem.entity` acepta las cinco entidades de dominio además de `galpon\|poza`. |
| `backend/app/services/sync.py` | `pull_changes` rechaza de forma determinista una entidad que el protocolo no representa (`UnsupportedPullEntity`). |
| `backend/app/controllers/sync.py` | Traduce ese caso a `500 HISTORIAL_NO_SOPORTADO`; nunca entrega una página parcial. |
| `backend/tests/test_pull_domain.py` | Nueva suite de descarga de dominio. |
| `backend/tests/test_integracion_d1_d2.py` | Prueba integrada D1 → D2 con base temporal propia y orquestador sintético. |
| `backend/tests/test_sync.py` | La prueba de regresión de D1 ahora verifica la entrega real (`test_pull_entrega_entidad_de_dominio`). |
| `backend/tests/test_publication.py` | La prueba de frontera separa push v1 (sigue rechazando) de pull (ya acepta). |

## Contrato real de `GET /sync/pull`

- `Authorization: Bearer <token>` obligatorio; el **ámbito se deriva del token**. No existe parámetro `scope_id` ni se acepta uno del cliente.
- `limit`: 1–100, por defecto 50. `cursor`: opaco, firmado y ligado al ámbito.
- Respuesta: `protocol_version=1`, `scope_id`, `items[]` con `seq`, `entity`, `record`, `next_cursor`, `has_more`.
- Entidades representables: `galpon`, `poza`, `cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias`.
- `record` conserva el snapshot publicado por D1: `id`, `version`, `created_at`, `updated_at`, `deleted_at`, `last_client_edited_at` y `data`. Los UUID viajan como string y `deleted_at` conserva el borrado lógico; no se transforman ni se omiten campos.
- `seq` es la secuencia del historial; `record.version` es la versión publicada de la fila.

## Paginación y cursor

- El cursor fija el `through` (agua alta) del ciclo al abrir la primera página y solo avanza hasta el último cambio **realmente incluido**.
- Con `has_more=true`, el cursor apunta a la secuencia del último ítem entregado; el resto queda para la página siguiente.
- Sin pendientes, el cursor se convierte en checkpoint y el siguiente ciclo recoge los cambios nuevos.
- Un cambio insertado después de fijar el agua alta no se mezcla en la página en curso.
- Una entidad no representable hace fallar la petición completa: no se recorta la página ni se adelanta el cursor sobre lo omitido.

## Límites explícitos

- El **push v1 no cambia**: `SyncOperation.entity` sigue limitado a `galpon|poza`.
- No hay push de dominio ni reconciliación de conflictos de dominio; eso requiere el protocolo v2.
- D2 solo entrega el delta: la aplicación transaccional en SQLite, el `sync_inbox` y la UI son D3/D4.
- No se agregó DDL ni backfill. `0005_pesajes_check.sql` no está en esta rama y no fue creada ni renumerada.
- Una entidad fuera del conjunto conocido en `sync_changes` produce `500 HISTORIAL_NO_SOPORTADO`; es un fallo de integridad, no una omisión silenciosa.

## Pruebas agregadas

`backend/tests/test_pull_domain.py` (8 pruebas):

1. Las cinco entidades de dominio se descargan con secuencia y versión correctas y snapshots íntegros.
2. Regresión explícita: la ruta no responde `500` para ninguna entidad de dominio.
3. Borrado lógico y versión `+1` conservados en el snapshot servido.
4. Aislamiento de ámbito: cada token ve solo su historial.
5. Paginación con `limit=2`: el cursor no adelanta cambios y el siguiente ciclo recoge lo nuevo.
6. Conjunto vacío y `limit=1`.
7. Compatibilidad `galpon`/`poza` con el formato previo.
8. Entidad desconocida: `500 HISTORIAL_NO_SOPORTADO`, sin cursor.

Ajustes de regresión: `test_pull_entrega_entidad_de_dominio` (antes esperaba `500`) y `test_push_v1_rechaza_entidades_nuevas_y_pull_las_acepta`.

## Prueba integrada D1 → D2

`backend/tests/test_integracion_d1_d2.py` (4 pruebas) es la prueba de contrato de plataforma de extremo a extremo. Crea su propia base PostgreSQL con nombre único (`cuyielite_d1_d2_<hex>`) desde `/postgres`, aplica el bootstrap central y las migraciones `0001`–`0004`, y la elimina con `DROP DATABASE ... WITH (FORCE)` en `finally`. No usa `cuyielite_test` como base de datos de trabajo ni datos reales.

El orquestador sintético es un arnés de prueba, no un servicio de promoción: no existe un ETL paralelo ni se simula integración con la herramienta de Diery.

| Prueba | Qué demuestra |
| --- | --- |
| `test_promocion_sintetica_d1_llega_al_pull_d2` | Inserta filas mínimas de `cuyes` (madre y cría), `partos`, `eventos`, `pesajes` y `parto_crias`; llama `publicar_cambios` con `entity/id/expected_version/before/after` en una transacción; confirma una sola vez; y verifica por `GET /sync/pull` los `seq` 1–6, `version=1`, UUID como string, referencias (`madre_id`, `cuy_id`, `evento_id`, `parto_id`), `deleted_at=null` y cursor. Después corrige con borrado lógico, hace commit y comprueba en el siguiente ciclo `seq=7`, `version=2` y `deleted_at` no nulo. |
| `test_fallo_antes_del_commit_exterior_revierte_todo` | Publica y luego falla antes del COMMIT exterior: quedan en cero las filas de dominio, el historial y `last_sequence`, y el pull devuelve vacío. |
| `test_publicacion_fallida_no_deja_lote_parcial` | Un lote con un `after` inconsistente falla con `FILA_FINAL_INCONSISTENTE`; tras rollback no hay dominio, historial ni avance de contador. |
| `test_push_v1_conserva_contrato_y_rechaza_dominio` | `galpon` sigue aceptándose por `/sync/push` y aparece en el pull; las cinco entidades de dominio se rechazan con `422`. |

## Contrato de llamada para el orquestador de Diery

Lo que D1 ofrece, y lo único que D2 consume:

```python
from backend.app.services.publication import (
    PUBLISHABLE_FIELDS, RegistroPublicacion, publicar_cambios,
)

# conn: psycopg con autocommit=False y transacción ya abierta por el orquestador.
# El orquestador escribe primero los campos de negocio de la fila.
registro = RegistroPublicacion(
    entity="cuyes",              # cuyes|partos|pesajes|eventos|parto_crias
    id=fila_id,                  # UUID de la fila ya escrita
    expected_version=None,       # None en el primer publish; versión actual en corrección
    before=None,                 # None en el primer publish; último snapshot en corrección
    after={campo: valor for campo in PUBLISHABLE_FIELDS["cuyes"]},
)
resultado = publicar_cambios(conn, scope_id, [registro])
conn.commit()                    # solo el orquestador confirma o revierte
```

- `conn` no se abre, no se cierra, no se confirma y no se revierte dentro de la primitiva.
- `after` debe ser exactamente la fila final escrita; `before` debe coincidir con el último snapshot publicado.
- `scope_id` sale de la identidad autorizada del orquestador; la primitiva rechaza ámbito inexistente, fila de otro ámbito y fila con `scope_id NULL`.
- Primer publish: `server_version=1` y snapshot. Corrección efectiva: `+1` y nuevo snapshot. No-op: sin historial ni contador.
- Errores (`PublicacionError.codigo`): `SIN_TRANSACCION`, `AMBITO_INEXISTENTE`, `ENTIDAD_NO_PERMITIDA`, `REGISTRO_INVALIDO`, `REGISTRO_DUPLICADO`, `REGISTRO_INEXISTENTE`, `SCOPE_NO_ASIGNADO`, `SCOPE_INVALIDO`, `VERSION_REQUERIDA`, `VERSION_OBSOLETA`, `VERSION_INCONSISTENTE`, `EVIDENCIA_INCONSISTENTE`, `FILA_FINAL_INCONSISTENTE`, `HISTORIAL_INCONSISTENTE`, `REFERENCIA_INVALIDA`, `REFERENCIA_FUERA_DE_AMBITO`, `VINCULO_INVALIDO`, `CAMPOS_INVALIDOS`, `RELACION_INCONSISTENTE`, `VALOR_INVALIDO`.
- D2 **no** aporta: envelope de lote, idempotencia durable del lote, lectura de Excel/CSV, conciliación de identidades, push v2 ni aplicación local. Eso es D1B/D3 de Diery y Oskar respectivamente.

**Bloqueo real:** el orquestador ETL de Diery no está en este checkout. La prueba integrada valida la frontera de plataforma con un arnés sintético; no acredita que la promoción real esté conectada.

## Comandos y resultados reales

Base PostgreSQL nueva, temporal, con nombre único; bootstrap central y migraciones `0001`–`0004` aplicadas. Contenedor y bases eliminados al terminar.

```powershell
python -m pytest backend/tests/test_pull_domain.py backend/tests/test_sync.py -q
# 31 passed

python -m pytest backend/tests/test_integracion_d1_d2.py -q
# 4 passed

python -m pytest backend tools/db_migrate/tests -q
# 114 passed  (82 backend + 20 migraciones + 12 D2)

python -m compileall -q backend
# salida vacía, exit 0
```

- `git diff --check`: sin errores.
- No hay linter ni typecheck configurados para `backend`: el workflow `backend.yml` solo instala dependencias y ejecuta `pytest`. No se inventó una herramienta.
- Sin datos reales, tokens ni credenciales en archivos versionados.

## Riesgo conocido

Un cliente v1 que no conozca las entidades de dominio seguirá recibiendo ítems que no sabe aplicar. D2 es backend; la compatibilidad de aplicación local se resuelve en D3. Hasta entonces, el cliente debe ignorar entidades desconocidas de forma explícita, no descartar la página ni el cursor.
