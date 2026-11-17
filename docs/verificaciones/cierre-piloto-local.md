# Cierre del alcance del piloto local (2026-11-17)

Estado general: **piloto local operativo con aplicaciones reales comprobadas en los extremos que el entorno permitió; recorrido nativo Android completo NO verificado en esta corrida**. La carga real de datos Lope sigue pendiente de autorización humana.

Base: `origin/dev` `23508b5` (PR #165). Rama `feat/cierre-piloto-local`.

## Bloque 1 — Revisión documental y contratos

**Realizado.** Revisión de los cuatro `docs/datos/lope-*.md` v1.0-propuesta (commit base `70eb84c`), `ml/handoff/ENTREGA_FINAL_DATOS_IA.md`, `ENTREGA_CARGADOR.md` y los contratos de `docs/integracion/` contra migraciones, esquema efectivo y código. Matriz en `docs/verificaciones/revision-entrega-diery-final.md` con hashes y commit revisado.

Los documentos de Diery ya no contienen las contradicciones de la revisión anterior: distinguen `CONFIRMADO`/`PROPUESTO`/`PENDIENTE` y dejan el registro de aprobación vacío. Se conservan los cinco entidades, `parto_crias` con identidad estable, replay por `lote_id` y clave global, identidad no reutilizable en otro ámbito, transacción única, versiones 1/+1/no-op y NULL conservado.

**Limitación / pendiente:** aprobación documental no emitida; siguen abiertos revisor técnico, vínculos reales de `parto_crias`, significado de `R`, catálogo de eventos, fuente de abortos y peso de monta, validación experta ciega, procedencia de preguntas RAG y dry-run real. Borrador de aprobación listo, **no enviado**.

## Bloque 2 — RF real, cargador, endpoints y apps

**Realizado.** Artefacto privado verificado antes de deserializar:

```text
SHA-256 artefacto = 744349c43b4781dc5acef88e3db9dd6522d7b76c26a3f91e82d578792d6adce9
Coincide con comunicado y con metadata.model_sha256: True
Cargador load_verified_model -> Pipeline[preprocessor, classifier]
Features: nupar_madre, tcnv, peso_nacimiento_g, ojos
Clases: ELITE, NORMAL | RandomForestClassifier(n_estimators=100)
Sin CUYIELITE_RF_MODEL_PATH -> None (modelo no disponible)
Hash modificado -> RF_MODEL_SHA256_MISMATCH (sin deserializar)
```

El artefacto no se añadió a Git. Se configuró en `.env` privado y en su copia restringida. Se preparó una base de laboratorio aislada (`cuyielite_rf_lab`) con dos animales sintéticos publicados por D1 (versiones 1, secuencias 1 y 2) y un backend dedicado en `127.0.0.1:8001`.

Endpoints reales, con JWT de la cuenta de laboratorio:

| Caso | Resultado |
|---|---|
| Login admin y viewer | 200 |
| Candidata con destete 15 d y peso 950 g | 200, `ELITE`, `CONFIRMADO`, `apoyo_modelo` con `ELITE/NORMAL` que suman 1.0 |
| Candidata con datos faltantes | 200, `NORMAL`, `REVISAR`, `apoyo_modelo: null` |
| Hembra con cuarto parto | 200, `DESCARTE`, motivo `ciclo completo` |
| Viewer consulta | 200, sin escritura |
| Sin token | 401 |

Las reglas fijan la clase principal; el RF aparece solo como `apoyo_modelo` separado. No se publicó ninguna probabilidad como categoría oficial. No se reentrenó ni sustituyó el modelo.

**Limitación / pendiente:** validación experta ciega no realizada; etiquetas derivadas de reglas, no de experto. 2.256 filas leídas, 805 usadas, 275 grupos por código de madre; sin deduplicación entre archivos ni identidad global; el RF no excluye las 18 identidades en conflicto del ETL. Cifras verificadas en `ml/models/metadata.json` y `ENTREGA_FINAL_DATOS_IA.md`. La visualización nativa de RF no quedó observada en esta corrida (sin.UI Android estable y sin observer Windows nuevo); la cobertura automatizada de presentación existente no se presenta como UI.

## Bloque 3 — Pertinencia y estabilidad del RAG

**Defecto técnico reproducible corregido.** `rag.src.retrieve.consultar` construía un `E5Embedder()` nuevo por petición, recargando los pesos en cada consulta. Con tres preguntas consecutivas se agotó la memoria y el backend respondió 503. Se añadió `get_embedder()` con una instancia compartida por proceso y modelo, y `reset_embedder_for_tests()`; `consultar` usa el embedder compartido cuando no se inyecta uno. Regresión en `rag/tests/test_embed.py` (reutilización, cambio de modelo y reset). Suite RAG: **39 passed, 1 skipped**.

Tras reiniciar el backend, las tres preguntas consecutivas devolvieron respuesta sin 503:

| Pregunta | Observación HTTP |
|---|---|
| Duración de la gestación | Fuentes `p. 28, 85, 26, 80, 25`; el texto extractivo mostrado empieza por `p. 28` (identificación), aunque `p. 26` contiene «La gestación dura entre 63 y 70 días» y aparece como tercera fuente |
| Vitamina C | Fuentes `p. 31, 28, 85, 32, 12`; el fragmento mostrado describe digestión/cecotrofia, no la tabla de requerimientos de `p. 32` |
| Impresora Wi-Fi | Abstención: «No encontré esta información en los manuales.», `fuentes: []` |

**Verificación del PDF:** el manual sí contiene la duración (p. 26) y los requerimientos de vitamina C (p. 32, tabla; p. 42 suplemento). Con eso, **no era una pregunta sin respuesta en corpus**: el problema es de selección/presentación del fragmento, no de ausencia. No se ajustó el umbral ni se cambió la generación extractiva para forzar estas respuestas.

**Limitación abierta:** la recuperación devuelve fuentes reales pero el texto extractivo prioriza fragmentos poco pertinentes. Tener HTTP 200 y fuentes correctas **no** acredita que la respuesta sea útil. La UI Android ya había mostrado la abstención de impresora Wi-Fi (PR #165). No se marca este criterio como cerrado en las dos preguntas de dominio.

## Bloque 4 — Preparación y carga real controlada

**Preparación terminada previamente y contrastada:** inventario y hashes en `piloto-local\entradas\hashes.txt`, `parser_version=0.1.0`/`mapeo_version=0.1.0`, 3.428 propuestas `PENDIENTE` con 11 y 10 celdas `#VALUE!` visibles, lote estable por huella, ámbito existente, rol ETL separado, respaldo y restauración comprobados, procedimiento en `docs/operacion/carga-lope-piloto.md`. No se marcó ninguna correspondencia como aceptada.

**Bloqueo humano único y concreto:** no hay revisor técnico designado ni decisiones aceptadas con evidencia; tampoco hay autorización explícita de Oskar para una promoción concreta. Sin esos insumos no se ejecuta la carga real. No se promovió ningún dato real.

## Bloque 5 — Cierre del piloto Windows/Android

**Cerrado en la medida observada.** Evidencia previa reutilizada por código equivalente: Windows/Electron con RAG real y sesión de piloto; Android del PR #165 con admin, sincronización vacía v1/v2/v3, consultas reales, abstención de impresora Wi-Fi, restauración visible de sesión y viewer solo consulta. En esta corrida se observó la app `.lab` en primer plano con la abstención de impresora Wi-Fi visible en pantalla y `fuentes: []`.

**No verificado en esta corrida:** RF en pantalla nativa, consulta con cita vitamina C/gestación en UI, cierre/reapertura con comprobación de cifrado, indisponibilidad y recuperación de outbox con el build final. RAM disponible cayó a 107–224 MB y commit a 1,04–3,34 GiB; no se forzó el emulador ni se repitieron intentos. La reapertura observada en PR #165 no acredita por sí sola una nueva revisión del cifrado.

**Pendiente:** Oskar debe liberar memoria y repetir los casos nativos; también debe designar revisor y autorizar la carga. Diery debe completar procedencia de preguntas y validación experta.

## Pruebas ejecutadas

```text
rag: 39 passed, 1 skipped   (cambio en embedder/shared)
test_embed/test_retrieve/test_citations: 17 passed
Endpoints RF sobre base aislada: 7 comprobaciones descritas arriba
Cargador RF: hash válido/invalido/ausente y precedencia de reglas (handoff + verificación local)
```

No se repitieron suites completas sin cambios que lo justificaran.
