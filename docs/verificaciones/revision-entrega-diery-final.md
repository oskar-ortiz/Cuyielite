# Revisión de la entrega final de Diery y contratos vigentes (2026-11-17)

Estado: **revisión técnica terminada; aprobación documental pendiente**. No se atribuye aprobación a Oskar ni al Centro Lope sobre esta versión.

## Versiones revisadas

| Elemento | Versión / commit | SHA-256 del archivo |
|---|---|---|
| Árbol revisado | `origin/dev` `943947b` (PR #169 fusionado); base original de la entrega `23508b5` / `70eb84c` | — |
| Entrega Datos/IA | `f03f0ad` vía PR #163 (merge `2c1512c`) | — |
| Validación RAG | `67e09e3` | — |
| `lope-diccionario-mapeo.md` | 1.0-propuesta, base `70eb84c` | `8da952de085324830344efa6424e4eb398aa84d76744d4e3030c3859cea05591` |
| `lope-identidad-conciliacion.md` | 1.0-propuesta, base `70eb84c` | `8c053cd61c832a267ca1a334532d8f77baaf5ee79c21d8728f48500660e2f027` |
| `lope-modelo-ddl-propuesto.md` | 1.0-propuesta, base `70eb84c`; **corrección documental de unicidad en esta entrega** (hash final) | `9df87433326834e9e39894d607e9c1884608a47fa87551819e924b25da153c0f` |
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

Los documentos usan `CONFIRMADO` con fuente, `PROPUESTO` y `PENDIENTE`, y conservan el registro de aprobación vacío. La única contradicción técnica verificable era la descripción de `cuyes.codigo_identificacion` como UNIQUE en PostgreSQL; quedó corregida en `docs/verificaciones/piloto-paridad-documentacion.md` §5 y en el bullet de `lope-modelo-ddl-propuesto.md` citado arriba. No se cambió DDL, índices, migraciones ni datos. La parte de dominio de D10 sigue pendiente: aclarar la restricción no resuelve vínculos reales.

### D10 — evidencia técnica disponible

| Elemento | Ruta y líneas verificadas |
|---|---|
| Bootstrap histórico | `db/ddl/central/002_nucleo.sql:27` — `codigo_identificacion VARCHAR(50) NOT NULL UNIQUE` |
| Migración vigorante | `db/migrations/central/0001_lope_domain.sql:46-47` — `DROP CONSTRAINT ... cuyes_codigo_identificacion_key` y `CREATE INDEX idx_cuyes_codigo ...` (no único) |
| Base efectiva del piloto | Consulta de solo lectura: `cuyes_pkey PRIMARY KEY (id)`, `idx_cuyes_codigo CREATE INDEX ... btree (codigo_identificacion)`, columna `NOT NULL` sin default; sin UNIQUE sobre la chapa |
| SQLite efectivo | `client/src/data/work.schema.ts` — `codigo_identificacion TEXT NOT NULL` sin UNIQUE; regresión en `client/src/data/work.migration.test.ts` |
| Interpretación | La chapa puede repetirse; la identidad es `id`. Repetir código no prueba identidad ni autoriza fusión |

El archivo `docs/datos/lope-decisiones-parto-crias.md` con D1–D14 **no está presente en `origin/dev` 943947b**. Para Diery: completar allí la parte técnica de D10 con estas rutas/líneas y conservar la decisión de dominio como pendiente. Hasta entonces, la matriz canónica `docs/verificaciones/matriz-carga-real-lope.md` usa los temas D1–D14 del contexto del encargo y marca su significado como **pendiente de verificación en el archivo de decisiones**.

### Procedencia de `R`

Oskar aportó la aclaración **`R` = REEMPLAZO**. Se registra con esa procedencia; **no** es una confirmación institucional del Centro Lope y no debe atribuírsele a él. De `R` no se deduce enfermedad, muerte, venta ni descarte: el motivo concreto de salida y su fuente siguen pendientes de evidencia y decisión de dominio. El contrato `docs/integracion/contrato-dominio-etl-plataforma.md` atribuye antes la confirmación a Diery; se conserva esa línea como parte del contrato y se aclara aquí la procedencia informada para esta revisión.

Las cifras del informe RF (2256 leídas, 805 usadas, 275 grupos por madre) coinciden con `ENTREGA_FINAL_DATOS_IA.md`; el hash del artefacto coincide con el comunicado y se verá en el bloque 2 antes de deserializar. No se citan métricas como aprobación experta.

## Borrador de aprobación documental — pendiente de envío por Oskar

> Asunto: revisión de documentos Lope v1.0-propuesta (borrador; no enviado)
>
> He revisado la versión 1.0-propuesta de `docs/datos/lope-diccionario-mapeo.md` (`8da952de…05591`), `lope-identidad-conciliacion.md` (`8c053cd6…0e2f027`), `lope-modelo-ddl-propuesto.md` (`9df87433…da153c0f`, con la corrección de unicidad documentada en `docs/verificaciones/piloto-paridad-documentacion.md` §5) y `lope-plan-migracion-validacion.md` (`511758c1…b6928575`), sobre `origin/dev` `943947b`, junto con `ml/handoff/ENTREGA_FINAL_DATOS_IA.md` y `ENTREGA_CARGADOR.md`.
>
> La revisión técnica está **COMPLETADA**. Conforme al diseño revisado: cinco entidades de dominio; `parto_crias` como filas con `id` estable, referencias y unicidad vigente en el esquema; transporte ya implementado, distinto de la aceptación de vínculos reales; replay con el mismo `lote_id` y clave global; rechazo de reutilización del lote en otro ámbito; una transacción exterior para dominio, `publicar_cambios` y lote; versión 1 en primera publicación, +1 en corrección efectiva y no-op sin historial duplicado; NULL distinto de cero; aceptaciones solo con decisión y evidencia; categorías y alertas conforme a reglas/evidencia aprobadas; consultas RF informativas sin persistencia oficial.
>
> Reservas: revisor técnico/de dominio por designar; D1–D10 de vínculos y evidencia de registros reales; catálogo de eventos, abortos y peso de monta; validación experta ciega; procedencia RAG. `R = REEMPLAZO` fue aclarado por Oskar y no equivale a confirmación del Centro Lope ni a una causa de salida.
>
> Esta conformidad técnica **no acepta correspondencias reales**, **no sustituye la validación zootécnica** y **no autoriza por sí sola una promoción de datos**. La carga requiere además lo registrado en `docs/verificaciones/matriz-carga-real-lope.md`.
>
> [Texto listo para emisión por Oskar — aprobación formal PENDIENTE; sin firma, fecha ni estado APROBADO registrados aquí]
