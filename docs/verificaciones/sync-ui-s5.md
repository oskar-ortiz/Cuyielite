# S5: experiencia de sincronización en Android y Windows

La base de trabajo ya muestra el estado de sincronización, permite iniciarla o reintentarla desde una acción explícita y enlaza a la revisión de conflictos sin bloquear la consulta local. Se verificó con pruebas automatizadas y con la app empaquetada de Windows y Android emulado, sin backend activo y con datos sintéticos. No se modificaron datos del Centro Lope.

## Numeración vigente

El plan de diseño (`docs/sync/plan-implementacion-propuesto.md`, todavía fuera de `dev`) numeraba **S5** como «pull y coordinación» y **S6** como «UI/UX e integración». La entrega efectivamente fusionada en `dev` absorbió el pull, el cursor y los conflictos en **S4** (ver `docs/verificaciones/sync-s4.md`). Por eso esta entrega implementa el contenido previsto para S6 y conserva el nombre **S5** para continuar la secuencia entregada S1–S4. No se renumeraron documentos anteriores.

## Alcance implementado

| Área | Cambio |
| --- | --- |
| Estado durable | `readWorkSyncStatus()` lee pendientes, preparados, conflictos y rechazados desde la outbox, y el scope/cursor desde `sync_context`. Solo lectura. |
| Estados visibles | sin sincronizar, pendiente, sincronizando, completado, sin conexión / error recuperable, conflicto. |
| Acción del usuario | Pantalla `/trabajo/sincronizacion` con token de laboratorio en memoria, botón Sincronizar/Reintentar y resumen del ciclo. |
| Conflictos | Se muestra el conteo y un enlace a `/trabajo/conflictos`; la decisión sigue en la pantalla existente de S4. |
| Navegación | Acceso desde el listado de Trabajo; regreso con el botón de la barra y enlace directo a los galpones. |
| Android / Windows | Misma pantalla Ionic; estado vía SQLite Android o plugin Electron; el ciclo usa el transporte nativo ya existente. |
| Demo / trabajo | La pantalla solo se registra bajo `/trabajo`; la base de demostración no participa. |

No se agregaron contratos, rutas de backend, autenticación, migraciones ni cambios de esquema. El token de laboratorio se toma de la entrada del usuario y vive solo en memoria durante la sesión; no se persiste en SQLite, archivos ni Git. El aprovisionamiento, la rotación y la revocación de credenciales de producción siguen pendientes y fuera de esta entrega.

## Archivos principales

- `client/src/data/work.sync.status.ts`: lectura del estado durable de sincronización.
- `client/src/data/work.sync.ui.ts`: fases visibles y clasificación de errores recuperables.
- `client/src/data/work.sync.repository.ts`: selección Android/Electron, guarda de concurrencia y resumen del ciclo.
- `client/src/pages/SincronizacionTrabajo.tsx` y `sincronizacion.css`: pantalla, accesibilidad y textos en español.
- `client/src/App.tsx`, `Galpones.tsx`, `ModoInicio.tsx`: ruta y accesos.
- `client/plugins/sync-lab/electron/dist/plugin.mjs`: método `status` del plugin Electron.
- `client/src/data/galpones.repository.android.ts`: recuperación de la conexión demo residual tras recargar el WebView, detectada durante esta verificación.
- Pruebas nuevas: `work.sync.status.test.ts`, `work.sync.ui.test.ts`, `SincronizacionTrabajo.test.tsx`, `galpones.repository.android.test.ts`.

## Comportamiento de estados

| Situación | Texto principal | Acción disponible |
| --- | --- | --- |
| Base sin scope y sin cambios | Sin sincronizar | Sincronizar (requiere token) |
| Cambios locales en cola | Cambios pendientes | Sincronizar |
| Ciclo en curso | Sincronizando… | Botón deshabilitado; la consulta local sigue disponible |
| Conflicto en outbox | Conflictos pendientes | Revisar conflictos |
| Red, timeout o 503 | Sin conexión | Reintentar |
| Token o contexto inválido | No se pudo sincronizar | Revisar token y reintentar |
| Ciclo exitoso en la sesión | Sincronización completada | Sincronizar de nuevo |
| Base vinculada sin pendientes | Sin cambios pendientes | Sincronizar |

