# Evidencia: cierre de integración en laboratorio (2026-11-16)

Estado: **recorrido Android de evaluación y alertas verificado en laboratorio aislado**. Windows verificado. ETL de plataforma verificado con lotes sintéticos. ETL real, RF y RAG siguen sin verificarse por falta de entregas de Diery. Sin datos reales, sin despliegue y sin merge.

Base: `dev` `d89204a` (PR #147 fusionado). Rama de esta entrega: `test/recorrido-android-laboratorio`.

## 1. Inventario real de entregas

| Componente | Qué existe en el checkout | ¿Ejecutable? | Veredicto |
| --- | --- | --- | --- |
| ETL de features (`ml/etl/`) | `config`, `extract`, `transform`, `load`; lee los Excel de `db/raw_Lope` | Solo con los Excel reales | **No ejecutado**: prohibido usar datos reales. Es librería, no CLI |
| Orquestador de promoción (`tools/lope_import/`) | CLI con manifiesto, `promote_batch` y `publicar_con_d1` | Sí, con manifiesto sintético | **Verificado** (plataforma, no ETL de Diery) |
| Random Forest (`ml/model/`) | `train.py`, `evaluate.py`, `dataset.py` | Entrenamiento, no inferencia | Artefacto **no versionado** |
| Metadata RF (`ml/models/metadata.json`) | `dataset_sha256 9268ba03…`, métricas de experimentos | — | Es un registro de experimento, **no un modelo** |
| RAG (`rag/src/`, `rag/ask.py`) | chunk, embed, index, retrieve, generate | Requiere corpus + venv + pgvector | **No verificado**: falta corpus autorizado y entorno |

Pendiente de Diery: artefacto RF con hash, corpus RAG autorizado y decisión sobre ejecutar `ml/etl` con los Excel reales.

## 2. Matriz de escenarios

| # | Escenario | Plataforma | Datos | Resultado |
| --- | --- | --- | --- | --- |
| 1 | Login admin y descarga de animales publicados por D1 | Android | Sintéticos | **HECHO** |
| 2 | Evidencia DECLARADA no habilita evaluación oficial | Android | Sintéticos | **HECHO** |
| 3 | Revisión autorizada + evaluación | Android | Sintéticos | **HECHO** |
| 4 | Dos abortos → PROVISIONAL, sin categoría ni alerta | Android | Sintéticos | **HECHO** |
| 5 | Cuarto parto con fecha → DESCARTE y vencimiento +20 días | Android | Sintéticos | **HECHO** |
| 6 | Cuarto parto sin fecha → sin vencimiento inventado | Android | Sintéticos | **HECHO** |
| 7 | Sync + ficha con fundamentos, categoría y alertas | Android | Sintéticos | **HECHO** |
| 8 | Idempotencia (reevaluar y resincronizar) | Android | Sintéticos | **HECHO** |
| 9 | Force-stop + reapertura (sesión y datos) | Android | Sintéticos | **HECHO** |
| 10 | Viewer: consulta y descarga, sin escritura | Android | Sintéticos | **HECHO** |
| 11 | Desajuste de ámbito dentro del laboratorio | Android | Sintéticos | **NO ALCANZABLE por UI** (ver §4.3) |
| 12 | Demo separada | Android | Sintéticos | **HECHO** |
| — | Mismos escenarios | Windows | Sintéticos | HECHO (evidencia previa) |
| — | Dry-run, rollback, idempotencia, D1 | PostgreSQL temporal | Sintéticos | HECHO |
| — | RF real / RAG real | — | — | NO EJECUTADO |

## 3. Windows

- No hay instalación en Registro: el mecanismo es la carpeta portable `client/electron/dist/win-unpacked`.
- `win-unpacked` (05:05) y el APK (04:34) son posteriores al commit `6d433c7` (04:20); no se reconstruyeron en esta sesión.
- El perfil real se conserva y la app reabre con él.
- El recorrido funcional de evaluación ya tiene evidencia previa y no se repitió.

## 4. Android (Pixel_36) — VERIFICADO

### 4.1 Montaje

- Mismo Pixel_36, user 0, sin `wipe-data` ni `pm clear`. El user 10 `LabCuyi` se conserva detenido.
- Build con **JDK 21** (`C:\Program Files\Zulu\zulu-21`) y una **variante de laboratorio** que añade el sufijo `.lab` solo cuando se pasa `-PlabAppId=true`:

```bash
cd client
VITE_AUTH_MODE=pilot VITE_API_BASE_URL=http://127.0.0.1:8000 npm run build
npx cap copy android
cd android
JAVA_HOME=<jdk-21> ANDROID_HOME=<sdk> ./gradlew assembleDebug -PlabAppId=true
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

- El paquete resultante es `co.ucc.cuyielite.lab`: **almacenamiento propio** (SQLite y Keystore por paquete/UID), así que no toca la instalación habitual `co.ucc.cuyielite`.
- El identificador de la app habitual no se modificó.
- Backend y PostgreSQL temporales (`cuyelite_android_lab2`) con ámbito e identidades sintéticas; tres animales publicados por `publicar_cambios` y un cuarto añadido para el caso de evidencia sin revisar.
- `adb reverse tcp:8000` y forward al WebView; interacción exclusivamente por UI.

### 4.2 Resultados observados

| Caso | Evidencia |
| --- | --- |
| Login admin y pull | Sesión `admin-lab`, ámbito `e51b429b…`, pull v1/v2/v3 y "Sincronización completada" |
| Declarada no habilita | Chip **Evidencia sin revisar**; sin categoría persistida |
| Revisión + evaluación | Evidencia `REVISADA`; evaluación pasa a `DEFINITIVA` |
| Dos abortos | Estado **Provisional**, `REVISAR\|PROPUESTA`, "categoría no modificada" |
| Cuarto parto con fecha | **Confirmada**; ficha con "Descarte recomendado" y "Fecha límite sugerida: 2026-01-30" |
| Cuarto parto sin fecha | **Confirmada**; ficha con "Fecha del cuarto parto pendiente de validar" y **sin** fecha límite |
| Ficha provisional | Chip Provisional y "Sin recomendaciones sincronizadas" |
| Idempotencia | Una sola ocurrencia de "Descarte recomendado" tras reevaluar y resincronizar |
| Force-stop + reapertura | Sesión `admin-lab` restaurada y datos/alertas visibles |
| Viewer | Sin botones de declarar/revisar/evaluar; "solo puede consultar"; sincroniza |
| Demo | "Datos de demostración" visible y separada de Trabajo |

Comprobación de solo lectura contra la base temporal:

```text
LAB-CONF      DESCARTE  DEFINITIVA  CONFIRMADO  v2   alerta partos_reproductora_descarte  causa 2026-01-10  límite 2026-01-30
LAB-SIN-FECHA DESCARTE  DEFINITIVA  CONFIRMADO  v2   alerta partos_reproductora_descarte  causa NULL        límite NULL
LAB-NORMAL    NORMAL    DEFINITIVA  CONFIRMADO  v2   sin alertas
LAB-PROV      NULL      NULL        NULL         v1   sin alertas
```

`v1` en LAB-PROV es la publicación inicial por D1; la evaluación provisional **no** incrementó versión ni escribió categoría.

### 4.3 Caso no alcanzable: desajuste de ámbito por UI

Al intentar iniciar sesión con una cuenta de **otro ámbito** en el mismo dispositivo, el backend responde `403 DEVICE_NOT_AUTHORIZED` en `/auth/login`: el dispositivo ya está ligado a un ámbito y no se permite reutilizarlo en otro. Por eso la pantalla de desajuste local no es alcanzable por UI en este montaje, y el guard del servidor es más estricto que el del cliente.

La ruta de UI sigue cubierta por pruebas automatizadas (`work.sync.ui.test.ts` y `SincronizacionTrabajo.test.tsx`, incluidas en las 18 pruebas dirigidas de sincronización). No se manipuló `scope_id` ni la base local para forzar el caso.

### 4.4 Correcciones

No apareció ningún defecto reproducible de producto. El único cambio de código es la variante de laboratorio en `client/android/app/build.gradle`, opt-in y sin efecto en la app habitual.

## 5. Verificación ejecutada

- Build Android de la variante de laboratorio con JDK 21: **BUILD SUCCESSFUL**.
- Suites: no hubo cambios de producto, así que se reutiliza la evidencia vigente sobre el mismo código (55 pruebas de ETL/migraciones, 10 de endpoints ML/RAG, 18 de sincronización dirigida).
- `git diff --check` limpio antes del commit.

## 6. Limpieza

- Se desinstaló **solo** `co.ucc.cuyielite.lab`. La app habitual `co.ucc.cuyielite` y sus tres bases siguen intactas (`cuyieliteSQLite.db` 28672, `pocSQLite.db` 12288, `trabajoSQLite.db` 163840).
- `adb forward` y `adb reverse` liberados; backend detenido; contenedor `cuyelite_android_lab2` eliminado.
- Pixel_36 queda encendido en el user 0, como estaba al comenzar.

## 7. Límites

- RF, RAG y ETL con datos reales siguen esperando entregas de Diery; no se ejecutaron.
- El caso de desajuste de ámbito no se ejecutó por UI (bloqueado por diseño en el backend).
