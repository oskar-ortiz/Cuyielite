# D4: interfaz y repositorios de dominio en Trabajo

Estado: **IMPLEMENTADO Y VERIFICADO EN PRUEBAS Y BUILDS**. Falta la verificación en ejecución nativa (Android/Windows), que no se ejecutó en este entorno.

Rama de trabajo: `feat/d4-trabajo-dominio`, desde `dev` `a91a30a` (D3 completo).

## Alcance

Experiencia de dominio dentro de **Trabajo**, con datos locales y outbox transaccional:

- Listado de animales por poza y ficha del animal con datos generales, genealogía, partos, pesajes y eventos.
- Creación y edición de `cuyes`, `partos`, `pesajes` y `eventos`.
- Vínculos `parto_crias` creados junto al parto (uno por cría) y corrección de `rol` disponible en el repositorio.
- Lectura offline desde SQLite; estado de sincronización, conflictos y aviso de conexión.
- Demo y Trabajo siguen separados por rutas, repositorios y bases.

No incluye borrado, push v2, ETL, ML/RAG ni datos reales.

## Rutas

```text
/trabajo/galpones/:galponId/pozas/:pozaId/animales
/trabajo/galpones/:galponId/pozas/:pozaId/animales/nuevo
/trabajo/animales/:animalId
/trabajo/animales/:animalId/editar
/trabajo/animales/:animalId/partos/nuevo
/trabajo/animales/:animalId/partos/:partoId/editar
/trabajo/animales/:animalId/pesajes/nuevo
/trabajo/animales/:animalId/pesajes/:pesajeId/editar
/trabajo/animales/:animalId/eventos/nuevo
/trabajo/animales/:animalId/eventos/:eventoId/editar
```

La poza de Trabajo enlaza a su listado de animales; Demo no cambia.

## Repositorios y atomicidad

`work.domain.repository.ts` concentra lectura y escritura sobre `MigrationDb`. Cada alta o corrección abre una transacción `BEGIN IMMEDIATE`, valida referencias, escribe la fila de negocio y encola la operación outbox + `record_state`, y confirma una sola vez. Un fallo revierte negocio y outbox.

- `createCuyo`/`updateCuyo`, `createParto`/`updateParto`, `createPesaje`/`updatePesaje`, `createEvento`/`updateEvento`.
- `parto_crias` se crea dentro de la transacción del parto; `parent_create_id` apunta al alta del parto cuando está pendiente. Una cría ya vinculada a otro parto aborta el lote completo.
- `predecessor_id` y `base_anchor` reutilizan la cadena existente de outbox; un alta local enlaza su edición posterior.
- Guardar sin cambios devuelve `changed: false` y no crea operación.
- Los campos vacíos se normalizan a `NULL`; los pesos se conservan como texto decimal exacto en gramos; las fechas se validan como ISO `AAAA-MM-DD`.
- Un pesaje admite como máximo `parto_id` o `evento_id`, coherente con el contrato de publicación.

Adaptadores: SQLite/Android con `getWorkConnection`; Electron con métodos nuevos del plugin `SqlitePoc` que reutilizan el mismo repositorio en el proceso principal. La Demo usa su repositorio y su base, sin cambios.

## Estados de UI

- Carga, vacío, error de lectura, dato incompleto, sin conexión y conflicto.
- El listado y la ficha muestran chips de cambios pendientes/conflictos y enlazan a `/trabajo/conflictos`.
- Los formularios conservan los valores ante error y muestran «Sin cambios para guardar» en no-op.

## Pruebas ejecutadas

```powershell
cd client
npm run test:unit   # 34 archivos, 182 pruebas passed
npm run lint        # eslint + typecheck:e2e + prettier: OK
npm run build       # tsc + vite build: OK
npm run build:electron
npm run build:migration
npm --prefix electron run build
npx cap copy android && gradlew assembleDebug   # BUILD SUCCESSFUL (JDK 21+; JBR de Android Studio)
```

Cobertura nueva:

- `work.domain.repository.test.ts` (6): alta y outbox atómica, no-op, corrección con predecesor, parto con `parto_crias` y `parent_create_id`, rollback al repetir cría en otro parto, pesaje/evento y rechazo de referencia inexistente.
- `Animales.test.tsx` (3): vacío, listado con pendientes/conflicto y error de lectura.
- Validación dentro de la suite del repositorio: NULL frente a cero, referencias obligatorias, decimales y doble vínculo de pesaje.

## Límites y pendientes

- **Ejecución nativa real pendiente:** no se recorrió la UI en emulador Android ni en la app instalada de Windows; los builds sí finalizaron.
- No hay borrado ni eliminación de vínculos `parto_crias`; solo alta y corrección de `rol` (esta última sin pantalla propia todavía).
- La revisión de conflictos de dominio sigue enlazando a la pantalla existente; sus casos aún no se listan allí (la revisión v1 cubre `galpon|poza`).
- La lista de pozas y animales se lee completa para los selectores; no hay paginación local.
- Sin datos reales, Excel, tokens ni bases versionadas; las pruebas usan filas sintéticas en memoria.
