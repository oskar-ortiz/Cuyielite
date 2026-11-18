# Propuesta de revisión D1–D5 — vínculos `parto_crias`

## Estado y alcance

- **Documento de trabajo para el revisor. No aprueba, no acepta correspondencias y no cambia los estados de D1–D5.** Las cinco decisiones siguen `PENDIENTE` en `lope-decisiones-parto-crias.md` y en la matriz canónica.
- **No se toca la matriz canónica, el DDL ni el contrato de transporte.** `parto_crias` conserva `UNIQUE (parto_id, cuy_id)` y `UNIQUE (cuy_id)` de `db/migrations/central/0001_lope_domain.sql`.
- **D11 sigue `PENDIENTE`.** No se designa aquí a ninguna persona; la propuesta se somete al revisor que Oskar/Lope designe y registre por el canal autorizado.
- **Alcance de D2:** se usa el D2 de este anexo (conciliación de identidad cría↔`cuy_id` y parto↔`parto_id`). La matriz canónica tiene otro D2 (identidad del parto compartido por hermanos); no se mezclan.
- **Sin datos reales en Git.** La evidencia de fila, celda o animal se conserva en la herramienta o en el canal autorizado; aquí solo se describe el tipo de evidencia y el riesgo.

## Resumen para el revisor

| ID | Decisión solicitada | Opción recomendada (técnica, no aprobación) | Evidencia disponible | Riesgo si se acepta sin evidencia | Riesgo si queda pendiente |
|---|---|---|---|---|---|
| D1 | Qué fila del Excel crea cada vínculo parto↔cría | (a) vínculo por fila de origen con archivo/huella, hoja, celda y fila; no usar cercanía ni conteo | DDL y documentos de mapeo; falta la extracción fila a fila | Vínculo falso, camada mezclada y genealogía incorrecta | Ningún `parto_crias` entra al manifiesto; el dry-run queda vacío para esa entidad |
| D2 | Cómo conciliar la identidad de la cría y del parto | (c) decidir cada código ambiguo; (a) aceptar solo códigos resueltos; (b) dejar pendientes los no resueltos | D10 comprobado: un código repetido no es conflicto de base de datos; falta la lista de casos | Animal o parto equivocado; duplicados de genealogía | Se bloquea la promoción de los vínculos no resueltos |
| D3 | Qué `rol` lleva cada vínculo | (a) `CRIA` solo con evidencia de fila/contexto; si no, (b) otro rol con evidencia o (c) pendiente | El DDL tiene `CRIA` por defecto, pero el default no es evidencia | Rol incorrecto y semántica equivocada del vínculo | El vínculo no se promueve |
| D4 | Qué hacer con los casos que contradicen la unicidad | (c) no cambiar la restricción; (a) dejar fuera los no resueltos; (b) resolver con evidencia cuando exista | Restricciones y paridad técnica; falta la lista de casos contradictorios | Fusión o pérdida de un vínculo real; cambio de DDL fuera de alcance | Los casos quedan excluidos del dry-run |
| D5 | Si se acepta cada correspondencia origen↔entidad | (a) `ACEPTADO` solo con motivo, evidencia, `origen_ref`, entidad y revisor; en otro caso (b) `RECHAZADO`, (c) `AMBIGUO` o (d) `PENDIENTE` | Regla de compuerta y estados; falta el revisor designado y las decisiones por vínculo | Promoción con correspondencia no válida | No hay promoción; la compuerta D5 queda cerrada |

## D1 — Filas que crean el vínculo parto↔cría

**Pregunta para el revisor:** ¿qué fila de origen crea el vínculo, y qué evidencia permite afirmar que esa cría pertenece a ese parto?

**Propuesta:** adoptar la opción (a). Cada vínculo debe conservar una referencia de origen verificable: archivo o huella, hoja, celda y fila. La cercanía de filas, el conteo de crías o el nombre del bloque no bastan. Si la fila no tiene una referencia estable, se marca `PENDIENTE`; no se inventa una referencia.

