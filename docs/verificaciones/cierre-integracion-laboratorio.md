# Evidencia: cierre de integración en laboratorio (2026-11-16, posterior a #144)

Estado: **PARCIAL Y EXPLÍCITO**. Windows verificado; Android bloqueado por toolchain; ETL de plataforma verificado con lotes sintéticos; ETL real, RF y RAG no verificables con lo disponible. Sin datos reales, sin despliegue y sin merge.

Base: `dev` `35a2826` (PR #144 fusionado). Rama de esta entrega: `test/integracion-piloto-laboratorio`.

## 1. Inventario real de entregas

| Componente | Qué existe en el checkout | ¿Ejecutable? | Veredicto |
| --- | --- | --- | --- |
| ETL de features (`ml/etl/`) | `config`, `extract`, `transform`, `load`; lee los Excel de `db/raw_Lope` | Solo con los Excel reales | **No ejecutado**: prohibido usar datos reales. Es librería, no CLI |
| Orquestador de promoción (`tools/lope_import/`) | CLI con manifiesto, `promote_batch` y `publicar_con_d1` | Sí, con manifiesto sintético | **Verificado** (plataforma, no ETL de Diery) |
| Random Forest (`ml/model/`) | `train.py`, `evaluate.py`, `dataset.py` | Entrenamiento, no inferencia | Artefacto **no versionado** |
| Metadata RF (`ml/models/metadata.json`) | `dataset_sha256 9268ba03…`, métricas de experimentos | — | Es un registro de experimento, **no un modelo** |
| RAG (`rag/src/`, `rag/ask.py`) | chunk, embed, index, retrieve, generate | Requiere corpus + venv + pgvector | **No verificado**: falta corpus autorizado y entorno |
| Migración RAG | `db/migrations/central/0003_rag_e5_embeddings.sql` | Sí | Esquema disponible |

Lo que debe entregar Diery para cerrar la integración real:

1. Artefacto RF autorizado (`.joblib`) con versión y hash, más la ruta de configuración (`CUYIELITE_RF_MODEL_PATH`).
2. Corpus autorizado para RAG (el manual del SENA) y decisión explícita de indexarlo en laboratorio, con el modelo de embeddings permitido.
3. Confirmación de si `ml/etl` debe ejecutarse contra los Excel reales desde el orquestador, o si la promoción se hace siempre por manifiesto.

## 2. Matriz de escenarios

| Escenario | Plataforma | Datos | Resultado |
| --- | --- | --- | --- |
| Declarar/revisar evidencia y evaluar reproductora | Windows | Sintéticos | HECHO |
| Provisional por dos abortos (ficha tras reabrir) | Windows | Sintéticos | HECHO |
| Cuarto parto con fecha y sin fecha | Windows | Sintéticos | HECHO |
| Viewer sin escritura | Windows | Sintéticos | HECHO |
| Demo separada | Windows | Sintéticos | HECHO |
| Mismos escenarios en Android | Android | — | **NO EJECUTADO (bloqueo de toolchain)** |
| Dry-run, rollback, idempotencia, D1 | PostgreSQL temporal | Sintéticos | HECHO |
| Evidencia declarada no habilita / revisada habilita | PostgreSQL temporal | Sintéticos | HECHO |
| RF real | — | — | NO EJECUTADO (sin artefacto) |
| RAG real | — | — | NO EJECUTADO (sin corpus/entorno) |
| RAG indisponibilidad | Dobles de prueba | — | HECHO (10 pruebas de endpoint) |

## 3. Windows

- No hay instalación en Registro ni en `Programs`: el mecanismo es la carpeta portable `client/electron/dist/win-unpacked`.
- Se reconstruyó desde `dev` `35a2826` (`build:electron`, `build:migration`, `sync:electron`, vendor y `electron-builder --dir`).
- El perfil real había quedado desplazado en la sesión anterior (`CuyiElite.real-backup-integral`). Se restauró: `trabajo.db` de 147456 bytes con fecha 12/11/2026 intacta.
- La app reabre con ese perfil y muestra la pantalla de acceso sin errores.
- El recorrido funcional (provisional, confirmada, sin fecha, viewer) se ejecutó en un perfil aislado con datos sintéticos y ya está documentado en la sección 1 de la evidencia previa.

## 4. Android (Pixel_36) — BLOQUEADO

Se intentó una instalación de prueba separada sin tocar los datos existentes:

1. Se agregó un `applicationIdSuffix` condicional en `build.gradle` para compilar una variante `.lab`; **se revirtió** porque el build falla en este entorno.
2. Causa del fallo de build: el JBR de Android Studio es **Java 25** y Gradle no puede compilar el script (`Unsupported class file major version 69`); con **Java 17** el build falla en `compileDebugJavaWithJavac` (`invalid source release: 21`) porque Capacitor 8 exige Java 21. **No hay JDK 21 instalado** y no se instalan dependencias sin autorización.
3. Alternativa probada: usuario secundario de Android (`pm create-user LabCuyi`). El paquete se instaló para el usuario 10, pero `am start` devolvió `Error type 3` y la actividad no abrió.
4. Se volvió al usuario 0 (`cmd activity switch-user 0`) y se verificó que los datos del Pixel siguen intactos: `cuyieliteSQLite.db` (28672, 03/11), `pocSQLite.db` (12288, 03/11) y `trabajoSQLite.db` (163840, 16/11).
5. **Efecto residual**: el usuario 10 `LabCuyi` quedó creado y `pm remove-user 10` falla mientras el sistema lo mantiene en ejecución. Requiere un reinicio del emulador para eliminarlo, y reiniciarlo estaba prohibido en esta tarea. Comando exacto para limpiar: `adb shell pm remove-user 10` tras reiniciar el emulador.

Para retomar Android hace falta una de estas dos cosas: un JDK 21 en el entorno, o autorización para reiniciar el emulador y limpiar el usuario 10.

## 5. ETL de plataforma y reglas

```text
pytest tools/lope_import/tests tools/db_migrate/tests   55 passed
pytest backend/tests/test_ml_endpoints.py                10 passed
```

Cubre promoción transaccional, dry-run, rollback total, idempotencia, publicación D1, migraciones y la ruta de indisponibilidad de ML/RAG. La prueba de integración de evidencia declarada/revisada vive en `backend/tests/test_evaluation_persistence.py`.

## 6. Límites

- No se ejecutó el ETL de Diery sobre Excel reales, ni el RF real, ni el RAG real.
- No se completó el recorrido Android.
- Las capturas y logs de esta sesión quedaron en el directorio temporal; no se versionan.
