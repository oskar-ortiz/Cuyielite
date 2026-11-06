# S2 — cola local de cambios de la base de trabajo

## Alcance

S2 agrega una migración incremental de `cuyielite-work` v2 a v3 y una cola local para altas y ediciones de galpones y pozas. Es una prueba de integración con datos sintéticos. La interfaz de trabajo conserva el modo de consulta; la escritura desde formularios y el transporte HTTP pertenecen a entregas posteriores.

La migración conserva `dataset_id`, el checksum de C2 y las filas existentes. Agrega `device_id`, contexto de sincronización, estado por registro y outbox. Cada escritura de negocio y su operación pendiente se confirman en una sola transacción. Una poza creada bajo un galpón aún pendiente referencia la operación de creación del padre; una edición posterior referencia la operación previa del mismo registro. Guardar sin cambios no modifica `updated_at` ni agrega una operación.

## Verificación automatizada

En `client/`:

```text
npm run test:unit       76 pruebas en 14 archivos, todas pasan
npm run lint            ESLint, typecheck:e2e y Prettier correctos
npm run build:migration correcto
npm run build           correcto
npm run build:electron  correcto
```

Las pruebas nuevas cubren base nueva, upgrade v2→v3, conservación de identidad y datos, reapertura, no-op, rechazo de checksum o esquema inválido, rollback/reintento, dependencias entre operaciones, conservación de relaciones y rollback si falla la cola. Se verificó además `assembleDebug` de Android y el empaquetado Electron (`npm run pack`).

## Windows empaquetado

Se usó `client/electron/dist/win-unpacked/CuyiElite.exe` con un perfil temporal aislado. Mediante CDP externo se invocaron las operaciones acotadas del plugin, sin exponer SQL o rutas al renderer:

1. Inicializar base de trabajo v3.
2. Crear un galpón y una poza sintéticos; editar el galpón; intentar guardar sin cambios.
3. Cerrar todos los procesos y reabrir el mismo perfil.

Tras reabrir, `getWorkDatabaseStatus()` devolvió v3, `dataset_id` `ae4f31e7-3e4a-46e7-802f-1831f26d6d38`, `device_id` `0dc9d8e9-1adf-4d5b-b0b1-04c5c87f8811` y checksum de sync `0bb0c84c...`. Una lectura SQLite directa en modo solo lectura, con la app cerrada, confirmó 1 galpón, 1 poza y 3 operaciones `queued`. La operación de la poza apunta a la creación del galpón y la edición apunta a la creación anterior. El intento sin cambios devolvió `changed: false` y no agregó operación. La base demo siguió separada (4 galpones, 6 pozas).

## Android emulado

Se creó un AVD temporal `CuyiElite_S2_Verify`, separado de `Pixel_36`. Primero se instaló la app S1 para crear una base v2 y se leyó su identidad: `dataset_id` `49c09269-6c00-4fc7-8db0-f011992e33ca`, checksum C2 `78c248ef...`. Después se instaló la APK S2 y se abrió el modo Trabajo. Una copia de la base obtenida con `run-as` y leída en modo solo lectura confirmó v3 con los mismos `dataset_id` y checksum C2, más checksum de sync `0bb0c84c...` y `device_id` `64558feb-df4a-466c-a1aa-f24fd3cab9e8`.

Para probar las operaciones nativas se compiló temporalmente un acceso de laboratorio condicionado por `VITE_S2_HARNESS=1`. Se creó un galpón y una poza sintéticos, se editó el galpón y se guardó de nuevo sin cambios. La base cerrada contenía 1 galpón, 1 poza y 3 operaciones `queued`, con referencia al padre y predecesor correctas. Se forzó el cierre y se reabrió la app: el galpón editado apareció en la vista Trabajo y los identificadores de la base permanecieron. Después se retiró el acceso temporal, se recompiló e instaló la APK final; `window.__s2Harness` ya no existe y el galpón de prueba siguió visible. El AVD temporal se eliminó; `Pixel_36` siguió disponible.

## Límites

- No se enviaron operaciones al servidor ni se implementaron recibos, pull o resolución de conflictos. Esto corresponde a S3–S5.
- No se importaron Excel ni datos reales y no se modificó el parser o las migraciones centrales de Diery.
- La UI de Trabajo sigue en solo consulta. Los formularios y la integración visible pertenecen a S6.
- Esta prueba usa perfil Windows y emulador Android aislados; no valida aún autenticación, autorización por ámbito ni despliegue de producción.
