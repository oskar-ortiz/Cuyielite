# Pull, coordinacion y conflictos explicitos de sync-v1

## Alcance

Esta entrega extiende el laboratorio S3 con descarga incremental, cursor firmado,
aplicacion transaccional en SQLite, coordinacion del ciclo y resolucion explicita
de conflictos. Conserva el transporte nativo de Windows y Android. La pantalla
de revision de conflictos es accesible desde el modo Trabajo. El inicio del
ciclo de sincronizacion sigue siendo una operacion de laboratorio, sin boton
de sincronizacion para usuarios finales.

## Implementacion

- `GET /sync/pull` autentica el dispositivo y devuelve paginas acotadas de
  `sync_changes`, ordenadas por secuencia. El cursor es opaco, HMAC-SHA256 y
  queda ligado al `scope_id`; cada pagina conserva el high-watermark inicial.
- `SYNC_CURSOR_SIGNING_KEY` debe ser estable entre reinicios del servicio y tener
  al menos 32 bytes. No se incluye una clave real en Git.
- Los cambios guardan snapshots centrales completos e inmutables. El lector
  conserva compatibilidad con snapshots de datos emitidos por el laboratorio
  S3 antes de este cambio.
- El cliente valida estrictamente scope, secuencias, UUID, versiones, fechas,
  campos y relaciones. Aplica cada pagina y su cursor en una transaccion SQLite.
  No retrocede versiones; conserva valores locales cuando hay operaciones
  pendientes y permite que el registro central actualizado sea revisado como
  conflicto.
- El coordinador serializa ciclos por `dataset_id`, captura el maximo
  `local_seq`, reconcilia solicitudes preparadas, hace pull antes y despues del
  push, y limita los reintentos a errores transitorios.
- Una resolucion de conflicto exige confirmar la version y la cabeza local
  revisadas. Permite conservar la version central o crear una operacion nueva
  contra esa version; no reutiliza el `operation_id` conflictivo ni reabre
  registros eliminados.
- La pantalla `/trabajo/conflictos` presenta los valores centrales y locales
  por campo, solicita confirmacion explicita, permite ajustar los valores
  antes de reintentar y distingue el reintento local de una confirmacion del
  servidor. Si el servidor elimino el registro, solo permite conservar esa
  version. Windows usa metodos acotados del plugin Electron; Android usa el
  mismo modulo de resolucion sobre SQLite nativo.
- Electron realiza HTTP fijo al loopback desde el proceso principal. Android usa
  `CapacitorHttp`; ambos rechazan redirecciones. El renderer no elige URL, ruta,
  metodo ni SQL.

## Verificacion automatizada

Resultados en el worktree `codex/client-sync-s5`:

- Cliente: `npm run test:unit` — 114 pruebas aprobadas, incluidas la
  comparacion de versiones, confirmacion antes de descartar/reintentar y
  eliminacion central.
- Cliente: `npm run lint` — ESLint, typecheck E2E y Prettier aprobados.
- `npm run build:migration` — compilacion TypeScript para los dos plugins Electron.
- `npm run build` y `npm run build:electron` — compilaciones correctas. Vite
  reporta chunks mayores de 500 kB, igual que en el build previo.
- `client/electron/npm run pack` — paquete Windows generado; el plugin vendoreado
  contiene los tres metodos acotados de revision y el modulo de resolucion.
  El script de empaquetado recompila y sincroniza los recursos web en modo
  Electron antes de crear `app.asar`. Se comprobo que `app/index.html` no incluye
  scripts legacy inline o `data:` bloqueados por la CSP de Electron.
- Android: `npx cap sync android` y `gradlew assembleDebug` — correctos con
  Android SDK en `C:\Android` y JDK 21.
- Backend: `python -m pytest backend -q` — 56 pruebas aprobadas sobre PostgreSQL
  temporal aislado, con DDL base y migraciones 0001/0002 aplicadas.

La primera ejecucion de backend sin `TEST_DATABASE_URL` fallo como corresponde:
las pruebas de integracion exigen una base aislada. Se repitieron correctamente
al levantar el contenedor temporal dedicado `cuyielite_s5_pull_20261106` en el
puerto 5434. No se uso ni se altero otra base. El contenedor se retiro al acabar.

## Verificacion nativa con datos sinteticos

