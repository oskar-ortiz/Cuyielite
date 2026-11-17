# Plan de validación y compuertas para carga Lope

| Campo | Valor |
|---|---|
| Versión | 1.0-propuesta |
| Fecha | 2026-11-17 |
| Commit base | `70eb84cec9251913a523a8928037451f4cad7c96` |
| Estado | **PROPUESTA: pendiente de aprobación documental sobre esta versión** |

**PROPUESTO** — El plan describe compuertas y responsabilidades. La aprobación
de esta lista corresponde a Diery/Oskar; no constituye autorización de carga.

## Registro de aprobación

| Revisor | Decisión | Evidencia/versión revisada | Fecha |
|---|---|---|---|
|  |  |  |  |

## Estado confirmado del flujo sintético

- **CONFIRMADO** — El código está separado en auditoría, adaptación,
  decisiones, manifiesto y promoción. El contrato permite cinco entidades:
  `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`. Fuentes:
  `tools/lope_import/{__main__,adapt,decisions,manifest,promote}.py`.
- **CONFIRMADO** — El adaptador de publicación usa la conexión recibida por el
  orquestador. El publicador registra versiones e historial; la promoción
  conserva la escritura del dominio y la confirmación del lote en su
  transacción. Fuentes: `tools/lope_import/promote.py`,
  `backend/app/services/publication.py` y
  `docs/verificaciones/etl-manifiesto-integracion.md`.
- **CONFIRMADO** — La evidencia de integración sintética documenta dry-run,
  replay/idempotencia, rollback y verificación con datos de prueba. Esto no es
  evidencia de carga real ni aprobación de correspondencias. Fuente:
  `docs/verificaciones/etl-manifiesto-integracion.md`.
- **CONFIRMADO** — La evidencia de paridad registra la aplicación de 0005 en
  el piloto y la validación equivalente de contexto exclusivo en el pull local.
  No se consultó ni modificó ninguna base en esta tarea. Fuente:
  `docs/verificaciones/piloto-paridad-documentacion.md`.

## Compuertas obligatorias antes de carga real

- [ ] **PENDIENTE — Revisor técnico designado.** Falta nombramiento y alcance
  escrito. Responsable: Oskar/Lope designa; registrar identidad por canal
  autorizado, no en este documento.
- [ ] **PENDIENTE — Decisiones humanas de correspondencias.** Cada decisión
  requiere estado, revisor, evidencia y campos completos. Responsable: Diery
  prepara propuestas; revisor técnico acepta, rechaza o marca ambigüedad.
- [ ] **PENDIENTE — Dry-run revisado.** Falta revisión de conteos por entidad,
  exclusiones, errores y diferencias antes de cualquier promoción.
  Responsable: Diery ejecuta solo después de autorización; revisor valida el
  resultado.
- [ ] **PENDIENTE — Respaldo restaurable.** Falta respaldo para el objetivo de
  carga y prueba de restauración verificable inmediatamente antes de la
  promoción. Responsable: administrador autorizado; revisor confirma evidencia.
- [ ] **PENDIENTE — Ámbito autorizado por canal privado.** Falta la autorización
  y resolución de `scope_id` desde configuración autorizada. Responsable:
  Oskar/administrador comparte por canal privado; no guardar el valor en Git.

## Controles de ejecución propuestos

- **PROPUESTO** — Mantener una transacción por lote: el orquestador escribe
  dominio y confirma el lote; `publicar_cambios` recibe la conexión abierta y
  no ejecuta `COMMIT`. Requiere aprobación documental de Oskar/Diery sobre esta
  versión.
- **CONFIRMADO** — El manifiesto valida el ámbito contra el contexto autorizado,
  la tupla de idempotencia y las correspondencias aceptadas. Fuente:
  `tools/lope_import/manifest.py`.
- **PENDIENTE** — Resolver las decisiones de datos antes de crear manifiestos
  reales, incluyendo `parto_crias`, `R`, el catálogo de eventos, la fuente de
  abortos y la fuente del peso de monta. Responsables y evidencia están en
  `lope-diccionario-mapeo.md`.
- **PROPUESTO** — Mantener reportes, decisiones y manifiestos reales fuera de
  Git. Requiere aprobación de quienes custodian los datos.

## Registro de ejecución de esta entrega

- **CONFIRMADO** — Los Excel autorizados se leyeron exclusivamente para el
  entrenamiento RF, según autorización de Diery. No se usaron para promoción
  Lope; no se consultó ni modificó `cuyielite`.
- **CONFIRMADO** — No se ejecutó promoción ni carga real en esta entrega.
- **PENDIENTE** — No se registra aprobación ni se marca ninguna compuerta como
  cumplida.
