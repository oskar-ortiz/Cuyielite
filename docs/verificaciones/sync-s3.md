# S3 — push de sincronización con recibos idempotentes

## Alcance

S3 cierra el tramo de subida: el cliente prepara y congela una operación de la cola local, la envía por un transporte nativo y aplica el recibo del servidor. El servidor confirma cada `operation_id` una sola vez y devuelve el mismo recibo si la solicitud se repite.

Entra en esta entrega:

- Transporte nativo en Windows empaquetado (Electron) y en Android.
- Error explícito cuando no existe transporte nativo: no hay camino alternativo por `fetch` del renderer.
- Vinculación del scope local contra el contexto autorizado del servidor.
- Rechazo de redirecciones HTTP 3xx en lugar de seguirlas.

No entra: pull, resolución de conflictos, edición desde formularios ni interfaz de sincronización. Eso corresponde a S4–S6.

## Diseño del transporte

Windows: el plugin `capacitor-sync-lab` se registra en el manifest de Capawesome junto a `capacitor-sqlite-poc`. El proceso principal resuelve la URL fija `http://127.0.0.1:8000`, el método HTTP, el `Authorization` y las operaciones de sincronización sobre SQLite. El renderer solo aporta el token en memoria y el cuerpo congelado; no elige URL, ruta, método ni SQL. `main.ts` conserva `createCapacitorElectronApp(config)`.

Android: el transporte usa `CapacitorHttp` importado de `@capacitor/core`, con `disableRedirects: true`. Una respuesta 3xx se rechaza antes de interpretar el cuerpo.

Ambas plataformas comparten el mismo contrato: `context(token)` y `push(token, request)`. En web, iOS o cualquier otra plataforma `createFetchTransport()` lanza un error antes de emitir cualquier solicitud.

## Verificación automatizada

En `client/`:

```text
npx tsc --noEmit           exit 0
npx vitest run             17 archivos, 95 pruebas, todas pasan
npm run lint               ESLint, typecheck:e2e y Prettier correctos
npm run build:migration    exit 0 (emite también plugins/sync-lab/electron/dist)
npm run build              exit 0
npm run build:electron     exit 0
npx cap sync android       exit 0
npx cap sync @capawesome/capacitor-electron  exit 0, 2 plugins con implementación Electron
```

En la raíz, con `TEST_DATABASE_URL` apuntando a `cuyielite_test`:

```text
python -m pytest backend -q   41 passed
```

Las pruebas nuevas de esta entrega cubren: preparación y congelamiento de una operación, respeto de predecesora y padre, aplicación y validación de recibos, conservación de `prepared` tras reapertura, vinculación condicional de `scope_id`, delegación del transporte Electron, `CapacitorHttp` con loopback fijo y `disableRedirects`, rechazo de 3xx, error HTTP no exitoso y ausencia de transporte en web e iOS.

## Laboratorio

- PostgreSQL temporal dedicado: base `cuyielite_s3_lab_91c4f7` en `127.0.0.1:5433`, con DDL y migraciones centrales aplicadas. Se descartó al terminar.
- Backend real: `uvicorn backend.app.main:app` en `127.0.0.1:8000`. `/health` 200 y `/sync/context` sin token 401.
- Token de laboratorio de 48 caracteres, uno por dispositivo, entregado en memoria al cliente. Nunca se escribe en la base local ni en archivos del repositorio.
- Dos dispositivos autorizados en el mismo scope `ea55e523-b0a0-477e-a826-11c05db8f92d`, uno por cliente, para poder exigir igualdad de `device_id` en cada vinculación.
- El acceso temporal de laboratorio usado para disparar las operaciones se retiró de `src/` y de la API del plugin antes de los commits; las compilaciones finales no lo contienen.

## Windows empaquetado

Artefacto: `client/electron/dist/win-unpacked/CuyiElite.exe`, perfil aislado con `--user-data-dir` y control por CDP.

```text
CuyiElite.exe --user-data-dir=<perfil temporal> --remote-debugging-port=9333
```

Resultados reales:

| Paso | Resultado |
|---|---|
| Arranque del bundle empaquetado | `title` CuyiElite, `root` presente |
| Plugins del puente | `SqlitePoc`, `SyncLab`, además de los de plataforma |
| Modo Demostración (UI) | 4 galpones de demostración |
| `fetch` del renderer bloqueado | toda llamada falla con "fetch del renderer bloqueado" |
| `context` por el plugin | 200, scope y `device_id` reales |
| Vinculación y alta de galpón | `accepted`, versión 1 |
| Alta de poza bajo ese galpón | `accepted`, versión 1 |
| Cierre total y reapertura | mismo `dataset_id`, `device_id`, `scope_id`; 1 galpón, 1 poza, 2 operaciones `accepted` |
| Reenvío de la solicitud congelada | recibo recuperado; sin filas, recibos ni cambios nuevos |
| Modo Trabajo (UI) | lista el galpón sincronizado |

