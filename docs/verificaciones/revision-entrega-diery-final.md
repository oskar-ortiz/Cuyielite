# Revisión de la entrega final de Diery y contratos vigentes (2026-11-17)

Estado: **revisión técnica terminada; aprobación documental pendiente**. No se atribuye aprobación a Oskar ni al Centro Lope sobre esta versión.

## Versiones revisadas

| Elemento | Versión / commit | SHA-256 del archivo |
|---|---|---|
| Árbol revisado | `origin/dev` `23508b5` (PR #165 fusionado) | — |
| Entrega Datos/IA | `f03f0ad` vía PR #163 (merge `2c1512c`) | — |
| Validación RAG | `67e09e3` | — |
| `lope-diccionario-mapeo.md` | 1.0-propuesta, base `70eb84c` | `8da952de085324830344efa6424e4eb398aa84d76744d4e3030c3859cea05591` |
| `lope-identidad-conciliacion.md` | 1.0-propuesta, base `70eb84c` | `8c053cd61c832a267ca1a334532d8f77baaf5ee79c21d8728f48500660e2f027` |
| `lope-modelo-ddl-propuesto.md` | 1.0-propuesta, base `70eb84c` | `587622e1079a669d7273edfcfb5f2f4ef7f3f4d02f4b7634761328950f8342f4` |
| `lope-plan-migracion-validacion.md` | 1.0-propuesta, base `70eb84c` | `511758c12d010a868780da98b069b1778fe8d98aaf527c14124b3297b6928575` |
| `ENTREGA_FINAL_DATOS_IA.md` | 1.0 | `c63d8285be155add70f3754567c83d1b14dd6016d1bddabc540f80d788185a5c` |
| `ENTREGA_CARGADOR.md` | informe de inspección | `91cc379dcd15832fb31b728c0f2b9ac3a43416ee327f6db50e16e66f8cb09820` |

Contratos contrastados: `docs/integracion/contrato-dominio-etl-plataforma.md`, `contrato-evaluacion-alertas-piloto.md`, `contrato-servicios-ml-rag.md`, `plan-piloto-lope-acceso-integracion.md`, evidencia en `docs/verificaciones/`.

## Matriz de revisión

| Tema | Acuerdo vigente | Implementación comprobada | Propuesta pendiente | Decisión humana requerida |
|---|---|---|---|---|
| Entidades de dominio | `cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias` | `tools/lope_import/promote.py::ENTITY_TABLES`, `backend/app/services/publication.py` y pull v1/v2 `PULL_ENTITY_NAMES` | Ninguna sobre el conjunto | No |
| `parto_crias` | Se transporta como filas con identidad estable; no como un `origen_rol` suelto | `UNIQUE(parto_id,cuy_id)` y `UNIQUE(cuy_id)` en PostgreSQL y en SQLite de Trabajo; `work.sync.pull.validation.ts` valida el par | Vincular crías reales a partos reales sigue sin decidirse | **Sí**: revisor técnico, con evidencia por fila |
| Replay e idempotencia | Mismo `lote_id`; clave global `(huella_archivo, parser_version, mapeo_version)`; identidad no reutilizable en otro ámbito | `importacion_lotes` con UNIQUE de tres columnas y `scope_id` (0009); pruebas de replay y rechazo en otro ámbito | No | No |
| Transacción | Una sola exterior: dominio + `publicar_cambios` + confirmación del lote | `promote.py` usa la conexión prestada; `publicar_cambios` no hace commit propio; rollback verificado | No | No |
| Versiones | Primera publicación 1; corrección efectiva +1; no-op sin historial duplicado | Cubierto por `test_manifest_promotion.py` y evidencia sintética | No | No |
| Datos faltantes | NULL conservado; nunca cero ni hecho confirmado | `adapt.py` deja `null` y `decisions.py` exige `after` con campos completos solo para ACEPTADO | Catálogos y códigos (R, eventos, AB) siguen abiertos | **Sí**: significado de `R`, catálogo de eventos, fuente de abortos, fuente de peso de monta |
| Cargador RF | Debe verificar SHA-256 antes de deserializar; reglas principales sobre el modelo | `ml/model/artifact.py::load_verified_model` + `backend/app/services/ml.py::load_candidate_model`; `ml/tests` y `backend/tests` en verde según handoff | Validación ciega con expertos | **Sí**: conjunto ciego, revisor y aceptación experta |
| RAG | Umbral calibrado con otro conjunto; procedencia incompleta | Evaluación entregada: 17 válidas, 10 fuera de corpus, 3 en dominio sin respuesta; abstención 7/10 y 0/3 | Procedencia de preguntas y recalibración | **Sí**: decidir si se ajusta el criterio de abstención en dominio sin respuesta |
| Carga real | Compuertas: revisor, decisiones, destino/ámbito, dry-run, respaldo, autorización explícita | `docs/operacion/carga-lope-piloto.md` ensayado con sintéticos; `decisiones-pendientes-*.json` sin aceptaciones | Dry-run real a revisar | **Sí**: Oskar autoriza la promoción concreta; revisor técnico firma correspondencias |

## Contradicciones revisadas

No quedan contradicciones técnicas verificables entre los cuatro documentos actualizados y el código/migraciones revisados: los documentos usan `CONFIRMADO` con fuente, `PROPUESTO` y `PENDIENTE`, y conservan el registro de aprobación vacío. La discrepancia documentada de unicidad entre `cuyes.codigo_identificacion` central y el esquema local sigue marcada como pendiente de resolución con evidencia autorizada: no se cambió el DDL para "alinear" documentos.

Las cifras del informe RF (2256 leídas, 805 usadas, 275 grupos por madre) coinciden con `ENTREGA_FINAL_DATOS_IA.md`; el hash del artefacto coincide con el comunicado y se verá en el bloque 2 antes de deserializar. No se citan métricas como aprobación experta.

## Borrador de aprobación documental — pendiente de envío por Oskar

> Asunto: revisión de documentos Lope v1.0-propuesta (borrador; no enviado)
>
> He revisado sobre `origin/dev` `23508b5` los documentos `docs/datos/lope-*.md` en su versión 1.0-propuesta (commit base `70eb84c`, hashes registrados en `docs/verificaciones/revision-entrega-diery-final.md`), junto con `ml/handoff/ENTREGA_FINAL_DATOS_IA.md` y `ENTREGA_CARGADOR.md`.
>
> Confirmo que describen el flujo implementado: cinco entidades, `parto_crias` con identidad estable, replay por `lote_id` y clave global, una transacción, versiones 1/+1/no-op y conservación de NULL. Apruebo **el diseño documentado en esa versión**, sin aprobar correspondencias reales ni autorizar cargas.
>
> Quedan fuera de esta aprobación, y requieren decisión explícita: revisor técnico, vínculos reales de `parto_crias`, significado de `R`, catálogo de eventos, fuente de abortos y peso de monta, validación experta ciega, procedencia de preguntas RAG y dry-run/respaldo de la carga real.
>
> [Firma de Oskar — NO emitida en este documento]