Los cambios rechazados por el servidor se informan como advertencia; no se inventó una política de resolución porque S4 solo definió conflictos.

## Pruebas automatizadas

Ejecutadas desde `client/` sobre el HEAD de la rama:

```powershell
npm run build:migration
npm run lint
npx vitest run --no-file-parallelism
npm run build
npm run build:electron
```

Resultados reales:

- `npm run lint`: ESLint, typecheck de E2E y Prettier correctos.
- `npx vitest run --no-file-parallelism`: **30 archivos, 148 pruebas en verde**.
- `npm run build`: correcto. Vite mantiene la advertencia de tamaño de bundle y una nota de import dinámico inefectivo por módulos de Android ya importados de forma estática; no impiden el build.
- `npm run build:electron`: correcto.
- `npm run build:migration`: correcto; genera `work.sync.status.js` en el plugin `sync-lab`.

Las pruebas cubren:
- conteo de estados de outbox y lectura de scope/cursor;
- prioridad de fases y clasificación de errores de red, token y contexto;
- token obligatorio, envío único, resultado, reintento y enlace a conflictos;
- lectura fallida del estado local;
- recuperación de la conexión demo residual de Android.

## Empaquetado y verificación nativa

```powershell
# Windows
cd client/electron
npm run pack
# Android
cd client
npm run build
npx cap copy android
$env:ANDROID_HOME='C:\Android'
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
cd android
.\gradlew assembleDebug
```

- Empaquetado Windows: `client/electron/dist/win-unpacked/CuyiElite.exe`, perfil temporal aislado, backend apagado.
- Android: `client/android/app/build/outputs/apk/debug/app-debug.apk` instalado en el AVD `Pixel_36`.
- La app se condujo por CDP sobre el WebView real; no se usaron datos reales ni tokens persistidos.

### Windows empaquetado

| Comprobación | Resultado |
| --- | --- |
| Inicio y modo Trabajo | `Elegir modo` y `/trabajo/galpones` |
| Acceso a Sincronización | `/trabajo/sincronizacion` |
| Estado inicial | Sin sincronizar |
| Token vacío | Botón Sincronizar deshabilitado |
| Token sintético + backend apagado | Sin conexión y botón Reintentar visible |
| Uso local durante/después del fallo | Galpones de trabajo accesibles y regreso a Sincronización correcto |
| Separación demo/trabajo | La demo muestra sus galpones y su marcado; no comparte la base de trabajo |
| Errores de consola | 0 |

### Android emulado

| Comprobación | Resultado |
| --- | --- |
| Inicio y modo Trabajo | `Elegir modo` y `/trabajo/galpones` |
| Acceso a Sincronización | `/trabajo/sincronizacion` |
| Estado inicial | Sin sincronizar |
| Token vacío | Botón Sincronizar deshabilitado |
| Token sintético + backend apagado | Sin conexión y botón Reintentar visible |
| Uso local durante/después del fallo | Galpones de trabajo accesibles y regreso a Sincronización correcto |
| Separación demo/trabajo | La demo carga sus galpones y su marcado |
| Consola | 2 avisos de `Error injecting safe area CSS` de Capacitor `SystemBars` durante las recargas `location.href` del recorrido automatizado y 1 registro del intento de red fallido; no son errores de la pantalla nueva |

La recarga directa del WebView reveló además `CreateConnection: Connection cuyielite already exists` al abrir la base de demostración. Se aplicó la misma recuperación acotada que S4 usa para la base de trabajo, con su prueba unitaria; tras el cambio, la demo volvió a cargar sus galpones.

## Límites reales

- No se ejecutó un ciclo exitoso contra backend en el recorrido nativo de esta entrega: el laboratorio requiere provisionar un token fuera de Git y una base central aislada. El camino exitoso, los conflictos y los rechazos están cubiertos por pruebas automatizadas y por la evidencia nativa de S4.
- No se repitió la verificación nativa de conflictos, ya realizada en S4; esta entrega muestra el conteo y enlaza a esa pantalla.
- La autenticación de producción y el aprovisionamiento del token no existen todavía; no se inventaron.
- No se modificaron datos reales, ETL, ML, RAG, backend ni esquema.
