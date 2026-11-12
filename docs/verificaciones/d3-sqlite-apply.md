# D3: SQLite de trabajo v4 y aplicación transaccional del pull

Estado: **IMPLEMENTADO Y VERIFICADO EN PRUEBAS, BUILDS Y EJECUCIÓN NATIVA (WINDOWS/ELECTRON Y ANDROID)**. Migración v3→v4, staging durable y aplicación de las cinco entidades de dominio, ejercitados en runtime con datos sintéticos. Sin UI D4, push v2 ni ETL.

Actualización 2026-11-12: el cliente ya integra push/pull v2 y usa una migración v4→v5 que agrega el cursor v2. Ver [sync-domain-push-v2-cliente](sync-domain-push-v2-cliente.md). El recorrido nativo de esa integración sigue pendiente.

Rama: `feat/sync-d3-sqlite-apply`, desde `origin/dev` `4e8585e` (D1 y D2 integrados).

## Alcance

- Migración incremental del esquema SQLite de Trabajo de v3 a v4, conservando filas, UUID, relaciones, outbox, `record_state`, conflictos y cursor.
- `sync_inbox` durable para registros cuya dependencia llega en una página posterior.
- Aplicación local transaccional de páginas de `GET /sync/pull` para `galpon`, `poza`, `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`.
- Sin formularios ni UI de dominio (D4), sin push v2, sin ETL, sin ML/RAG.

## Esquema v4

`WORK_DOMAIN_SYNC_SQL` (nuevo, checksum propio) define el destino v4. No modifica `WORK_SYNC_SQL` v3 ni el checksum de C2.

| Tabla | Cambio |
| --- | --- |
| `sync_record_state` | CHECK de `entity` ampliado a las siete entidades. Se recrea con copia conservando filas. |
| `sync_outbox` | CHECK de `entity` ampliado, mismas columnas, estados e índices (`sync_outbox_one_prepared`, `sync_outbox_record`). Se recrea conservando `local_seq`, `operation_id`, `frozen_request`, recibos y cabezas. |
| `sync_inbox` | Nueva: `dataset_id`, `scope_id`, `seq`, `entity`, `record_id`, `server_version`, `payload` original, `missing_refs`, `state` (`staged`, `applied`, `incomplete`), `code`, `received_at`, `applied_at`. Única por `(dataset_id, scope_id, entity, record_id)`. |

La migración valida v3 (familia, checksum C2, checksum de sync v3 y migración `0002_work_sync`), copia dentro de una transacción con FKs diferidas, verifica que no se pierdan filas, actualiza `schema_version=4`, guarda `previous_sync_checksum` y `previous_sync_migration_id`, fija `sync_migration_id='0003_work_domain_sync'`, `sync_schema_checksum` al checksum v4 y `PRAGMA user_version=4`. Un fallo revierte todo y deja la base en v3.

## Aplicación de páginas

Orden de dependencia dentro de la página: `galpon`, `poza`, `cuyes`, `partos`, `eventos`, `parto_crias`, `pesajes`; dentro de una entidad, por secuencia. El cliente no depende de que el servidor respete ese orden.

| Situación | Comportamiento |
| --- | --- |
| Registro nuevo o corrección | Upsert de negocio + `sync_record_state` con versión/snapshot. |
| Versión de servidor menor | Se ignora (`ignoredOlder`), sin retroceso. |
| Misma versión y mismo snapshot | No-op. Misma versión con snapshot distinto: error. |
| Página repetida | Si el cursor local ya es el `next_cursor` de la página, devuelve 0 aplicados; no duplica ni altera. |
| Dependencia ausente | Se guarda en `sync_inbox` (`staged`) con `missing_refs`; el cursor avanza; se reintenta al final de la página y al iniciar el siguiente pull. |
| Dependencia que llega después | `reconcileInbox` aplica el pendiente, marca `applied` y conserva el payload. |
| Conflicto con outbox pendiente | Se conserva el contenido local, se guarda el snapshot central en `record_state`, la operación pasa a `state='conflict'` con recibo `VERSION_CONFLICT`; no se sobrescribe `business_snapshot`. |
| `UNIQUE(cuy_id)` en `parto_crias` | El registro queda `incomplete` con `code='UNIQUE_CONFLICT'`, payload y diagnóstico conservados; la fila existente no se toca. |
| Fallo inesperado a mitad de página | Rollback de datos, inbox y cursor; se reintenta desde el mismo cursor. |

`sync_inbox` conserva los estados `staged` (recibido, pendiente), `applied` (aplicado) e `incomplete` (error permanente diagnosticable). No se compactan las filas `applied`; la retención/compactación queda como decisión posterior.

