# Matriz canónica de requisitos y responsables — carga real Lope

Estado: **preparación técnica completa; ejecución NO autorizada**. Esta matriz es la única lista de pendientes de carga real. Las demás guías y documentos de verificación enlazan aquí; no debe haber listas divergentes.

Base: `origin/dev` `943947b` (PR #169 fusionado). Revisión documental: `docs/verificaciones/revision-entrega-diery-final.md`. Esquema efectivo y unicidad: `docs/verificaciones/piloto-paridad-documentacion.md` §5. Procedimiento operativo: `docs/operacion/carga-lope-piloto.md`.

## Nota sobre D1–D14

`docs/datos/lope-decisiones-parto-crias.md` **no está presente en `origin/dev` 943947b**, por lo que no fue posible verificar allí el significado literal de D1–D14. Las filas siguientes usan los temas comunicados en el encargo y los documentos de entrega vigentes; cuando haga falta citar el contenido exacto de cada decisión, Diery debe completar la referencia al archivo y confirmar la numeración. Ninguna decisión de dominio se marca resuelta por esta matriz.

## Matriz

| ID | Qué falta exactamente | Quién prepara la evidencia | Quién decide/autoriza | Evidencia que demuestra el cierre | Bloquea | Estado real |
|---|---|---|---|---|---|---|
| D1 | Vínculo real cría→parto: qué fila del Excel corresponde a cada `parto_id` | Diery, desde las decisiones humanas | Revisor técnico del Centro Lope | Decisión ACEPTADA con `origen_ref`, `entidad_id`, revisor y evidencia | Promoción de `parto_crias` | PENDIENTE |
| D2 | Identidad del parto compartido por hermanos (no sumar la camada por cría) | Diery | Revisor técnico del Centro Lope | Correspondencia aceptada con un solo `parto_id` para el grupo | Promoción de partos/vínculos | PENDIENTE |
| D3 | Rol de cada cría en `parto_crias` (`rol`) y su fuente | Diery | Revisor técnico del Centro Lope | Decisión con valor de `rol` y evidencia | Promoción de `parto_crias` | PENDIENTE |
| D4 | Unicidad aplicable a vínculos reales: `UNIQUE(parto_id,cuy_id)` y `UNIQUE(cuy_id)` ya existen en esquema; falta decidir si alguna fila real se fusiona o se conserva aparte | Oskar/plataforma aporta el esquema efectivo; Diery aporta los casos | Revisor técnico del Centro Lope | Decisión de dominio sobre los casos, sin cambiar DDL | Promoción de `parto_crias` | PREPARADO la parte técnica; PENDIENTE la decisión |
| D5 | Correspondencias de animales e identidades en conflicto | Diery | Revisor técnico del Centro Lope | `decisiones-pendientes-*.json` convertidas en decisiones ACEPTADO/RECHAZADO/AMBIGUO con evidencia; 18 identidades en conflicto resueltas | Promoción de `cuyes` | PENDIENTE |
| D6 | Significado y procedencia de `R` | Oskar aportó la aclaración `R = REEMPLAZO`; Diery registra la referencia | Revisor técnico del Centro Lope | Registro de la aclaración y decisión sobre el motivo concreto de salida | Catálogo de destinos/eventos | PREPARADO la aclaración; PENDIENTE el motivo y su fuente |
| D7 | Catálogo de eventos (tipos, códigos y su significado) | Diery propone; Oskar revisa integración | Revisor técnico del Centro Lope | Catálogo acordado con fuente | Promoción de `eventos` | PENDIENTE |
| D8 | Fuente y captura de abortos (no inferir desde AB) | Diery | Revisor técnico del Centro Lope | Evidencia original y decisión sobre cada conteo | Campos de abortos en partos/evaluación | PENDIENTE |
| D9 | Fuente y validación del peso de monta | Diery | Revisor técnico del Centro Lope | Celda original verificada y decisión aceptada | Pesajes de monta y reglas ELITE | PENDIENTE |
| D10 | Evidencia técnica de unicidad de `cuyes`: bootstrap UNIQUE, 0001 índice no único, base efectiva PK(id)+índice no único, SQLite sin UNIQUE | Oskar/plataforma (`piloto-paridad-documentacion.md` §5) | Diery completa la parte técnica en el archivo de decisiones; revisor decide la parte de dominio | Referencias `002_nucleo.sql:27`, `0001_lope_domain.sql:46-47`, consulta de solo lectura y `work.schema.ts` | Cierre técnico de D10; no bloquea por sí solo la carga | PREPARADO técnicamente; PENDIENTE registro en el archivo y decisión de dominio |
| D11 | Revisor técnico/de dominio identificado por canal autorizado | Oskar designa y registra fuera de Git | Oskar | Nombre/rol y alcance registrados por canal privado | Cualquier decisión de correspondencia | PENDIENTE |
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
