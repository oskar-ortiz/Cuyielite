# D1: publicación de cambios de dominio

Estado: **IMPLEMENTADO Y VERIFICADO EN LABORATORIO**. Diery confirmó que D1 conserva `0004_publicacion_dominio.sql`; su CHECK independiente de pesajes se entregará como `0005_*`. Sin push ni PR.

Rama: `feat/d1-publicacion-dominio`, desde `origin/dev` `8496b29`.

## Alcance

La primitiva permite que el orquestador ETL de Diery publique metadatos de dominio dentro de su propia transacción. No implementa ETL, limpieza, conciliación, endpoints HTTP, sync v2 ni pantallas.

```python
publicar_cambios(conn, scope_id, registros)
```

- `conn`: conexión del llamador con `autocommit=False` y transacción activa.
- `scope_id`: UUID del ámbito, existente y autorizado por el orquestador.
- `registros`: secuencia de `RegistroPublicacion` o mappings con `entity`, `id`, `expected_version`, `before`, `after`.

Entidades permitidas en D1: `cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias`. Los identificadores v1 `galpon|poza` no se modifican ni se incluyen en esta primitiva.

## Garantías de la primitiva

| Garantía | Comportamiento |
| --- | --- |
| Conexión prestada | No abre ni cierra conexiones. |
| Transacción | No inicia transacción, no hace `COMMIT`/`ROLLBACK`; propaga el error. |
| Dominio | No escribe campos de negocio ni genera UUID. El orquestador ya insertó/actualizó la fila. |
| Ámbito | Bloquea `sync_scopes` con `FOR UPDATE`; rechaza ámbito inexistente, fila sin ámbito y fila de otro ámbito. |
| Referencias | Rechaza referencias inexistentes, fuera de ámbito, `pesajes` con `parto_id` y `evento_id` simultáneos, pesaje cuyo parto/evento no corresponde al animal y `parto_crias` con la madre como cría. |
| Duplicados | Rechaza dos registros con la misma `entity`/`id` en una llamada. |
| Evidencia | Exige `before`/`after` con las mismas claves publicables; `after` debe coincidir con la fila final. |
| Versión | Primera publicación `1`; corrección efectiva `+1`; obsoleta o inconsistente falla. |
| No-op | Sin UPDATE de metadatos, historial ni contador. |
| Historial | Inserta snapshot inmutable y avanza `last_sequence` en la misma transacción. |
| Resultado | Devuelve versiones/secuencias provisionales hasta el COMMIT exterior. |

## Versiones

- **Registro nuevo no publicado** (`server_version=0`, `expected_version=None`, `before=None`): se asigna `server_version=1`, se inserta snapshot y se incrementa el contador.
- **Corrección efectiva** (`server_version>0`, `expected_version=versión actual`, `before=último snapshot`): se asigna `versión+1`, se inserta nuevo snapshot y se incrementa el contador.
- **No-op** (`before == after`, fila final coincide): se devuelve la versión actual, sin UPDATE, historial ni contador.
- **Versión obsoleta**: `expected_version` distinto de la actual falla con `VERSION_OBSOLETA`.
- **Histórico sin ámbito**: `scope_id IS NULL` falla con `SCOPE_NO_ASIGNADO`; no se infiere ni se publica.

La primitiva actualiza únicamente `server_version`. No cambia `scope_id`, `created_at`, `updated_at`, `deleted_at` ni campos de negocio. El ETL debe fijar `scope_id` en la fila antes de publicar.

## Relaciones y animal correcto

Además del ámbito, D1 valida la relación mínima que puede comprobar con las filas existentes:

- `pesajes.parto_id`: el parto debe ser de la madre medida o existir `parto_crias(parto_id, cuy_id)` para una cría.
- `pesajes.evento_id`: el evento debe pertenecer al mismo `cuy_id` medido.
- `parto_crias`: la madre del parto no puede figurar como cría de su propio parto.

