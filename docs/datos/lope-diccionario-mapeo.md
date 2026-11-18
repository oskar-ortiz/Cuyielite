# Diccionario y cobertura del parser Lope

| Campo | Valor |
|---|---|
| Versión | 1.0-propuesta |
| Fecha | 2026-11-17 |
| Commit base | `70eb84cec9251913a523a8928037451f4cad7c96` |
| Estado | **PROPUESTA: pendiente de aprobación documental sobre esta versión** |

**PROPUESTO** — Esta versión separa comportamiento comprobable, mapeos
candidatos e insumos pendientes; no aprueba correspondencias ni autoriza
promociones. Requiere revisión de Diery/Oskar.

## Registro de aprobación

| Revisor | Decisión | Evidencia/versión revisada | Fecha |
|---|---|---|---|
|  |  |  |  |

## Estados y fuentes

- **CONFIRMADO**: coincide con el código o una verificación citada. La fuente
  identifica qué se comprobó; no implica aprobación de dominio ni de datos.
- **PROPUESTO**: mapeo candidato que requiere acuerdo de Diery/Oskar y, cuando
  aplique, del revisor técnico designado.
- **PENDIENTE**: falta una fuente, evidencia o responsable; se indica quién debe
  aportarlo.
- **ACLARACIÓN**: aporte recibido por canal directo (por ejemplo, de Oskar); no
  es aprobación documental ni confirmación de dominio.

## Auditoría y extracción

- **CONFIRMADO** — El paquete declara parser `0.1.0`, mapeo `0.1.0` y contrato
  `lope_import_audit/v1`. Fuente: `tools/lope_import/__init__.py`,
  `models.py` y `__main__.py`.
- **CONFIRMADO** — El lector individual recorre hasta la columna V y el lector
  reproductivo hasta L. La auditoría también examina errores guardados hasta T,
  los conserva como `celdas_error` y no los convierte en cantidades. Fuentes:
  `tools/lope_import/readers.py` y `__main__.py`.
- **CONFIRMADO** — `CandidateAnimal` conserva código de negocio, sexo
  normalizado, fecha de nacimiento, color, ojos y referencia de origen.
  `sexo_from_code` transforma 1→M y 2→H; otros valores quedan sin resolver.
  Fuente: `models.py`, `normalize.py` y `__main__.py`.
- **CONFIRMADO** — Los bloques reproductivos conservan valores de parto y peso
  para revisión; los valores `T.C.N.` no se convierten en conteos por el lector.
  `CandidateLitter` está definido, pero el recorrido de `__main__` agrega
  bloques tipo diccionario, no instancia esa clase. Fuentes: `models.py`,
  `readers.py` y `__main__.py`.
- **CONFIRMADO** — La auditoría identifica coincidencias y ambigüedades, pero
  declara `reconcilable: False`; no fusiona identidades. Fuente:
  `tools/lope_import/reconcile.py`.
- **CONFIRMADO** — El adaptador crea propuestas `PENDIENTE_REVISION`; datos sin
  evidencia se dejan en `null`, y los errores de auditoría impiden adaptar el
  reporte. La carga de decisiones exige revisor, evidencia y campos publicables
  completos para aceptar. Fuentes: `adapt.py` y `decisions.py`.
- **CONFIRMADO** — `tools/lope_import` conserva los valores de color y destino
  sin una regla de normalización para `R`. Fuente: `readers.py`, `normalize.py`
  y búsqueda del código del importador en el commit base.

## Mapeos y decisiones

- **PROPUESTO** — Usar la salida individual para proponer campos de `cuyes` y
  la salida reproductiva para proponer `partos`, pesajes y eventos. Cada
  correspondencia debe revisarse por separado; requiere aprobación documental
  de Diery/Oskar y decisión del revisor técnico antes de promover.
- **PROPUESTO** — Interpretar el peso del bloque reproductivo como candidato a
  pesaje de etapa `MONTA`. `adapt.py` ya construye esa propuesta, pero no prueba
  que la columna sea una medición de monta ni que corresponda a un animal
  confirmado. Requiere evidencia de origen y acuerdo de dominio.
- **ACLARACIÓN DE OSKAR (pendiente de confirmación por el responsable de
  dominio)** — `R` = REEMPLAZO: un animal que sale de su función (por ejemplo
  enfermedad o venta). `R` por sí sola no demuestra muerte ni descarte. El motivo
  de salida se conserva en un campo separado y no se infiere del símbolo. La
  regla no está implementada en `tools/lope_import`. Falta que el responsable de
  dominio confirme la semántica y que se identifique la fuente autorizada del
  motivo de salida (decisión pendiente abajo).
- **PENDIENTE** — Identificar la fuente autorizada del motivo de salida de un
  animal `R` (REEMPLAZO) y su impacto en este diccionario de mapeo. No se publica
  el motivo sin fuente ni se deriva muerte o descarte desde `R`. Diery aporta la
  fuente y su trazabilidad; el revisor técnico designado valida; el responsable
  de dominio confirma.
- **PENDIENTE** — Confirmar catálogo y semántica de eventos. Las etiquetas
  candidatas del diseño no son un catálogo aprobado. Diery/Oskar deben acordar
  valores permitidos, significado de `detalle` y evidencia de cada evento.
- **PENDIENTE** — Identificar la fuente autorizada de abortos. La entrada ML
  admite ese campo, pero el parser Lope revisado no lo produce como dato
  publicable. Diery debe aportar fuente y trazabilidad; el revisor debe validar.
- **PENDIENTE** — Confirmar la fuente y significado del peso de monta frente a
  `PESO PARTO` y el peso del bloque reproductivo. Diery debe aportar evidencia
  de columna/fecha/contexto y el revisor debe validar antes de aceptar.
- **PENDIENTE** — Resolver, antes de aceptar cada `parto_crias` real, estas
  decisiones de dominio (sin cambios al contrato de transporte):
  1. Identificar la fila de origen y la evidencia que vincula ese parto con esa
     cría; registrar archivo/huella, hoja, celda y fila. La cercanía de filas o
     un conteo del parto no prueban por sí solos el vínculo.
  2. Conciliar la identidad de la cría con un `cuy_id` aceptado y el parto con
     un `parto_id` aceptado; decidir explícitamente cada código ambiguo,
     duplicado o sin correspondencia. Un `codigo_identificacion` repetido no es
     un conflicto de base de datos (D10 comprobado); la identidad única es el
     UUID `id` y el caso es de conciliación de datos.
  3. Aprobar el `rol` de cada vínculo con evidencia de la columna/contexto.
     `CRIA` es el default del DDL, no evidencia de que ese valor corresponda;
     acordar la semántica de otros roles si aparecen.
  4. Resolver con evidencia los casos que contradigan la unicidad vigente
     (un vínculo por `cuy_id`); dejar sin aceptar los casos no resueltos, sin
     cambiar esa restricción.

  Diery prepara cada propuesta; el revisor técnico designado acepta, rechaza o
  deja pendiente con evidencia y motivo. Solo se promueven los vínculos
  aceptados con `parto_id`, `cuy_id` y `rol` resueltos.

## Alcance no autorizado

- **CONFIRMADO** — La promoción solo consume decisiones aceptadas y
  correspondencias revisadas; las propuestas de auditoría no se publican por sí
  solas. Fuentes: `decisions.py`, `manifest.py` y `promote.py`.
- **PENDIENTE** — Ningún mapeo de esta lista habilita una carga real. Faltan
  revisor designado, decisiones con evidencia, ámbito autorizado por canal
  privado y respaldo verificable; ver
  `lope-plan-migracion-validacion.md`.
