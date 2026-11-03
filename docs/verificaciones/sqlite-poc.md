# Verificación — PoC SQLite persistente (Windows)

Rama: `feat/client-sqlite-poc`. Commit del paso 1: `7381b94`.
App probada: `client/electron/dist/win-unpacked/CuyiElite.exe` (empaquetada, sin instalar).

## Aislamiento de la base de prueba

- La base de prueba es `poc.db` en `%APPDATA%\CuyiElite\sqlite-poc\`, separada
  de cualquier otra base. El plugin resuelve la ruta en el proceso principal con
  `app.getPath('userData')`; no se aceptan rutas desde el renderer.
- El ejecutable empaquetado se probó sin instalarlo, para no sobrescribir la
  instalación existente de CuyiElite (`%LOCALAPPDATA%\Programs\cuyielite-electron`).
- No se modificó la instalación Windows existente.

## Comando reproducible

Desde la raíz del worktree:

```bash
cd client
npm ci
npm install ./plugins/sqlite-poc
npm run build:electron
npx cap sync @capawesome/capacitor-electron

cd electron
npm ci
npm run build
npx capacitor-electron vendor
npm run pack   # genera dist/CuyiElite Setup 0.0.0.exe y dist/win-unpacked/
```

## Prueba en la app empaquetada (sin backend ni red)

Runtime: Electron 45.2.1, Chromium 156.0.8078.75, Node 24.22.1.

1. Ejecución 1: lanzar `dist/win-unpacked/CuyiElite.exe`, navegar a
   `/sqlite-poc`, pulsar "Guardar valor". Valor generado y guardado:
   `poc-mw04b4iz-pdnwsgza`.
2. Cerrar todos los procesos de la app.
3. Ejecución 2: reabrir la app, navegar a `/sqlite-poc`, pulsar solo "Leer valor"
   (sin pulsar "Guardar"). Valor leído: `poc-mw04b4iz-pdnwsgza`.
4. Comparación externa: IGUALES. 0 errores de consola.

## Windows (Electron, desarrollo)

Verificación tras agregar `@capacitor-community/sqlite@8.1.1`:
- `npx cap sync @capawesome/capacitor-electron` emite un WARN: el plugin comunitario
  declara implementación Electron pero su `electron/dist/plugin.mjs` no existe; se omite.
  No rompe el puente Capawesome.
- `client/electron/generated/plugin-manifest.json` sigue registrando solo
  `capacitor-sqlite-poc`.
- Prueba de persistencia: ejecución 1 guardó `poc-mw066l5l-57spj02n`; cierre total;
  ejecución 2 leyó `poc-mw066l5l-57spj02n` (IGUALES), 0 errores de consola.
- La instalación existente de CuyiElite no se modificó.

## Android (emulador)

Entorno instalado:
- Android Studio 2026.2.2.8 (Otter+), JDK 21 (Zulu 21.0.13), Android SDK en
  `C:\Android` (Platform 36, Build-Tools 36.0.0, Platform-Tools, Emulator, imagen
  API 36 x86_64). Emulador `Pixel_36` (emulator-5554).
- Compilación: `.\gradlew assembleDebug` exitosa (minSdk 24, compileSdk/targetSdk 36,
  AGP 8.13.0, Gradle 8.14.3, JDK 21).

Prueba en emulador:
1. Ejecución 1: abrir app, navegar a PoC SQLite, pulsar "Guardar valor". Valor
   guardado: `poc-mw060lbd-rrajkjd4`.
2. Cerrar app (`adb shell am force-stop`) y reabrir.
3. Ejecución 2: navegar a PoC SQLite, pulsar solo "Leer valor" (sin "Guardar").
   Valor leído: `poc-mw060lbd-rrajkjd4`.
4. Comparación: IGUALES. 0 errores de consola.

## Resultado

- Persistencia SQLite nativa verificada en la app empaquetada Windows y en el
  emulador Android.
- La base sobrevive al cierre total de procesos y se lee sin backend ni red en
  ambas plataformas.
- SQLCipher se incluye en @capacitor-community/sqlite incluso sin activar cifrado:
  revisar licencia/exportación antes de distribución (pendiente).
- No se validó DDL de negocio, LWW ni /sync.