Se prepararon en la base temporal un galpon y 51 pozas con UUID v4, todos dentro
del mismo scope y unidos por FK. El limite de pagina se mantuvo en 50.

### Windows empaquetado

- `win-unpacked/CuyiElite.exe` se ejecuto con un perfil `userData` temporal.
- El ciclo obtuvo el contexto autorizado, vinculo la base de trabajo al scope y
  descargo 52 snapshots en dos paginas: 1 galpon y 51 pozas; cero pendientes,
  conflictos o rechazos.
- Tras cerrar y reabrir la app, el `dataset_id`, `device_id`, `scope_id` y cursor
  persistieron. El siguiente ciclo no aplico registros duplicados.

### Android emulado

- Se uso un AVD temporal `CuyiS5Lab` (Android 36) y un harness de build local,
  agregado solo para esta comprobacion y retirado despues.
- La base de trabajo alcanzo schema v3, quedo vinculada al dispositivo/scope
  autorizado y contiene 1 galpon y 51 pozas. El cursor persistido alcanzo la
  secuencia 52.
- Despues de `force-stop` y reapertura, el ciclo devolvio cero registros nuevos;
  permanecieron las 52 filas esperadas y el mismo cursor.
- La red del emulador accedio al servicio temporal mediante `adb reverse`.

### Interfaz de conflictos en Windows empaquetado

- Se inicio `win-unpacked/CuyiElite.exe` con un perfil temporal nuevo y dos
  conflictos sinteticos de galpon, cada uno con version central 2. El listado
  y la comparacion por campo mostraron ambos valores correctamente.
- Para el primer galpon se eligio y confirmo **Conservar version central**.
  La interfaz retiro ese conflicto. La inspeccion SQLite en modo solo lectura
  mostro nombre y ubicacion centrales, operacion anterior `discarded`, sin
  cabeza local y con `server_version=2`.
- Para el segundo se cambio el nombre a `Galpon B revisado`, se eligio y
  confirmo **Reintentar cambio local**. La interfaz quedo sin conflictos y
  aclaro que el nuevo cambio aun no estaba confirmado por el servidor.
  SQLite mostro la operacion anterior `discarded` y una nueva `queued` con
  `base_anchor=2`, vinculada como cabeza local. El nombre editado persistio.
- La primera apertura de una base de trabajo vacia se comprobo sin errores de
  bloqueo. Se habilito `busy_timeout=5000` en las conexiones Electron y se
  evito iniciar simultaneamente dos cargas del listado al entrar en la vista.
- Esta prueba de interfaz fue local y sintetica: no ejecuto un nuevo envio al
  servidor. El APK Android actualizado se instalo en `Pixel_36`: se recorrio
  Inicio → Trabajo → Revisar conflictos y se observo el estado vacio sin error.
  No se probaron las dos decisiones con conflictos en la UI Android; esa ruta
  se cubre con pruebas de interaccion del componente compartido.

Los registros eran sintéticos, se usaron UUID v4 y no se utilizaron archivos
Excel ni datos del Centro Lope.

## Limpieza y limites

- Se detuvo el backend y se elimino el contenedor PostgreSQL temporal.
- Se retiro el AVD temporal, el perfil aislado de Windows, las redirecciones ADB
  y el harness. La fuente de entrada `client/src/main.tsx` queda sin cambios de
  diagnostico.
- El archivo temporal que preparo los dos conflictos sinteticos para la prueba
  visual se retiro del worktree. Los tres perfiles temporales usados durante el
  diagnostico de esa interfaz permanecen fuera de Git bajo `%TEMP%` porque la
  politica del entorno bloqueo su eliminacion recursiva; no contienen datos
  reales del Centro Lope.
- La pantalla de revision de conflictos se cubre con pruebas de interaccion
  automatizadas y con la prueba empaquetada de Windows descrita arriba. La
  corrida nativa Android comprobo pull, reapertura y navegacion a la pantalla
  vacia de conflictos; la resolucion manual de conflictos en Android no se
  ejecuto. La interfaz no ejecuta la
  sincronizacion automaticamente despues de un reintento.
- No se importaron datos reales. No se ejecutaron migraciones en una base
  compartida ni se implemento el importador de Entrega D.
- Los builds producen advertencias informativas sobre paquetes/chunks; no
  impidieron compilaciones ni pruebas.
