# Decisiones abiertas — parto_crias (Lope)

| Campo | Valor |
|---|---|
| Versión | 1.0-propuesta |
| Fecha | 2026-11-17 |
| Estado | **PROPUESTA: decisiones abiertas, ninguna aprobada** |

## Declaración de alcance

- **No se reabre** el contrato de transporte (`publicar_cambios`, manifiesto
  `lope_promocion/v1`, correspondencias) ni las migraciones centrales vigentes
  `0001`–`0009`; en particular `parto_crias` mantiene `UNIQUE (parto_id, cuy_id)`
  y `UNIQUE (cuy_id)`. Fuentes: `tools/lope_import/{decisions,manifest,promote}.py`,
  `db/migrations/central/0001_lope_domain.sql`.
- **Acordado (CONFIRMADO en los documentos):** `parto_crias` es tabla independiente
  con clave propia y unicidad de la relación y del cuy; el flujo separa auditoría,
  propuesta, decisión humana, manifiesto y promoción; solo `ACEPTADO` promueve;
  la promoción exige correspondencias aceptadas y entidades del lote/ámbito
  validado; la evidencia distingue `DECLARADA`/`REVISADA`/`RECHAZADA`.
  Fuentes: `docs/datos/lope-modelo-ddl-propuesto.md` §Estructuras y semánticas;
  `docs/datos/lope-identidad-conciliacion.md` §Reglas confirmadas.
- **Comprobado por Oskar (técnico):** PostgreSQL y SQLite permiten repetir
  `cuyes.codigo_identificacion`; la identidad única es el UUID `id`; `0001`
  elimina `cuyes_codigo_identificacion_key` y crea el índice no único
  `idx_cuyes_codigo`. Un código repetido es un asunto de conciliación de datos,
  no una restricción de base de datos. La matriz de paridad
  (`docs/verificaciones/piloto-paridad-documentacion.md`) tiene una afirmación
  obsoleta que Oskar corregirá; no se edita aquí.
- **Pendiente:** todo lo listado abajo salvo lo comprobado o aclarado por Oskar
  (D10, D14 y la aclaración de D6); ninguna decisión está aprobada y ninguna
  compuerta de carga real se marca cumplida.

## Decisiones abiertas