No se valida la identidad biológica ni la calidad de la conciliación; eso pertenece al ETL/revisión de Diery. Si el llamador no escribió la relación `parto_crias` antes de publicar un pesaje de cría, D1 rechaza la publicación hasta que la relación exista en la misma transacción.

Límite explícito de D1: no valida el tipo de evento frente a la etapa del pesaje, el `rol` de `parto_crias`, la pertenencia biológica de la cría a la camada ni la exactitud histórica de la relación. Solo comprueba existencia, ámbito y las correspondencias mínimas descritas arriba; la conciliación de identidades sigue siendo de Diery.

## Migración central

`db/migrations/central/0004_publicacion_dominio.sql` agrega a `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`:

- `scope_id UUID NULL REFERENCES sync_scopes(id)`;
- `server_version BIGINT NOT NULL DEFAULT 0`;
- `last_client_edited_at TIMESTAMPTZ`;
- CHECK `server_version >= 0`;
- índices por `scope_id`.

No asigna ámbito a filas históricas. No modifica `0001`–`0003` ni recalcula checksums. `server_version=0` significa no publicado.

### Coordinación pendiente

Al revisar la base de D1, `origin/dev` contenía `0001`–`0003`. Diery confirmó después que el CHECK de pesajes será `0005_*`, independiente de D1, porque utiliza `pesajes.parto_id` y `pesajes.evento_id` ya presentes desde `0001_lope_domain.sql`. Por tanto, D1 conserva `0004_publicacion_dominio.sql`. La primitiva rechaza ambos vínculos de pesaje; el CHECK de base se incorporará con la migración de Diery. Antes de fusionar, comprobar que `dev` no haya incorporado otra migración con el mismo número.

## Errores de contrato

| Código | Condición |
| --- | --- |
| `SIN_TRANSACCION` | Conexión cerrada, autocommit o sin transacción activa. |
| `AMBITO_INEXISTENTE` | `scope_id` no existe. |
| `ENTIDAD_NO_PERMITIDA` | Entidad fuera de las cinco de D1. |
| `REGISTRO_INVALIDO` | Registro que no es dataclass/mapping o le faltan claves. |
| `REGISTRO_DUPLICADO` | Misma entidad/id dos veces en la llamada. |
| `REGISTRO_INEXISTENTE` | El ETL no escribió la fila antes de publicar. |
| `SCOPE_NO_ASIGNADO` | Fila histórica con `scope_id=NULL`. |
| `SCOPE_INVALIDO` | Fila de otro ámbito. |
| `VERSION_REQUERIDA` | Registro publicado sin `expected_version`. |
| `VERSION_OBSOLETA` | `expected_version` no coincide con la actual. |
| `VERSION_INCONSISTENTE` | Registro nuevo con `expected_version` no nulo. |
| `EVIDENCIA_INCONSISTENTE` | `before` no coincide con el último snapshot o falta en una corrección. |
| `FILA_FINAL_INCONSISTENTE` | `after` no coincide con la fila escrita. |
| `HISTORIAL_INCONSISTENTE` | Versión publicada sin snapshot previo. |
| `REFERENCIA_INVALIDA` | Referencia inexistente o sin ámbito. |
| `REFERENCIA_FUERA_DE_AMBITO` | Referencia existente en otro ámbito. |
| `RELACION_INCONSISTENTE` | Parto/evento no corresponde al animal medido o madre vinculada como cría. |
| `VINCULO_INVALIDO` | Pesaje con `parto_id` y `evento_id` simultáneos. |
| `CAMPOS_INVALIDOS` | Claves de `before`/`after` distintas de las publicables. |
| `VALOR_INVALIDO` | UUID, fecha, decimal, entero o valor no finito inválido. |

## Evidencia reproducible

Base PostgreSQL nueva, temporal, con nombre único y `cuyielite_test` como base administrativa de pruebas. Los recursos se eliminan al terminar.

