# D7: verificación integral de la plataforma

Estado: **verificación automatizada ejecutada; Windows nativo verificado; Android verificado parcialmente por bloqueo de memoria. D7 no se declara completo.**

## Checks automatizados (2026-11-11, ejecutados en D7)

```powershell
cd client
npx vitest run --maxWorkers=1   # 36 archivos, 188 pruebas passed
npm run build                  # OK
npm run lint                   # OK
python -m pytest backend tools/db_migrate/tests -q   # 130 passed (PostgreSQL temporal)
```

Tareas pesadas secuenciales y con un worker para evitar el bloqueo de memoria que afectó a D6. Recursos PostgreSQL temporales eliminados.

## Matriz

| Criterio | Plataforma | Evidencia | Resultado | Pendiente / causa |
| --- | --- | --- | --- | --- |
| Publicación D1 y descarga D2 | Backend | Prueba integrada con PostgreSQL temporal | Pasa en suite 130 | No como recorrido nativo |
| Aplicación SQLite D3 | Cliente/Node | Pruebas de migración v4, apply e inbox | Pasa en suite 188 | No observada en app nativa |
| Pantallas D4 | Cliente | Pruebas y build | Pasa | Recorrido nativo no ejecutado |
| Cierre/reapertura local | Cliente | Pruebas de reapertura SQLite | Pasa automatizado | Reapertura de app nativa no ejecutada |
| Predicción D6 con reglas reales | Backend | Prueba de adaptador con `ml.prediccion` real | Pasa local con numpy/pandas | Endpoints con dobles; UI nativa no ejecutada |
| REVISAR y apoyo `null` | Cliente | Pruebas de UI | Pasa con dobles | RF real no disponible |
| Animal local no publicado | Cliente | Mapeo 404 y mensaje | Pasa en prueba | No observado en UI nativa |
| Token inválido/backend caído | Cliente/Backend | Pruebas 401/503 y mapeo | Pasa con dobles | No ejecutado contra backend real en nativo |
| Token no persistido y Demo separada | Cliente | Token en memoria; Demo en rutas/base propias | Revisado en código | Reinicio real no ejecutado |
| RAG real | Backend | — | **No ejecutado** | Faltan `RAG_DATABASE_URL`, embeddings E5 y corpus |
| RAG UI (respuesta/fuentes/abstención) | Cliente | Pruebas con dobles | Pasa | No es recuperación real |

## Intento de recorrido nativo (2026-11-12)

Se recompiló la app unpacked desde `dev` (D3–D6), se levantó backend D5b en `127.0.0.1:8000` y PostgreSQL temporal, y se publicaron por D1 un galpón, poza, cuy, parto, evento y pesaje sintéticos (secuencias 1–6). La app se lanzó con `--user-data-dir` temporal.

Observado:

- Navegación **Trabajo → Sincronización** correcta; el backend registró `GET /sync/context` **200** con el token sintético.
- No se observó `GET /sync/pull` ni push; la sincronización no completó y el resumen no apareció. La base local quedó en `user_version=4`, `scope_id=NULL`, `cursor=NULL`, sin outbox.
- Un segundo lanzamiento cerró la ventana antes de interactuar. Memoria libre del equipo: ~0.65 GB; Electron + Playwright no se mantuvieron estables.
- No se capturó el mensaje de error de la UI; no se atribuye a un defecto ni se corrigió a ciegas.

Android no se intentó: Pixel_36 requiere ~2.5 GB y el entorno no tenía memoria tras Electron; la ejecución debía ser secuencial. El AVD no se modificó.

Limpieza: contenedor PostgreSQL, backend, perfiles temporales, scripts y token sintético eliminados; no se tocaron AVD, instalaciones ni bases preexistentes.

## Recorrido nativo v2 (2026-11-12)

Se ejecutó secuencialmente Windows y Android con PostgreSQL temporal, backend `uvicorn`, scope/tokens sintéticos y perfiles aislados.

### Windows (completo)

