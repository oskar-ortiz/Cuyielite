# D2: push v2 de dominio (backend)

Estado: **IMPLEMENTADO Y VERIFICADO EN LABORATORIO** sobre PostgreSQL temporal con datos sintéticos. Backend únicamente: el cliente, la verificación nativa del push y el recorrido nativo de D7 siguen pendientes.

Rama: `feat/sync-domain-push-v2`, desde `dev` (`9e3a71f`, D1–D7 integradas).

## Alcance

Esta entrega agrega el protocolo v2 explícito de escritura y descarga de dominio:

- `GET /sync/v2/context`
- `POST /sync/v2/push`
- `GET /sync/v2/pull`

El push v1 (`/sync/push`, `/sync/pull`, `/sync/context`) conserva su contrato y sigue limitado a `galpon|poza`. No se modifican sus rutas, esquemas ni semántica; solo se parametrizó el cursor y el pull por protocolo con valor por defecto 1.

Entidades v2: `cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias`.

## Contrato v2

### Contexto

`GET /sync/v2/context` exige Bearer token y responde:

```json
{
  "protocol_version": 2,
  "scope_id": "…",
  "device_id": "…",
  "supported_entities": ["cuyes", "partos", "pesajes", "eventos", "parto_crias"],
  "limits": {"push_operations": 100, "push_bytes": 1048576, "pull_default": 50, "pull_max": 100}
}
```

`scope_id` y `device_id` se derivan exclusivamente del token; el cuerpo no acepta `scope_id`.

### Push

```json
{
  "protocol_version": 2,
  "device_id": "…",
  "operations": [
    {
      "operation_id": "…",
      "entity": "cuyes",
      "record_id": "…",
      "action": "create|update",
      "base_version": null,
      "client_created_at": "2026-11-12T10:00:00Z",
      "client_edited_at": null,
      "data": { }
    }
  ]
}
```

- `protocol_version` debe ser exactamente `2`; el sobre rechaza campos desconocidos.
- `create` exige `base_version=null` y `client_created_at`; `update` exige `base_version` decimal positivo.
- `record_id` es el UUID estable creado por el cliente. La chapa (`codigo_identificacion`) no es identidad.
- Máximo 100 operaciones; no se admiten `operation_id` ni `(entity, record_id)` duplicados dentro del lote.
- El `device_id` del cuerpo debe coincidir con el del token; si no, `403 DEVICE_NOT_AUTHORIZED`.

Respuesta:

```json
{
  "protocol_version": 2,
  "results": [
    {
      "operation_id": "…",
      "entity": "cuyes",
      "record_id": "…",
      "status": "accepted|rejected|conflict",
      "changed": true,
      "code": null,
      "record": {
        "id": "…",
        "version": "1",
        "created_at": "…",
        "updated_at": "…",
        "deleted_at": null,
        "last_client_edited_at": null,
        "data": { }
      }
    }
  ]
}
```

`record.data` contiene únicamente los campos sincronizables del cliente. No expone `categoria_ml`, `ultimo_peso_g` ni metadatos técnicos. En `VERSION_CONFLICT` el resultado incluye el registro actual del servidor para que el cliente pueda reconciliar sin sobrescribir su edición local.

### Allowlist estricta

Se exige que `data` tenga **exactamente** el conjunto listado. Cualquier campo faltante o adicional produce `CAMPOS_INVALIDOS`.

| Entidad | `data` permitido |
| --- | --- |
| `cuyes` | `poza_id`, `galpon_origen_id`, `codigo_identificacion`, `sexo`, `fecha_nacimiento`, `color_codigo`, `ojos_codigo`, `pelaje_original`, `padre_id`, `madre_id`, `estado` |
| `partos` | `madre_id`, `fecha_parto`, `numero_parto`, `nacidos_vivos`, `nacidos_muertos`, `tamano_camada_nacida` |
| `pesajes` | `cuy_id`, `fecha_pesaje`, `peso_gramos`, `etapa`, `parto_id`, `evento_id` |
| `eventos` | `cuy_id`, `tipo`, `fecha`, `macho_id`, `poza_origen_id`, `poza_destino_id`, `detalle` |
| `parto_crias` | `parto_id`, `cuy_id`, `rol` |

