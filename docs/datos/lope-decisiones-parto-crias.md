# Anexo de decisiones — parto_crias (Lope)

| Campo | Valor |
|---|---|
| Versión | 1.1-propuesta |
| Fecha | 2026-11-17 |
| Estado | **ANEXO DE LA MATRIZ CANÓNICA; decisiones abiertas, ninguna aprobada** |
| Matriz canónica | `docs/verificaciones/matriz-carga-real-lope.md` |

## Relación con la matriz canónica

- La lista única de requisitos, responsables, evidencias y estados de carga real
  es `docs/verificaciones/matriz-carga-real-lope.md`. Este archivo no la
  duplica: registra el detalle de las decisiones D1–D15, sus opciones y su
  evidencia.
- **Aprobación técnica:** Oskar emitió una aprobación técnica **con reservas** de
  los cuatro documentos Lope (PR #171;
  `docs/verificaciones/aprobacion-tecnica-documentos-lope.md`) sobre las
  versiones y hashes registrados en
  `docs/verificaciones/revision-entrega-diery-final.md`. No cierra D1–D15 ni
  autoriza la carga. Este anexo no modifica esos cuatro documentos.
- Los estados de este anexo no sustituyen los de la matriz; ante una diferencia
  operativa prevalece la matriz. Las equivalencias y diferencias se muestran
  abajo.

## Equivalencias y diferencias con la matriz

