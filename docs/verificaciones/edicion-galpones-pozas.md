# Verificación — Edición de galpones y pozas (Windows y Android)

Rama: `feat/client-edicion-galpones-pozas`.

## Windows (app empaquetada)

App probada: `client/electron/dist/win-unpacked/CuyiElite.exe` con perfil aislado
(backup/restore de `%APPDATA%\CuyiElite`). Backend apagado; red NO desactivada
en esta ejecución (la app no usa red, pero no se probó con red desactivada).

Runtime: Electron 45.2.1, Chromium 156.0.8078.75, Node 24.22.1.

1. Editar galpón "Galpón Norte" → "Galpón WinEdit": el listado y el
   formulario muestran el nuevo nombre (el detalle solo muestra las pozas).
   Cerrar y reabrir: persiste.
2. Editar poza P-101 → "P-WINEDIT": el detalle muestra el nuevo código.
   Cerrar y reabrir: persiste.
3. Sin cambios efectivos: guardar sin modificar no actualiza `updated_at`.
4. Datos inválidos: nombre vacío muestra error y conserva el formulario.
5. Identificador inexistente: muestra "Galpón no encontrado"/"Poza no encontrada".
6. Base aislada; no se modificó la instalación existente.

Conservación de identificadores y marcas de tiempo (verificado por código y por
consulta a la base SQLite con `node:sqlite` en modo solo lectura):

- Galpón "Norte" → "WinEdit": id, created_at y deleted_at (null) conservados;
  updated_at cambió.
- Poza "P-101" → "P-WINEDIT": id, galpon_id, created_at y deleted_at (null)
  conservados; updated_at cambió.

## Android (emulador)

Entorno: Pixel_36 (emulator-5554), Android SDK 36, JDK 21. Red desactivada
(airplane_mode_on=1, wifi_on=0, mobile_data=0). Backend apagado.

Método de extracción de base: `adb shell "run-as co.ucc.cuyielite base64
databases/cuyieliteSQLite.db"` decodificado con `certutil -decode`; consulta con
`node:sqlite` en modo solo lectura. Archivos WAL/SHM verificados (tamaño 0).
Base no cifrada (no-encryption).

Galpón "Galpón Norte" → "Galpón AndEdit" (ubicación "Lote AndEdit"):
- id: d30ddf43-d3ff-466d-9ec8-c185afc6cf77 (conservado)
- created_at: 2026-01-01T00:00:00Z (conservado)
- deleted_at: null (conservado)
- updated_at: 2026-01-01T00:00:00Z → 2026-11-03T09:18:39.165Z (cambió)

Poza "P-101" → "P-ANDEDIT" (tipo engorde, capacidad 99):
- id: 78985c3c-3e9b-4002-b2fe-78c982d9305c (conservado)
- galpon_id: d30ddf43-d3ff-466d-9ec8-c185afc6cf77 (conservado)
- created_at: 2026-01-01T00:00:00Z (conservado)
- deleted_at: null (conservado)
- updated_at: 2026-01-01T00:00:00Z → 2026-11-03T09:23:23.336Z (cambió)
- capacidad_maxima: 99 (confirmado en base)

Guardar sin cambios (Galpón AndEdit): `updated_at` conservó exactamente
2026-11-03T09:18:39.165Z (comprobado en base).

Persistencia: tras cerrar (`adb shell am force-stop`) y reabrir con red/backend
apagados, la base conserva los valores editados.

Observación de interfaz: al guardar un galpón sin cambios, la app regresa al
detalle, que solo muestra las pozas; el nombre y la ubicación no se muestran
allí. Esos valores se verifican en el listado o al abrir "Editar galpón".
La navegación hacia atrás (botón "Galpones") resulta confusa en ese flujo;
es una posible mejora de interfaz, no un fallo de persistencia.

## Cobertura de pruebas automatizadas

- `EditarGalpon.test.tsx` (6 casos) y `EditarPoza.test.tsx` (6 casos): 12 pruebas
  nuevas. Total: 38 tests (26 anteriores + 12 nuevas). Casos: valores precargados,
  editar y guardar con argumentos correctos, cancelar sin escribir, guardar sin
  cambios sin llamar a `update`, error de guardado conservando valores y reintento,
  registro inexistente.
- Lint, 38 tests, build web, build Electron y build Android en verde.

## Limitaciones

- No se implementó edición del galpón de una poza.
- No se validó DDL de negocio, LWW ni `/sync`.
- SQLCipher no se activó; revisión de licencia/exportación pendiente.