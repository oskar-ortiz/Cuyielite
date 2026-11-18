# Matriz canónica de requisitos y responsables — carga real Lope

Estado: **preparación técnica completa; ejecución NO autorizada**. Esta matriz es la única lista de pendientes de carga real. Las demás guías y documentos de verificación enlazan aquí; no debe haber listas divergentes.

La [aprobación técnica de Oskar](aprobacion-tecnica-documentos-lope.md) fue emitida con reservas el 2026-11-17 sobre las versiones identificadas en ese registro. No cierra decisiones D1–D14 ni autoriza la promoción.

Base: `origin/dev` `943947b` (PR #169 fusionado). Revisión documental: `docs/verificaciones/revision-entrega-diery-final.md`. Esquema efectivo y unicidad: `docs/verificaciones/piloto-paridad-documentacion.md` §5. Procedimiento operativo: `docs/operacion/carga-lope-piloto.md`.

## Integración del anexo D1–D15

Actualización del 2026-11-18 sobre `origin/dev` `3d0db27`: ya están disponibles el [anexo de decisiones](../datos/lope-decisiones-parto-crias.md) y el [inventario agregado de valores](../datos/lope-eventos-valores-encontrados.md), incorporados antes de esta revisión. La nota anterior sobre su ausencia describía únicamente la base histórica `943947b`.

Se conservan los identificadores canónicos D1–D14. Al citar una decisión debe indicarse si pertenece a la matriz o al anexo:

- **D2:** en la matriz es la identidad de un parto compartido por hermanos; en el anexo abarca conciliación cría→cuy y parto→parto. Son alcances relacionados, no idénticos; ambos requieren evidencia.
- **D5:** agrupa las identidades en conflicto y las correspondencias origen→entidad aceptadas. La propuesta del anexo no acepta registros por sí sola.
- **D15 del anexo:** motivo de salida, cubierto por D6 de esta matriz. Se conserva esa equivalencia sin renumerar decisiones existentes.
- **D10:** la comprobación técnica ya está registrada en el anexo. Lo pendiente es la decisión sobre los casos reales, no repetir la comprobación del esquema.

El PR #176, commit `a82801b`, añade cambios del anexo y la procedencia de preguntas RAG; al revisar el 2026-11-18 estaba abierto con conflictos de fusión. No se considera integrado por esta actualización. Las decisiones de dominio y la aceptación de registros continúan pendientes.

## Responsable de dominio comunicado — D11

Diery comunicó a Oskar el 2026-11-18 que **Luis Mangin**, instructor del SENA en el Centro Lope, zootecnista de cuyes y coasesor del proyecto, es el responsable de dominio y revisor de decisiones zootécnicas y correspondencias. Se registra la persona y el alcance comunicados; no se atribuye una firma ni una decisión concreta a Luis.

Según ese relato, el aval para realizar el proyecto se recibió el 2026-05-18 por WhatsApp y está en trámite una constancia firmada. El soporte original y la constancia no se inspeccionaron en esta revisión. El anexo en la base revisada cita SMS; el canal se conserva como antecedente por conciliar, sin convertirlo en evidencia institucional comprobada. La revisión de decisiones y correspondencias se realizará durante la prueba del sistema en el SENA; esa revisión aún no ha ocurrido según la información recibida.

**Estado:** responsable identificado por comunicación; PENDIENTES la confirmación formal de designación y alcance, la constancia y la revisión de decisiones concretas. Identificar al responsable no autoriza a marcar correspondencias como ACEPTADO ni a promover datos reales.

## Aclaración contextual de R — D6 / D15 del anexo

La explicación `R = REEMPLAZO` procede de Oskar como aclaración del uso operativo. No se aportó una celda o formato que demuestre ese significado en los Excel. Según el inventario agregado de Diery, el valor exacto aparece 15 veces en `COLOR` y ninguna en `DESTINO`. No se aplica la interpretación de reemplazo a esas celdas ni se deduce su significado cromático. Luis debe revisar la columna, el contexto y el formato fuente. D6 y el motivo de salida siguen pendientes; no se normaliza ni publica un significado por esta aclaración.

## Matriz

| ID | Qué falta exactamente | Quién prepara la evidencia | Quién decide/autoriza | Evidencia que demuestra el cierre | Bloquea | Estado real |
|---|---|---|---|---|---|---|
| D1 | Vínculo real cría→parto: qué fila del Excel corresponde a cada `parto_id` | Diery, desde las decisiones humanas | Revisor técnico del Centro Lope | Decisión ACEPTADA con `origen_ref`, `entidad_id`, revisor y evidencia | Promoción de `parto_crias` | PENDIENTE |
| D2 | Identidad del parto compartido por hermanos (no sumar la camada por cría) | Diery | Revisor técnico del Centro Lope | Correspondencia aceptada con un solo `parto_id` para el grupo | Promoción de partos/vínculos | PENDIENTE |
| D3 | Rol de cada cría en `parto_crias` (`rol`) y su fuente | Diery | Revisor técnico del Centro Lope | Decisión con valor de `rol` y evidencia | Promoción de `parto_crias` | PENDIENTE |
| D4 | Unicidad aplicable a vínculos reales: `UNIQUE(parto_id,cuy_id)` y `UNIQUE(cuy_id)` ya existen en esquema; falta decidir si alguna fila real se fusiona o se conserva aparte | Oskar/plataforma aporta el esquema efectivo; Diery aporta los casos | Revisor técnico del Centro Lope | Decisión de dominio sobre los casos, sin cambiar DDL | Promoción de `parto_crias` | PREPARADO la parte técnica; PENDIENTE la decisión |
| D5 | Correspondencias de animales e identidades en conflicto | Diery | Revisor técnico del Centro Lope | `decisiones-pendientes-*.json` convertidas en decisiones ACEPTADO/RECHAZADO/AMBIGUO con evidencia; 18 identidades en conflicto resueltas | Promoción de `cuyes` | PENDIENTE |
| D6 | Significado de `R` según columna/contexto y fuente del motivo de salida (D15 del anexo) | Oskar aportó `R = REEMPLAZO`; Diery aporta inventario: 15 en COLOR, 0 en DESTINO | Responsable de dominio comunicado: Luis Mangin; confirmación formal pendiente | Fuente y decisión revisadas por contexto, separando código de color, reemplazo y motivo de salida | Catálogo de destinos/eventos | ACLARACIÓN RECIBIDA; PENDIENTES validación contextual, motivo y fuente |
| D7 | Catálogo de eventos (tipos, códigos y su significado) | Diery propone; Oskar revisa integración | Revisor técnico del Centro Lope | Catálogo acordado con fuente | Promoción de `eventos` | PENDIENTE |
| D8 | Fuente y captura de abortos (no inferir desde AB) | Diery | Revisor técnico del Centro Lope | Evidencia original y decisión sobre cada conteo | Campos de abortos en partos/evaluación | PENDIENTE |
| D9 | Fuente y validación del peso de monta | Diery | Revisor técnico del Centro Lope | Celda original verificada y decisión aceptada | Pesajes de monta y reglas ELITE | PENDIENTE |
| D10 | Evidencia técnica de unicidad de `cuyes` y decisiones sobre identidades reales repetidas | Oskar/plataforma aporta esquema; Diery ya lo registra en el anexo | Revisor decide los casos de dominio | PR #170 y anexo D10: UUID único, chapa repetible; decisiones reales con evidencia | Decisiones de conciliación; no exige cambio de esquema | COMPROBADO Y REGISTRADO técnicamente; PENDIENTE decisión de dominio |
| D11 | Confirmación formal del responsable y alcance de revisión | Diery comunicó a Luis Mangin y la constancia en trámite; Oskar coordina el registro | Oskar/Lope confirman designación; Luis revisa el dominio | Persona y alcance comunicados arriba; confirmación formal y evidencia de revisiones concretas pendientes | Aceptación de correspondencias y validación de dominio del dry-run | RESPONSABLE IDENTIFICADO por comunicación; PENDIENTES formalización y revisión |
| D12 | Dry-run revisado con conteos por entidad y por decisión | Diery ejecuta el dry-run autorizado; Oskar/plataforma aporta el entorno | Revisor técnico valida resultados y conteos | Reporte de dry-run con aceptados, rechazados, ambiguos, pendientes y conteos por entidad | Autorización de promoción | PREPARADO el comando; PENDIENTE ejecución y revisión |
| D13 | Respaldo restaurable de la base destino | Oskar/plataforma | Revisor técnico confirma la evidencia | `pg_dump` + restauración en base aislada comprobada inmediatamente antes de la promoción | Autorización de promoción | PREPARADO y comprobado en laboratorio; PENDIENTE comprobación inmediata previa a la carga |
| D14 | Ámbito autorizado disponible por canal privado | Ya disponible: handoff privado `handoff-diery-scope.md` con `scope_id` del piloto | Oskar confirma el ámbito de destino para la promoción concreta | Handoff privado existente y configuración del piloto | Autorización de promoción | COMPROBADO como disponible; PENDIENTE confirmación de destino para esa promoción |

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
