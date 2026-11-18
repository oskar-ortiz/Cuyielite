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
  (D10, D14 y la aclaración de D6). La información y propuesta de Oskar para D7,
  D8, D9 y D15 no es aprobación: falta la validación del responsable del Centro.
  Ninguna decisión está aprobada y ninguna compuerta de carga real se marca
  cumplida.

## Decisiones abiertas

| ID | Pregunta puntual | Opciones | Evidencia (archivo y sección) | Impacto sobre dry-run | Responsable | Estado |
|---|---|---|---|---|---|---|
| D1 | ¿Qué filas del Excel Lope crean el vínculo parto↔cría y qué evidencia lo sustenta? | (a) vínculo por fila de origen con archivo/huella, hoja, celda y fila; (b) vínculo por cercanía de filas o conteo del parto (no suficiente). | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (PENDIENTE regla física); `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 1). | Sin decisión aceptada, ningún `parto_crias` entra al manifiesto; el dry-run queda vacío para esa entidad. | Diery prepara; revisor técnico designado decide. | PENDIENTE |
| D2 | ¿Cómo se concilia la identidad de la cría con un `cuy_id` aceptado y del parto con un `parto_id` aceptado (códigos ambiguos, duplicados o sin correspondencia)? D10 comprobó que repetir `codigo_identificacion` no es un conflicto de base de datos: el caso es de conciliación. | (a) aceptar por código resuelto; (b) dejar pendiente/rechazar el caso ambiguo; (c) decidir explícitamente cada código. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 2); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (parto_crias, punto 2). | Bloquea la promoción de vínculos con identidad no resuelta; el dry-run omite esos casos. | Diery prepara; revisor técnico designado decide. | PENDIENTE |
| D3 | ¿Qué `rol` corresponde a cada vínculo parto↔cría? | (a) `CRIA` (default del DDL, no es evidencia); (b) otro rol con evidencia de columna/contexto; (c) dejar pendiente. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 3); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (punto 3). | Sin `rol` resuelto no se promueve el vínculo; el dry-run no incluye la fila. | Diery aporta evidencia; revisor técnico designado aprueba. | PENDIENTE |
| D4 | ¿Cómo resolver los casos que contradicen la unicidad vigente de `parto_crias` (`UNIQUE (cuy_id)` y `UNIQUE (parto_id, cuy_id)`), distinta de la chapa repetible? | (a) dejar sin aceptar los casos no resueltos; (b) resolver con evidencia; (c) no cambiar la restricción. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 4); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (punto 4). | Los conflictos no resueltos se excluyen del dry-run; la restricción no se modifica. | Diery prepara evidencia; revisor técnico designado decide. | PENDIENTE |
| D5 | ¿Se acepta la correspondencia origen↔entidad para cada vínculo, con motivo, evidencia y revisor técnico designado? | (a) `ACEPTADO`; (b) `RECHAZADO`; (c) `AMBIGUO`; (d) `PENDIENTE`. | `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (primer punto); `lope-plan-migracion-validacion.md` §Compuertas (decisiones humanas de correspondencias). | Sin `ACEPTADO` no hay promoción; el dry-run no incluye la correspondencia. | Diery prepara propuestas; Oskar/Centro Lope designan revisor; ese revisor decide. | PENDIENTE |
| D6 | ¿Cuál es el significado de `R` en su columna y contexto? | Aclaración de Oskar: `R` = REEMPLAZO, un animal que sale de su función (por ejemplo enfermedad o venta); por sí sola no demuestra muerte ni descarte. El motivo de salida se conserva en un campo separado; ver D15. En los archivos revisados `R` solo aparece en `COLOR` (15 celdas), no en `DESTINO`; no confundir columnas. Pendiente: confirmación del responsable de dominio. | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (valor `R`); `lope-diccionario-mapeo.md` §Mapeos y decisiones (R); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (R); `lope-eventos-valores-encontrados.md` §4; `lope-evidencia-libro.md` §1 (contradice `R` = REEMPLAZO). | `tools/lope_import` no normaliza `R`; no afecta `parto_crias` directamente pero bloquea publicación de campos con `R`. | Oskar aporta la aclaración; responsable de dominio (por definir) confirma; Oskar actualiza el documento normativo. | ACLARACIÓN DE OSKAR — PENDIENTE DE CONFIRMACIÓN POR RESPONSABLE DE DOMINIO |
| D7 | ¿Cuál es el catálogo de eventos y la semántica de `detalle`? | No hay catálogo de dominio cerrado; los tipos previstos en el sistema no prueban cuáles registra el Centro. Ver §Información y propuesta de Oskar (D7) y `lope-eventos-valores-encontrados.md`. (a) acordar valores permitidos, significado de `detalle` y evidencia por evento; (b) no publicar eventos sin catálogo revisado. | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (eventos.tipo); `lope-diccionario-mapeo.md` §Mapeos y decisiones (catálogo eventos); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (catálogo eventos); `lope-eventos-valores-encontrados.md`; `lope-evidencia-libro.md` §6. | Sin catálogo revisado, los eventos no se promueven; el dry-run excluye esa entidad. | Oskar aporta la información; responsable del Centro (por definir) valida. | PENDIENTE |
| D8 | ¿Cuál es la fuente autorizada de abortos? | `AB` aparece en las celdas `T.C.N.` (17 apariciones: reproductivo G1 6; reproductivo G2 viejo 11), pero no hay cantidad verificable ni regla aprobada para contar ocurrencias; no convertirlo en número. Al cargar se conserva archivo, hoja y celda de cada ocurrencia como procedencia (en la herramienta, nunca en Git). Ver §Información y propuesta de Oskar (D8) y `lope-eventos-valores-encontrados.md` §3. (a) definir la regla de conteo; (b) no publicar sin regla. | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (fuente de abortos); `lope-diccionario-mapeo.md` §Mapeos y decisiones (abortos); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (abortos); `lope-eventos-valores-encontrados.md` §3; `lope-evidencia-libro.md` §4. | Los abortos no entran como cantidad al dry-run; cualquier conteo queda fuera hasta aprobar una regla. | Diery aporta trazabilidad; responsable del Centro (por definir) valida la regla; revisor técnico revisa. | PENDIENTE |
| D9 | ¿Cuál es la fuente y significado del peso de monta frente a `PESO PARTO` y el peso del bloque reproductivo? | Fuente identificada: columna `Peso` de la fila de la hembra en el bloque reproductivo. Su interpretación como peso de monta requiere revisión por registro con procedencia; destino propuesto: pesaje de etapa `MONTA` vinculado a un evento `EMPADRE`, respetando el `CHECK` de `0005`. Ver §Información y propuesta de Oskar (D9) y `lope-eventos-valores-encontrados.md` §7. (a) validar la propuesta; (b) confirmar por registro; (c) rechazar. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (peso de monta; propuesta `MONTA`); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (peso de monta); `lope-eventos-valores-encontrados.md` §7; `lope-evidencia-libro.md` §5. | Sin validación, la propuesta `MONTA` no se promueve; el dry-run excluye esos pesajes. | Diery aporta procedencia por registro; responsable del Centro (por definir) valida; revisor técnico revisa. | PROPUESTO (pendiente de validación) |
| D10 | ¿Se resuelve la discrepancia de unicidad de `cuyes.codigo_identificacion` (migración 0001 elimina UNIQUE y crea índice no único; matriz de paridad dice UNIQUE)? | Comprobado: PostgreSQL y SQLite permiten repetir `codigo_identificacion`; la identidad única es el UUID `id`; `0001` elimina `cuyes_codigo_identificacion_key` y crea el índice no único `idx_cuyes_codigo`. Un código repetido es un asunto de conciliación de datos, no una restricción de base de datos. La matriz de paridad conserva una afirmación obsoleta que Oskar corregirá (no se edita aquí). | `lope-modelo-ddl-propuesto.md` §Esquema central y local; `lope-identidad-conciliacion.md` §Reglas confirmadas; `db/migrations/central/0001_lope_domain.sql`. Confirmado por Oskar en la base efectiva del piloto. | No afecta `parto_crias` directamente; habilita tratar códigos repetidos como casos de conciliación, no como error de carga. | Oskar aportó la comprobación; la corrección documental de la matriz de paridad queda a su cargo. | COMPROBADO POR OSKAR (técnico; no es aprobación documental) |
| D11 | ¿Quién es el revisor técnico designado (alcance escrito)? | No hay persona del Centro identificada. Oskar revisa solo la integración técnica de plataforma; falta designar quién valida las correspondencias y las decisiones zootécnicas. Nombre: POR DEFINIR (sin nombre ni firma). Ver §Información y propuesta de Oskar (D11). (a) Oskar/Centro Lope designa y registra por canal autorizado. | `lope-plan-migracion-validacion.md` §Compuertas (revisor técnico designado); `lope-diccionario-mapeo.md` §Estados y fuentes. | Sin revisor designado no se acepta ninguna correspondencia; el dry-run no se puede validar. | Oskar/Centro Lope designa; Nombre: POR DEFINIR. | PENDIENTE |
| D12 | ¿Se revisa el dry-run (conteos por entidad, exclusiones, errores y diferencias) antes de promover? | (a) Diery ejecuta solo tras autorización coordinada por Oskar; (b) revisor valida el resultado. | `lope-plan-migracion-validacion.md` §Compuertas (dry-run revisado). | Es la compuerta que habilita o no la promoción real; el dry-run debe quedar revisado y archivado. | Diery ejecuta tras autorización; coordinación de Oskar; revisor valida. | PENDIENTE |
| D13 | ¿Se cuenta con respaldo restaurable y prueba de restauración inmediatamente antes de la promoción? | (a) administrador autorizado genera respaldo; (b) un administrador comprueba la restauración; coordinado por Oskar. | `lope-plan-migracion-validacion.md` §Compuertas (respaldo restaurable). | Sin respaldo verificable no hay promoción real; no afecta el dry-run en sí. | Administrador autorizado comprueba la restauración; coordinación de Oskar. | PENDIENTE |
| D14 | ¿Se autoriza el `scope_id` por canal privado (configuración autorizada)? | (a) Oskar comparte por canal privado; (b) no guardar el valor en Git. | `lope-plan-migracion-validacion.md` §Compuertas (ámbito autorizado por canal privado); `lope-identidad-conciliacion.md` §Controles de identidad. | Sin `scope_id` autorizado el manifiesto no se puede generar; el dry-run no es promocionable. | Oskar (canal privado). | COMPARTIDO POR CANAL PRIVADO (por Oskar); valor no registrado en Git |
| D15 | ¿Cuál es la fuente autorizada del motivo de salida de un animal marcado `R` (REEMPLAZO) y cómo impacta el diccionario de mapeo? | `R` = REEMPLAZO (aclaración de Oskar). No se deduce de `R`: revisar `DESTINO` y observaciones con evidencia. En los archivos revisados `R` no aparece en `DESTINO` (solo 15 veces en `COLOR`, donde es color); `DESTINO` observado: `M` 545, `V` 297, vacío 6465. Observaciones: EMPADRE/MONTA 13, VENTA 5, MUERTE 1 (macho), sin mención de `R`. Ver §Información y propuesta de Oskar (D15) y `lope-eventos-valores-encontrados.md` §4–§5. (a) identificar el campo fuente del motivo con trazabilidad; (b) no publicar el motivo sin fuente; (c) no inferir muerte ni descarte desde `R`. | Aclaración de Oskar en este documento (D6); `lope-diccionario-mapeo.md` §Mapeos y decisiones (R); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (R); `lope-eventos-valores-encontrados.md` §4–§5; `lope-evidencia-libro.md` §1 y §3. | Sin motivo de salida resuelto, ese campo queda fuera del manifiesto; el dry-run no lo incluye. | Diery aporta la fuente; responsable del Centro (por definir) valida; revisor técnico revisa. | PENDIENTE |