- `categoria_ml` y `ultimo_peso_g` son campos del servidor: se rechazan si llegan y no se escriben desde v2.
- `scope_id`, `server_version`, `created_at`, `updated_at`, `deleted_at` y `last_client_edited_at` no son editables.
- `NULL` se conserva como `NULL`; no se convierte a `0` ni a cadena vacía.
- `peso_gramos` viaja como cadena decimal y se persiste en `NUMERIC(8,2)`; la respuesta conserva la escala (por ejemplo `"995.00"`).

## Transacción y publicación

Cada operación se procesa en su propia conexión y transacción:

1. Se bloquea el ámbito con `SELECT … FOR UPDATE` (mismo bloqueo que v1), serializando escritores del ámbito.
2. Se busca el recibo por `(scope_id, device_id, operation_id)` dentro de la transacción.
   - Mismo `request_hash`: se devuelve la respuesta original, sin reescribir.
   - Mismo `operation_id` con otro contenido: `OPERATION_ID_REUSED`.
3. Se valida la allowlist y se comprueban las referencias contra el ámbito autorizado.
   - Referencia inexistente o de otro ámbito: `DEPENDENCY_PENDING` (mismo resultado, sin revelar propiedad).
   - Referencia a una operación anterior del lote que no fue aceptada: `DEPENDENCY_REJECTED`.
4. Se escriben solo los campos de negocio del cliente.
   - `create`: inserta el UUID del cliente; `server_version` inicia en 0.
   - `update`: `SELECT … FOR UPDATE` y comparación con `base_version`; versión distinta produce `VERSION_CONFLICT` sin escribir.
   - No-op: si los campos del cliente son canónicamente iguales a la versión publicada, no se ejecuta `UPDATE`.
5. Se lee la fila persistida y se llama a `publicar_cambios(conn, scope_id, [registro])` con la **misma conexión y transacción**:
   - `before` se lee del último snapshot publicado de la versión esperada.
   - `after` se relee de la fila persistida, nunca del cliente.
   - `publicar_cambios` sigue sin abrir/cerrar conexión, sin confirmar y sin escribir campos de negocio.
6. Se guarda el recibo y se confirma una sola vez. Dominio, versión, historial, secuencia y recibo confirman juntos.

Ante `PublicacionError` o error de base de datos se revierte la transacción completa (negocio, versión, historial y secuencia), se guarda el recibo del rechazo y se confirma solo el recibo. Es la misma semántica de recibo de v1.

`publicar_cambios` conserva su validación de referencias, vínculos, versiones y evidencia. En particular, un pesaje con `parto_id` y `evento_id` simultáneos se rechaza con `VINCULO_INVALIDO` y la fila escrita se revierte.

## Pull y cursor v2

`GET /sync/v2/pull` acepta `limit` (1–100, por defecto 50) y `cursor` opaco.

- Sin cursor inicia en la secuencia 0 y reproduce el historial retenido del ámbito.
- El cursor v2 se firma con HMAC sobre `{protocol_version: 2, scope_id, after, through}`.
- El cursor v1 no es válido en v2 y el cursor v2 no es válido en v1 (`400 CURSOR_INVALID`).
- La primera página fija el agua alta (`through`); las páginas siguientes no mezclan cambios posteriores.
- El cursor v2 es independiente del cursor v1: no lo reutiliza, borra ni retrocede.
- v2 entrega solo las cinco entidades de dominio. `galpon|poza` pertenecen al contrato v1 y se omiten de forma explícita sin frenar el cursor; el cliente v2 conserva su cursor v1 para esas entidades.
- Una entidad desconocida en el historial produce `500 HISTORIAL_NO_SOPORTADO`, sin entregar una página parcial ni avanzar el cursor.
- No hay purga automática de historial. Si en el futuro una instalación no puede acceder al historial retenido, deberá recibir un error explícito de resincronización requerida; esta entrega no inventa ese estado.

## Migraciones

No se agregó ni editó ninguna migración. Se reutilizan:

- bootstrap central `db/ddl/central/001`–`005`
- `db/migrations/central/0001_lope_domain.sql`
- `db/migrations/central/0002_sync_lab.sql`
- `db/migrations/central/0003_rag_e5_embeddings.sql`
- `db/migrations/central/0004_publicacion_dominio.sql`

