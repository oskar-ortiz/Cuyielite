# Conflictos de dominio en la UI de Trabajo

Estado: **IMPLEMENTADO Y VERIFICADO EN PRUEBAS, LINT, BUILDS Y RECORRIDO NATIVO WINDOWS/ANDROID**. La pantalla existente de conflictos cubre `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`, mantiene `galpon|poza` y aplica únicamente las acciones aprobadas por los ADR: conservar la versión central o reenviar una edición local revisada como operación nueva. No hay merge automático ni elección por timestamps.

Rama: `feat/work-conflictos-dominio-ui`, desde `origin/dev` `a17592f` (PR #131 fusionado). Sin cambios de esquema: se reutiliza la base de trabajo v5.

## Decisiones aplicadas

Fuente: ADR 0004 (versiones y conflictos explícitos), ADR 0005 (outbox y recibos idempotentes) y ADR 0008 (borrado lógico y relaciones), en el worktree de diseño de sincronización.

- La versión central por registro es la autoridad. Las fechas locales son informativas y no eligen ganador.
- Ante un conflicto se conserva la edición local y el snapshot central revisado.
- **Conservar versión central** descarta solo la cadena revisada y aplica el registro central en una transacción.
- **Reintentar cambio local** crea una operación nueva con `operation_id` nuevo, `base_anchor` igual a la versión central revisada y sin reutilizar el cuerpo congelado ni el recibo de la operación original.
- Una edición local posterior a la revisión invalida la revisión (`local_head_operation_id` cambió); no se descarta en silencio.
- Si el servidor vuelve a cambiar, el control de versión produce un conflicto nuevo; no hay overwrite incondicional.
- `parto_crias` conserva sus referencias centrales y respeta `UNIQUE(cuy_id)` y la prohibición de que la madre sea cría de su propio parto.
- `categoria_ml` y `ultimo_peso_g` siguen siendo derivados de solo lectura y no se envían como cambios locales.

## Implementación

### Datos y presentación

- `client/src/data/work.sync.conflicts.config.ts`: configuración única por entidad, campos editables, referencias, etiquetas, formato de fechas/pesos/NULL y validación del reintento reutilizando los validadores de dominio existentes.
- `client/src/data/work.sync.conflicts.presentation.ts`: catálogo de referencias con etiquetas y UUID corto. Las chapas repetidas se distinguen por identificador; los animales no se confunden solo por chapa.
- Las referencias se muestran con etiquetas disponibles (`poza`, `galpón`, `animal`, `parto`, `evento`) y, si falta la etiqueta local, con un identificador corto explícito.
- Los pesos se muestran en gramos (`1234.50 g`), las fechas como `dd/mm/aaaa` y un `null` se distingue de `0`.

### Revisión y resolución

- `client/src/data/work.sync.conflicts.review.ts`: lista conflictos de las siete entidades; valida el snapshot con el protocolo correspondiente (v1 para `galpon|poza`, v2 para dominio) y detecta si el recibo de conflicto v2 no incluye los derivados del servidor.
- `client/src/data/work.sync.conflicts.resolve.ts`: resolución transaccional genérica. Conserva el `result_json` y el `frozen_request` originales, marca la cadena revisada como `discarded`, aplica central y crea la operación nueva cuando corresponde.
- `client/src/data/work.sync.conflicts.config.ts` valida referencias locales antes de aplicar central: poza/madre/padre/parto/evento existentes y activos, y reglas de `parto_crias`.
- Si el recibo central no trae `categoria_ml`/`ultimo_peso_g`, la resolución conserva los valores locales derivados en lugar de borrarlos.

### Interfaz

- `client/src/pages/ConflictosTrabajo.tsx`: lista, comparación servidor/dispositivo, edición de los campos reenviables, referencias como selectores, estados de carga/vacío/error/sin conexión/resolución en curso, cancelación sin escritura, guarda contra doble envío y recarga ante una revisión obsoleta.
- Ruta de foco: `/trabajo/conflictos/:entity/:recordId`.
- `client/src/pages/AnimalDetalle.tsx`: accesos directos desde animal, parto, pesaje, evento y vínculo cría–parto; los vínculos se muestran con su rol y parto.
- `work.domain.api.ts` y los adaptadores Android/Electron incorporan la lectura de vínculos por animal; el plugin `sqlite-poc` expone `listDomainVinculos`.

### Regresión v1

`galpon` y `poza` conservan la pantalla, la comparación, las dos acciones y la validación existentes. Los campos específicos de poza (`galpon_id`) no se ofrecen para mover el padre.

## Pruebas automatizadas

```text
npx vitest run --maxWorkers=1
39 archivos, 214 pruebas: OK

npm run lint
eslint + typecheck:e2e + prettier: OK
```

Cobertura dirigida:

- comparación y resolución de `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`;
- operación nueva con `base_anchor` de la versión revisada y recibo original intacto;
- reintento idempotente: una segunda resolución no crea otra operación;
- versión central modificada durante la revisión: rechazo y conflicto conservado;
- edición posterior: revisión obsoleta rechazada sin descartar la edición;
- `parto_crias` con `UNIQUE(cuy_id)` y madre como cría inválida;
- conservación de derivados del servidor cuando el recibo no los incluye;
- cancelación, doble clic, fallo de resolución y foco desde la ficha;
- regresión de `galpon|poza`.

Builds:

```text
npm run build            OK
npm run build:electron   OK
npm run build:migration  OK
gradlew assembleDebug    BUILD SUCCESSFUL
electron-builder --dir   OK
```

## Recorrido nativo

Laboratorio temporal: PostgreSQL con nombre único, migraciones `0001`–`0004`, backend `uvicorn` en loopback y datos sintéticos. Se reutilizó la identidad Android existente (`scope 1fa8fd97-…`, device `3720974e-…`) y se agregó un dispositivo Windows nuevo al mismo ámbito. El APK se actualizó con `adb install -r`; la base v5 y sus datos se conservaron.

Preparación central: se publicaron por HTTP los seis registros que la base Android ya tenía (galpón, poza, animal, parto, evento y pesaje) en las secuencias 9–14. Así el cursor Android existente (`after=14`) quedó alineado sin modificar cursores ni recibos. El dispositivo Windows descargó esos seis registros.

### Windows (primero)

- Sincronización inicial: **6 recibidos, 0 enviados**.
- Edición real desde la ficha del animal: `C-AND-V2` → `C-AND-WIN`; ciclo **0 recibidos, 1 enviado**, recibo `accepted`, central en versión 2.
- Segundo ciclo: **1 recibido, 0 enviados** (adoptó la versión 3 resuelta por Android).
- Edición real del pesaje: `1234.50` → `1300.00`; ciclo **0 recibidos, 1 enviado**, recibo `accepted`, central en versión 2.

### Android (después, secuencial)

- Edición local previa al pull: `C-AND-V2` → `C-AND-AND`; el ciclo detectó la versión central 2 y dejó **1 conflicto**, conservando el cambio local.
- La pantalla mostró `Servidor: C-AND-WIN` y `Dispositivo: C-AND-AND`, con poza, fechas y referencias etiquetadas.
- **Reintentar cambio local** con `C-AND-REV`: operación nueva, recibo `accepted`, central en versión 3.
- Segundo conflicto: pesaje local `1400.00` contra central `1300.00`, versión 2. La comparación mostró `Servidor: 1300.00 g` y `Dispositivo: 1400.00 g`.
- **Conservar versión central**: el pesaje local quedó en `1300.00`, el conflicto desapareció y no se creó una operación nueva.
- Reapertura con `force-stop`: persistieron `C-AND-REV` y `1300.00`, los cursores v1/v2 quedaron en `after=17`, el token quedó vacío y no había conflictos pendientes.
- Demo siguió separada: mostró sus cuatro galpones y ningún registro de Trabajo.

Estado final comprobado:

- central: `cuyes` `C-AND-REV` versión 3, `pesajes` `1300.00` versión 2, 9 cambios y 9 recibos en el ámbito;
- local Android: outbox con 1 operación `accepted` y 1 `discarded` para `cuyes`, 1 `accepted` y 1 `discarded` para `pesajes`, y las operaciones v1 previas;
- cursores v1/v2 en `after=17`; sin modificaciones manuales de cursor ni de recibos.

## Límites

- No se ejecutó autenticación de producción, rotación de tokens, RAG real, RF real ni ETL.
- El recorrido nativo de las cinco entidades no se repitió una por una: `cuyes` y `pesajes` se ejercitaron en Windows/Android; `partos`, `eventos` y `parto_crias` quedaron cubiertos por pruebas dirigidas.
- No se probó en nativo un fallo de red durante la resolución ni un doble clic real; ambos están cubiertos por pruebas de UI.
- La UI no ofrece combinación de campos ni resolución automática, conforme a los ADR.
- El perfil real de Windows se aisló mediante copia/restauración y quedó restaurado; Pixel_36 conservó su base y sus datos.

## Archivos principales

- `client/src/data/work.sync.conflicts.config.ts`
- `client/src/data/work.sync.conflicts.presentation.ts`
- `client/src/data/work.sync.conflicts.review.ts`
- `client/src/data/work.sync.conflicts.resolve.ts`
- `client/src/pages/ConflictosTrabajo.tsx`
- `client/src/pages/AnimalDetalle.tsx`
- `client/src/App.tsx`
- `client/src/data/work.domain.api.ts` y adaptadores Android/Electron
- `client/src/data/work.sync.conflicts.domain.test.ts`
- `client/src/pages/ConflictosTrabajo.test.tsx`