Una referencia con UUID válido que no existe es indistinguible de una dependencia que llegará después: permanece `staged` con `missing_refs` visible vía `listInboxEntries`. No se convierte en `NULL`, cero ni borrado, y no se inventan padres. Una referencia con formato inválido rechaza la página antes de escribir.

## Corrección de contrato detectada

El publicador central serializa `created_at`/`updated_at` con zona `+00:00` y microsegundos; el validador del cliente solo aceptaba `Z`. D3 acepta ambos formatos (`Z` o `±HH:MM`) y fechas de negocio `YYYY-MM-DD`. Sin esta corrección, snapshots reales de D1/D2 habrían sido rechazados.

## Archivos

- `client/src/data/work.sync.schema.ts`: constantes v4 y `WORK_ENTITY_NAMES`.
- `client/src/data/work.sync.migration.ts`: validación v4, `migrateWorkSyncV2ToV3`, `migrateWorkSyncV3ToV4`.
- `client/src/data/work.sync.pull.validation.ts`: siete entidades y validadores de datos.
- `client/src/data/work.sync.pull.apply.ts`: aplicación, inbox, conflictos, reconciliación y diagnóstico.
- `client/src/data/work.sync.pull.runner.ts`: reconciliación al iniciar y contadores.
- `client/src/data/work.sync.pull.ts`: exportaciones.
- `client/src/data/work.sync.conflicts.review.ts`: la revisión v1 ignora conflictos de dominio hasta D4.
- Pruebas: `work.sync.migration.v4.test.ts` (5), `work.sync.pull.domain.test.ts` (8), `work.sync.pull.validation.test.ts` (+1), `work.sync.migration.test.ts` (expectativas v4).

## Verificación ejecutada

```powershell
cd client
npm run test:unit
# 32 archivos, 173 pruebas passed

npm run lint
# eslint, typecheck:e2e y prettier --check: sin errores

npm run build
# tsc + vite build: OK

npm run build:electron
# tsc + vite build --mode electron: OK

npm --prefix electron run build
# tsc del proceso principal Electron: OK
```

Builds nativos:

- **Android:** `npx cap copy android` + `gradlew assembleDebug` → **BUILD SUCCESSFUL** (246 tareas). Requiere JDK 21+: con el JDK 17 del entorno falló `invalid source release: 21`; se usó el JBR de Android Studio (Java 25). APK en `client/android/app/build/outputs/apk/debug/app-debug.apk`.
- **Electron:** `npm run pack` en `client/electron` → instalador NSIS generado en `client/electron/dist/CuyiElite Setup 0.0.0.exe` (≈121 MB). Sin firma de código, como ya estaba configurado.

## Verificación nativa en ejecución

Datos sintéticos, bases temporales con nombre único y sin tocar la base Demo ni datos reales. Los arneses fueron temporales y se retiraron antes de cerrar; no aparecen en Git.

### Windows / Electron

- Arnés temporal ejecutado con el runtime Electron **45.2.1 / Node 24.22.1**, `--user-data-dir` separado y base en `…\cuyielite-work\trabajo.db`. Cargó los módulos compilados del plugin (`work.sync.migration.js`, `work.sync.pull.apply.js`) copiados sin modificar a un directorio temporal.
- Base v3 representativa: 1 fila sintética por tabla de dominio, una operación de outbox en `conflict` con su recibo, `record_state` y cursor `native-cursor-v3`.
- Resultado: **25/25 comprobaciones OK**, con `ok:true`. Se observó migración a v4 (`user_version=4`, `schema_version=4`, `0003_work_domain_sync`, `previous_sync_checksum`), filas intactas, outbox/estado/cursor conservados, `sync_inbox` creado y segunda inicialización no-op.
- Aplicación: página con las cinco entidades de dominio y una poza v2 con borrado lógico → 6 aplicados, cursor `native-c1`, referencias y `foreign_key_check` correctos. Reenvío idempotente → 0 aplicados sin duplicar. Conflicto local → negocio local intacto, outbox `conflict` con `VERSION_CONFLICT` y snapshot central guardado. Dependencia posterior → `staged` con `evento_id->eventos`, cursor avanzado y aplicación al llegar el padre. Fallo inyectado en staging → rollback sin filas nuevas y cursor sin avance.
- Smoke de la app empaquetada: `CuyiElite.exe --user-data-dir=<temporal>` permaneció en ejecución 12 s y se cerró; el `userData` temporal se eliminó.

### Android

