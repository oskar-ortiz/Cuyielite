# Android RAG del piloto: diagnóstico, preflight y estado observado (2026-11-17)

Estado: **BLOQUEADO / NO VERIFICADO EN UI ANDROID**. No se inició ningún AVD nuevo ni se ejecutó el recorrido: los recursos no cumplen el umbral de la guarda. No se declara ningún caso del recorrido como completado. Incluye una segunda revisión del 2026-11-17 con el emulador ya conectado (§7).

## 1. Estado de partida

- `origin/dev` = `70eb84c` (PR #159 fusionado; además llegó el commit de Diery `67e09e3` «Validacion RAG», que solo toca `rag/eval`, `rag/tests` y `rag/reports`).
- Árbol de trabajo limpio al empezar; rama `fix/android-rag-preflight` creada desde `origin/dev`.
- JDK 21 verificado: Zulu `21.0.13.0.3` LTS. SDK Android con plataformas `android-36`, `android-37.0` y build-tools `35.0.0`/`36.0.0`; `adb 1.0.41`.
- Ningún dispositivo conectado (`adb devices` vacío). No había emulador, `qemu` ni procesos Gradle de nuestras sesiones anteriores. Los cuatro procesos `CuyiElite` visibles son la instalación habitual del usuario (perfil `%APPDATA%\CuyiElite`) y **no se tocaron**.

## 2. Diagnóstico del bloqueo anterior

Mediciones de esta sesión, antes de cualquier intento de arranque:

```text
RAM física libre:      0 GiB de 7,19 GiB
RAM disponible:        0,62 GiB (637 MB)
Margen de commit:      5,64 GiB
AVD Pixel_36:          2560 MB RAM, 2 núcleos, x86_64, Android 36
Partición de datos:    6 GiB
```

El lanzador `scripts/start-pixel.ps1` comprobaba **solo el margen de memoria comprometida**. Ese margen podía ser de 4–6 GiB gracias al archivo de paginación incluso con 239–654 MB de RAM física disponible, así que el emulador arrancaba con 2560 MB de RAM asignados y empezaba a intercambiar. En los registros del emulador de los intentos anteriores aparece además `Software OpenGL failed. Falling back to system OpenGL`.

Resultado observado en la sesión previa: la app de laboratorio abrió hasta «Elegir modo»; al entrar a Trabajo apareció «System UI isn't responding» y, tras pulsar «Wait», la pantalla quedó en negro. Es decir: **no fue un fallo de la app ni del RAG**, sino un bloqueo de recursos del emulador/Sistema UI antes de que la app pudiera mostrar la pantalla de acceso. No se llegó a login ni a consulta.

### Corrección del procedimiento

`scripts/start-pixel.ps1` ahora exige además **RAM física disponible ≥ RAM solicitada para el AVD** (parámetro `-AvdRamMb`, por defecto 2560) y conserva la comprobación de margen de commit. El mensaje de rechazo dice explícitamente que no se cierran aplicaciones ni se cambia el archivo de paginación.

Comprobación de la nueva guarda, ejecutada en este estado:

```text
RAM disponible: 635 MB; margen de commit: 5780 MB; AVD solicitado: 2560 MB
throw: RAM disponible insuficiente para el AVD (2560 MB). No se inicia el emulador...
adb devices: (vacío)
```

El emulador **no** se inició. No se cerraron aplicaciones del usuario ni se reinició Windows.

## 3. Preparación realizada sin emulador

| Comprobación | Resultado | Naturaleza |
|---|---|---|
| APK de la variante `co.ucc.cuyielite.lab` | SHA-256 `443e394eceb8d5cb440f9e6e52395261c5cfb12b58a5bbcf60b5a287be3203b6`, compilado con JDK 21; `git diff bcfa207..HEAD -- client` vacío | Artefacto construido, **no instalado ni ejecutado en esta sesión** |
| Corpus RAG en `cuyielite_rag` | 76 fragmentos de `produccion_cuyes.pdf`, 768 dimensiones | Consulta directa a PostgreSQL, no UI |
| Sesión y validación de pull | `auth.session.test.ts` + `work.sync.pull.validation.test.ts`: 10 pruebas en verde | Pruebas automatizadas, no UI |
| API del piloto | `/health` 200; una consulta `/assistant/query` devolvió 200 con fuente `produccion_cuyes.pdf, p. 23` y la siguiente 503; el proceso de backend murió poco después | Verificación de backend; inestable bajo la misma presión de memoria |

El 503 y la muerte del backend se registran como observaciones del entorno, **no** como fallo funcional del RAG ni como evidencia de UI Android. No se cambió código del pipeline RAG ni del backend.

## 4. Recorrido Android: resultado caso por caso

| Caso | Estado |
|---|---|
| Acceso a Trabajo y login de piloto | **NO VERIFICADO** (no se inició el emulador) |
| Sincronización necesaria | **NO VERIFICADO** |
| Pregunta dentro del corpus con fuente y página | **NO VERIFICADO** |
| Pregunta fuera del corpus y abstención | **NO VERIFICADO** |
| Cierre y reapertura; credenciales persistentes de forma segura | **NO VERIFICADO** en UI (solo cobertura automatizada de sesión) |
| Consulta como viewer sin acciones de escritura | **NO VERIFICADO** |

La verificación de Windows/Electron de la entrega anterior no se reutiliza como prueba Android.

## 5. Requisito concreto para reintentar

No se debe iniciar el AVD hasta que:

1. `RAM disponible >= 2560 MB` (o el valor que se pase a `-AvdRamMb`, siempre que se acuerde bajar la memoria del AVD);
2. `margen de commit >= 4 GB`;
3. no haya otros procesos pesados en ejecución, sin cerrar aplicaciones del usuario sin autorización;
4. exista un dispositivo `emulator-5554` en `adb devices` tras el arranque.

Con esas condiciones, el procedimiento ya documentado es:

```powershell
# 1) backend y base del piloto
.\scripts\piloto-local.ps1 start
# 2) emulador (la guarda falla si no hay RAM suficiente)
.\scripts\start-pixel.ps1 -Avd Pixel_36 -TimeoutSeconds 300
# 3) red local y variante aislada
adb reverse tcp:8000 tcp:8000
adb install <client\android\app\build\outputs\apk\debug\app-debug.apk>   # solo co.ucc.cuyielite.lab
```

Después se debe recorrer la UI real y capturar capturas/logs antes de marcar cualquier caso como verificado. No se simularon acciones con SQL, `pm clear` ni cambios de `scope_id`, cursor o recibos.

## 6. Conservación y limpieza

- Pixel_36, usuario 0, la app habitual `co.ucc.cuyielite`, sus bases y su Keystore: **intactos**.
- No se desinstaló paquete habitual, no hubo `wipe-data`, no se abrieron puertos ni se cambió firewall.
- No quedan contenedores, bases ni emuladores creados en esta sesión: solo `cuyielite-db-1` y el preexistente `cuyielite-s3-test`.

## 7. Reanudación del 2026-11-17 con emulador ya conectado

Fecha: 2026-11-17. Dispositivo: `emulator-5554`, `sdk_gphone64_x86_64`, API 36, usuario 0. Rama `docs/android-preflight-estado` desde `origin/dev` `3c4eb52` (PR #161 fusionado; PR #160 fusionó el handoff de Diery). JDK 21 (`Zulu 21.0.13.0.3`), `adb 1.0.41`. Método: solo lectura de estado, captura de pantalla y `logcat`; **no se enviaron taps, textos ni navegación**.

### Preflight observado

```text
RAM disponible:        769 MB -> 767 MB en la segunda medición
Margen de commit:      5,41 GiB -> 5,36 GiB
Umbral de la guarda:   2560 MB de RAM disponible, 4 GiB de commit
Dispositivos adb:      emulator-5554 (único; no hay teléfono físico autorizado)
adb reverse:           tcp:8000 -> tcp:8000 activo
Backend:               /health 200 (PID 19480); contenedor cuyielite-db-1 activo
Paquete en primer plano: co.ucc.cuyielite.lab / co.ucc.cuyielite.MainActivity
```

La RAM disponible quedó **por debajo del umbral en toda la sesión**. Cumplir el margen de commit no basta: ese margen depende del archivo de paginación. No se inició otro AVD, no se bajó `-AvdRamMb`, no se cerraron aplicaciones del usuario, no se reinició Windows y no se repitieron intentos de interacción. No había un teléfono físico conectado que permitiera usar la variante `.lab`.

### Origen del APK instalado

```text
pm path co.ucc.cuyielite.lab -> /data/app/.../base.apk  (14.714.578 bytes)
sha256 instalado = 443e394eceb8d5cb440f9e6e52395261c5cfb12b58a5bbcf60b5a287be3203b6
sha256 local     = 443e394eceb8d5cb440f9e6e52395261c5cfb12b58a5bbcf60b5a287be3203b6
```

El APK instalado corresponde exactamente al artefacto compilado con el código actual; **no** por eso se considera verificado el recorrido.

### Estado de pantalla observado (captura, sin interacción)

Captura: `%TEMP%\opencode\android-preflight.png`. Muestra `Acceso · Trabajo` de la variante `.lab`, etiqueta `Sin sesión`, campo de usuario con texto corrupto heredado de la interacción anterior (`…quen sin marcarse como completos.`), barra de herramientas del IME desplegada y campo de contraseña vacío. Es estado transitorio del formulario: no se limpió con `pm clear`, SQL ni desinstalación, y no se intentó corregirlo bajo el umbral de memoria.

### Logcat (solo lectura)

`adb logcat -d -t 1500` mostró `Long monitor contention` y `Slow dispatch took 380ms` en `system_server`, y `ImeTracker ... STATUS_TIMEOUT` al mostrar el IME. Es coherente con la presión de recursos documentada; no se registró un error funcional de la app en este tramo.

### Resultado de los siete criterios (2026-11-17)

| # | Criterio | Estado | Método / evidencia |
|---|---|---|---|
| 1 | Entrar a Trabajo e iniciar sesión admin | **NO VERIFICADO** | Pantalla de acceso observable; sin taps ni credenciales enviadas |
| 2 | Sincronización con estado visible, sin spinner infinito | **NO VERIFICADO** | No se navegó fuera de Acceso |
| 3 | Pregunta dentro del corpus con fuente y página | **NO VERIFICADO** | Sin consulta desde UI |
| 4 | Pregunta fuera del corpus y abstención | **NO VERIFICADO** | Sin consulta desde UI |
| 5 | Cierre/reapertura y sesión sin access token en claro | **NO VERIFICADO en UI** | Solo cobertura automatizada previa; no se cerró ni reabrió la app |
| 6 | Viewer sin acciones de escritura | **NO VERIFICADO** | No se inició sesión como viewer |
| 7 | Evidencia separando UI / backend / SQLite / pruebas | **PARCIAL** | UI: captura de estado; backend: `/health` 200; SQLite: sin comprobación nueva; pruebas: no ejecutadas en esta corrida |

### Bloqueo y paso concreto para reanudar

Bloqueo: RAM física disponible de 767–769 MB frente a 2560 MB exigidos por la guarda, con un único emulador conectado y sin teléfono físico autorizado. Reanudar cuando `RAM disponible >= 2560 MB` y `commit libre >= 4 GB`, confirmando `adb devices` y `/health`; entonces sí ejecutar los taps de login, consulta, abstención, cierre/reapertura y viewer, capturando una captura por caso. No se debe reducir `-AvdRamMb` ni cerrar aplicaciones del usuario para forzar la prueba.