- App `win-unpacked`, perfil de Trabajo aislado. Flujo UI: galpón `Galpón Nativo V2`, poza `P-NAT-1`, madre `C-NAT-MADRE`, cría `C-NAT-CRIA`, parto con `parto_crias`, pesaje `995.50` y evento `DESTETE`.
- Primer ciclo: **8 cambios enviados, 0 recibidos**, 0 pendientes/conflictos/rechazados; outbox 8/8 `accepted`.
- Central: 8 cambios y 8 recibos, todas las entidades en versión 1.
- Cursores v1 y v2 independientes en `after=8`.
- Cierre/reapertura: datos y cursores persistieron; token vacío. Demo con 4 galpones, separada.

### Android (parcial)

- AVD nuevo `CuyiElite_V2_Verify` (API 36), APK debug, `adb reverse tcp:8000 tcp:8000`; Pixel_36 no se modificó.
- Pull: **8 registros recibidos, 0 enviados**; galpón, animales, parto/cría, pesaje y evento visibles; SQLite con las 7 tablas y cursores v1/v2 en `after=8`.
- Cierre/reapertura: datos y cursores persistieron; token vacío. Demo con 4 galpones, separada.
- Push: segundo pesaje `1000.25` creado desde la UI y enviado; outbox `accepted`, cursor v1/v2 en `after=9`, central con pesaje versión 1 y 9 recibos/cambios.
- La UI quedó en “Sincronizando…” y el equipo llegó a **~38 MB de memoria libre**; una reapertura posterior mostró pantalla blanca. Se detuvo el emulador y se eliminó el AVD de prueba.
- **Android no se marca completo** por ese bloqueo; D7 no se declara completo.

### Reintento Android-only (2026-11-13)

- AVD temporal `CuyiElite_Android_Verify` (API 36, 1024 MB, 720×1280, sin ventana, GMS deshabilitado), PostgreSQL/backend temporales y `adb reverse`.
- Memoria libre del host: **~15 MB**; `Memory Compression` >3.8 GB. La app mostró `System UI isn't responding`; `MainActivity` tardó 18 s en mostrarse.
- Logcat: `lowmemorykiller` mató `keychain`, `printspooler` y `localtransport` por `low watermark is breached`. No se llegó a la pantalla de sincronización ni se capturó un error JavaScript/WebView del cliente.
- No se reprodujo un defecto de código; el bloqueo es de memoria del entorno. No se cambió código ni se simuló la UI con SQL. Android y D7 siguen sin completarse.

### Intento con emulador visible (2026-11-13)

- PR #131 abierto; se continuó en `fix/android-sync-v2-runtime`.
- Medición previa: **0.72 GB libres de 7.19 GB**; mínimo requerido 3 GB.
- No se inició Pixel_36 ni Android Studio Device Manager; no se abrió UI Android.
- Pixel_36 quedó intacto. No se ejecutó contexto, pull, push, reapertura ni Demo en esta sesión.
- Android y D7 siguen incompletos.

### Límites de la corrida

- RAG real y artefacto RF real no se ejecutaron por falta de corpus/embeddings/modelo; no se usaron mocks como evidencia real.
- No se probó ML nativo; las reglas reales ya estaban cubiertas por D5.
- La autenticación de producción, la rotación de tokens y la UI de resolución de conflictos de dominio siguen pendientes.

## Límites vigentes

1. Push v2 de dominio (`cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias`): backend y cliente integrados ([backend](sync-domain-push-v2-backend.md), [cliente](sync-domain-push-v2-cliente.md)). Windows nativo verificado; Android confirmó pull/push en SQLite/PostgreSQL, pero no cerró la UI por memoria. D7 sigue pendiente.
2. `categoria_ml` y `ultimo_peso_g`: ya no son editables ni se publican; la ficha los muestra como derivados del servidor. Persistencia de `categoria_ml` y alertas sigue pendiente de política.
3. Recorrido nativo integral Windows/Android: Windows completo; Android parcial por bloqueo de memoria.
4. RAG real y artefacto RF real: dependencias/corpus no disponibles.
5. Autenticación de producción/rotación: no implementada.
6. Carga real/ETL: fuera de alcance; el orquestador de Diery no se probó aquí.
