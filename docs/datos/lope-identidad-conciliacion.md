# Identidad y conciliación — importación Lope

| Campo | Valor |
|---|---|
| Versión | 1.0-propuesta |
| Fecha | 2026-11-17 |
| Commit base | `70eb84cec9251913a523a8928037451f4cad7c96` |
| Estado | **PROPUESTA: pendiente de aprobación documental sobre esta versión** |

## Registro de aprobación

| Revisor | Decisión | Evidencia/versión revisada | Fecha |
|---|---|---|---|
|  |  |  |  |

## Reglas confirmadas

- **CONFIRMADO** — La identidad de origen se distingue de la identidad de
  dominio: la auditoría usa huella de archivo y referencia de hoja/celda; la
  entidad aceptada conserva un UUID propio. Fuentes: `tools/lope_import/__main__.py`,
  `decisions.py`, `manifest.py` y `db/migrations/central/0001_lope_domain.sql`.
- **CONFIRMADO** — La clave idempotente del lote contiene huella de archivo,
  versión de parser y versión de mapeo; `0009` agrega `scope_id` nullable a
  lotes anteriores y el orquestador rechaza un lote sin ámbito registrado.
  Fuentes: `tools/lope_import/manifest.py`, `promote.py` y
  `db/migrations/central/0009_importacion_lotes_scope.sql`.
- **CONFIRMADO** — El flujo separa auditoría, propuesta, decisión humana,
  manifiesto y promoción. Solo `ACEPTADO` puede promoverse; la decisión requiere
  revisor, evidencia, identidad y `after` completo. Fuente:
  `tools/lope_import/decisions.py` y `manifest.py`.
- **CONFIRMADO** — `reconcile_litters` reporta ambigüedades y no fusiona por
  coincidencia de código. Fuente: `tools/lope_import/reconcile.py`.
- **CONFIRMADO** — `parto_crias` existe en el SQL de `0001` con clave propia,
  `UNIQUE(parto_id, cuy_id)` y `UNIQUE(cuy_id)`. La verificación de paridad
  informa la misma relación en SQLite de Trabajo. Fuentes:
  `db/migrations/central/0001_lope_domain.sql` y
  `docs/verificaciones/piloto-paridad-documentacion.md`.
- **CONFIRMADO** — La evidencia declarada no equivale a evidencia revisada:
  `0008` distingue `DECLARADA`, `REVISADA` y `RECHAZADA`. Fuente:
  `db/migrations/central/0008_evidencia_revisable.sql`.
- **COMPROBADO POR OSKAR** (técnico; no es aprobación documental) — PostgreSQL
  y SQLite permiten repetir `cuyes.codigo_identificacion`; la identidad única
  es el UUID `id`. `0001_lope_domain.sql` elimina
  `cuyes_codigo_identificacion_key` y crea el índice no único
  `idx_cuyes_codigo`. Un código repetido es un asunto de conciliación de datos,
  no una restricción de base de datos. Confirmado por Oskar en la base efectiva
  del piloto. La matriz de paridad
  (`docs/verificaciones/piloto-paridad-documentacion.md`) contiene una
  afirmación obsoleta que Oskar corregirá; no se edita en esta entrega. Fuentes:
  `db/migrations/central/0001_lope_domain.sql` y confirmación de Oskar.

## Decisiones que requieren evidencia

- **PENDIENTE** — Resolver cada correspondencia origen↔entidad con motivo,
  evidencia y revisor técnico designado. Responsable: Diery prepara las
  propuestas; Oskar/Lope designan al revisor; ese revisor decide.
- **PENDIENTE** — Para aceptar un vínculo `parto_crias` real se debe:
  (1) citar la fila de origen (archivo/huella, hoja, celda y fila) y evidencia
  del vínculo cría–parto; (2) conciliar por separado `cuy_id` y `parto_id`,
  resolviendo códigos ambiguos, duplicados o sin correspondencia; (3) aprobar
  el `rol` observado —el default `CRIA` del DDL no lo demuestra—; y (4) decidir
  con evidencia los conflictos con `UNIQUE(cuy_id)` o
  `UNIQUE(parto_id, cuy_id)`, sin cambiar las restricciones vigentes.
  Diery prepara la evidencia y el revisor técnico designado acepta, rechaza o
  deja pendiente cada vínculo. No se modifica el contrato de transporte.