| Anexo | Matriz | Diferencia de numeración o estado |
|---|---|---|
| D1 | D1 | Sin diferencia de numeración; PENDIENTE en ambos. |
| D2 | D2 | **Alcance distinto.** La matriz D2 trata la identidad del parto compartido por hermanos; este anexo D2 trata la conciliación de identidad cría↔`cuy_id` y parto↔`parto_id`. Se conserva la numeración del anexo para no romper D6–D15; al citar la matriz, usar su D2. Ambos PENDIENTES. |
| D3 | D3 | Sin diferencia de numeración; PENDIENTE en ambos. |
| D4 | D4 | Matriz: «PREPARADO la parte técnica; PENDIENTE la decisión»; anexo: PENDIENTE. Mismo fondo: falta la decisión de dominio. |
| D5 | D5 | La matriz D5 agrupa los conflictos de animales e identidades; el anexo D5 trata la aceptación de correspondencias origen↔entidad. Apuntan a la misma compuerta de correspondencias; ambos PENDIENTES. |
| D6 | D6 | Matriz: «PREPARADO la aclaración; PENDIENTE el motivo y su fuente»; anexo: aclaración de Oskar pendiente de validación de dominio. Equivalente; ver la nota de `R` en la fila D6. |
| D7 | D7 | PENDIENTE en ambos. |
| D8 | D8 | PENDIENTE en ambos. |
| D9 | D9 | Matriz: PENDIENTE; anexo: PROPUESTO (pendiente de validación). El anexo registra una propuesta concreta; no hay aprobación. |
| D10 | D10 | Matriz: «PREPARADO técnicamente; PENDIENTE registro en el archivo y decisión de dominio»; anexo: COMPROBADO POR OSKAR (PR #170, técnico). La parte técnica queda registrada; la decisión de dominio sigue PENDIENTE. |
| D11 | D11 | Matriz: «responsable identificado; formalización pendiente»; Luis Mangin está identificado como responsable de dominio y ya se le comunicó; siguen pendientes la formalización de la designación y la revisión concreta de cada decisión. La revisión se hará durante la prueba del sistema terminado, como se acordó. |
| D12 | D12 | Matriz: «PREPARADO el comando; PENDIENTE ejecución y revisión»; anexo: PENDIENTE. Equivalente. |
| D13 | D13 | Matriz: «PREPARADO y comprobado en laboratorio; PENDIENTE comprobación inmediata»; anexo: PENDIENTE. Equivalente. |
| D14 | D14 | Matriz: «COMPROBADO como disponible; PENDIENTE confirmación de destino»; anexo: COMPARTIDO POR CANAL PRIVADO (por Oskar), valor no registrado en Git. Equivalente; falta la confirmación de destino. |
| D15 | D6 (motivo de salida) | **No existe en la matriz; propuesta de nueva fila para Oskar.** El motivo concreto de salida está incluido en la matriz D6; este anexo lo separa como D15. PENDIENTE. |

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
- **Comprobado por Oskar (técnico, PR #170):** PostgreSQL y SQLite permiten
  repetir `cuyes.codigo_identificacion`; la identidad única es el UUID `id`;
  `0001` elimina `cuyes_codigo_identificacion_key` y crea el índice no único
  `idx_cuyes_codigo`. Un código repetido es un asunto de conciliación de datos,
  no una restricción de base de datos. La corrección documental quedó registrada
  en `docs/verificaciones/piloto-paridad-documentacion.md` §5; los cuatro
  documentos aprobados no se editan aquí.
- **Pendiente:** los requisitos operativos, sus responsables y sus evidencias
  están en la matriz canónica; este anexo no repite esa lista. Las decisiones
  D1–D15 siguen sin aprobación de dominio: D10 solo tiene la comprobación
  técnica de Oskar, D6 solo la aclaración `R` = REEMPLAZO y D9 sigue PROPUESTO.
  La aprobación técnica con reservas de los cuatro documentos (PR #171) no
  cierra ninguna decisión ni compuerta de carga.

## Decisiones abiertas

Esta tabla registra opciones, evidencia y estado de cada decisión; no es la
lista canónica de pendientes ni reemplaza la matriz.

Guion de decisión para D1–D5: `lope-propuesta-revision-d1-d5.md`. Es una
propuesta para el revisor; no aprueba ni cambia los estados.

| ID | Pregunta puntual | Opciones | Evidencia (archivo y sección) | Impacto sobre dry-run | Responsable | Estado |
|---|---|---|---|---|---|---|
| D1 | ¿Qué filas del Excel Lope crean el vínculo parto↔cría y qué evidencia lo sustenta? | (a) vínculo por fila de origen con archivo/huella, hoja, celda y fila; (b) vínculo por cercanía de filas o conteo del parto (no suficiente). | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (PENDIENTE regla física); `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 1). | Sin decisión aceptada, ningún `parto_crias` entra al manifiesto; el dry-run queda vacío para esa entidad. | Diery prepara; revisor técnico designado decide. | PENDIENTE |
| D2 | ¿Cómo se concilia la identidad de la cría con un `cuy_id` aceptado y del parto con un `parto_id` aceptado (códigos ambiguos, duplicados o sin correspondencia)? D10 comprobó que repetir `codigo_identificacion` no es un conflicto de base de datos: el caso es de conciliación. | (a) aceptar por código resuelto; (b) dejar pendiente/rechazar el caso ambiguo; (c) decidir explícitamente cada código. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 2); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (parto_crias, punto 2). | Bloquea la promoción de vínculos con identidad no resuelta; el dry-run omite esos casos. | Diery prepara; revisor técnico designado decide. | PENDIENTE |
| D3 | ¿Qué `rol` corresponde a cada vínculo parto↔cría? | (a) `CRIA` (default del DDL, no es evidencia); (b) otro rol con evidencia de columna/contexto; (c) dejar pendiente. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 3); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (punto 3). | Sin `rol` resuelto no se promueve el vínculo; el dry-run no incluye la fila. | Diery aporta evidencia; revisor técnico designado aprueba. | PENDIENTE |
| D4 | ¿Cómo resolver los casos que contradicen la unicidad vigente de `parto_crias` (`UNIQUE (cuy_id)` y `UNIQUE (parto_id, cuy_id)`), distinta de la chapa repetible? | (a) dejar sin aceptar los casos no resueltos; (b) resolver con evidencia; (c) no cambiar la restricción. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (item 4); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (punto 4). | Los conflictos no resueltos se excluyen del dry-run; la restricción no se modifica. | Diery prepara evidencia; revisor técnico designado decide. | PENDIENTE |
| D5 | ¿Se acepta la correspondencia origen↔entidad para cada vínculo, con motivo, evidencia y revisor técnico designado? | (a) `ACEPTADO`; (b) `RECHAZADO`; (c) `AMBIGUO`; (d) `PENDIENTE`. | `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (primer punto); `lope-plan-migracion-validacion.md` §Compuertas (decisiones humanas de correspondencias). | Sin `ACEPTADO` no hay promoción; el dry-run no incluye la correspondencia. | Diery prepara propuestas; Oskar/Centro Lope designan revisor; ese revisor decide. | PENDIENTE |
| D6 | ¿Cuál es el significado de `R` en su columna y contexto? | Aclaración de Oskar: `R` = REEMPLAZO, un animal que sale de su función (por ejemplo enfermedad o venta); por sí sola no demuestra muerte ni descarte. El motivo de salida se conserva en un campo separado; ver D15. En los archivos de datos `R` aparece en `COLOR` (15 veces), no en `DESTINO`; no confundir columnas. El motivo y su fuente siguen pendientes (matriz D6). | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (valor `R`); `lope-diccionario-mapeo.md` §Mapeos y decisiones (R); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (R); `lope-eventos-valores-encontrados.md` §4; `docs/verificaciones/matriz-carga-real-lope.md` (D6); `lope-evidencia-libro.md` §1, §3. | `tools/lope_import` no normaliza `R`; no afecta `parto_crias` directamente pero bloquea publicación de campos con `R`. | Oskar aporta la aclaración; responsable de dominio (por definir) valida; Oskar actualiza el documento normativo. | ACLARACIÓN DE OSKAR — PENDIENTE DE VALIDACIÓN DE DOMINIO |
| D7 | ¿Cuál es el catálogo de eventos y la semántica de `detalle`? | No hay catálogo de dominio cerrado; los tipos previstos en el sistema no prueban cuáles registra el Centro. Ver §Información y propuesta de Oskar (D7) y `lope-eventos-valores-encontrados.md`. (a) acordar valores permitidos, significado de `detalle` y evidencia por evento; (b) no publicar eventos sin catálogo revisado. | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (eventos.tipo); `lope-diccionario-mapeo.md` §Mapeos y decisiones (catálogo eventos); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (catálogo eventos); `lope-eventos-valores-encontrados.md`; `lope-evidencia-libro.md` §6. | Sin catálogo revisado, los eventos no se promueven; el dry-run excluye esa entidad. | Oskar aporta la información; responsable del Centro (por definir) valida. | PENDIENTE |
| D8 | ¿Cuál es la fuente autorizada de abortos? | `AB` aparece en las celdas `T.C.N.` (17 apariciones: reproductivo G1 6; reproductivo G2 viejo 11), pero no hay cantidad verificable ni regla aprobada para contar ocurrencias; no convertirlo en número. Al cargar se conserva archivo, hoja y celda de cada ocurrencia como procedencia (en la herramienta, nunca en Git). Ver §Información y propuesta de Oskar (D8) y `lope-eventos-valores-encontrados.md` §3. (a) definir la regla de conteo; (b) no publicar sin regla. | `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas (fuente de abortos); `lope-diccionario-mapeo.md` §Mapeos y decisiones (abortos); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (abortos); `lope-eventos-valores-encontrados.md` §3; `lope-evidencia-libro.md` §4. | Los abortos no entran como cantidad al dry-run; cualquier conteo queda fuera hasta aprobar una regla. | Diery aporta trazabilidad; responsable del Centro (por definir) valida la regla; revisor técnico revisa. | PENDIENTE |
| D9 | ¿Cuál es la fuente y significado del peso de monta frente a `PESO PARTO` y el peso del bloque reproductivo? | Fuente identificada: columna `Peso` de la fila de la hembra en el bloque reproductivo. Su interpretación como peso de monta requiere revisión por registro con procedencia; destino propuesto: pesaje de etapa `MONTA` vinculado a un evento `EMPADRE`, respetando el `CHECK` de `0005`. Ver §Información y propuesta de Oskar (D9) y `lope-eventos-valores-encontrados.md` §7. (a) validar la propuesta; (b) confirmar por registro; (c) rechazar. | `lope-diccionario-mapeo.md` §Mapeos y decisiones (peso de monta; propuesta `MONTA`); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (peso de monta); `lope-eventos-valores-encontrados.md` §7; `lope-evidencia-libro.md` §5. | Sin validación, la propuesta `MONTA` no se promueve; el dry-run excluye esos pesajes. | Diery aporta procedencia por registro; responsable del Centro (por definir) valida; revisor técnico revisa. | PROPUESTO (pendiente de validación) |
| D10 | ¿Se resuelve la discrepancia de unicidad de `cuyes.codigo_identificacion` (migración 0001 elimina UNIQUE y crea índice no único; matriz de paridad dice UNIQUE)? | Comprobado por Oskar (PR #170: merge `0bb3a98`, commit `b0204ea`): PostgreSQL y SQLite permiten repetir `codigo_identificacion`; la identidad única es el UUID `id`; `0001` elimina `cuyes_codigo_identificacion_key` y crea el índice no único `idx_cuyes_codigo`. Un código repetido es un asunto de conciliación de datos, no una restricción de base de datos. La corrección documental quedó registrada en `piloto-paridad-documentacion.md` §5. | `docs/verificaciones/matriz-carga-real-lope.md` (D10); `docs/verificaciones/revision-entrega-diery-final.md` §D10; `docs/verificaciones/piloto-paridad-documentacion.md` §5; `db/ddl/central/002_nucleo.sql:27`; `db/migrations/central/0001_lope_domain.sql:46-47`; `client/src/data/work.schema.ts`. | No afecta `parto_crias` directamente; habilita tratar códigos repetidos como casos de conciliación, no como error de carga. | Oskar aportó la comprobación; Diery registra la parte técnica; el revisor de dominio decide la parte pendiente. | COMPROBADO POR OSKAR (PR #170; técnico) — DECISIÓN DE DOMINIO PENDIENTE |
| D11 | ¿Quién es el revisor designado (alcance escrito)? | Responsable de dominio identificado por comunicación: Luis Mangin, zootecnista de cuyes del Centro Lope (SENA) y coasesor del proyecto. Aval y aprobación para la realización del sistema recibidos (18/05/2026, WhatsApp); entregó la información en PDF y Excel. Oskar revisa solo la integración técnica de plataforma. Falta que Oskar registre la designación formal, y el alcance escrito de la revisión (correspondencias y decisiones zootécnicas). Ver §Información y propuesta de Oskar (D11). | `lope-plan-migracion-validacion.md` §Compuertas (revisor designado); `lope-diccionario-mapeo.md` §Estados y fuentes. | Sin revisor designado no se acepta ninguna correspondencia; el dry-run no se puede validar. | Oskar registra la designación; Luis Mangin valida las decisiones zootécnicas (con retroalimentación al probar el sistema en el SENA, o antes si revisa la evidencia). | RESPONSABLE IDENTIFICADO; FORMALIZACIÓN Y VALIDACIÓN DE DECISIONES PENDIENTES |
| D12 | ¿Se revisa el dry-run (conteos por entidad, exclusiones, errores y diferencias) antes de promover? | (a) Diery ejecuta solo tras autorización coordinada por Oskar; (b) revisor valida el resultado. | `lope-plan-migracion-validacion.md` §Compuertas (dry-run revisado). | Es la compuerta que habilita o no la promoción real; el dry-run debe quedar revisado y archivado. | Diery ejecuta tras autorización; coordinación de Oskar; revisor valida. | PENDIENTE |
| D13 | ¿Se cuenta con respaldo restaurable y prueba de restauración inmediatamente antes de la promoción? | (a) administrador autorizado genera respaldo; (b) un administrador comprueba la restauración; coordinado por Oskar. | `lope-plan-migracion-validacion.md` §Compuertas (respaldo restaurable). | Sin respaldo verificable no hay promoción real; no afecta el dry-run en sí. | Administrador autorizado comprueba la restauración; coordinación de Oskar. | PENDIENTE |
| D14 | ¿Se autoriza el `scope_id` por canal privado (configuración autorizada)? | (a) Oskar comparte por canal privado; (b) no guardar el valor en Git. | `lope-plan-migracion-validacion.md` §Compuertas (ámbito autorizado por canal privado); `lope-identidad-conciliacion.md` §Controles de identidad. | Sin `scope_id` autorizado el manifiesto no se puede generar; el dry-run no es promocionable. | Oskar (canal privado). | COMPARTIDO POR CANAL PRIVADO (por Oskar); valor no registrado en Git |
| D15 | ¿Cuál es la fuente autorizada del motivo de salida de un animal marcado `R` (REEMPLAZO) y cómo impacta el diccionario de mapeo? | `R` = REEMPLAZO (aclaración de Oskar). No se deduce de `R`: revisar `DESTINO` y observaciones con evidencia. En los archivos revisados `R` no aparece en `DESTINO` (solo 15 veces en `COLOR`, donde es color); `DESTINO` observado: `M` 545, `V` 297, vacío 6465. Observaciones: EMPADRE/MONTA 13, VENTA 5, MUERTE 1 (macho), sin mención de `R`. Ver §Información y propuesta de Oskar (D15) y `lope-eventos-valores-encontrados.md` §4–§5. (a) identificar el campo fuente del motivo con trazabilidad; (b) no publicar el motivo sin fuente; (c) no inferir muerte ni descarte desde `R`. | Aclaración de Oskar en este documento (D6); `docs/verificaciones/matriz-carga-real-lope.md` (D6, motivo de salida); `lope-diccionario-mapeo.md` §Mapeos y decisiones (R); `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (R); `lope-eventos-valores-encontrados.md` §4–§5; `lope-evidencia-libro.md` §1 y §3. | Sin motivo de salida resuelto, ese campo queda fuera del manifiesto; el dry-run no lo incluye. | Diery aporta la fuente; responsable del Centro (por definir) valida; revisor técnico revisa. | PENDIENTE |

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
- **D11 — revisor designado y responsable de dominio.** Responsable de dominio
  identificado por comunicación: Luis Mangin, zootecnista de cuyes del Centro Lope (SENA) y
  coasesor del proyecto. Aval y aprobación para la realización del sistema
  recibidos (18/05/2026, WhatsApp); entregó la información en PDF y Excel. Oskar
  revisa solo la integración técnica de plataforma. Falta que Oskar registre la
  designación formal y el alcance escrito de la revisión (correspondencias y
  decisiones zootécnicas). Validación de decisiones concretas: PENDIENTE; Luis
  Mangin las validará con la retroalimentación al probar el sistema en el SENA.
  Designación formal registrada por Oskar: pendiente.
- **D15 — motivo de salida de `R`; no existe en la matriz y se propone como
  nueva fila para Oskar.** `R` = REEMPLAZO, pero `R` no aparece en
  `DESTINO` en los archivos revisados (solo 15 veces en `COLOR`, que es la
  columna de color). `DESTINO` observado: `M` 545, `V` 297, vacío 6465.
  En observaciones: EMPADRE/MONTA 13, VENTA 5, MUERTE 1 (macho), sin mención de
  `R`. No hay vínculo por fila entre `DESTINO` y observaciones, así que el motivo
  de salida no es demostrable con estos archivos. Detalle en
  `lope-eventos-valores-encontrados.md` §4–§6. La evidencia del libro para D15
  cita p. 66 (física; impresa p. 65, verificada por Diery) y p. 67 (física;
  impresa p. 66, verificada por Diery). La referencia a p. 61 es física; su
  impresa p. 60, verificada por Diery.

### Antecedentes de la relación con el Centro Lope (relato de Diery, pendiente de soporte documental)

a) El equipo se reunió y habló con Luis Mangin, zootecnista de cuyes del Centro Lope (SENA). [fecha no registrada]

b) Luis Mangin dio su aval y aprobación para la realización del sistema (18/05/2026, WhatsApp) y aceptó acompañar el proyecto como coasesor.

c) Entregó al equipo los PDF y Excel con la información del Centro, incluido el libro de producción `db/raw_Lope/produccion_cuyes.pdf`, usada para el ETL, el modelo, el corpus del RAG y la validación.

