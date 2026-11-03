# Verificación — base Windows con Electron (paso 2)

Rama: `feat/client-electron-base`. Commit del paso 1: `651b22c`.
Instalador verificado: `client/electron/dist/CuyiElite Setup 0.0.0.exe` (NSIS, x64, per-user).

## Comando reproducible

Desde la raíz del worktree:

```bash
cd client
npm ci
npm run build:electron

cd electron
npm ci
npm run pack
```

`npm run pack` ejecuta `npm run build` (TypeScript de Electron), `capacitor-electron vendor`
y `electron-builder --config electron-builder.config.js`. El target queda explícito en
`electron-builder.config.js`: NSIS, `arch: ['x64']`, `perMachine: false`,
`oneClick: true`, `allowElevation: false`.

## Instalación

- No existía instalación previa de CuyiElite (sin entradas en el registro ni en
  `%LOCALAPPDATA%\Programs\CuyiElite`, `%ProgramFiles%` ni el menú Inicio).
- Instalación silenciosa: `"CuyiElite Setup 0.0.0.exe" /S`.
- Ruta instalada: `%LOCALAPPDATA%\Programs\cuyielite-electron\CuyiElite.exe`.
- Entrada de desinstalación registrada:
  `%LOCALAPPDATA%\Programs\cuyielite-electron\Uninstall CuyiElite.exe`.

## Pruebas realizadas (backend y Vite apagados)

Sin procesos en los puertos 5173/8000/8100. Runtime: Electron 45.2.1,
Chromium 156.0.8078.75.

1. Arranque: título `CuyiElite`, URL `capacitor-electron://localhost/galpones`,
   4 galpones listados.
2. Navegación: detalle del Galpón Norte muestra únicamente P-101/P-102/P-103;
   regreso al listado.
3. Estado vacío: Galpón Este muestra «Este galpón todavía no tiene pozas
   registradas».
4. Cierre completo y reapertura: dos ejecuciones consecutivas, ambas con 0
   errores de consola.
5. Red emulada como desconectada: `BrowserContext.setOffline(true)` aplicado a
   la app instalada. Listado (4 galpones), detalle (P-101), regreso y recarga
   (`reload`) funcionan; 0 errores de consola. Al restaurar la red
   (`setOffline(false)`) no se requiere reinicio.

## Fuera de alcance de esta verificación

- No se valida SQLite ni persistencia: esta entrega conserva los datos demo
  incluidos en la app. El conector SQLite y su prueba de escritura/cierre/
  reapertura quedan pendientes.
- No se firma el instalador (sin certificado de firma de código).
- No se desactivaron protecciones de Windows.