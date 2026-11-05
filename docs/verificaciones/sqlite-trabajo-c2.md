# Verificación de SQLite de trabajo (C2)

## Versiones y comandos reproducibles

- Node: v24.20.0
- npm: 11.19.0
- Vitest: 5.0.5
- @capacitor-community/sqlite: 8.1.1
- Electron: 45.2.1

```powershell
cd client
npm ci
npm run test:unit
npm run build:migration
npm run lint
npm run typecheck:e2e
npm run build
npm run build:electron
```

## Ubicaciones por plataforma

- Android: nombre físico generado por el plugin (puede ser `trabajoSQLite.db`). No se renombra.
- Windows/Electron: `trabajo.db` dentro de `userData/cuyielite-work/`.

## Resultados automatizados

- work.migration.test.ts: 19 passed.
- galpones.migration.test.ts: 5 passed.
- Total unit tests: 57 passed.
- build:migration: OK.
- lint (eslint + prettier): OK (0 warnings).
- typecheck:e2e: OK.
- build: OK.
- build:electron: OK.
- Importación real del módulo compilado: OK (exports verificados).

## Pruebas realizadas (work.migration.test.ts)

1. Inicialización desde cero: esquema completo y cero filas de negocio.
2. FK activas y foreign_key_check sin errores.
3. Segundo inicio: mismo dataset_id, versión y checksum (no-op).
4. Rechaza versión futura sin degradar.
5. Rechaza base demo (version 1) sin convertirla.
6. Rechaza identidad desconocida (tablas existentes).
7. Error intermedio revierte esquema, versión y metadatos (inyección real de fallo + reintento).
8. Chapa duplicada permitida.
9. NULL se distingue de cero.
10. Pesos decimales se conservan exactamente.
11. Un parto admite varias crías; una cría no admite dos partos.
12. Reapertura conserva dataset_id y checksum.
13. Checksum alterado se rechaza.
14. Esquema incompleto se rechaza.
15. Inicialización concurrente sin duplicación.
16. Base rechazada no se altera.
17. Recuperación tras fallo permite reintento.

## Métodos registrados en plugin Electron

- `initializeWorkDatabase`
- `getWorkDatabaseStatus`
- `closeWorkDatabase`

Ruta resuelta en proceso principal: `path.join(app.getPath('userData'), 'cuyielite-work', 'trabajo.db')`. Sin SQL ni rutas del renderer.

## Verificación nativa Windows (ejecutada)

- App empaquetada: `dist/win-unpacked/CuyiElite.exe` + `resources/app.asar`.
- `app.asar` contiene `build/main.js` y `work.migration.js` (módulos requeridos).
- Lanzada con userData aislado (`C:\Users\Admin\AppData\Local\Temp\opencode\cuyi-verify-userdata6/7`).
- Invocación via CDP externo: `window.CapacitorCustomPlatform.plugins.SqlitePoc.initializeWorkDatabase()`.
- Resultado: `{ ok: true, status: { schemaFamily: "cuyielite-work", schemaVersion: 2, datasetId: "ec0db2d5-...", checksum: "78c248ef...", counts: { galpones:0, pozas:0, cuyes:0, partos:0, pesajes:0, eventos:0, parto_crias:0 } } }`.
- Inspección directa de `trabajo.db` (solo lectura): user_version=2, meta completa, 8 tablas, 0 filas de negocio.
- Cierre y reapertura: dataset_id y checksum persisten (ec0db2d5... / 78c248ef...).
- Demo no modificada (base demo no tocada; verificación por inspección).

## Verificación nativa Android (ejecutada)

- Emulador: Pixel_36 (AVD existente, sin instalar SDKs ni descargar imágenes).
- APK instalado: app-debug.apk (build successful).
- App lanzada: co.ucc.cuyielite/.MainActivity.
- Harness temporal activado via VITE_C2_HARNESS=1 (renderizado directo, sin deep links).
- Resultado del harness: C2_HARNESS_READY: OK conexion obtenida.
- Inspección de trabajoSQLite.db (solo lectura, copia binaria):
  - user_version: 2
  - schema_family: cuyielite-work
  - schema_version: 2
  - dataset_id: 0b35978b-3b3d-4a2e-9ef6-20eb64776cd2
  - schema_checksum: 78c248efb66b0af63f289055210478e8d345f239aa7d559288004be91cc244a3
  - tablas: galpones, pozas, cuyes, partos, pesajes, eventos, parto_crias, meta (8 tablas)
  - filas de negocio: 0 en todas
- Cierre forzado y reapertura: dataset_id y checksum persisten.
- Comparación demo antes/después:
  - before sha256: 0b6d13e97b202de90fc540d43d3e503678d0150973638a7af7d11827cbc56aad
  - after sha256:  0b6d13e97b202de90fc540d43d3e503678d0150973638a7af7d11827cbc56aad
  - identical: True
  - Captura binaria via subprocess.run (shell=False, stdout en archivo "wb", stderr separado, exit code 0).
  - Sin archivos WAL adicionales en el directorio de bases.
- Harness temporal retirado (WorkDbHarness.tsx eliminado, ruta/importación eliminadas de App.tsx).

## Fallos, limitaciones y comprobaciones pendientes

- Importador y sincronización no iniciados (C3+).

## Nota sobre harness temporal

Se utilizó un harness temporal (WorkDbHarness.tsx) con bandera VITE_C2_HARNESS=1 para la verificación nativa Android. Se retiró antes de entregar. Un diagnóstico permanente no es un pendiente de C2.


## Validación no-op del inicializador compilado

Codex ejecutó el inicializador compilado final en modo solo lectura sobre:
- Base Windows perfil 6 (trabajo.db)
- Base Windows perfil 7 (trabajo.db)
- Copia Android (trabajoSQLite.db)

Los tres no-op fueron correctos: identidad, versión 2, checksum y tablas se conservaron.
Esto valida las bases existentes; no representa una nueva ejecución en el emulador.
