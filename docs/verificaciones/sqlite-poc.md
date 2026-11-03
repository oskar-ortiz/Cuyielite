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

## Resultado

- Persistencia SQLite nativa verificada en la app empaquetada Windows.
- La base sobrevive al cierre total de procesos y se lee sin backend ni red.
- No se declaró SQLite validado en Android: entorno móvil pendiente
  (sin SDK/adb en la máquina).
- No se validó DDL de negocio, LWW ni /sync.