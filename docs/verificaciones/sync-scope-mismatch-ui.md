# Verificación: desajuste entre sesión y ámbito local

Estado: **CORRECCIÓN DE PRESENTACIÓN Y BLOQUEO DE REINTENTO VERIFICADOS EN PRUEBAS DE CLIENTE; SIN RECORRIDO NATIVO**.

## Hallazgo

El cliente ya rechazaba correctamente sincronizar cuando el `scope_id` del contexto remoto no coincidía con el ámbito vinculado a la SQLite de Trabajo. Los errores `scope local no coincide` y `Cambio de scope no permitido` terminaban como un error genérico, sin explicar que la instalación conserva un vínculo de ámbito inmutable ni que debe usarse un perfil de Trabajo correspondiente.

## Cambio

- La clasificación del error identifica por separado el desajuste de ámbito.
- La pantalla informa que la sesión y la base local corresponden a ámbitos distintos, que los datos y cambios pendientes se conservaron, y que se debe verificar la cuenta/perfil antes de continuar.
- En modo piloto se bloquea el reintento mientras la identidad no cambie. En modo laboratorio se habilita tras cambiar el token manual.
- No se rebindea la base, no se borran datos, no se cambian cursores/recibos y no se migra información entre ámbitos.

## Verificación

```text
npx vitest run src/data/work.sync.ui.test.ts src/pages/SincronizacionTrabajo.test.tsx --maxWorkers=1
  2 archivos, 18 pruebas aprobadas
npm run lint
  OK
npm run build
  OK
```

El build conserva las advertencias existentes de tamaño de bundles e import dinámico inefectivo.

## Límite

Estas pruebas verifican el mensaje y el bloqueo de reintento; no demuestran una sincronización nativa. El último ensayo Android sigue bloqueado por el perfil con ámbito distinto, la falta de JDK 21 y recursos del emulador. La verificación debe retomarse con un perfil aislado; no borrar ni reiniciar Pixel_36 para forzarla.
