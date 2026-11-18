# Modelo de datos Lope — referencia de implementación y decisiones

| Campo | Valor |
|---|---|
| Versión | 1.0-propuesta |
| Fecha | 2026-11-17 |
| Commit base | `70eb84cec9251913a523a8928037451f4cad7c96` |
| Estado | **PROPUESTA: pendiente de aprobación documental sobre esta versión** |

**PROPUESTO** — Este documento es referencia de diseño, no una migración; todo
cambio de DDL requiere revisión y una migración incremental aprobada.

## Registro de aprobación

| Revisor | Decisión | Evidencia/versión revisada | Fecha |
|---|---|---|---|
|  |  |  |  |

## Esquema central y local

- **CONFIRMADO** — `0001_lope_domain.sql` define `eventos`, `parto_crias`,
  `importacion_origenes`, `importacion_lotes` e
  `importacion_correspondencias`, además de las columnas de dominio para
  genealogía, origen, color, ojos, número de parto y contexto de pesaje. Fuente:
  `db/migrations/central/0001_lope_domain.sql`.
- **CONFIRMADO** — `0004_publicacion_dominio.sql` agrega ámbito, versión y
  metadatos de edición a `cuyes`, `partos`, `pesajes`, `eventos` y
  `parto_crias`. Fuente: `db/migrations/central/0004_publicacion_dominio.sql`.
- **CONFIRMADO** — `0005_pesajes_check.sql` exige que un pesaje tenga
  `parto_id`, `evento_id` o ninguno, pero nunca ambos. La evidencia de piloto
  registra aplicación y segunda ejecución no-op; este documento no reejecuta
  migraciones. Fuentes: la migración y
  `docs/verificaciones/piloto-paridad-documentacion.md`.
- **CONFIRMADO** — `0009_importacion_lotes_scope.sql` incorpora ámbito al lote
  como columna nullable para preservar lotes históricos; el orquestador rechaza
  los que carecen de ámbito. Fuentes: migración 0009 y
  `tools/lope_import/promote.py`.
- **CONFIRMADO** — El esquema SQLite efectivo de Trabajo es
  `client/src/data/work.schema.ts`; `db/ddl/local/001_sqlite.sql` es una
  referencia histórica. La paridad documenta diferencias intencionales,
  incluida la validación del contexto exclusivo de pesajes en el pull.
  Fuente: `docs/verificaciones/piloto-paridad-documentacion.md`.
- **COMPROBADO POR OSKAR** (técnico; no es aprobación documental) — PostgreSQL y
  SQLite permiten repetir `cuyes.codigo_identificacion`; la identidad única es
  el UUID `id`. El SQL de migración 0001 elimina la restricción
  `cuyes_codigo_identificacion_key` y crea el índice no único `idx_cuyes_codigo`.
  Un código repetido es un asunto de conciliación de datos, no una restricción
  de base de datos. Confirmado por Oskar en la base efectiva del piloto. La
  matriz de paridad (`docs/verificaciones/piloto-paridad-documentacion.md`)
  describe ese campo como UNIQUE: es una afirmación obsoleta que Oskar corregirá
  y que no se edita en esta entrega. Fuentes: migración 0001 y confirmación de
  Oskar.

## Estructuras y semánticas

- **CONFIRMADO** — `parto_crias` es una tabla independiente, con relación a
  parto y cuy, clave propia y unicidad de la relación y del cuy. Esta restricción
  es distinta de `cuyes.codigo_identificacion`, que no es único (ver §Esquema
  central y local). Fuentes: migración 0001 y matriz de paridad.
- **PENDIENTE** — La regla física no decide qué filas Excel crean el vínculo ni
  qué evidencia lo sustenta. Diery prepara los candidatos; el revisor técnico
  designado decide.
- **CONFIRMADO** — `eventos.tipo` es texto de longitud limitada en la migración;
  no se define allí un catálogo cerrado. Fuente: migración 0001.
- **PROPUESTO** — Aprobar un catálogo de eventos y la semántica de `detalle`
  antes de publicar eventos; requiere acuerdo de Diery/Oskar y validación del
  responsable de dominio.
- **PENDIENTE** — El valor `R` requiere la confirmación del responsable de
  dominio antes de mapearlo. Aclaración aportada por Oskar: `R` = REEMPLAZO, un
  animal que sale de su función (por ejemplo enfermedad o venta); por sí sola no
  demuestra muerte ni descarte, y el motivo de salida se conserva en un campo
  separado. `tools/lope_import` no implementa su normalización. Responsable:
  Oskar aporta la aclaración; responsable de dominio confirma; revisor técnico
  valida.
- **PENDIENTE** — Identificar la fuente autorizada del motivo de salida de un
  animal `R` (REEMPLAZO) y su impacto en el diccionario de mapeo. No se infiere
  muerte ni descarte desde `R`. Responsable: Diery aporta la fuente; revisor
  técnico designado valida; responsable de dominio confirma.
- **PENDIENTE** — La fuente de abortos y el origen/fecha del peso de monta no se
  resuelven con DDL. Responsable: Diery aporta fuente autorizada; revisor
  técnico valida.

## Uso de este documento

- **CONFIRMADO** — Las migraciones centrales numeradas 0001–0009 están en
  `db/migrations/central/`; 0005 no debe editarse ni recrearse. Fuente:
  directorio de migraciones y evidencia de paridad.
- **PROPUESTO** — Cualquier cambio futuro de esquema debe acordarse y entrar
  como migración incremental revisada; requiere aprobación documental de
  Oskar/Diery.
- **PENDIENTE** — La aprobación de este diseño y la autorización de carga real
  son decisiones separadas. No se registra aprobación en esta versión.
