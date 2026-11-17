# Revisión documental de los cuatro documentos Lope (borrador para Oskar y Diery)

Estado: **REVISION PREPARADA, NO APROBACIÓN EMITIDA**. Los cuatro documentos siguen como propuestas en este checkout; Diery está actualizándolos en su rama, por lo que **no se editaron en paralelo**. Este escrito entrega correcciones concretas y un borrador de aprobación para que Oskar lo revise y envíe si lo considera adecuado.

## Versiones revisadas

- Código y contratos: `origin/dev` **1e56162** (PR #158 fusionado).
- Migración del CHECK de pesajes: PR #157, commit **5d1ac64** (`0005_pesajes_check.sql`), ya aplicada al piloto.
- Parser y mapeo: `tools/lope_import` `__version__=0.1.0`, `MAPPING_VERSION=0.1.0`.
- Contratos: `lope_import_audit/v1`, `lope_import_review/v1`, `lope_import_review_decisions/v1`, `lope_promocion/v1`.
- Evidencia de ejecución: `docs/verificaciones/etl-manifiesto-integracion.md`, `docs/verificaciones/piloto-local-rag-revision.md` y `docs/verificaciones/piloto-paridad-documentacion.md`.

## 1. `docs/datos/lope-diccionario-mapeo.md`

| Tipo | Punto | Corrección concreta / referencia |
|---|---|---|
| Obsoleto | «Pruebas: 19 (6 en `test_basic.py`, 13 en `test_cli.py`)» | La suite de `tools/lope_import` tiene **55 pruebas** en verde, incluidas decisiones, manifiesto, promoción, puntos de entrada CLI y celdas de error. Ver `docs/verificaciones/etl-manifiesto-integracion.md`. |
| Obsoleto | «Una tabla futura `parto_crias` puede formalizarlo» | `parto_crias` ya existe en `0001_lope_domain.sql`, en el esquema de Trabajo (`work.schema.ts`) y en el contrato de publicación. |
| Obsoleto | «Ampliaciones del parser necesarias (trabajo posterior, no implementadas): usar `to_decimal`/`to_int`» | `tools/lope_import/adapt.py` ya usa `to_decimal` y valida los campos publicables. La auditoría conserva la procedencia y las decisiones humanas fijan los valores; no todo lo listado sigue pendiente. |
| Obsoleto | «Implementar reconciliación de correspondencias individual↔reproductivo» | Existe `reconcile_litters` (detecta ambigüedades sin fusionar) y la cadena `decisions.py` → `manifest.py` → `promote.py` aplica correspondencias aceptadas con revisor, evidencia e identidad. La conciliación **automática** de identidades sigue prohibida y requiere revisión humana. |
| Obsoleto | «Formato reproductivo (`max_cols=12`)» | El recorrido de bloques sigue siendo 12 columnas, pero la auditoría ahora explora hasta la columna T para **detectar errores guardados** `#VALUE!` y exponerlos como `celdas_error`. No se infieren cantidades de ahí. Ver `readers.py::read_error_cells`. |
| Se conserva | Chapa reutilizable; UUID interno distinto; sin fusión automática; `1=macho, 2=hembra`; `1=negros, 2=rojos`; fecha vacía = NULL; T.C.N. textual no parseado; vacío/X no se convierte en cero | Todas estas reglas están vigentes y son verificables en `normalize.py`, `adapt.py` y `decisions.py`. |
| Requiere acuerdo | Normalización de `ojos`/`color` a catálogo, despivot de Parto 1..N y extracción de GAL/POZA/MADRE/NUPAR como campos publicables | Siguen siendo propuestas. No se agregaron para desbloquear la auditoría real. |

## 2. `docs/datos/lope-identidad-conciliacion.md`

| Tipo | Punto | Corrección concreta / referencia |
|---|---|---|
| Implementado | Clave global `(huella_archivo, parser_version, mapeo_version)` y `scope_id` en `importacion_lotes` | `UNIQUE(huella_archivo, parser_version, mapeo_version)` y columna `scope_id` comprobadas en la base del piloto (migración 0009). El replay usa el mismo `lote_id`. |
| Implementado | `UNIQUE(origen_id, estado)` en correspondencias | Restricción presente (`importacion_correspondencias_origen_id_estado_key`). |
| Implementado | `importacion_origenes` independiente de lote/versiones | Tabla y UNIQUE de seis columnas presentes. |
| Implementado | `parto_crias` con `UNIQUE(parto_id, cuy_id)` y `UNIQUE(cuy_id)` | Presente en PostgreSQL y en SQLite de Trabajo. |
| Obsoleto | «Incompatibilidades con el esquema actual: fechas obligatorias, ubicación obligatoria, estado ACTIVO por defecto, `poza_id` NOT NULL» | Ya no son incompatibilidades: en el esquema efectivo `partos.fecha_parto`, `pesajes.fecha_pesaje`, `cuyes.poza_id`, `cuyes.sexo` y `cuyes.estado` son **NULL** sin DEFAULT; los conteos de parto son NULL sin DEFAULT 0. La única restricción vigente que conviene recordar es `cuyes.codigo_identificacion NOT NULL UNIQUE`. |
| Obsoleto | «Estado: PROPUESTA ... No aprobado ni implementado» | Las reglas de identidad están implementadas en el flujo; el documento debe distinguir **diseño implementado** de **aprobación del revisor técnico** y de **autorización de carga real**. |
| Se conserva | Sin fusión por chapa/año/parecido; referencias no resueltas conservadas; un parto compartido no se suma por cría; aceptación con motivo, evidencia y responsable | Vigente y exigido por `decisions.py` y `promote.py`. |
| Requiere acuerdo | Designación formal del revisor técnico de Lope y sus criterios de evidencia | No se designó a Oskar, Diery ni a la cuenta `admin` por defecto. Sigue pendiente. |

## 3. `docs/datos/lope-modelo-ddl-propuesto.md`

| Tipo | Punto | Corrección concreta / referencia |
|---|---|---|
| Implementado | `galpon_origen_id`, `padre_id`, `madre_id`, `color_codigo`, `ojos_codigo`, `pelaje_original`, `numero_parto`, `etapa`, `parto_id`, `evento_id`, `eventos`, `parto_crias`, `importacion_origenes`, `importacion_correspondencias` | Todos presentes en bootstrap + migraciones 0001/0004 y en el esquema de Trabajo. |
| Implementado | «Un pesaje se vincula a lo sumo a un `parto_id` o `evento_id`» | Ahora es restricción de base: `pesajes_contexto_exclusivo_chk` de **0005_pesajes_check.sql**, aplicada al piloto y comprobada. El texto debe citar 0005 en vez de decir que es solo una propuesta. |
| Obsoleto | «Tablas existentes: galpones, pozas, cuyes, partos, pesajes, mortalidad» | El modelo vigente incluye además `eventos`, `parto_crias`, tablas de importación, evaluación, evidencia, sincronización y RAG. |
| Obsoleto | «No modificar DDL histórico 001-005» | Sigue siendo cierto como regla de inmutabilidad, pero 0005 ya existe y está aplicada: hay que leerlo como «no reescribir migraciones históricas; usar migraciones incrementales nuevas». |
| Se conserva | No crear tabla `animales`; `ANIMAL No.` es código de negocio separado; pelaje/ojos originales conservados; peso de madre como pesaje autoritativo; mortalidad autoritativa, no evento duplicado | Decisiones acordadas y vigentes. |
| Requiere acuerdo | Cambiar `cuyes.codigo_identificacion` a índice no único para chapas reutilizadas | **No se ejecutó**. La PK/UNIQUE central sigue vigente; el local permite duplicados temporalmente para revisión. Requiere decisión explícita si se quiere alterar. |

## 4. `docs/datos/lope-plan-migracion-validacion.md`

| Tipo | Punto | Corrección concreta / referencia |
|---|---|---|
| Obsoleto | «Estado: PROPUESTA. No ejecutada. No se ha importado ni migrado ninguna base» | La integración sintética se ejecutó y cerró (PR #156), el procedimiento de carga real está ensayado con datos sintéticos (`docs/operacion/carga-lope-piloto.md`) y **no hubo carga real**. El estado correcto es: «sintético ejecutado; real preparado y pendiente de autorización». |
| Obsoleto | «Parser Entrega A verificado: 19 pruebas» | 55 pruebas de `tools/lope_import` + 27 de migraciones en verde. |
| Obsoleto | «Herramienta: psql con ON_ERROR_STOP=1» | La herramienta oficial es `python -m tools.db_migrate --env-var <ENV>`; aplica en una transacción con advisory lock, valida checksums y registra `schema_migrations`. 0005 se aplicó con ese mecanismo, segunda ejecución no-op. |
| Obsoleto | «Contrato ampliado: sync cubre solo galpones/pozas» | El pull v1/v2 ya entrega `cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias` con versiones, y el feed v3 entrega categorías y alertas de solo lectura. Ver matriz en `docs/verificaciones/piloto-paridad-documentacion.md`. |
| Implementado | Transacción única, sin segundo publicador, rollback de dominio + versión + contador + historial + lote, idempotencia por lote y ámbito | Comprobado en la matriz del cierre sintético. `publicar_cambios` usa la conexión prestada. |
| Se conserva | Sin publicación automática de candidatos; evidencia declarada no queda revisada por importar; evaluación oficial es acción explícita autorizada | Vigente. |
| Requiere acuerdo | Designación del revisor, `scope_id` autorizado, dry-run con conteos y respaldo comprobados antes de la carga real | Pendiente. No se marcaron aceptaciones para desbloquear pruebas. |

## Diferencia entre aprobar el diseño y autorizar la carga

- **Aprobación de diseño**: confirmar que diccionario, identidad, DDL y plan describen el sistema implementado y las reglas acordadas. No crea registros.
- **Autorización de carga real**: requiere además revisor técnico designado, decisiones humanas sobre cada correspondencia, `scope_id` autorizado, dry-run con conteos, respaldo/restauración comprobados y ejecución explícita. No está concedida.

## Borrador de aprobación — pendiente de revisión y envío por Oskar

> Asunto: aprobación de diseños Lope (borrador; pendiente de confirmación de Oskar)
>
> He revisado, sobre `origin/dev` 1e56162 (PR #158) y el commit 5d1ac64 (PR #157, migración `0005_pesajes_check.sql`), los documentos `docs/datos/lope-diccionario-mapeo.md`, `lope-identidad-conciliacion.md`, `lope-modelo-ddl-propuesto.md` y `lope-plan-migracion-validacion.md`, con las correcciones de `docs/verificaciones/revision-documentos-lope.md`.
>
> Apruebo el **diseño** así corregido: identidad estable, clave global, exclusión de contextos en pesajes, ausencia de publicación automática de candidatos y separación entre revisión de evidencia y evaluación oficial. Esta aprobación **no** acepta automáticamente registros reales, **no** sustituye las decisiones del revisor técnico designado y **no** autoriza la promoción de datos del Centro Lope.
>
> La carga real queda supeditada a la designación del revisor, a las decisiones humanas sobre las correspondencias, al `scope_id` autorizado, al dry-run con conteos por entidad y a la comprobación de respaldo y restauración.
>
> [Firma de Oskar — NO emitida en este documento]

Este bloque es un borrador. **No** debe publicarse como aprobación hasta que Oskar lo confirme y envíe por su propio canal.
