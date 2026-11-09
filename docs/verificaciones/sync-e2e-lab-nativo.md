# Sincronización E2E exitosa con backend PostgreSQL de laboratorio

Se completó el camino exitoso que S5 dejó pendiente: Windows empaquetado y Android emulado sincronizaron datos sintéticos relacionados contra un PostgreSQL aislado, con credenciales temporales, recibos, versiones y cursores verificados. No se usaron datos reales ni se modificaron contratos, autenticación o esquema.

Rama: `test/sync-e2e-lab-nativo`, desde `origin/dev` `83eb97d` (S5 fusionada). Fecha: 2026-11-09.

## Aislamiento y recursos temporales

| Recurso | Valor |
| --- | --- |
| Contenedor | `cuyelite-s5e2e-692608` |
| Base de datos | `cuyelite_s5e2e_692608` |
| Imagen | `pgvector/pgvector:pg16` |
| Puerto host | `55432` (backend en `8000`) |
| Ámbito | `952cdd43-d19b-44bb-96db-6132e34b84e7` |

- Se creó una base nueva con nombre único y se aplicó el bootstrap `db/ddl/central/001-005` y las migraciones `0001_lope_domain.sql`, `0002_sync_lab.sql` y `0003_rag_e5_embeddings.sql` con `python -m tools.db_migrate`.
- El backend se habilitó solo con `CUYIELITE_SYNC_LAB_ENABLED=1`, `DATABASE_URL` a esa base y una `SYNC_CURSOR_SIGNING_KEY` aleatoria temporal.
- Los tokens de laboratorio se generaron aleatoriamente, se guardaron solo en un archivo temporal fuera de Git y se registró únicamente su SHA-256 en `sync_devices`. No se imprimieron en logs, consola ni evidencia.
- Windows usó un `--user-data-dir` temporal propio. Android usó la base de trabajo sintética ya existente en `Pixel_36`, que estaba vacía y sin scope al iniciar; no se borró ni recreó la base de demostración.
- Al terminar se eliminaron el contenedor, la base, el perfil temporal y los archivos de secretos. El contenedor preexistente `cuyelite-s3-test` no se tocó.

## Método

La UI de Trabajo sigue sin formularios de alta/edición; S5 solo expone estado, sincronización y conflictos. Por eso las entidades sintéticas se crearon y actualizaron con la capa local ya aprobada (`createWorkGalpon`, `createWorkPoza`, `updateWorkPoza` de `work.outbox`, que escribe datos y outbox en una transacción). La sincronización, los estados visibles, la navegación y la persistencia se ejecutaron desde la UI real de cada app. No se agregó una pantalla ni un bypass para la prueba.

Flujo ejecutado:

1. Windows creó un galpón y una poza con la capa local y sincronizó desde la UI.
2. Android sincronizó desde la UI, descargó ambos registros y verificó la poza relacionada.
3. Android creó una segunda poza y actualizó su código; cada operación se envió desde la UI.
4. Windows volvió a sincronizar y descargó la segunda poza y su versión actualizada.
5. Se cerraron y reabrieron ambas apps y se repitió el estado.
6. Se reenvió exactamente la solicitud congelada de cada dispositivo y se compararon recibos, cambios y versiones.

Comandos principales (sin credenciales):

```powershell
python -c "import psycopg, glob, os; conn=psycopg.connect(os.environ['CUYI_DB_URL'], autocommit=True); [conn.execute(open(f, encoding='utf-8').read()) for f in sorted(glob.glob('db/ddl/central/*.sql'))]; conn.close()"
python -m tools.db_migrate --env-var CUYI_DB_URL
$env:DATABASE_URL = $env:CUYI_DB_URL
$env:CUYIELITE_SYNC_LAB_ENABLED = "1"
$env:SYNC_CURSOR_SIGNING_KEY = "<clave temporal fuera de Git>"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# Android necesita el loopback del backend en el emulador
adb reverse tcp:8000 tcp:8000

# App Windows empaquetada
client/electron/dist/win-unpacked/CuyiElite.exe --user-data-dir=<perfil-temporal> --remote-debugging-port=9333
```

## Datos y resultados en el servidor

| Entidad | ID | Versión | Origen |
| --- | --- | --- | --- |
| Galpón `Galpón E2E 692608` | `a876e9bc-23ac-4a9d-8e85-674986b93acc` | 1 | Windows |
| Poza `P-E2E-692608` | `de113183-b50f-417c-8ab8-f66af2b2c9c9` | 1 | Windows |
| Poza `P2-E2E-692608` | `ac077751-f68c-417b-bccd-9a3bb5245aa0` | 1 | Android |
| Poza `P3-E2E-692608` | `3e055ea6-edb7-4585-bfcd-10102836f26a` | 2 | Android, actualizada |

Estado final de PostgreSQL aislado:

