# D7: verificación integral de la plataforma

Estado: **checks automatizados y builds ejecutados; recorrido nativo Windows/Android no ejecutado**. No se declara la plataforma completa ni la sincronización bidireccional de dominio.

Rama: `test/integracion-plataforma-d7`, apilada sobre `feat/client-predicciones-asistente-d6`. D6 no está en `dev`; su consolidación va primero (PR #125).

## Base verificada

- `dev` contiene D5b (#123): `POST /ml/predict/hembra`, `/ml/predict/candidata`, `/assistant/query`.
- D6 (pantallas y transporte) solo está en la rama apilada; se abrió consolidación hacia `dev`.

## Bloqueo de memoria

La suite y el build de D6 habían abortado por presión de memoria. En D7 se ejecutaron secuencialmente y con workers limitados:

```powershell
cd client
npx vitest run --maxWorkers=1   # 36 archivos, 188 pruebas passed
npm run build                  # OK
npm run lint                   # OK
```

Backend con PostgreSQL temporal aislado y recursos eliminados:

```powershell
python -m pytest backend tools/db_migrate/tests -q   # 130 passed
```

No se redujeron pruebas ni se añadieron omisiones para ocultar fallos. La prueba de reglas reales sigue omitiéndose solo cuando faltan numpy/pandas; en este entorno estaban disponibles y se ejecutó.

## Matriz de verificación

| Criterio | Plataforma | Evidencia | Resultado | Pendiente / causa |
| --- | --- | --- | --- | --- |
| Publicación D1 y descarga D2 | Backend | Prueba integrada con PostgreSQL temporal (`test_integracion_d1_d2`) | Pasa en suite (130) | No repetida como recorrido nativo |
| Aplicación SQLite D3 (referencias, versiones, cursor) | Cliente/Node | Pruebas de migración v4, apply e inbox con `node:sqlite` | Pasa (suite 188) | No observada en app nativa |
| Pantallas D4 (listado, ficha, alta/edición) | Cliente | Pruebas de listado y build web | Pasa (suite/build) | Recorrido nativo no ejecutado |
| Cierre/reapertura con identidad y datos | Cliente | Pruebas de reapertura de archivo SQLite | Pasa en automatización | Reapertura de la app nativa no ejecutada |
| Predicción D6 de animal autorizado con reglas reales | Backend | `test_real_rule_functions_are_used_by_the_adapter` (sin doble) | Pasa localmente con numpy/pandas | Endpoint con dobles; UI nativa no ejecutada |
| `apoyo_modelo=null` y REVISAR | Cliente/Backend | Pruebas de UI y validación de salida | Pasa con dobles | RF/artefacto real no disponible |
| Animal local no publicado | Cliente | Mapeo 404 y mensaje de publicación pendiente | Pasa en prueba dirigida | No observado en UI nativa |
| Token ausente/inválido, backend caído y reintento | Cliente/Backend | Pruebas de 401/503 y mapeo de errores | Pasa con dobles | No ejecutado contra backend real en nativo |
| Token no persistido y Demo separada | Cliente | Token en estado de componente; Demo en rutas/base propias | Revisado en código y pruebas | Reinicio real de app no ejecutado |
| RAG real (recuperación) | Backend | — | **No ejecutado** | Faltan `RAG_DATABASE_URL`, embeddings E5 y corpus autorizado |
| RAG UI con respuesta/fuentes y abstención | Cliente | Pruebas con dobles controlados | Pasa | No es recuperación real |
| Indisponibilidad RAG en runtime | Cliente | Mapeo 503 y conservación de pregunta en pruebas | Pasa con dobles | No observado en app nativa |

## Recorrido nativo: bloqueo concreto

No se ejecutó el recorrido en Windows empaquetado ni en AVD temporal. Causas registradas:

- El entorno ya había abortado suite/build por presión de memoria; se priorizó estabilizar los checks automatizados.
- El recorrido requiere backend D5b en ejecución, token de laboratorio, animal sintético publicado y app empaquetada con D6; no se completó dentro de esta sesión.
- No se declaran los criterios 1–8 como observados en runtime nativo.

## Correcciones

No se encontraron defectos de código en los checks ejecutados; no hubo cambios de implementación. Solo se actualizó evidencia y documentación.

## Límites vigentes (frente de Oskar)

1. Push v2 de dominio (`cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias`): **no existe**. La sincronización es solo descarga + escritura local.
2. Persistencia de `categoria_ml` y alertas: pendiente de política de calidad, idempotencia, deduplicación y código/identidad de episodio.
3. Recorrido nativo integral Windows/Android y reapertura real: pendiente.
4. RAG real y artefacto RF real: dependencias/corpus no disponibles en el entorno.
5. Autenticación de producción/rotación: no implementada.
6. Carga real/ETL: fuera de alcance; el orquestador de Diery no se probó aquí.

## Evidencia D6 actualizada

La suite completa, el build y el lint que D6 dejó pendientes quedaron verificados en D7. La ejecución nativa de D6 sigue pendiente por la misma causa.