d) Acuerdo: el equipo entrega el sistema funcional, el Centro lo prueba y da retroalimentación según su criterio; las revisiones de decisiones y correspondencias se harán en esa prueba.

e) La autorización por escrito del uso de los datos y del corpus en el trabajo de grado: [pendiente de soporte documental].

## Coherencia D1–D4 con D10

- D10 no cambia las opciones de D1–D4: `parto_crias` conserva en `0001`
  `UNIQUE (parto_id, cuy_id)` y `UNIQUE (cuy_id)`, una restricción distinta de
  `cuyes.codigo_identificacion`.
- Un `codigo_identificacion` repetido no es un conflicto de base de datos (D10
  comprobado): es un caso de conciliación de identidad (D2), donde el UUID `id`
  es la identidad única. Ninguna opción de D1–D4 se modifica.

## Lectura de estados

- La lista canónica de pendientes operativos, responsables y evidencias es la
  matriz (`docs/verificaciones/matriz-carga-real-lope.md`); este anexo no la
  repite.
- **Aprobación técnica con reservas de los cuatro documentos Lope:** emitida por
  Oskar en el PR #171 sobre las versiones y hashes de
  `docs/verificaciones/revision-entrega-diery-final.md`. No es aprobación de
  dominio, no cierra D1–D15 y no autoriza la promoción. Este anexo no forma
  parte de esa aprobación.
- **Comprobado técnicamente:** D10 (PR #170). La decisión de dominio de D10
  sigue pendiente.
- **Aclarado, sin validación de dominio:** D6 (`R` = REEMPLAZO); el motivo y su
  fuente siguen pendientes.
- **Propuesto:** D9 (peso de monta), pendiente de validación.
- Los demás estados, bloqueos y responsables se consultan en la matriz; este
  anexo no mantiene una lista paralela.
