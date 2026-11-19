# Matriz canónica de requisitos y responsables — carga real Lope

Estado: **preparación técnica completa; ejecución NO autorizada**. Esta matriz es la única lista de pendientes de carga real. Las demás guías y documentos de verificación enlazan aquí; no debe haber listas divergentes.

La [aprobación técnica de Oskar](aprobacion-tecnica-documentos-lope.md) fue emitida con reservas el 2026-11-17 sobre las versiones identificadas en ese registro. No cierra decisiones D1–D15 ni autoriza la promoción.

Base: `origin/dev` `943947b` (PR #169 fusionado). Revisión documental: `docs/verificaciones/revision-entrega-diery-final.md`. Esquema efectivo y unicidad: `docs/verificaciones/piloto-paridad-documentacion.md` §5. Procedimiento operativo: `docs/operacion/carga-lope-piloto.md`.

## Integración del anexo D1–D15

Actualización del 2026-11-18 sobre `origin/dev` `3d0db27`: ya están disponibles el [anexo de decisiones](../datos/lope-decisiones-parto-crias.md) y el [inventario agregado de valores](../datos/lope-eventos-valores-encontrados.md), incorporados antes de esta revisión. La nota anterior sobre su ausencia describía únicamente la base histórica `943947b`.

Se conservan los identificadores canónicos D1–D14 y se añade D15 sin renumerarlos. Al citar una decisión debe indicarse si pertenece a la matriz o al anexo:

- **D2:** en la matriz es la identidad de un parto compartido por hermanos; en el anexo abarca conciliación cría→cuy y parto→parto. Son alcances relacionados, no idénticos; ambos requieren evidencia.
- **D5:** agrupa las identidades en conflicto y las correspondencias origen→entidad aceptadas. La propuesta del anexo no acepta registros por sí sola.
- **D15:** motivo de salida, separado de D6 (significado contextual de R). La versión anterior lo agrupaba en D6; ahora tiene fila propia, con el mismo identificador del anexo.
- **D10:** la comprobación técnica ya está registrada en el anexo. Lo pendiente es la decisión sobre los casos reales, no repetir la comprobación del esquema.

El PR #176, commit `a82801b`, añade cambios del anexo y la procedencia de preguntas RAG; al revisar el 2026-11-18 estaba abierto con conflictos de fusión. No se considera integrado por esta actualización. Las decisiones de dominio y la aceptación de registros continúan pendientes.

## Responsable de dominio comunicado — D11

Diery comunicó a Oskar el 2026-11-18 que **Luis Mangin**, instructor del SENA en el Centro Lope, zootecnista de cuyes y coasesor del proyecto, es el responsable de dominio y revisor de decisiones zootécnicas y correspondencias. Se registra la persona y el alcance comunicados; no se atribuye una firma ni una decisión concreta a Luis.

El aval para realizar el proyecto se recibió el 2026-05-18 por **WhatsApp**. Diery ratificó el canal a Oskar el 2026-11-19; queda rectificada la referencia anterior a SMS. **Oskar confirmó el 2026-11-19 que Diery ya entregó el aval y ordenó registrarlo como confirmado.** Quedan registrados el aval y Luis Mangin como responsable de dominio/revisor de correspondencias y decisiones zootécnicas. La captura, la constancia y cualquier documento de identidad permanecen fuera del repositorio; esta anotación no afirma que el agente inspeccionó una firma ni reproduce el soporte privado.

**Estado:** AVAL Y RESPONSABLE CONFIRMADOS POR OSKAR; pendiente la revisión de decisiones concretas durante la prueba del sistema con Luis/SENA. La recepción del aval no autoriza a marcar correspondencias como ACEPTADO ni a promover datos reales. La mención previa a formalización/constancia pendiente queda como antecedente sustituido por la confirmación de recepción de Oskar; no equivale a validar correspondencias o resultados.

## Aclaración contextual de R y motivo de salida — D6 / D15

El anexo registra **D6 confirmado por el Centro**, según la leyenda y la comunicación de Luis Mangin del 2026-11-18: en `DESTINO`, `R` significa reemplazo. Diery comunicó adicionalmente a Oskar el 2026-11-19 que la letra se pone al animal que se retira de su función (el reemplazado), no al que lo sustituye. Se registra esa última aclaración como comunicación de dominio; no como inspección directa del soporte ni aceptación de una fila real.

El inventario de archivos sigue mostrando 15 valores `R` en `COLOR` y ninguno en `DESTINO`. Son contextos distintos: no se convierten esos 15 registros en reemplazos ni se deduce enfermedad, venta, muerte o descarte. El anexo conserva pasajes donde la distinción reemplazante/reemplazado figuraba pendiente; esta actualización registra el mensaje posterior para que Diery los concilie sin alterar el recuento observado.

**D15 permanece pendiente:** `DESTINO` solo consigna la letra, no el motivo concreto. Durante la prueba Luis debe confirmar si existe otra hoja/formato donde se anote ese motivo. Si no existe fuente, el motivo queda desconocido; no se fabrica desde `R`. Confirmar el significado del código no define por sí solo su efecto en las reglas ML o el estado productivo.

## Matriz

| ID | Qué falta exactamente | Quién prepara la evidencia | Quién decide/autoriza | Evidencia que demuestra el cierre | Bloquea | Estado real |
|---|---|---|---|---|---|---|
| D1 | Vínculo real cría→parto: qué fila del Excel corresponde a cada `parto_id` | Diery, desde las decisiones humanas | Revisor técnico del Centro Lope | Decisión ACEPTADA con `origen_ref`, `entidad_id`, revisor y evidencia | Promoción de `parto_crias` | PENDIENTE |
| D2 | Identidad del parto compartido por hermanos (no sumar la camada por cría) | Diery | Revisor técnico del Centro Lope | Correspondencia aceptada con un solo `parto_id` para el grupo | Promoción de partos/vínculos | PENDIENTE |
| D3 | Rol de cada cría en `parto_crias` (`rol`) y su fuente | Diery | Revisor técnico del Centro Lope | Decisión con valor de `rol` y evidencia | Promoción de `parto_crias` | PENDIENTE |
| D4 | Unicidad aplicable a vínculos reales: `UNIQUE(parto_id,cuy_id)` y `UNIQUE(cuy_id)` ya existen en esquema; falta decidir si alguna fila real se fusiona o se conserva aparte | Oskar/plataforma aporta el esquema efectivo; Diery aporta los casos | Revisor técnico del Centro Lope | Decisión de dominio sobre los casos, sin cambiar DDL | Promoción de `parto_crias` | PREPARADO la parte técnica; PENDIENTE la decisión |
| D5 | Correspondencias de animales e identidades en conflicto | Diery | Revisor técnico del Centro Lope | `decisiones-pendientes-*.json` convertidas en decisiones ACEPTADO/RECHAZADO/AMBIGUO con evidencia; 18 identidades en conflicto resueltas | Promoción de `cuyes` | PENDIENTE |
| D6 | Registrar el significado contextual de `R`, separado del motivo (D15) y del efecto en clasificación | Diery aporta leyenda y confirmación comunicada de Luis; inventario: 15 en COLOR, 0 en DESTINO | Luis Mangin; aval y responsable confirmados por Oskar en D11 | Anexo: R = reemplazo confirmado por el Centro; mensaje posterior identifica al reemplazado. No acepta registros ni cambia reglas | Interpretación contextual de destinos | CONFIRMADO POR EL CENTRO según anexo/comunicación; sin promoción ni efecto ML aprobado |
| D7 | Catálogo de eventos (tipos, códigos y su significado) | Diery propone; Oskar revisa integración | Revisor técnico del Centro Lope | Catálogo acordado con fuente | Promoción de `eventos` | PENDIENTE |
| D8 | Fuente y captura de abortos (no inferir desde AB) | Diery | Revisor técnico del Centro Lope | Evidencia original y decisión sobre cada conteo | Campos de abortos en partos/evaluación | PENDIENTE |
| D9 | Fuente y validación del peso de monta | Diery | Revisor técnico del Centro Lope | Celda original verificada y decisión aceptada | Pesajes de monta y reglas ELITE | PENDIENTE |
| D10 | Evidencia técnica de unicidad de `cuyes` y decisiones sobre identidades reales repetidas | Oskar/plataforma aporta esquema; Diery ya lo registra en el anexo | Revisor decide los casos de dominio | PR #170 y anexo D10: UUID único, chapa repetible; decisiones reales con evidencia | Decisiones de conciliación; no exige cambio de esquema | COMPROBADO Y REGISTRADO técnicamente; PENDIENTE decisión de dominio |
| D11 | Aval y responsable de dominio registrados; ejecutar después la revisión de decisiones concretas | Diery entregó el aval; Oskar confirmó su recepción y registro el 19/11/2026 | Oskar confirma el registro; Luis Mangin revisa decisiones zootécnicas y correspondencias | Confirmación explícita de Oskar; soporte conservado por canal privado, sin firma inspeccionada por el agente | La revisión concreta sigue siendo necesaria para aceptar correspondencias y validar el dry-run | AVAL Y RESPONSABLE CONFIRMADOS POR OSKAR; PENDIENTE revisión de decisiones concretas |
| D12 | Dry-run revisado con conteos por entidad y por decisión | Diery ejecuta el dry-run autorizado; Oskar/plataforma aporta el entorno | Revisor técnico valida resultados y conteos | Reporte de dry-run con aceptados, rechazados, ambiguos, pendientes y conteos por entidad | Autorización de promoción | PREPARADO el comando; PENDIENTE ejecución y revisión |
| D13 | Respaldo restaurable de la base destino | Oskar/plataforma | Revisor técnico confirma la evidencia | `pg_dump` + restauración en base aislada comprobada inmediatamente antes de la promoción | Autorización de promoción | PREPARADO y comprobado en laboratorio; PENDIENTE comprobación inmediata previa a la carga |
| D14 | Ámbito autorizado disponible por canal privado | Ya disponible: handoff privado `handoff-diery-scope.md` con `scope_id` del piloto | Oskar confirma el ámbito de destino para la promoción concreta | Handoff privado existente y configuración del piloto | Autorización de promoción | COMPROBADO como disponible; PENDIENTE confirmación de destino para esa promoción |
| D15 | Fuente del motivo concreto por el que el animal sale de su función; confirmar si se registra en otra hoja/formato | Diery documenta que R se coloca al reemplazado y DESTINO no consigna el motivo | Luis Mangin confirma la fuente durante la prueba; revisor acepta cada dato con evidencia | Fuente identificada y revisada por registro, o constancia de que no existe y debe conservarse desconocido | Publicación del motivo de salida y cualquier inferencia que lo requiera | PENDIENTE fuente/registro; prohibido inferir enfermedad, venta, muerte o descarte desde R |

## Hallazgos de integración que no cierran decisiones de dominio

Revisión de código del 2026-11-19, base `origin/dev` `bfc1944`:

- `tools/lope_import/readers.py` y `adapt.py::_animal_proposal` conservan OJOS en bruto como `ojos_codigo`; el adaptador no procesa DESTINO. Conservar el código fuente no equivale a aceptar su correspondencia ni autoriza una normalización nueva.
- `ml/rules/clasificar.py::_black_eyes` ya reconoce `1` y `NEGRO`; el código numérico en bruto no implica por sí solo un fallo de clasificación. No se introducen conversiones adicionales de texto libre sin contrato.
- La regla de candidata excluye destino `M`/`MUERTE`; reproductora usa `hembra_muerta`. La marca `SP` se incorpora como `SIN_PLACA` en `ml/etl/transform.py`, no como nueva exclusión de `clasificar.py`. La librería ML y el importador de dominio son flujos distintos.
- No existe en esas reglas un tratamiento específico de D, V, R, L o E. Antes de promover registros cuya interpretación dependa de esos destinos, Luis debe decidir su aplicabilidad por etapa, efecto sobre estado/clasificación y evidencia. No se agregan exclusiones, categorías ni eventos por deducción del equipo de plataforma. D7/D15 y las correspondencias aplicables conservan su bloqueo.

No se modificó backend, ETL, reglas, esquema, corpus ni índice como consecuencia de estas aclaraciones.

## Puerta de ejecución

La promoción real se ejecutará **solo** cuando existan, simultáneamente:

1. D11: revisor técnico identificado.
2. Decisiones ACEPTADO con `entidad_id`, revisor y evidencia verificable (D1–D10 según aplique).
3. Destino y ámbito autorizados (D14 confirmado para esa promoción).
4. D12: dry-run revisado con conteos.
5. D13: respaldo restaurable comprobado.
6. Autorización explícita de Oskar sobre **esa promoción concreta**.

No se ejecuta ETL real, carga, aceptación, migración, evaluación ni cambio de datos sin esas seis condiciones. La comprobación técnica de D13 no equivale a la aprobación de los resultados de D12.

## Pendientes que NO son requisitos de importación

| Tema | Responsable | Estado |
|---|---|---|
| Pertinencia RAG (gestación, vitamina C) y umbral | Diery | PENDIENTE; handoff `docs/integracion/handoff-diery-pertinencia-rag.md` |
| Procedencia de preguntas RAG | Diery | PENDIENTE |
| Validación experta ciega del RF | Diery + revisor experto | PENDIENTE |

Aprobar la documentación no cierra ninguno de estos tres trabajos.

## Enlaces

- Revisión documental y borrador de aprobación: `docs/verificaciones/revision-entrega-diery-final.md`.
- Paridad y unicidad efectiva: `docs/verificaciones/piloto-paridad-documentacion.md`.
- Procedimiento de carga y bloque de aprobación: `docs/operacion/carga-lope-piloto.md`.
- Operación del piloto: `docs/operacion/piloto-local.md`.
- Cierre de plataforma: `docs/verificaciones/cierre-plataforma-piloto.md`.