`0005_pesajes_check.sql` no está disponible en este checkout y no se creó ni renumeró. La exclusividad de vínculo de `pesajes` queda garantizada por la validación de publicación, no por un CHECK de base de datos.

## Archivos

- `backend/app/schemas/sync_v2.py`: sobre, entidades y reglas de versión.
- `backend/app/services/sync_v2.py`: allowlist, referencias, escritura, publicación, recibo y rollback por operación.
- `backend/app/controllers/sync_v2.py`: rutas v2 de contexto, push y pull.
- `backend/app/services/sync.py`: `pull_changes(..., protocol)` y filtro v2; v1 conserva el valor por defecto 1.
- `backend/app/sync_cursor.py`: cursor firmado con versión de protocolo.
- `backend/app/main.py`: registro del router v2.
- `backend/tests/test_sync_v2_push.py`: suite nueva.

## Pruebas

`backend/tests/test_sync_v2_push.py` (8 pruebas):

1. v1 intacto (contexto, push de dominio rechazado, push de galpón aceptado), contexto v2 y rechazo de `protocol_version` incorrecto.
2. Autenticación, `device_id` del token, rechazo de `scope_id` en el cuerpo y referencia de otro ámbito sin filtrar propiedad.
3. Create y update de las cinco entidades, no-op y conservación de `categoria_ml`/`ultimo_peso_g` fuera del contrato.
4. Allowlist estricta, campos del servidor rechazados, `NULL` distinto de cero y decimal de peso inválido.
5. Dependencias dentro del lote: padre rechazado, hija `DEPENDENCY_REJECTED`, orden de llegada y escritura correcta cuando el padre ya fue aceptado.
6. Recibo idempotente, replay exacto, reutilización de `operation_id`, versión obsoleta y versión superada.
7. Rollback de publicación: sin fila de pesaje, sin secuencia, sin historial y recibo del rechazo reproducible.
8. Cursor v2 independiente, paginación, replay desde el inicio, todas las entidades, exclusión de `galpon|poza` y cursores cruzados v1/v2 rechazados.

Verificación ejecutada secuencialmente sobre PostgreSQL temporal:

```text
python -m pytest backend/tests/test_sync_v2_push.py \
  backend/tests/test_sync.py \
  backend/tests/test_sync_controller.py \
  backend/tests/test_sync_cursor.py \
  backend/tests/test_pull_domain.py \
  backend/tests/test_integracion_d1_d2.py -q
61 passed
```

La base de verificación se creó con nombre único (`cuyielite_verify_<sufijo>`); cada suite que necesita base propia creó y eliminó su base hija. No se reutilizó ninguna base existente, no se ejecutó ETL y no se importaron archivos reales. Los recursos temporales se eliminaron al cierre.

No se repitió `tools/db_migrate/tests/test_migrations.py`: no se agregó ni editó una migración y esa suite exige una base llamada `cuyielite_test`, prohibida para esta verificación. La aplicación de `0001`–`0004` sí quedó ejercitada por la prueba integrada y por la suite v2.

## Límites y pendientes

- **Cliente pendiente:** negociación de protocolo v2, envío de outbox de dominio, persistencia del cursor v2 y aplicación idempotente en SQLite/UI.
- **Verificación nativa del push pendiente:** no se ejecutó un push v2 desde Windows/Android.
- **D7 nativo pendiente:** Windows solo alcanzó `GET /sync/context`; Android no se ejecutó. Esta entrega no modifica ese estado.
- Sin autenticación de producción, aprovisionamiento ni rotación de tokens.
- Sin retención/purga de historial ni código de resincronización requerida; hoy el historial es inmutable y no se purga.
- Sin CHECK de base de datos para la exclusividad de `pesajes` (0005 ausente); la regla vive en `publicar_cambios`.
- Un `create` con un UUID que ya existe en otro ámbito responde `ALREADY_EXISTS` sin revelar el ámbito propietario; el conflicto es de identidad global, no de escritura.
- El recibo de una operación rechazada se conserva para replay exacto, igual que v1.