- **PENDIENTE** — Confirmar la semántica de `R`. Aclaración aportada por Oskar:
  `R` = REEMPLAZO, un animal que sale de su función (por ejemplo enfermedad o
  venta); por sí sola no demuestra muerte ni descarte. El motivo de salida se
  conserva en un campo separado, cuya fuente autorizada queda como decisión
  pendiente. En los archivos revisados `R` no aparece en `DESTINO` (solo 15
  celdas en `COLOR`, la columna de color). `tools/lope_import` no implementa
  una regla para ese símbolo. Responsable: Oskar aporta la aclaración;
  responsable del Centro (por definir) confirma; revisor técnico revisa. Detalle:
  `lope-eventos-valores-encontrados.md` §4.
- **PENDIENTE** — Confirmar catálogo de eventos y el uso de `detalle`. Los tipos
  previstos no prueban uso; se observaron 47 valores distintos (46 no vacíos y la celda vacía) en
  1412 celdas `T.C.N.`. Responsable: Oskar aporta la información; responsable del Centro (por
  definir) valida. Detalle: `lope-eventos-valores-encontrados.md` §1–§2.
- **PENDIENTE** — Confirmar la fuente de abortos y del peso de monta con su
  fecha, procedencia y relación con el animal. `AB` aparece 17 veces en `T.C.N.`
  sin cantidad verificable ni regla de conteo; la columna `Peso` de la fila de la
  hembra tiene 353 celdas numéricas y se propone como peso de etapa `MONTA`
  vinculado a `EMPADRE`, sin publicar valores. Responsable: Diery aporta
  trazabilidad; responsable del Centro (por definir) valida la regla; revisor
  técnico revisa. Detalle: `lope-eventos-valores-encontrados.md` §3 y §7.
- **PENDIENTE** — Identificar la fuente autorizada del motivo de salida de un
  animal `R` (REEMPLAZO) y su impacto en el diccionario de mapeo. No se infiere
  muerte ni descarte desde `R`: `DESTINO` observado tiene `M` 545, `V` 297 y 6465
  vacíos, sin `R`; las observaciones mencionan EMPADRE/MONTA 13, VENTA 5 y MUERTE
  1 (macho), sin mención de `R`, y no tienen vínculo por fila con `DESTINO`.
  Responsable: Diery aporta la fuente; responsable del Centro (por definir)
  valida; revisor técnico revisa. Detalle:
  `lope-eventos-valores-encontrados.md` §4–§6.
- **RESUELTO (COMPROBADO POR OSKAR)** — La discrepancia de unicidad de
  `cuyes.codigo_identificacion` quedó comprobada sobre la base efectiva del
  piloto; ver §Reglas confirmadas. Un código repetido se trata como caso de
  conciliación, no como restricción de base de datos.

## Controles de identidad

- **CONFIRMADO** — El código de negocio no se usa por sí solo para fusionar
  animales; las referencias ambiguas se quedan en revisión. Fuente:
  `reconcile.py`, `decisions.py` y `promote.py`.
- **CONFIRMADO** — La identidad única del animal es el UUID `id`;
  `codigo_identificacion` es chapa de negocio y puede repetirse. Un código
  repetido requiere conciliación, no corrección de esquema. Fuentes:
  `db/migrations/central/0001_lope_domain.sql` y `reconcile.py`.
- **CONFIRMADO** — La promoción exige que los registros tengan correspondencias
  aceptadas y que las entidades de referencia pertenezcan al lote/ámbito
  validado. Fuente: `tools/lope_import/manifest.py` y `promote.py`.
- **PENDIENTE** — El ámbito autorizado y las decisiones reales no se incluyen en
  Git ni se infieren de archivos locales; deben recibirse por canal privado.