| ID | Pregunta puntual | Opciones | Evidencia (archivo y sección) | Impacto sobre dry-run | Responsable | Estado |
|---|---|---|---|---|---|---|
| D1 | ¿Qué filas del Excel Lope crean el vínculo parto↔cría y qué evidencia lo sustenta? | (a) vínculo por fila de origen con archivo/huella, hoja, celda y fila; (b) vínculo por cercanía de filas o conteo del parto (no suficiente). | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (PENDIENTE regla física); `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 1). | Sin decisión aceptada, ningún `parto_crias` entra al manifiesto; el dry-run queda vacío para esa entidad. | Diery prepara; revisor técnico designado decide. | PENDIENTE |
| D2 | ¿Cómo se concilia la identidad de la cría con un `cuy_id` aceptado y del parto con un `parto_id` aceptado (códigos ambiguos, duplicados o sin correspondencia)? D10 comprobó que repetir `codigo_identificacion` no es un conflicto de base de datos: el caso es de conciliación. | (a) aceptar por código resuelto; (b) dejar pendiente/rechazar el caso ambiguo; (c) decidir explícitamente cada código. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 2); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (parto_crias, punto 2). | Bloquea la promoción de vínculos con identidad no resuelta; el dry-run omite esos casos. | Diery prepara; revisor técnico designado decide. | PENDIENTE |
| D3 | ¿Qué `rol` corresponde a cada vínculo parto↔cría? | (a) `CRIA` (default del DDL, no es evidencia); (b) otro rol con evidencia de columna/contexto; (c) dejar pendiente. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 3); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (punto 3). | Sin `rol` resuelto no se promueve el vínculo; el dry-run no incluye la fila. | Diery aporta evidencia; revisor técnico designado aprueba. | PENDIENTE |
| D4 | ¿Cómo resolver los casos que contradicen la unicidad vigente de `parto_crias` (`UNIQUE (cuy_id)` y `UNIQUE (parto_id, cuy_id)`), distinta de la chapa repetible? | (a) dejar sin aceptar los casos no resueltos; (b) resolver con evidencia; (c) no cambiar la restricción. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 4); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (punto 4). | Los conflictos no resueltos se excluyen del dry-run; la restricción no se modifica. | Diery prepara evidencia; revisor técnico designado decide. | PENDIENTE |
| D5 | ¿Se acepta la correspondencia origen↔entidad para cada vínculo, con motivo, evidencia y revisor técnico designado? | (a) `ACEPTADO`; (b) `RECHAZADO`; (c) `AMBIGUO`; (d) `PENDIENTE`. | `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (primer punto); `lope-plan-migracion-validacion.md` §Compuertas (decisiones humanas de correspondencias). | Sin `ACEPTADO` no hay promoción; el dry-run no incluye la correspondencia. | Diery prepara propuestas; Oskar/Centro Lope designan revisor; ese revisor decide. | PENDIENTE |
| D6 | ¿Cuál es el significado de `R` en su columna y contexto? | Aclaración de Oskar: `R` = REEMPLAZO, un animal que sale de su función (por ejemplo enfermedad o venta); por sí sola no demuestra muerte ni descarte. El motivo de salida se conserva en un campo separado; ver D15. Pendiente: confirmación del responsable de dominio. | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (valor `R`); `lope-diccionario-mapeo.md` §Mapeos y decisiones (R); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (R). | `tools/lope_import` no normaliza `R`; no afecta `parto_crias` directamente pero bloquea publicación de campos con `R`. | Oskar aporta la aclaración; responsable de dominio (por definir) confirma; Oskar actualiza el documento normativo. | ACLARACIÓN DE OSKAR — PENDIENTE DE CONFIRMACIÓN POR RESPONSABLE DE DOMINIO |
| D7 | ¿Cuál es el catálogo de eventos y la semántica de `detalle`? | (a) acordar valores permitidos, significado de `detalle` y evidencia por evento; (b) no publicar eventos sin catálogo aprobado. | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (eventos.tipo); `lope-diccionario-mapeo.md` §Mapeos y decisiones (catálogo eventos); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (catálogo eventos). | Sin catálogo aprobado, los eventos no se promueven; el dry-run excluye esa entidad. | Diery/Oskar acuerdan con responsable de dominio. | PENDIENTE |
| D8 | ¿Cuál es la fuente autorizada de abortos? | (a) Diery aporta fuente y trazabilidad; (b) revisor valida; (c) no publicar sin fuente. | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (fuente de abortos); `lope-diccionario-mapeo.md` §Mapeos y decisiones (abortos); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (abortos). | El parser Lope no produce abortos como dato publicable; el dry-run no incluye esa entidad. | Diery aporta fuente autorizada; revisor técnico valida. | PENDIENTE |
| D9 | ¿Cuál es la fuente y significado del peso de monta frente a `PESO PARTO` y el peso del bloque reproductivo? | (a) interpretar el peso del bloque reproductivo como candidato a pesaje etapa `MONTA` (propuesta); (b) confirmar con evidencia de columna/fecha/contexto; (c) rechazar. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (peso de monta; propuesta `MONTA`); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (peso de monta). | Sin confirmación, la propuesta `MONTA` no se promueve; el dry-run excluye esos pesajes. | Diery aporta evidencia de columna/fecha/contexto; revisor técnico valida. | PENDIENTE |
| D10 | ¿Se resuelve la discrepancia de unicidad de `cuyes.codigo_identificacion` (migración 0001 elimina UNIQUE y crea índice no único; matriz de paridad dice UNIQUE)? | Comprobado: PostgreSQL y SQLite permiten repetir `codigo_identificacion`; la identidad única es el UUID `id`; `0001` elimina `cuyes_codigo_identificacion_key` y crea el índice no único `idx_cuyes_codigo`. Un código repetido es un asunto de conciliación de datos, no una restricción de base de datos. La matriz de paridad conserva una afirmación obsoleta que Oskar corregirá (no se edita aquí). | `lope-modelo-ddl-propuesto.md` §Esquema central y local; `lope-identidad-conciliacion.md` §Reglas confirmadas; `db/migrations/central/0001_lope_domain.sql`. Confirmado por Oskar en la base efectiva del piloto. | No afecta `parto_crias` directamente; habilita tratar códigos repetidos como casos de conciliación, no como error de carga. | Oskar aportó la comprobación; la corrección documental de la matriz de paridad queda a su cargo. | COMPROBADO POR OSKAR (técnico; no es aprobación documental) |
| D11 | ¿Quién es el revisor técnico designado (alcance escrito)? | (a) Oskar/Centro Lope designa y registra por canal autorizado. Nombre: POR DEFINIR. Oskar puede aprobar solo lo técnico de plataforma; falta quien revise las correspondencias y las decisiones zootécnicas. | `lope-plan-migracion-validacion.md` §Compuertas (revisor técnico designado); `lope-diccionario-mapeo.md` §Estados y fuentes. | Sin revisor designado no se acepta ninguna correspondencia; el dry-run no se puede validar. | Oskar/Centro Lope designa; Nombre: POR DEFINIR. | PENDIENTE |
| D12 | ¿Se revisa el dry-run (conteos por entidad, exclusiones, errores y diferencias) antes de promover? | (a) Diery ejecuta solo tras autorización coordinada por Oskar; (b) revisor valida el resultado. | `lope-plan-migracion-validacion.md` §Compuertas (dry-run revisado). | Es la compuerta que habilita o no la promoción real; el dry-run debe quedar revisado y archivado. | Diery ejecuta tras autorización; coordinación de Oskar; revisor valida. | PENDIENTE |
| D13 | ¿Se cuenta con respaldo restaurable y prueba de restauración inmediatamente antes de la promoción? | (a) administrador autorizado genera respaldo; (b) un administrador comprueba la restauración; coordinado por Oskar. | `lope-plan-migracion-validacion.md` §Compuertas (respaldo restaurable). | Sin respaldo verificable no hay promoción real; no afecta el dry-run en sí. | Administrador autorizado comprueba la restauración; coordinación de Oskar. | PENDIENTE |
| D14 | ¿Se autoriza el `scope_id` por canal privado (configuración autorizada)? | (a) Oskar comparte por canal privado; (b) no guardar el valor en Git. | `lope-plan-migracion-validacion.md` §Compuertas (ámbito autorizado por canal privado); `lope-identidad-conciliacion.md` §Controles de identidad. | Sin `scope_id` autorizado el manifiesto no se puede generar; el dry-run no es promocionable. | Oskar (canal privado). | COMPARTIDO POR CANAL PRIVADO (por Oskar); valor no registrado en Git |
| D15 | ¿Cuál es la fuente autorizada del motivo de salida de un animal marcado `R` (REEMPLAZO) y cómo impacta el diccionario de mapeo? | (a) fuente primaria por columna/campo con trazabilidad; (b) no publicar el motivo sin fuente; (c) no inferir muerte ni descarte desde `R`. | Aclaración de Oskar en este documento (D6); `lope-diccionario-mapeo.md` §Mapeos y decisiones (R); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (R). | Sin motivo de salida resuelto, ese campo queda fuera del manifiesto; el dry-run no lo incluye. | Diery aporta la fuente; revisor técnico designado valida; responsable de dominio confirma. | PENDIENTE |