Identidad y registros:

```text
dataset_id  14d1f0ff-459c-42bb-875e-5105777f2bdc
device_id   238f1abf-62a4-41f7-b65f-87656f466899
scope_id    ea55e523-b0a0-477e-a826-11c05db8f92d
galpón      6690d01b-a815-4e10-b4dc-12468be6bd41
poza        e5924038-ad32-4fca-aa04-36e58265f8d5
```

El reenvío se hizo con el cuerpo congelado leído de `sync_outbox` y el `fetch` del renderer bloqueado: la solicitud salió del proceso principal.

## Android emulado

AVD temporal `CuyiS3Lab` (Android 36, `google_apis`, `x86_64`), separado de `Pixel_36`. Backend alcanzado con `adb reverse tcp:8000 tcp:8000`; la app usa `http://127.0.0.1:8000` y el `network_security_config` de debug habilita tráfico en claro solo para `127.0.0.1`. La configuración de release queda sin excepciones.

Resultados reales:

| Paso | Resultado |
|---|---|
| `assembleDebug` | BUILD SUCCESSFUL |
| Manifest fusionado de debug | `android:networkSecurityConfig="@xml/network_security_config"` |
| Recurso empaquetado | `base-config cleartextTrafficPermitted="false"` + dominio `127.0.0.1` permitido |
| Arranque | `platform` android, `https://localhost/` |
| `fetch` del renderer bloqueado | toda llamada falla con "fetch del renderer bloqueado" |
| `context` por `CapacitorHttp` | 200, scope y `device_id` reales |
| Alta de galpón y poza | `accepted`, versión 1 cada uno |
| Cierre forzado y reapertura | identidad y registros conservados; 2 operaciones `accepted` |
| Reenvío de las dos solicitudes congeladas | recibos recuperados; sin duplicados |
| Modo Demostración y modo Trabajo (UI) | 4 galpones demo; galpón sincronizado visible |

Identidad y registros:

```text
dataset_id  080c7945-8d40-4404-8055-4a423f843c66
device_id   33fb77ec-da90-4897-9525-63fc276aa921
galpón      55a5e708-91a5-4556-82ad-0308174762a4
poza        61322263-91e9-4aa3-b6d6-ba526b8cb641
```

### Redirecciones 3xx

Con un servidor de laboratorio en `127.0.0.1:9000` que responde 302 hacia `/target`:

```text
disableRedirects: true   -> status 302, url http://127.0.0.1:9000/redirect, /target no visitado
sin la opción            -> status 200, url http://127.0.0.1:9000/target, cuerpo TARGET-REACHED
```

La opción nativa evita el seguimiento y el transporte rechaza el 3xx.

## Comparación SQLite y PostgreSQL

Estado final después de las dos corridas y de los reenvíos, sin filas nuevas por reintento:

| Dato | Windows (SQLite) | Android (SQLite) | PostgreSQL |
|---|---|---|---|
| scopes | — | — | 1 |
| devices | — | — | 2 |
| galpones | 1 | 1 | 2 |
| pozas | 1 | 1 | 2 |
| operaciones en outbox | 2 `accepted` | 2 `accepted` | — |
| recibos | — | — | 4 |
| cambios registrados | — | — | 4 |
| versiones de servidor | 1 y 1 | 1 y 1 | 1 y 1 por registro |
| `last_sequence` | — | — | 4 |

Las bases locales se leyeron con la app cerrada: en Windows desde `<perfil>/cuyielite-work/trabajo.db` y en Android con una copia obtenida por `run-as`. Ambos esquemas conservan `sync_context`, `sync_outbox` y `sync_record_state`, y las tablas de negocio no presentan filas duplicadas.

## Criterios de aceptación

| Criterio | Estado |
|---|---|
| Push nativo desde Windows empaquetado | Cumplido |
| Push nativo desde Android emulado | Cumplido |
| Recibos idempotentes sin efectos duplicados | Cumplido |
| Reapertura sin pérdida ni reenvío espurio | Cumplido |
| Sin transporte web de respaldo | Cumplido: error explícito y prueba unitaria |
| 3xx no seguido | Cumplido: comprobación nativa y prueba unitaria |
| Token solo en memoria | Cumplido: no se persiste ni se registra |
| Datos sintéticos y base temporal | Cumplido: base dedicada y descartada |

## Límites

- No se implementaron pull, resolución de conflictos ni la interfaz de sincronización.
- El transporte exige un dispositivo autorizado previamente en el servidor; el alta de dispositivos fuera del laboratorio corresponde a la entrega de autenticación.
- La verificación usó un backend local en `127.0.0.1`; no cubre despliegue remoto, TLS ni proxy.
- `plugins/sync-lab/electron/dist/*.js` se genera con `npm run build:migration` y no se versiona: el paquete Electron se arma después de ese paso.