## Información y propuesta de Oskar, pendiente de validación del responsable del Centro

- **D7 — catálogo de eventos.** No existe catálogo de dominio cerrado:
  `eventos.tipo` es texto sin `CHECK` en `0001`. Las etiquetas del código no
  prueban uso. Se agregan valores observados en `T.C.N.` (47 valores distintos: 46 no
  vacíos y la celda vacía, en 1412 celdas), en `DESTINO` y en observaciones, más
  los tipos previstos.
  Detalle en `lope-eventos-valores-encontrados.md` §1–§2. No se aprueba ningún
  valor, familia ni significado de `detalle`.
- **D8 — abortos.** `AB` aparece 17 veces en `T.C.N.` (reproductivo G1 6;
  reproductivo G2 viejo 11), sin cantidad verificable ni regla aprobada de
  conteo. La herramienta debe conservar archivo, hoja y celda de cada ocurrencia
  como procedencia; esa procedencia no se versiona en Git. No se convierte en un
  número de abortos ni de crías abortadas. Detalle en
  `lope-eventos-valores-encontrados.md` §3.
- **D9 — peso de monta.** La fuente candidata es la columna `Peso` de la fila de
  la hembra en el bloque reproductivo (353 celdas numéricas). La interpretación
  como peso de monta requiere revisión por registro con procedencia. Destino
  propuesto: pesaje de etapa `MONTA` vinculado a un evento `EMPADRE`, respetando
  el `CHECK` de `0005` (un pesaje no puede tener `parto_id` y `evento_id` a la
  vez). No se publican valores. Detalle en
  `lope-eventos-valores-encontrados.md` §7.
