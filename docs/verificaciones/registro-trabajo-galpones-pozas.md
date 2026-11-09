# Registro y edición de galpones y pozas en el modo Trabajo

El modo Trabajo ya permite crear y editar galpones y pozas desde la UI de Android y Windows. Cada guardado persiste la fila local y su operación de outbox en una sola transacción, reutilizando la arquitectura existente. La demo permanece separada y sin cambios.

Fecha: 2026-11-09. Rama: `feat/work-registro-galpones-pozas`, desde `origin/dev` `86162ec`.

## Alcance implementado

| Área | Cambio |
| --- | --- |
| Repositorio de trabajo | `getWorkGalponesRepository()` compone lecturas locales con las altas/ediciones de `work.outbox` en Android y Electron. |
| Selección por modo | `getGalponesRepositoryFor(mode)` evita que demo y trabajo compartan repositorio. |
| Formularios | `CrearGalpon`, `CrearPoza`, `EditarGalpon` y `EditarPoza` aceptan `mode` y conservan sus validaciones y flujos. |
| Rutas | Altas y ediciones bajo `/trabajo/galpones/...`; la demo conserva sus rutas. |
| Navegación | El listado y el detalle de Trabajo muestran **Nuevo**, **Editar galpón**, **Nueva poza** y **Editar** por poza. |
| Estado pendiente | El listado de Trabajo muestra un chip con la cantidad de cambios pendientes; la sincronización sigue en su pantalla. |
| Separación | La demo conserva su base, su marcado y sus rutas; el modo Trabajo ya no se presenta como «solo consulta». |

No se agregó borrado. No se tocaron animales, partos, pesajes, ETL, ML, RAG, contratos, autenticación ni esquema.

## Garantías reutilizadas

- `createWorkGalpon`, `updateWorkGalpon`, `createWorkPoza` y `updateWorkPoza` ya ejecutan `BEGIN IMMEDIATE`, escriben la fila y la operación outbox, y hacen `COMMIT` o `ROLLBACK` juntos.
- Una poza creada antes de que el galpón padre se sincronice conserva `parent_create_id`; la operación queda ligada al alta del padre.
- Una edición sucesora conserva `predecessor_id` y no inventa versión central.
- Un guardado sin cambios devuelve `changed=false` y no inserta operación; los formularios además evitan llamar al repositorio cuando los valores normalizados son iguales.
- La outbox conserva `operation_id`, snapshot y solicitud congelada para reintentos idempotentes.

## Pruebas automatizadas

Desde `client/` sobre el código final:

```powershell
npm run lint
npx vitest run --no-file-parallelism
npm run build
```

- Lint: ESLint, typecheck de E2E y Prettier correctos.
- Pruebas: **30 archivos, 159 pruebas en verde**.
- Build web: correcto, con las advertencias preexistentes de tamaño de bundle.
- Android: `gradlew assembleDebug` correcto.
- Windows: `win-unpacked` generado con `electron-builder --dir`.

Cobertura nueva o ajustada:

- escritura de trabajo por plataforma y selección demo/trabajo;
- creación y edición desde los cuatro formularios en modo Trabajo;
- validaciones y conservación de valores ante error;
- guardado sin cambios sin llamar a la outbox;
- rutas y accesos de edición en listado y detalle;
- chip de cambios pendientes;
- pruebas existentes de outbox: atomicidad, rollback, dependencia padre-hijo, sucesoras y no-op.

## Verificación nativa sin backend

Windows empaquetado con `--user-data-dir` temporal y Android `Pixel_36`, con backend apagado:

| Comprobación | Windows | Android |
| --- | --- | --- |
| Crear galpón desde la UI | Sí | Sí |
| Crear poza desde el detalle | Sí | Sí |
| Editar galpón y poza | Sí | Sí |
| El cambio aparece de inmediato | Sí | Sí |
| Chip y pantalla de sincronización | 4 pendientes | 4 pendientes |
| Guardar sin cambios | No agregó operación | No agregó operación |
| Cerrar y reabrir | Datos y 4 pendientes persisten | Datos y 4 pendientes persisten |
| Demo intacta | Sí | Sí, con sus datos previos |