```powershell
# 1. Crear contenedor/base temporal (credenciales fuera de Git)
# 2. Bootstrap y migraciones
$env:CUYI_DB_URL = "<url-temporal>"
python -c "import psycopg, glob, os; conn=psycopg.connect(os.environ['CUYI_DB_URL'], autocommit=True); [conn.execute(open(f, encoding='utf-8').read()) for f in sorted(glob.glob('db/ddl/central/*.sql'))]; conn.close()"
python -m tools.db_migrate --env-var CUYI_DB_URL

# 3. Pruebas
$env:TEST_DATABASE_URL = $env:CUYI_DB_URL
$env:DATABASE_URL = $env:CUYI_DB_URL
python -m pytest backend tools/db_migrate/tests -q
```

Resultado real de la corrida final sobre la rama:

- `backend/tests/test_publication.py`: **16 passed**.
- `backend/tests/test_sync.py::test_pull_v1_no_filtra_entidad_nueva_y_api_falla_actualmente`: prueba específica del comportamiento v1.
- Suite completa `backend` + `tools/db_migrate/tests`: **102 passed** (82 backend + 20 migraciones).
- Migración `0004` aplicada correctamente sobre bootstrap + `0001`–`0003`.
- Base temporal y contenedor eliminados al terminar; no se usaron bases existentes ni datos reales.

## Pruebas cubiertas

1. Primera publicación: versión 1, snapshot y contador.
2. Corrección efectiva: versión +1 e historial inmutable.
3. No-op: sin cambios de versión, timestamp, historial ni contador.
4. Versión obsoleta y `before` inconsistente.
5. Ámbito inválido, fila sin ámbito, referencia sin ámbito y referencia cruzada.
6. Duplicado entidad/id en una llamada.
7. Rollback exterior de dominio, metadatos, historial y contador.
8. La función no confirma ni cierra; el llamador puede hacer rollback y luego commit.
9. Dos escritores concurrentes con bloqueo de ámbito: secuencias 1 y 2, sin duplicados.
10. Histórico sin ámbito permanece sin publicar.
11. Las cinco entidades D1 publican; sync v1 sigue rechazando entidades nuevas.
12. Pesaje con dos vínculos rechazado.
13. Pesaje con parto/evento de otro animal y madre vinculada como cría rechazados.
14. UUID, fecha y decimal aportados como strings se normalizan.
15. Pull v1 no filtra la entidad nueva; la API falla antes de entregar cursor.

## Comportamiento actual de pull v1

`pull_changes` **no filtra** entidades desconocidas. Si `sync_changes` contiene una fila con `entity='cuyes'`, el servicio la devuelve en `items` y calcula un `next_cursor`; no avanza el cursor por filtrado.

La API v1 no puede representar esa página: `SyncPullItem.entity` acepta solo `galpon|poza`. La prueba `test_pull_v1_no_filtra_entidad_nueva_y_api_falla_actualmente` demuestra que:

- la llamada directa a `pull_changes` devuelve el ítem `cuyes` y un cursor;
- la API `/sync/pull` responde `500` antes de entregar cursor;
- por tanto, publicar dominio nuevo sin D2 deja a los clientes v1 sin descarga válida.

No se implementó un filtro de entidades en `pull_changes`: filtrar y avanzar el cursor perdería cambios para una futura descarga. La entrega D2 debe resolver la negociación/descarga de entidades nuevas. **La publicación de dominio no tiene llamador operativo hasta D2**; D1 solo se invoca en pruebas y desde un orquestador sintético.

## Pendientes reales

- Incorporar y verificar la migración independiente `0005_*` del CHECK de pesajes cuando Diery la publique. No forma parte de D1.
- No se implementó backfill de históricos; requiere procedimiento revisado y separado.
- No se implementó sync v2, endpoints, UI ni D1B.
- No se abrió PR ni se hizo commit/push en esta fase.
