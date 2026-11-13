# D2: integración del cliente con sync de dominio v2

Estado: **CORRECCIÓN DE CAMPOS DERIVADOS Y RECORRIDO NATIVO WINDOWS VERIFICADOS; ANDROID VERIFICADO PARCIALMENTE; D7 NATIVO SIGUE PENDIENTE**. El push/pull v2 funciona desde la UI empaquetada de Windows y desde un emulador Android aislado; la memoria del entorno impidió completar el cierre visual de Android tras su último push.

Rama de integración: `feat/client-sync-domain-v2`, desde `origin/dev` (`b4e9398`, merge del PR #128). Validación nativa: `test/sync-domain-v2-nativo`, desde `origin/dev` (`e977054`, merge del PR #129).

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

### Android (parcial)

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
- Por ese bloqueo, **Android no se marca como completamente verificado** y **D7 nativo no se declara completo**, aunque el pull y el push quedaron confirmados en SQLite y PostgreSQL.

### Límites de esta corrida

- RAG real y artefacto RF real no se ejecutaron: no hay corpus/embeddings/modelo en el entorno. No se sustituyeron por mocks como evidencia real.
- No se probó ML nativo en esta corrida; las reglas reales ya estaban cubiertas por las pruebas de D5.
- La autenticación de producción, la rotación de tokens y la UI de resolución de conflictos de dominio siguen pendientes.
- Android no se marca completo por el bloqueo de memoria descrito.

## Límites

- **Recorrido nativo:** Windows empaquetado verificado de extremo a extremo. Android verificado en pull, persistencia y Demo; su último push quedó confirmado en SQLite/PostgreSQL, pero la UI no alcanzó el estado final por falta de memoria. Android no se marca completo.
- **D7 nativo pendiente:** Windows ya completó el recorrido; Android no. Por eso D7 no se declara completo.
- `categoria_ml` y `ultimo_peso_g` ya no son editables en el formulario ni se publican; la ficha los muestra como derivados del servidor.
- La revisión/resolución de conflictos de dominio sigue limitada a la outbox y a la lectura; la UI de resolución es de v1 (`galpon|poza`).
- No hay autenticación de producción, rotación de tokens ni retención/purga de historial.
- El cliente envía una operación por solicitud; no agrupa lotes. El backend soporta lotes y resultados parciales, pero el cliente conserva la atomicidad por operación.