## Coherencia D1–D4 con D10

- D10 no cambia las opciones de D1–D4: `parto_crias` conserva en `0001`
  `UNIQUE (parto_id, cuy_id)` y `UNIQUE (cuy_id)`, una restricción distinta de
  `cuyes.codigo_identificacion`.
- Un `codigo_identificacion` repetido no es un conflicto de base de datos (D10
  comprobado): es un caso de conciliación de identidad (D2), donde el UUID `id`
  es la identidad única. Ninguna opción de D1–D4 se modifica.

## Acordado vs. pendiente

- **Acordado:** identidad de origen vs. dominio; clave idempotente del lote con huella/parser/mapeo; separación de auditoría/propuesta/decisión/manifiesto/promoción; `reconcile_litters` reporta ambigüedades sin fusionar; `parto_crias` existe en `0001` con clave propia y unicidad; evidencia `DECLARADA`/`REVISADA`/`RECHAZADA`; promoción exige correspondencias aceptadas y entidades del lote/ámbito; código de negocio no fusiona por sí solo.
- **Comprobado por Oskar (técnico, no aprobación):** D10; D14 compartido por canal privado; D6 cuenta con su aclaración, pendiente de confirmación por el responsable de dominio.
- **Pendiente:** todo D1–D15 salvo D10; D6, D11, D12 y D13 siguen sin aprobación; falta revisor designado (D11: Nombre POR DEFINIR), fuente del motivo de salida (D15), ámbito autorizado registrado y respaldo verificable.