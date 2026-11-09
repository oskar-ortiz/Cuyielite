# S4: pull, cursor y conflictos en Android y Windows

S4 se verificó el 9 de noviembre de 2026 con datos sintéticos y un PostgreSQL de laboratorio aislado. La sincronización descargó registros en páginas, conservó el cursor tras reiniciar y exigió una decisión explícita cuando el servidor y un dispositivo editaron el mismo galpón. Esta entrega no inicia S5 ni importa datos del Centro Lope.

## Alcance y cortes revisables

El código se dividió en unidades pequeñas: cursor firmado del backend, API pull, validación del contrato cliente, aplicación transaccional, coordinador, modelo y resolución de conflictos, transporte nativo, interfaz y recuperación de conexión Android. Cada rama `feat/sync-s4-*` parte de la anterior; los PR hacia `dev` se integran en ese orden para que el diff de revisión corresponda a una unidad.

| Capa | Resultado verificado |
| --- | --- |
| Cursor y API | Cursor ligado al scope y firmado; el backend valida el token y el dispositivo antes de entregar cambios. |
| Cliente | Valida páginas, aplica registros en orden, persiste el cursor tras la transacción y reanuda desde él. |
| Conflictos | El cambio local pendiente no se sobrescribe; el recibo `conflict` conserva la versión central para revisión. |
| Resolución | Se puede conservar la versión central o reintentar con una nueva operación y la versión revisada. |
| Transporte | Electron realiza HTTP en el proceso principal; Android usa `CapacitorHttp`. |

## Verificación automatizada

- `python -m pytest backend -q`: **65 passed** sobre una base PostgreSQL temporal con migraciones `0001` y `0002` aplicadas. La suite usó una base de prueba separada de la base del recorrido nativo.
- `npm run test:unit` en `client/`: **127 passed** en 26 archivos, incluidas tres pruebas de recuperación de conexión Android.
- `npm run lint`: ESLint, typecheck de E2E y Prettier correctos.
- `npm run build`: correcto. Vite emitió una advertencia de tamaño de bundle; no impidió el build.
- Empaquetado `win-unpacked/CuyiElite.exe` y `gradlew assembleDebug`: correctos. El APK de prueba incluyó un harness temporal que se retiró del código y de los assets normales al terminar.
- `git diff --check`: sin errores.

## Recorrido nativo

Se creó una base central temporal, un scope y credenciales sintéticas exclusivas para el laboratorio. Un dispositivo productor creó un galpón y 51 pozas. Cada cliente recibió un token diferente asociado a su `device_id` real; ninguno eligió el scope desde el cuerpo de una solicitud. Los valores de tokens no se guardaron en Git ni en esta evidencia.

| Comprobación | Windows empaquetado | Android emulado |
| --- | --- | --- |
| Perfil | `userData` temporal aislado | AVD temporal `CuyiS4Dev` |
| Transporte | Plugin Electron y `fetch` de Node | `CapacitorHttp` y `adb reverse` al backend local |
| `fetch` del renderer | Bloqueado durante el ciclo | Bloqueado durante el ciclo |
| Primer pull | 52 registros, dos páginas antes del push; 1 galpón y 51 pozas | 52 registros, dos páginas antes del push; 1 galpón y 51 pozas |
| Reinicio | Mismos `dataset_id`, `device_id`, scope, cursor y cantidades | `force-stop` y reapertura: mismos identificadores, cursor y cantidades |
| Segundo ciclo | 0 registros aplicados, 0 duplicados | 0 registros aplicados, 0 duplicados |

El servidor avanzó después el galpón a versión 2 mientras Windows conservaba una edición local basada en versión 1. El ciclo descargó la versión central sin pisar la edición local (`preservedLocalRecords=1`), envió la operación y recibió un conflicto. La pantalla mostró los valores del servidor y del dispositivo. Al elegir **Conservar versión central**, desapareció el conflicto y el galpón local adoptó la versión 2.

Android descargó esa versión 2. Luego se editó localmente el mismo galpón y el servidor avanzó a versión 3. El ciclo Android preservó el cambio local, obtuvo un conflicto y mostró ambos valores en **Conflictos de trabajo**. Desde esa pantalla se eligió **Reintentar cambio local**: se creó una operación nueva basada en versión 3; el siguiente ciclo la envió con `accepted`, sin conflicto pendiente. PostgreSQL dejó el galpón en versión 4 con los valores reintentados. Windows descargó después las versiones 3 y 4 y mostró el mismo valor final. El servidor terminó con 55 cambios y 57 recibos; los dos recibos adicionales corresponden a operaciones en conflicto, sin cambios centrales.

## Recuperación de conexión Android

Una recarga directa del WebView en `/trabajo/conflictos` reveló `CreateConnection: Connection trabajo already exists`: el contexto JavaScript se renovaba mientras el plugin nativo mantenía abierta la conexión. `work.database.android.ts` ahora cierra y recrea únicamente esa conexión residual cuando recibe ese error concreto. La ruta volvió a cargar el conflicto sin pérdida de datos. Las pruebas cubren conexión residual, apertura normal y propagación de otros errores.

## Aislamiento y límites

- La app demo continuó mostrando sus cuatro galpones en Android; la base de trabajo conservó el galpón y las 51 pozas sintéticas.
- El harness Android se usó solo en el APK del laboratorio. `main.tsx` y los assets normales se restauraron; no hay ruta ni código de harness en Git.
- La verificación se limita a galpones y pozas del protocolo de laboratorio, con backend en loopback. Autenticación de producción, otros tipos de entidad, datos reales, despliegue y S5 quedan fuera de esta entrega.
- Los tokens de laboratorio, perfiles, AVD, base central y procesos temporales se eliminan al cerrar el recorrido; no forman parte de los commits.