En ambas plataformas la base de trabajo terminó con 1 galpón y 1 poza locales y 4 operaciones `queued`: alta de galpón, alta de poza, edición de poza y edición de galpón. La poza conservó `parent_create_id` del alta del galpón.

## Sincronización contra PostgreSQL de laboratorio

Se creó un PostgreSQL aislado nuevo:

| Recurso | Valor |
| --- | --- |
| Contenedor | `cuyelite-work-e2e-e94248` |
| Base | `cuyelite_work_e94248` |
| Puerto | `55432`; backend en `8000` |
| Ámbito | `1fa8fd97-1aee-4b07-94fd-41428ef87ea6` |
| Dispositivos | Windows `5fbc4ca4-26bf-4889-a43c-6edfb2b75755`; Android `3720974e-7df5-4b3e-bd9e-7dd50cae2aa5` |

Se aplicaron bootstrap `001-005` y migraciones `0001-0003`. Los tokens temporales se generaron fuera de Git y solo se persistió su SHA-256 en `sync_devices`.

### Resultado central

| Entidad | Versión | Relación |
| --- | --- | --- |
| `Galpón UI Win` | 2 | — |
| `Galpón UI Android` | 2 | — |
| `P-UI-WIN-2` | 2 | ligada a `Galpón UI Win` |
| `P-UI-AND-2` | 2 | ligada a `Galpón UI Android` |

- 2 dispositivos, 2 galpones, 2 pozas, **8 cambios** y **8 recibos**; `last_sequence=8`.
- Windows envió sus 4 operaciones y luego recibió 4 registros de Android.
- Android envió sus 4 operaciones y recibió los registros de Windows.
- Ambos clientes quedaron con cursor `after=8`, 0 pendientes y ambos galpones visibles.
- Los detalles mostraron cada poza dentro de su galpón correcto.

### Idempotencia

Se reenvió la primera solicitud congelada de cada cliente:

| Dispositivo | Operación | HTTP | Resultado |
| --- | --- | --- | --- |
| Windows | `321307f5-e5a2-4236-9989-81460cbd63ea` | 200 | Recibo original, comparación semántica |
| Android | `6be7e281-1c4c-45ae-aa2d-e0e0c194404b` | 200 | Recibo original, comparación semántica |

Después de ambos reenvíos el servidor siguió con 8 cambios, 8 recibos y `last_sequence=8`; no aparecieron filas, versiones ni recibos nuevos.

### Recuperación observada

Durante la prueba, una recarga forzada del WebView en medio de un ciclo de Android dejó la primera operación en `prepared` con resultado central ya aceptado. El siguiente ciclo reenvió el mismo cuerpo congelado, recibió el recibo original y continuó con las operaciones restantes hasta completar las 4. Esto confirma la recuperación idempotente prevista por el diseño, no un defecto de la UI.

Las recargas forzadas también registraron en consola `CreateConnection: Connection trabajo already exists`; la recuperación existente de la conexión de trabajo la resolvió y la app siguió operando.

## Límites reales

- No se implementó borrado ni restauración.
- No se amplió a animales, partos, pesajes ni otras entidades; requieren el modelo y contrato coordinados con Diery.
- La autenticación sigue siendo exclusiva del laboratorio. Aprovisionamiento, rotación y revocación de producción no existen todavía.
- Los ciclos de Android pueden tardar más de un minuto en el emulador; la UI permanece usable y muestra «Sincronizando…».
- El instalador NSIS no se generó en esta corrida: se usó `electron-builder --dir` para producir `win-unpacked`, que es el ejecutable empaquetado probado.

## Limpieza ejecutada

- Contenedor `cuyelite-work-e2e-e94248`, base y volumen eliminados.
- Backend detenido; puertos `8000`, `55432`, `9333` y `9225` liberados.
- Perfil temporal de Windows, secretos, scripts y copias temporales eliminados.
- Emulador apagado. La base de demostración de Android y sus datos previos quedaron intactos; la base de trabajo conserva los datos sintéticos del recorrido.
- El contenedor preexistente `cuyelite-s3-test` no se tocó.