- **D11 — revisor técnico.** No hay persona del Centro identificada. Oskar
  revisa solo la integración técnica de plataforma; falta designar quién valida
  las correspondencias y las decisiones zootécnicas. Nombre: POR DEFINIR, sin
  nombre ni firma.
- **D15 — motivo de salida de `R`.** `R` = REEMPLAZO, pero `R` no aparece en
  `DESTINO` en los archivos revisados (solo 15 celdas en `COLOR`, que es la
  columna de color). `DESTINO` observado: `M` 545, `V` 297, vacío 6465.
  En observaciones: EMPADRE/MONTA 13, VENTA 5, MUERTE 1 (macho), sin mención de
  `R`. No hay vínculo por fila entre `DESTINO` y observaciones, así que el motivo
  de salida no es demostrable con estos archivos. Detalle en
  `lope-eventos-valores-encontrados.md` §4–§6.

- **Evidencia del libro de producción.** El libro del Centro aporta definiciones
  para estos puntos en `lope-evidencia-libro.md`; no cambia estados.
  Contradicciones principales: `R` = rojo en `COLOR` y `R` = reproductor en
  `DESTINO` (no REEMPLAZO); `AB` no se define y no hay regla de conteo; el libro
  no incluye el código `SP`.

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
- **Información y propuesta de Oskar (sin validar):** D7, D8, D9 y D15, con valores agregados en `lope-eventos-valores-encontrados.md`. D9 queda PROPUESTO; D7, D8 y D15 siguen PENDIENTES.
- **Pendiente:** todo D1–D15 salvo D10; D6, D7, D8, D11, D12, D13 y D15 siguen sin aprobación; D9 está PROPUESTO; falta revisor designado (D11: Nombre POR DEFINIR), fuente del motivo de salida (D15), regla de conteo de abortos (D8), catálogo de eventos (D7), validación del peso de monta (D9), ámbito autorizado registrado y respaldo verificable.