- Emulador **API 36 (Android 16)** dedicado: AVD temporal clonado (`d3tmp_*`), arrancado sin ventana, con `-wipe-data`; se eliminó al terminar. No se usó ni modificó el AVD habitual.
- APK debug construido con un arnés temporal embebido (bandera de build) que usa **Capacitor SQLite** sobre una base aislada `d3harness*`; el arnés y el flag se retiraron después y el bundle normal se regeneró y copió.
- Misma secuencia de 25 comprobaciones: **`ok:true`**, con base inicial v3, migración a v4, filas/outbox/`record_state`/cursor conservados, inbox creado, segunda inicialización no-op, aplicación de las cinco entidades, idempotencia, conflicto local, dependencia posterior y rollback sin avance de cursor. Resultado capturado en logcat con el marcador `D3_NATIVE_RESULT`.
- Limpieza: app desinstalada (elimina sus datos), emulador detenido y AVD temporal borrado. El borrado explícito de la base del arnés vía `deleteDatabase` devolvió “No available connection” porque la conexión ya estaba cerrada; el `uninstall` y la eliminación del AVD dejaron el recurso fuera del entorno.

### Persistencia Android tras force-stop

Cierre forzado y relanzamiento del proceso con la misma base aislada (`d3persist`), en un AVD temporal nuevo y el APK D3 ya verificado. Fase 1 creó el estado y terminó sin limpiar; luego `adb shell am force-stop co.ucc.cuyielite` (sin PID tras el cierre) y relanzamiento de `MainActivity` para la fase 2.

Fase 1 (`D3_PERSIST_PHASE1`, `ok:true`) dejó: cursor `native-c5`, 1 registro `staged` (`pesajes` con `missing_refs: ["evento_id->eventos"]`), 1 `applied`, y el conflicto local en outbox.

Fase 2, tras relanzar el proceso (`D3_PERSIST_PHASE2`, **`ok:true`, 14/14**):

- `user_version=4`, `schema_version=4`, `sync_migration_id=0003_work_domain_sync`.
- Cursor `native-c5` conservado.
- Filas aplicadas conservadas (`cuyes` con `CRIA-N`, poza con `P-EDIT` y `deleted_at`, pesajes aplicados).
- El pendiente sigue sin aplicar y su fila `staged` persiste con el mismo `missing_refs`.
- El `applied` de inbox persiste; el conflicto local sigue en `conflict` con `VERSION_CONFLICT`.
- Segunda inicialización no-op (identidad y checksum estables) y `foreign_key_check` limpio.

Limpieza: app desinstalada, emulador detenido y AVD temporal eliminado (solo queda el AVD habitual). El arnés de persistencia y su flag de build se retiraron; el bundle normal se regeneró y copió.

## Pruebas cubiertas

Migración v4:

1. v3→v4 conserva galpones, outbox (incluido `local_seq`, estado y recibo), `record_state`, cursor y checksum C2.
2. Segunda ejecución no-op; checksum estable.
3. Fallo inyectado en la creación de `sync_inbox` revierte todo y permite reintentar desde v3.
4. v4 incompleto (sin `sync_inbox`) se rechaza sin reparación silenciosa.
5. Una base demo (v1) se rechaza y permanece intacta.

Aplicación:

1. Las cinco entidades se aplican con dependencias resueltas dentro de la misma página (4 staging + reconciliación).
2. Versión y borrado lógico; una página vieja no retrocede.
3. Página repetida idempotente (dos modos: cursor anterior y cursor confirmado).
4. Dependencia posterior: inbox `staged`, cursor avanzado, `missing_refs`, aplicación al llegar el padre.
5. Conflicto local: contenido local y outbox intactos, conflicto explícito y snapshot central guardado.
6. Fallo intermedio: rollback de datos, inbox y cursor.
7. `UNIQUE` de `parto_crias`: `incomplete` diagnosticable sin sobrescribir la relación existente.
8. Reapertura de archivo SQLite: inbox y cursor persisten y el staging se aplica al llegar la dependencia.

Validación: acepta entidades de dominio y timestamps con offset; rechaza entidades desconocidas y datos con campos extra.

## Límites y pendientes

- La ejecución nativa se hizo con arneses de laboratorio sobre la capa de datos, no recorriendo la UI de dominio: D4 no existe todavía. La app empaquetada se verificó solo como arranque.
- No hay UI de dominio (D4); `listInboxEntries` es la API de diagnóstico actual y la revisión de conflictos de dominio aún no se muestra.
- No se compactan filas `applied` de `sync_inbox`.
- Una dependencia que nunca llega permanece `staged`: es reintentable y visible, pero no se marca `incomplete` automáticamente por el fin de una ventana.
- No hay push v2 ni creación de outbox para entidades de dominio; la outbox solo se amplió para el futuro y para registrar conflictos.
- Sin datos reales, Excel, tokens ni credenciales; las pruebas usan UUID y filas sintéticas en memoria, archivos temporales o bases aisladas de emulador.
