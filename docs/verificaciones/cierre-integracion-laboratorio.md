# Evidencia: cierre de integración en laboratorio (2026-11-16)

Estado: **PARCIAL Y EXPLÍCITO**. Windows verificado; recorrido Android **no ejecutado** por memoria insuficiente del host; ETL de plataforma verificado con lotes sintéticos; ETL real, RF y RAG no verificables con lo disponible. Sin datos reales, sin despliegue y sin merge.

Base: `dev` `c44415b` (PR #146 fusionado). Rama de esta entrega: `test/evaluacion-alertas-android`.

## 1. Inventario real de entregas

| Componente | Qué existe en el checkout | ¿Ejecutable? | Veredicto |
| --- | --- | --- | --- |
| ETL de features (`ml/etl/`) | `config`, `extract`, `transform`, `load`; lee los Excel de `db/raw_Lope` | Solo con los Excel reales | **No ejecutado**: prohibido usar datos reales. Es librería, no CLI |
| Orquestador de promoción (`tools/lope_import/`) | CLI con manifiesto, `promote_batch` y `publicar_con_d1` | Sí, con manifiesto sintético | **Verificado** (plataforma, no ETL de Diery) |
| Random Forest (`ml/model/`) | `train.py`, `evaluate.py`, `dataset.py` | Entrenamiento, no inferencia | Artefacto **no versionado** |
| Metadata RF (`ml/models/metadata.json`) | `dataset_sha256 9268ba03…`, métricas de experimentos | — | Es un registro de experimento, **no un modelo** |
| RAG (`rag/src/`, `rag/ask.py`) | chunk, embed, index, retrieve, generate | Requiere corpus + venv + pgvector | **No verificado**: falta corpus autorizado y entorno |

Lo que debe entregar Diery para cerrar la integración real:

1. Artefacto RF autorizado (`.joblib`) con versión y hash, y la ruta de configuración (`CUYIELITE_RF_MODEL_PATH`).
2. Corpus autorizado para RAG y decisión explícita de indexarlo en laboratorio, con el modelo de embeddings permitido.
3. Confirmación de si `ml/etl` debe ejecutarse contra los Excel reales desde el orquestador, o si la promoción se hace siempre por manifiesto.

## 2. Matriz de escenarios

| Escenario | Plataforma | Datos | Resultado |
| --- | --- | --- | --- |
| Declarar/revisar evidencia y evaluar reproductora | Windows | Sintéticos | HECHO |
| Provisional por dos abortos (ficha tras reabrir) | Windows | Sintéticos | HECHO |
| Cuarto parto con fecha y sin fecha | Windows | Sintéticos | HECHO |
| Viewer sin escritura | Windows | Sintéticos | HECHO |
| Demo separada | Windows | Sintéticos | HECHO |
| Mismos escenarios en Android | Android | Sintéticos | **NO EJECUTADO (memoria del host)** |
| Dry-run, rollback, idempotencia, D1 | PostgreSQL temporal | Sintéticos | HECHO |
| Evidencia declarada no habilita / revisada habilita | PostgreSQL temporal | Sintéticos | HECHO |
| RF real | — | — | NO EJECUTADO (sin artefacto) |
| RAG real | — | — | NO EJECUTADO (sin corpus/entorno) |
| RAG indisponibilidad | Dobles de prueba | — | HECHO |

## 3. Windows

- No hay instalación en Registro ni en `Programs`: el mecanismo es la carpeta portable `client/electron/dist/win-unpacked`.
- `win-unpacked` fue construido a las 05:05 y el APK a las 04:34, ambos **posteriores** al commit `6d433c7` (04:20): los artefactos corresponden al código vigente y no se reconstruyeron en esta sesión.
- El perfil real (`%APPDATA%\CuyiElite`) fue restaurado en la sesión anterior (147456 bytes, 12/11/2026) y la app reabre con él.
- El recorrido funcional (provisional, confirmada, sin fecha, viewer, Demo) tiene evidencia de la sesión anterior y no se repitió.

## 4. Android (Pixel_36) — NO EJECUTADO

Intento realizado el 2026-11-16 sobre `dev` `c44415b`:

1. JDK 21 está instalado (`C:\Program Files\Zulu\zulu-21`), por lo que el bloqueo de toolchain de la sesión anterior **ya no aplica**.
2. El emulador estaba encendido con el user 0 activo. Se cambió al user 10 `LabCuyi`, se inició la app, se configuró `adb reverse tcp:8000` y el forward al WebView.
3. Se preparó PostgreSQL temporal aislado (`cuyelite_android_lab`, puerto 55444) con ámbito e identidades sintéticas, tres animales publicados por D1 (4 partos con fecha, 4 partos sin fecha, 1 parto) y un segundo ámbito con `admin-otro` para el caso de desajuste.
4. **Memoria del host: 0,65–0,81 GB libres**, muy por debajo del mínimo de 3 GB definido para trabajo nativo.
5. Resultado: la app mostró la pantalla de acceso, pero **ningún `POST /auth/login` llegó al backend** (solo health checks). La sesión de CDP dejó de responder (`Runtime.evaluate` quedó sin resolver) y el script abortó en el primer paso del recorrido.
6. No se ejecutó ninguna acción de negocio: no se declaró evidencia, no se evaluó, no se sincronizó y no se modificó dato alguno.

Estado dejado:

- Emulador devuelto al user 0; datos del user 0 verificados (`pocSQLite.db` y `trabajoSQLite.db` presentes).
- `adb forward` y `adb reverse` liberados, backend detenido y contenedor `cuyelite-and-lab` eliminado.
- El user 10 `LabCuyi` se conserva (no se elimina por prohibición expresa).

Para retomar Android hace falta liberar al menos 3 GB en el host (sin cerrar procesos del usuario) y repetir el recorrido; la app, el APK y el emulador ya están listos.

## 5. Verificación ejecutada en esta entrega

No se ejecutaron suites nuevas: no hubo cambios de código. Se reutiliza la evidencia de la entrega anterior, que sigue vigente sobre el mismo código de aplicación:

```text
pytest tools/lope_import/tests tools/db_migrate/tests   55 passed
pytest backend/tests/test_ml_endpoints.py                10 passed
vitest (suite de sincronización dirigida)               18 passed
```

El código agregado entre `6d433c7` y `c44415b` es únicamente el merge; los artefactos nativos ya lo incluyen.

## 6. Límites

- No se ejecutó el ETL de Diery sobre Excel reales, ni el RF real, ni el RAG real.
- No se completó el recorrido Android por memoria del host; queda pendiente y medido.
- No se usaron datos reales, tokens persistentes ni recursos de producción.
