# Verificación — Registro de galpones y pozas (Windows y Android)

Rama: `feat/client-registro-galpones-pozas`.

## Windows (app empaquetada)

App probada: `client/electron/dist/win-unpacked/CuyiElite.exe` con
`--user-data-dir` aislado (no se sobrescribió la instalación existente).

Runtime: Electron 45.2.1, Chromium 156.0.8078.75, Node 24.22.1.
Prueba realizada con backend apagado y red emulada desconectada
(`BrowserContext.setOffline(true)`).

1. Crear galpón "Galpón Offline" con ubicación "Lote test": aparece en el listado.
2. Abrir detalle, crear poza "P-OFF" (tipo cría, capacidad 7): aparece en el detalle.
3. Cerrar todos los procesos y reabrir: listado muestra "Galpón Offline" y detalle
   muestra "P-OFF". 0 errores de consola.
4. Base aislada en userData temporal; no se modificó la instalación existente.

## Android (emulador)

Entorno: Pixel_36 (emulator-5554), Android SDK 36, JDK 21.

Prueba con red desactivada (airplane_mode_on=1, wifi_on=0, mobile_data=0):
1. Crear galpón y poza desde la UI.
2. Cerrar app (`adb shell am force-stop`) y reabrir.
3. Listado y detalle muestran los registros creados. 0 errores.
4. Red restaurada a airplane=0, wifi=1, mobile_data=1. Backend apagado.

## Limitaciones
- No se implementó edición ni eliminación.
- LWW, timestamps de sincronización y `/sync` quedan para tareas posteriores.
- SQLCipher no se activó; revisión de licencia/exportación pendiente.