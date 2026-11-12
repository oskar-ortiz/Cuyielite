# D7: verificación integral de la plataforma

Estado: **verificación automatizada ejecutada; recorrido nativo Windows/Android no verificado**. No se declara la plataforma completa ni la sincronización bidireccional de dominio.

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

## Límites vigentes

1. Push v2 de dominio (`cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias`): backend implementado y verificado el 2026-11-12 ([evidencia](sync-domain-push-v2-backend.md)); el cliente v2 se integró en una entrega posterior ([evidencia](sync-domain-push-v2-cliente.md)). El recorrido nativo del push y el recorrido nativo D7 siguen pendientes. La sincronización nativa recorrida en D7 fue solo descarga + escritura local.
2. Persistencia de `categoria_ml` y alertas: pendiente de política de calidad, idempotencia, deduplicación y código/identidad de episodio.
3. Recorrido nativo integral Windows/Android y reapertura real: pendiente por memoria/entorno.
4. RAG real y artefacto RF real: dependencias/corpus no disponibles.
5. Autenticación de producción/rotación: no implementada.
6. Carga real/ETL: fuera de alcance; el orquestador de Diery no se probó aquí.
