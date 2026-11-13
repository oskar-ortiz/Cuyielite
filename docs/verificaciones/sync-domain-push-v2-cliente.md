# D2: integración del cliente con sync de dominio v2

Estado: **RECORRIDOS NATIVOS WINDOWS Y ANDROID VERIFICADOS; D7 GLOBAL SIGUE PENDIENTE POR RAG REAL, RF REAL Y CRITERIOS NO EJECUTADOS**. El push/pull v2 funciona desde la UI empaquetada de Windows y desde Pixel_36, con identidad y datos preservados, no-op, cierre/reapertura, token no persistido y Demo separada.

Rama de integración: `feat/client-sync-domain-v2`, desde `origin/dev` (`b4e9398`, merge del PR #128). Validación nativa: `test/sync-domain-v2-nativo`, desde `origin/dev` (`e977054`, merge del PR #129). Evidencia Android visible: `fix/android-sync-v2-runtime` (PR #131).

## Alcance

El cliente ya usa las rutas v2 del backend fusionado:

- `GET /sync/v2/context`
- `POST /sync/v2/push`
- `GET /sync/v2/pull`

`galpon` y `poza` siguen por v1 (`/sync/context`, `/sync/push`, `/sync/pull`). Las cinco entidades de dominio (`cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias`) se congelan, envían y descargan por v2.

No se implementaron ETL, importación de Excel, autenticación de producción, persistencia de `categoria_ml`/alertas ni cambios de ML/RAG.

## Corrección de campos derivados

`categoria_ml` y `ultimo_peso_g` dejaron de ser editables en el formulario de animal. La ficha los muestra como **derivados del servidor**, en solo lectura. El repositorio tampoco los escribe en `cuyes` al crear o actualizar, ni los incluye en `business_snapshot`; por tanto no llegan a la outbox ni al cuerpo v2. El peso autoritativo sigue siendo `pesajes`.

Se agregaron pruebas de UI (`FormularioCuyo.test.tsx`) y de repositorio para demostrar que no se renderizan como campos editables y que no se publican.

## Contrato conectado

### Negociación

Cada ciclo consulta primero el contexto v1 y luego el contexto v2. El contexto v2 debe:

- declarar `protocol_version=2`;
- conservar el mismo `scope_id` del contexto v1 y el `device_id` local;
- incluir las cinco entidades de dominio en `supported_entities`;
- declarar los límites de pull `50/100`.

Si el transporte no expone v2, el ciclo sigue operando solo v1 y deja las operaciones de dominio en la outbox. Si el contexto v2 existe pero es incompatible, el ciclo falla de forma explícita. El token sigue viviendo solo en memoria.

### Push

La outbox existente se reutiliza sin cambiar su modelo:

- `operation_id` y `frozen_request` se conservan para reintentos de red y resultados desconocidos;
- el cuerpo v2 se congela una vez con `protocol_version=2`;
- `data` se limita a la allowlist v2: en `cuyes` se excluyen `categoria_ml` y `ultimo_peso_g`;
- `client_created_at` se mantiene para `create`; `base_version` sale del recibo aceptado de la predecesora o de `base_anchor`;
- los recibos se validan contra la solicitud y se aplican en una transacción local;
- `accepted`, `conflict` y `rejected` se persisten por operación.

Las operaciones v1 (`galpon`, `poza`) conservan exactamente su cuerpo v1.

### Dependencias

Cuando el backend devuelve `DEPENDENCY_PENDING` o `DEPENDENCY_REJECTED`:

1. Se conserva la operación original con estado `superseded` y su recibo de rechazo.
2. Se crea una operación nueva con **nuevo `operation_id`**, el mismo `business_snapshot`, `base_anchor` y vínculos de dependencia.
3. Las ediciones posteriores del mismo registro y las altas hijas se reencadenan a la operación nueva.
4. El ciclo no reintenta la nueva operación en la misma pasada: su `local_seq` queda después del corte `capturedThroughLocalSeq`. El siguiente ciclo la prepara y la envía.

Esto es necesario porque el backend guarda un recibo por `operation_id`; reenviar el mismo `operation_id` devolvería el rechazo almacenado aunque la dependencia ya exista. El cuerpo congelado sigue siendo idéntico para reintentos de transporte de la misma operación, pero una dependencia rechazada explícitamente se reintenta como una operación nueva.

### Pull

- El runner de D3 se reutiliza con `protocol=2`.
- El cursor v2 es independiente: se guarda en `sync_context.cursor_v2` y no toca `sync_context.cursor` (v1).
- Sin cursor v2 empieza en la secuencia inicial y reproduce el historial retenido de dominio.
- v1 y v2 se ejecutan en el mismo ciclo; ambos usan el inbox durable, el orden por dependencia, el staging y la reconciliación de D3.
- Una página v2 puede venir vacía con `has_more=true` porque el backend filtra `galpon|poza`; el cliente la acepta y avanza el cursor.
- v2 rechaza `galpon|poza` en una página de dominio.
- Un snapshot de push v2 de `cuyes` no incluye campos del servidor; el pull sí. La comparación de misma versión normaliza `categoria_ml` y `ultimo_peso_g`, de modo que no se declara un conflicto falso y se enriquece el snapshot local con la versión central.

## Migración SQLite

Se agregó la migración incremental **v4 → v5**:

- `sync_context.cursor_v2 TEXT`;
- `meta.schema_version=5`, `sync_v2_schema_checksum` y `sync_v2_migration_id='0004_work_sync_v2'`;
- se conservan `sync_schema_checksum`, `sync_migration_id`, el cursor v1, la outbox, el inbox, los conflictos y todos los datos;
- no se editaron checksums ni migraciones históricas.

## Archivos

- `client/src/data/work.sync.schema.ts`: versión y DDL v5.
- `client/src/data/work.sync.migration.ts`: migración y validación v5.
- `client/src/data/work.sync.cursor.ts`: lectura/escritura del cursor por protocolo.
- `client/src/data/work.sync.client.ts`: congelado v2, allowlist, protocolo y reintento de dependencias.
- `client/src/data/work.sync.coordinator.ts`: negociación v1/v2, envío enrutado y doble pull.
- `client/src/data/work.sync.transport.ts` y `client/plugins/sync-lab/electron/dist/plugin.mjs`: rutas v2 nativas.
- `client/src/data/work.sync.pull.validation.ts`, `work.sync.pull.runner.ts`, `work.sync.pull.apply.ts`: validación, cursor y aplicación por protocolo.
- `client/src/data/work.sync.v2.test.ts`: pruebas nuevas de integración del cliente v2.

## Verificación

### Pruebas

```text
npx vitest run --maxWorkers=1
37 archivos, 198 pruebas: OK
```

Incluye 10 pruebas nuevas: 7 de `work.sync.v2.test.ts`, 2 de rutas v2 en `work.sync.transport.test.ts` y 1 de preservación v4→v5 en `work.sync.migration.v4.test.ts`.

Tras la corrección de campos derivados y el chequeo de dependencias locales se ejecutaron 32 pruebas dirigidas sobre `work.domain.repository.test.ts`, `work.sync.v2.test.ts`, `FormularioCuyo.test.tsx`, `Animales.test.tsx`, `work.sync.client.test.ts` y `work.sync.coordinator.test.ts`: **32 passed**. No se repitió la suite completa porque el entorno ya estaba limitado de memoria; lint, typecheck y builds sí se repitieron.

Cubren:

- congelado v2 sin campos del servidor;
- protocolo v1 para galpon/poza y v2 para dominio;
- cursor v2 separado, primer pull desde cero, replay idempotente y página vacía con `has_more`;
- staging/inbox de una dependencia y aplicación al llegar el padre;
- rechazo de `galpon|poza` en páginas v2;
- dependencia rechazada con nueva operación y reintento posterior;
- ciclo mixto v1/v2 con cursores distintos;
- preservación de outbox, inbox, conflicto y cursor v1 en la migración v5.

### Lint, tipos y builds

```text
npm run lint                 OK (eslint, typecheck:e2e, prettier)
npm run build                OK (web)
npm run build:electron       OK
npm run build:migration      OK
npm run sync:electron        OK
gradlew assembleDebug        BUILD SUCCESSFUL
```

### Integración HTTP real

Se usó un contenedor PostgreSQL temporal con nombre único, base `cuyielite_client_v2_<sufijo>`, bootstrap + migraciones `0001`–`0004`, backend `uvicorn` en loopback y un cliente Node con SQLite en memoria que importa los módulos compilados del cliente.

Resultado con datos sintéticos:

- primer ciclo: 3 envíos (galpón y poza v1; cuy v2);
- segundo ciclo: 5 envíos v2 (cría, parto, `parto_crias`, pesaje, evento);
- pull v2 directo desde el cursor independiente: 1 registro central publicado por el backend aplicado en SQLite;
- tercer ciclo: 1 actualización v2 aceptada;
- cuarto ciclo: 1 conflicto de versión con `VERSION_CONFLICT`; el estado local `ACTIVO` se conservó y el snapshot central quedó en versión 3;
- cursores v1 y v2 separados, ambos firmados y con `protocol_version` distinto;
- todas las operaciones v2 terminaron `accepted` salvo el conflicto intencional;
- recursos temporales eliminados al cierre: contenedor, base, backend, perfiles y archivos de trabajo.

## Recorrido nativo sintético (2026-11-12)

### Entorno y aislamiento

- PostgreSQL temporal con nombre único, bootstrap + migraciones `0001`–`0004`.
- Backend `uvicorn` en `127.0.0.1:8000`, con `CUYIELITE_SYNC_LAB_ENABLED=1` y firma de cursor sintética.
- Windows: app empaquetada `win-unpacked`, perfil de Trabajo aislado mediante copia + junction; el perfil real se restauró al terminar.
- Android: AVD nuevo `CuyiElite_V2_Verify` (API 36, `google_apis`, x86_64), `adb reverse tcp:8000 tcp:8000`, APK debug. Pixel_36 no se modificó.
- La comprobación inicial de arranque en Windows usó el perfil real y migró un `trabajo.db` **vacío** de v4 a v5; no había filas. Después se trabajó con la copia aislada y se restauró el perfil real.

### Windows (verificado)

Flujo desde la UI real: crear galpón `Galpón Nativo V2`, poza `P-NAT-1`, madre `C-NAT-MADRE`, cría `C-NAT-CRIA`, parto con vínculo `parto_crias`, pesaje `995.50` y evento `DESTETE`.

Resultado del primer ciclo:

- `Se recibieron 0 registro(s) y se enviaron 8 cambio(s)`.
- Pendientes, conflictos y rechazados: `0`.
- Outbox: 8 operaciones `accepted` (galpón, poza, 2 cuyes, parto, parto_crias, pesaje, evento).
- Central: 8 cambios, 8 recibos, todas las entidades en versión 1.
- Cursores v1 y v2 independientes, ambos en `after=8`.
- Cierre y reapertura: datos y cursores persistieron; el token quedó vacío.
- Demo mostró sus 4 galpones y ningún registro de Trabajo.

### Android (intento previo, parcial)

AVD nuevo, Trabajo vacío y token provisionado en el mismo `scope_id` del cliente Windows.

- Pull inicial v2 + v1: `Se recibieron 8 registro(s) y se enviaron 0 cambio(s)`.
- Datos visibles: galpón, 2 animales, parto con `C-NAT-CRIA`, pesaje `995.50` y evento.
- SQLite local: 1 galpón, 1 poza, 2 cuyes, 1 parto, 1 `parto_crias`, 1 pesaje, 1 evento; outbox/inbox vacíos.
- Cursores v1 y v2 en `after=8`; token vacío tras `force-stop` y reapertura.
- Demo mostró sus 4 galpones, separada de Trabajo.

Android push: se creó desde la UI un segundo pesaje `1000.25` (`2026-11-26`, `DESTETE`) y se sincronizó.

- Outbox local: operación `accepted`; cursor v1/v2 en `after=9`.
- Central: pesaje en versión 1; 9 recibos y 9 cambios.
- La UI quedó mostrando “Sincronizando…” y el entorno llegó a **~38 MB de memoria libre**; un `force-stop`/reapertura posterior mostró una pantalla blanca. Se detuvo el emulador y se eliminó el AVD de prueba.
- Por ese bloqueo, en ese intento **Android no se marcó como completamente verificado** y **D7 nativo no se declaró completo**, aunque el pull y el push quedaron confirmados en SQLite y PostgreSQL.

### Reintento Android-only previo (2026-11-13)

Se intentó aislar Android sin Electron, con AVD temporal `CuyiElite_Android_Verify` (API 36, `google_apis`, x86_64), 1024 MB de RAM, pantalla 720×1280, sin ventana y con GMS deshabilitado después del arranque. PostgreSQL/backend temporales y `adb reverse tcp:8000 tcp:8000` se prepararon de nuevo.

Evidencia recogida:

- Memoria libre del host: **~15 MB** al iniciar la app; `Memory Compression` superaba 3.8 GB.
- La app mostró `System UI isn't responding` antes de poder navegar; `MainActivity` tardó 18 s en mostrarse.
- Logcat: `lowmemorykiller: Kill 'com.android.keychain' ... reason: low watermark is breached`, seguido de `printspooler` y `localtransport`.
- `dumpsys meminfo co.ucc.cuyielite` mostró el proceso vivo, pero el entorno no permitió llegar a la pantalla de sincronización.
- No se capturó un error JavaScript/WebView propio del cliente ni una respuesta fallida del backend porque la app no llegó a iniciar el ciclo.

Conclusión: el reintento no reproduce un defecto de código; reproduce **agotamiento de memoria del host/emulador**, coherente con el spinner y la pantalla blanca de la corrida anterior. No se modificó código ni se simuló la UI con SQL. En ese intento, Android seguía **no verificado** y D7 **no completo**.

### Intento previo con emulador visible (2026-11-13, no ejecutado)

El PR #131 seguía abierto, así que se continuó en `fix/android-sync-v2-runtime`. Antes de iniciar el AVD se midió la memoria del host:

- **0.72 GB libres de 7.19 GB totales**.
- Umbral indicado para esta verificación: 3 GB libres.
- No se inició Pixel_36 ni Android Studio Device Manager; no se abrió ninguna UI Android.
- No se borró, reinstaló ni modificó Pixel_36. No se abrió Electron.
- Auditoría de recursos propios: no quedaban emuladores, backends ni contenedores iniciados por esta tarea. El contenedor `cuyielite-s3-test` (~35 MB) pertenece a una tarea anterior y no se detuvo.
- Consumidores externos observados: Memory Compression ~1.32 GB, `opencode-cli` ~309 MB, `vmmemWSL` ~266 MB, `studio64` ~242 MB, OpenCode ~212 MB, Docker backend ~134 MB, antivirus ~132 MB, ChatGPT ~169 MB, Docker Desktop ~79 MB, `codex` ~65 MB. No se cerró ninguna aplicación del usuario.

Por la regla de seguridad del encargo, no se forzó el emulador. No se ejecutó contexto, pull, push, recibo, reapertura ni comprobación Demo en esa sesión. En ese intento, Android y D7 seguían incompletos.

### Recorrido Android visible sobre Pixel_36 (2026-11-13)

Se retomó la sesión ya abierta de Pixel_36 (API 36, 1080×2400), sin crear, clonar ni reiniciar el AVD. La app instalada era `co.ucc.cuyielite` debug, versionCode 1, con una base de Trabajo v3 ya vinculada al ámbito sintético `1fa8fd97-1aee-4b07-94fd-41428ef87ea6` y al dispositivo `3720974e-7df5-4b3e-bd9e-7dd50cae2aa5`; se conservaron ambos.

- Se actualizó el APK con `adb install -r` reutilizando el debug existente. La migración v3→v5 conservó `scope_id`, `device_id`, el cursor v1, 2 galpones, 2 pozas y 4 operaciones `accepted` de la outbox.
- La clave con la que se firmó el cursor v1 original no estaba disponible. Para no reiniciar la identidad ni el cursor, se volvió a firmar el mismo payload (`after=8`, mismo ámbito y protocolo 1) con la clave temporal del laboratorio. Fue el único acceso de escritura directa a SQLite y no alteró posición, identidad ni datos de negocio.
- Laboratorio: PostgreSQL temporal con nombre único, migraciones `0001`–`0004`, backend `uvicorn` en `127.0.0.1:8000` y `adb reverse tcp:8000 tcp:8000`. Se provisionaron el ámbito y el dispositivo preservados y un dispositivo semilla; no se conectaron datos reales.
- Se publicaron 5 registros sintéticos por HTTP: galpón `Galpón Android V2`, poza `P-AND-V2`, cuy `C-AND-V2`, parto del `2026-02-01` y evento `DESTETE` del `2026-03-01`.

Pull y visualización:

- Ciclo desde la UI: **5 recibidos, 0 enviados**; la pantalla salió de “Sincronizando…” y mostró “Sincronización completada”.
- Cursores v1 y v2 independientes, ambos en `after=13`.
- Tras el pull se vieron en la UI el galpón, la poza, el animal `C-AND-V2`, el parto y el evento; SQLite local quedó con 3 galpones, 3 pozas, 1 cuy, 1 parto, 1 evento y 0 pesajes.

Push y recibo:

- Se creó desde el formulario real un pesaje de `1234.50` g, etapa `DESTETE`, fecha nula, para `C-AND-V2`.
- Ciclo: **0 recibidos, 1 enviado**; la UI mostró el resultado final y la outbox local guardó la operación `accepted`.
- Cursores v1 y v2 en `after=14`.
- Central: pesaje en versión 1, 6 recibos y 6 cambios para el ámbito; local: 5 operaciones `accepted` (4 previas + pesaje).

No-op y reapertura:

- Segundo ciclo: **0 recibidos, 0 enviados**; no se duplicaron filas ni recibos. Central siguió con 6 recibos y 6 cambios; local con un solo pesaje.
- `force-stop` + relanzamiento sin borrar datos: la primera captura a los 8 s mostró el WebView en blanco; a los ~10 s renderizó “Elegir modo”. El proceso estaba vivo (`PSS` ~103 MB), sin `ANR`, `FATAL` ni `lowmemorykiller` en Logcat; se trató del arranque del WebView, no de un cierre.
- Tras reabrir: los 3 galpones, la poza `P-AND-V2`, el animal, el parto, el pesaje `1234.50` y el evento persistieron; cursores v1/v2 en `after=14`; identidad intacta; 5 operaciones `accepted`.
- El campo de token quedó vacío y el botón deshabilitado con “Ingresa el token de laboratorio para habilitar la sincronización”; el token no se persistió.
- Demo abrió con sus 4 galpones (`Galpón AndEdit`, `Galpón Sur`, `Galpón Occidente`, `Galpón Este`) y el distintivo “Datos de demostración”, sin registros de Trabajo.

Conclusión: el recorrido Android de push/pull v2 quedó verificado de extremo a extremo sobre Pixel_36, con identidad y datos preservados y sin cambios de código.

### Límites de esta corrida

- El recorrido Android se ejecutó sobre Pixel_36 ya iniciado y con `adb install -r`; no se creó, reinició ni borró el AVD. La pantalla blanca de ~10 s al relanzar se documentó como arranque del WebView, sin `ANR` ni `lowmemorykiller`.
- La clave original del cursor v1 no era recuperable. Se re-firmó el mismo payload (`after=8`) con una clave temporal; la posición y la identidad se conservaron, pero el cursor no se puede validar con la clave histórica.
- RAG real y artefacto RF real no se ejecutaron: no hay corpus/embeddings/modelo en el entorno. No se sustituyeron por mocks como evidencia real.
- No se probó ML nativo en esta corrida; las reglas reales ya estaban cubiertas por las pruebas de D5.
- La autenticación de producción, la rotación de tokens y la UI de resolución de conflictos de dominio siguen pendientes.

## Límites

- **Recorrido nativo:** Windows empaquetado y Android sobre Pixel_36 verificados de extremo a extremo para pull, push, no-op, reapertura, token no persistido y Demo separada. Android conservó la identidad sintética y los datos previos; la clave original del cursor v1 no era recuperable y se re-firmó el mismo payload con una clave temporal.
- **D7 global pendiente:** el recorrido nativo Windows/Android quedó completo, pero RAG real, artefacto RF real, autenticación de producción y otros criterios no ejecutados siguen pendientes.
- `categoria_ml` y `ultimo_peso_g` ya no son editables en el formulario ni se publican; la ficha los muestra como derivados del servidor.
- La revisión/resolución de conflictos de dominio sigue limitada a la outbox y a la lectura; la UI de resolución es de v1 (`galpon|poza`).
- No hay autenticación de producción, rotación de tokens ni retención/purga de historial.
- El cliente envía una operación por solicitud; no agrupa lotes. El backend soporta lotes y resultados parciales, pero el cliente conserva la atomicidad por operación.