- 1 ámbito, 2 dispositivos autorizados, 1 galpón y 3 pozas.
- 5 cambios centrales y 5 recibos; `last_sequence = 5`.
- Las tres pozas pertenecen al galpón `a876e9bc-…`; `P3` quedó en versión 2 tras la actualización.
- Totales de la base: 1 ámbito, 1 galpón, 3 pozas, 5 cambios y 5 recibos, sin filas de otros ámbitos.

Estado local final:

| Comprobación | Windows | Android |
| --- | --- | --- |
| `scope_id` | `952cdd43-…` | `952cdd43-…` |
| Cursor | `after=5` | `after=5` |
| Outbox | 2 aceptadas, 0 pendientes | 3 aceptadas, 0 pendientes |
| Registros | galpón + 3 pozas | galpón + 3 pozas |
| Cierre y reapertura | «Sin cambios pendientes» y datos presentes | «Sin cambios pendientes» y datos presentes |

Las UI mostraron los estados esperados: «Cambios pendientes» antes de enviar, «Sincronizando…» sin bloquear la consulta local, «Sincronización completada» con el resumen de registros/cambios y «Sin cambios pendientes» tras reabrir.

## Idempotencia

Se reenvió el cuerpo congelado de una operación aceptada por dispositivo con el mismo token:

| Dispositivo | Operación reenviada | HTTP | Resultado |
| --- | --- | --- | --- |
| Windows | `b435aff1-b821-40d5-a659-0e2c7e869c92` (alta de galpón) | 200 | Recibo idéntico al almacenado (comparación semántica, tolerando orden de claves JSON) |
| Android | `d5888ec5-2060-42df-bd6c-ad9fa6e4b9ee` (alta de P2) | 200 | Recibo idéntico al almacenado |

Tras ambos reenvíos, PostgreSQL siguió con 5 cambios, 5 recibos y `last_sequence = 5`; no aparecieron filas, versiones ni recibos nuevos. El campo `changed=true` es el valor original del recibo memoizado, no un segundo efecto.

## Defecto encontrado y corregido

Durante la prueba con un único cambio pendiente, Android mostró «1 cambio locales esperan envío.» y el texto de conflictos usaba el mismo plural. Se corrigió la concordancia en `client/src/data/work.sync.ui.ts`:

- Antes: `1 cambio locales esperan envío.` / `1 cambio esperan tu decisión.`
- Después: `1 cambio local espera envío.` / `1 conflicto espera tu decisión.`
- También se ajustó «2 cambios; requieren revisión».

Se agregó una prueba dirigida en `work.sync.ui.test.ts` para singular/plural de pendientes, conflictos y rechazos. La corrección se verificó en Android con el build final (`1 cambio local espera envío.`) y en la suite completa.

## Verificación automatizada final

Sobre el código final de la rama, en `client/`:

```powershell
npm run lint
npx vitest run --no-file-parallelism
npm run build
```

- Lint: ESLint, typecheck de E2E y Prettier correctos.
- Pruebas: **30 archivos, 149 pruebas en verde**.
- Build web: correcto, con las advertencias preexistentes de tamaño de bundle y de import dinámico.
- Android: `gradlew assembleDebug` correcto y APK instalado en `Pixel_36`.
- Windows: `win-unpacked/CuyiElite.exe` generado con el código final.

## Límites reales

- La UI de Trabajo todavía no ofrece formularios de alta/edición. Las entidades se sembraron con la capa local aprobada; no se consideró una prueba de formularios.
- `npm run pack` completo falló dos veces con `504 Gateway Time-out` al descargar NSIS desde el servicio externo de electron-builder. Se generó `win-unpacked` con `electron-builder --dir` y se probó ese ejecutable empaquetado. No se produjo instalador NSIS en esta corrida.
- La autenticación sigue siendo exclusiva del laboratorio. Aprovisionamiento, rotación y revocación de credenciales de producción no existen todavía y no se implementaron.
- No se probaron otros tipos de entidad, borrados ni conflictos; conflictos ya fueron verificados en S4 y aquí el ámbito quedó sin conflictos.
- Los ciclos de Android tardaron decenas de segundos en el emulador; la UI permaneció usable y mostró «Sincronizando…» mientras tanto.

## Limpieza ejecutada

- Contenedor `cuyelite-s5e2e-692608`, base `cuyelite_s5e2e_692608` y su volumen eliminados con `docker rm -f`.
- Backend de laboratorio detenido; puertos `8000`, `55432`, `9333` y `9225` liberados.
- Perfil temporal de Windows, archivos de secretos, scripts y copias de bases temporales eliminados.
- Emulador `Pixel_36` apagado. La app instalada y su base de demostración quedaron intactas; la base de trabajo conserva los datos sintéticos del recorrido. No se borraron datos de la app.
- Contenedor preexistente `cuyelite-s3-test` intacto.
