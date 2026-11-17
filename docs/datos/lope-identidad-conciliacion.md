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
- **PENDIENTE** — Confirmar la semántica de `R` por campo. `tools/lope_import`
  no implementa una regla para ese símbolo y la documentación previa presenta
  interpretaciones incompatibles. Responsable: Diery aporta la fuente primaria;
  revisor técnico valida y Oskar actualiza el documento normativo.
- **PENDIENTE** — Confirmar catálogo de eventos y el uso de `detalle`.
  Responsable: Diery/Oskar acuerdan el catálogo con el responsable de dominio.
- **PENDIENTE** — Confirmar la fuente de abortos y del peso de monta con su
  fecha, procedencia y relación con el animal. Responsable: Diery aporta la
  fuente autorizada; revisor técnico valida.
- **PENDIENTE** — Confirmar el esquema central efectivo donde exista
  discrepancia entre migraciones y documentación de paridad. No consultar la
  base `cuyielite` para esta entrega. Responsable: Oskar aporta evidencia
  verificable del esquema autorizado.

## Controles de identidad

- **CONFIRMADO** — El código de negocio no se usa por sí solo para fusionar
  animales; las referencias ambiguas se quedan en revisión. Fuente:
  `reconcile.py`, `decisions.py` y `promote.py`.
- **CONFIRMADO** — La promoción exige que los registros tengan correspondencias
  aceptadas y que las entidades de referencia pertenezcan al lote/ámbito
  validado. Fuente: `tools/lope_import/manifest.py` y `promote.py`.
- **PENDIENTE** — El ámbito autorizado y las decisiones reales no se incluyen en
  Git ni se infieren de archivos locales; deben recibirse por canal privado.
