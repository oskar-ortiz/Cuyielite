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
- **CONFIRMADO** — El SQL de migración 0001 elimina la restricción UNIQUE de
  `cuyes.codigo_identificacion` y crea `idx_cuyes_codigo` como índice no único.
  La matriz de paridad, corregida el 2026-11-17, describe el esquema efectivo
  con ambos lados sin UNIQUE. Fuentes: `db/migrations/central/0001_lope_domain.sql:46-47`,
  `docs/verificaciones/piloto-paridad-documentacion.md` §5 y consulta de solo
  lectura sobre la base del piloto.
- **PENDIENTE (D10, parte de dominio)** — La aclaración técnica de unicidad no
  resuelve la decisión de dominio sobre vínculos reales. Debe completarla Diery
  con la evidencia indicada en `docs/verificaciones/matriz-carga-real-lope.md`.
  No se cambiaron DDL, índices ni datos.

## Estructuras y semánticas

- **CONFIRMADO** — `parto_crias` es una tabla independiente, con relación a
  parto y cuy, clave propia y unicidad de la relación y del cuy. Fuentes:
  migración 0001 y matriz de paridad.
- **PENDIENTE** — La regla física no decide qué filas Excel crean el vínculo ni
  qué evidencia lo sustenta. Diery prepara los candidatos; el revisor técnico
  designado decide.
- **CONFIRMADO** — `eventos.tipo` es texto de longitud limitada en la migración;
  no se define allí un catálogo cerrado. Fuente: migración 0001.
- **PROPUESTO** — Aprobar un catálogo de eventos y la semántica de `detalle`
  antes de publicar eventos; requiere acuerdo de Diery/Oskar y validación del
  responsable de dominio.
- **PENDIENTE** — El valor `R` requiere fuente primaria y contexto de columna
  antes de mapearlo. `tools/lope_import` no implementa su normalización y la
  documentación previa presenta interpretaciones incompatibles. Responsable:
  Diery aporta evidencia; revisor técnico valida.
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