**Evidencia disponible:**
- `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas: la tabla existe, pero la regla física no decide qué filas la alimentan.
- `lope-diccionario-mapeo.md` §Mapeos y decisiones: el vínculo debe revisarse por separado y requiere decisión del revisor.
- `db/migrations/central/0001_lope_domain.sql`: `parto_crias` tiene clave propia y unicidad de la relación.

**Evidencia faltante:** extracción fila a fila con archivo, hoja, celda y fila; confirmación de que la cría y el parto son los correctos.

**Riesgo:** aceptar por cercanía o por conteo puede mezclar camadas y atribuir una cría al parto equivocado. Dejarlo pendiente no autoriza la promoción de `parto_crias`, pero evita un dato falso.

**Criterio de aceptación:** cada vínculo propuesto tiene referencia de origen completa y el revisor puede reconstruir la fila sin ambigüedad.

## D2 — Identidad de la cría y del parto

**Pregunta para el revisor:** ¿cómo se resuelve un código ambiguo, duplicado o sin correspondencia, y qué pasa con el vínculo mientras no se resuelva?

**Propuesta:** opción (c), decisión explícita por código. Para un código resuelto, opción (a): aceptar la correspondencia con el `cuy_id` y el `parto_id` aceptados. Para un código no resuelto, opción (b): dejar el vínculo `PENDIENTE` o rechazarlo; no asignar el primer candidato. D10 ya comprobó que repetir `codigo_identificacion` no es un conflicto de base de datos: la identidad única es el UUID `id`, y el caso es de conciliación.

**Evidencia disponible:**
- `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia y §Controles de identidad.
- `lope-diccionario-mapeo.md` §Mapeos y decisiones (identidad y correspondencias).
- `docs/verificaciones/piloto-paridad-documentacion.md` §5 y `db/migrations/central/0001_lope_domain.sql:46-47` para D10.
- `client/src/data/work.schema.ts` para la identidad local.

**Evidencia faltante:** lista de códigos ambiguos, duplicados o sin correspondencia; candidatos de `cuy_id` y `parto_id` por caso; criterio para elegir entre candidatos.

**Riesgo:** aceptar por código sin resolver puede vincular una cría a otro animal o a otro parto; rechazar todos los ambiguos puede perder vínculos reales. La decisión por código permite distinguir los dos casos.

**Criterio de aceptación:** cada vínculo tiene `cuy_id` y `parto_id` aceptados, o queda explícitamente `PENDIENTE`/`RECHAZADO` con motivo.

## D3 — Rol del vínculo

**Pregunta para el revisor:** ¿qué `rol` corresponde a cada vínculo y qué evidencia de origen lo sustenta?

**Propuesta:** no aceptar `CRIA` por el solo valor por defecto del DDL. Usar (a) `CRIA` cuando la fila y el contexto demuestren que es una cría del parto; usar (b) otro rol solo si hay una columna o contexto que lo respalde; si no hay evidencia, (c) dejar `PENDIENTE`. El default `CRIA` es una comodidad del esquema, no una prueba.

**Evidencia disponible:**
- `lope-modelo-ddl-propuesto.md` §Estructuras y semánticas.
- `lope-diccionario-mapeo.md` §Mapeos y decisiones (rol).
- `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (rol).

**Evidencia faltante:** valor de `rol` por fila y fuente de ese valor; en particular, distinguir el default del DDL de una prueba de origen.

**Riesgo:** un rol incorrecto cambia la semántica del vínculo y puede afectar conteos y genealogía; dejar el rol pendiente impide promover ese vínculo, pero no inventa una relación.

**Criterio de aceptación:** cada vínculo promovible tiene un `rol` permitido y una evidencia asociada; los demás quedan fuera.

## D4 — Casos que contradicen la unicidad

**Pregunta para el revisor:** ¿qué se hace con una fila real que no cabe en `UNIQUE (cuy_id)` o en `UNIQUE (parto_id, cuy_id)`?

**Propuesta:** opción (c): no cambiar la restricción ni el DDL. Aplicar (a): los casos no resueltos no se aceptan y quedan fuera del dry-run. Aplicar (b): si hay evidencia suficiente, resolver el caso con una decisión explícita; si no, no fusionar ni duplicar por conveniencia. La unicidad de `cuy_id` implica un solo vínculo vigente por cría; si el origen muestra más de uno, es un conflicto de datos o una limitación del modelo que el revisor debe declarar.

**Evidencia disponible:**
- `db/migrations/central/0001_lope_domain.sql`: `UNIQUE (parto_id, cuy_id)` y `UNIQUE (cuy_id)`.
- `lope-diccionario-mapeo.md` §Mapeos y decisiones (unicidad).
- `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (unicidad).
- D10 y `docs/verificaciones/piloto-paridad-documentacion.md` §5: la unicidad de `codigo_identificacion` es un tema distinto.

**Evidencia faltante:** lista de casos contradictorios, con la fila de origen y la razón por la que contradicen la restricción; decisión por caso.

**Riesgo:** fusionar dos vínculos reales puede perder información; duplicar o cambiar la restricción queda fuera del alcance. Excluir los casos es conservador, pero debe quedar contado y explicado en el dry-run.

**Criterio de aceptación:** cada caso contradictorio tiene decisión (`ACEPTADO` con evidencia, `RECHAZADO` o `PENDIENTE`) y la restricción no se modifica.

## D5 — Aceptación de la correspondencia origen↔entidad

**Pregunta para el revisor:** ¿se acepta esta correspondencia concreta, con qué motivo y evidencia, y quién la revisa?

**Propuesta:** aplicar la compuerta existente:
- `ACEPTADO` solo si están completos `origen_ref`, `entidad_id`, motivo, evidencia y revisor designado.
- `RECHAZADO` con motivo si la correspondencia no se sostiene.
- `AMBIGUO` si hay más de un candidato y falta evidencia para decidir.
- `PENDIENTE` si falta evidencia o revisión.

Solo `ACEPTADO` habilita la promoción. D5 no se puede cerrar antes de D1–D4 y antes de D11; la propuesta no sustituye la decisión del revisor.

**Evidencia disponible:**
- `lope-identidad-conciliacion.md` §Decisiones que requieren evidencia (primer punto) y §Controles de identidad.
- `lope-plan-migracion-validacion.md` §Compuertas obligatorias.
- `lope-diccionario-mapeo.md` §Estados y fuentes.

**Evidencia faltante:** revisor designado y registrado por canal autorizado; decisión por correspondencia; motivo y evidencia por vínculo.

**Riesgo:** promover con una correspondencia no aceptada rompe la trazabilidad; dejar D5 pendiente impide la promoción, que es el comportamiento correcto mientras falte el revisor o la evidencia.

**Criterio de aceptación:** cada correspondencia tiene estado, motivo, evidencia, `origen_ref`, `entidad_id` y revisor; el dry-run cuenta aceptados, rechazados, ambiguos y pendientes.

## Evidencia que falta reunir antes de la sesión

| ID | Evidencia mínima | Dónde se conserva |
|---|---|---|
| D1 | Archivo/huella, hoja, celda y fila de cada vínculo propuesto | Herramienta o canal autorizado; no en Git |
| D2 | Lista de códigos ambiguos/duplicados y candidatos aceptados | Herramienta o canal autorizado; no en Git |
| D3 | `rol` propuesto y fuente de ese valor por fila | Herramienta o canal autorizado; no en Git |
| D4 | Casos que contradicen la unicidad y su decisión | Herramienta o canal autorizado; no en Git |
| D5 | Correspondencias con estado, motivo, evidencia y revisor | Herramienta o canal autorizado; no en Git |

## Orden de revisión propuesto

1. D11: confirmar el revisor y su alcance por el canal autorizado. Sin esto, D5 no puede aceptarse.
2. D1: fijar la referencia de origen de cada vínculo.
3. D2: resolver la identidad de cría y parto.
4. D3: fijar el rol con evidencia.
5. D4: decidir los casos que contradicen la unicidad.
6. D5: aceptar, rechazar, marcar ambiguo o dejar pendiente cada correspondencia.

## Lo que esta propuesta no hace

- No marca D1–D5 como aprobadas.
- No designa revisor ni sustituye D11.
- No modifica la matriz canónica, el DDL, las migraciones ni el contrato de transporte.
- No autoriza dry-run, promoción ni carga real.
- No incluye datos reales, códigos de animal, chapas ni procedencias en Git.
