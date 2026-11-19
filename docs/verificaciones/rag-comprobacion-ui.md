# Comprobación visual del RAG actualizado (2026-11-18)

Estado: **UI comprobada en Windows y Android**; pertinencia de las respuestas **sigue pendiente** con Diery. No se cambió índice, umbral, modelo, corpus ni generación. No se promovieron datos reales.

Base: `origin/dev` `a0bd811` (#183–#185 integrados). Se consultó además la versión de `docs/verificaciones/rag-actualizacion-piloto.md` publicada en PR #186 (rama `test/rag-actualizacion-piloto`, commit `e3a2ad1`), que estaba abierta al hacer esta comprobación. Este documento no modifica ese archivo para evitar un PR apilado.

## 1. Índice y HTTP: no repetidos

La actualización del índice ya estaba ejecutada y documentada en PR #186: 76 fragmentos, 55 hashes sustituidos, respaldo restaurable, dry-run y replay. Las cuatro consultas HTTP respondieron 200 y sin token 401. **No se reindexó ni se repitió HTTP sin necesidad de diagnóstico.** Los resultados de UI se comparan con esa evidencia, no la sustituyen.

Configuración conservada: `top_k=5`, `RAG_MIN_SIMILARITY=0.807566308073`, `intfloat/multilingual-e5-base`, modo extractivo, backend `http://127.0.0.1:8000`.

## 2. Matriz de casos

| Caso (pregunta exacta) | Windows (perfil aislado, CDP sobre Electron) | Android (`.lab`, `emulator-5554`) | Evidencia | Pendiente |
|---|---|---|---|---|
| A `Cuál es la duración de la gestación de los cuyes?` | Respuesta visible que comienza con fragmento de identificación individual (`p. 28`); fuentes `28, 25, 26, 85, 80` | Igual: texto de `p. 28` al inicio; fuentes `28, 25, 26, 85, 80` | `win-rag-A.png`, `rag_A.png`, `rag_A_fuentes2.png` | Pertinencia: Diery |
| B `¿Cuál es la duración de la gestación de los cuyes?` | Segunda consulta consecutiva, sin reiniciar backend; misma respuesta inicial, fuentes `28, 85, 26, 25, 80` | Misma pregunta con signos, fuentes `28, 85, 26, 25, 80` | `win-rag-B.png`, `rag_B_top.png`, `rag_B_fuentes.png` | Pertinencia: Diery |
| C `¿Por qué los cuyes necesitan vitamina C en su alimentación?` | Respuesta sobre digestión/cecotrofia, no explicación del porqué; fuentes `31, 28, 85, 32, 12` | Igual; fuentes `31, 28, 85, 32, 12` | `win-rag-C.png`, `rag_C.png`, `rag_C_fuentes.png` | Pertinencia y validación: Diery |
| D `¿Cómo configuro una impresora Wi-Fi?` | Abstención: «No encontré esta información en los manuales.»; fuentes vacías | Igual; fuentes vacías | `win-rag-D.png`, `rag_D.png`, `rag_D_full.png` | Ninguno |

Las fuentes mostradas corresponden a páginas reales del PDF y coinciden con el orden de la evidencia HTTP de PR #186. **HTTP 200 y fuentes reales no acreditan que A/B/C sean respuestas correctas**; se registran como contenido poco pertinente, sin declarar corregido.

## 3. Estados y recuperación

| Comprobación | Windows | Android |
|---|---|---|
| Pregunta enviada y respuesta correspondiente, sin mezclar resultados anteriores | Confirmado: cada envío limpió el resultado previo; A→B→C→D consecutivos | Confirmado: mismo orden; captures por caso |
| Estado de carga y finalización | Los cuatro casos terminaron con respuesta/fuentes; no spinner permanente | Igual |
| Segunda consulta sin reiniciar backend | B después de A, sin reinicio | B/C/D consecutivos |
| Cierre/reapertura con flujo normal de sesión | Cerrado y reabierto el perfil aislado; sesión activa y nueva consulta D con abstención | `force-stop` + reapertura de `.lab`; sesión activa y nueva consulta D con abstención (`rag_reopen.png`, `rag_afterreopen.png`) |
| Viewer | Cobertura previa vigente (PR #165) | **Observado**: `lope.viewer` pudo consultar el asistente y ver la abstención (`viewer_query.png`); Galpones mostró «solo consulta» y sin botón de edición (`viewer_final_profile.png`) |

## 4. Intervención manual y estabilidad

- Windows: las credenciales se escribieron mediante automatización CDP sobre la app real; no se imprimieron contraseñas ni tokens. Las capturas no contienen secretos.
- Android: la entrada de texto con acentos y signos de interrogación no fue fiable mediante `adb input text`. Se solicitó a Oskar, **una acción por vez**, que escribiera A, B, C y D y confirmara cada resultado; él confirmó los cuatro y la consulta del viewer. Las capturas fueron tomadas y corroboradas por mí. No se usó SQL, HTTP ni manipulación del WebView para simular la pantalla.
- Al abrir `.lab` apareció una vez «System UI isn't responding». Se pulsó «Wait» una sola vez; la app volvió a la pantalla de selección de modo y el recorrido continuó. No se repitieron intentos ni se cerraron aplicaciones ajenas. RAM disponible al inicio del tramo Android: ~160 MB; el AVD ya estaba abierto, por lo que no se exigió la memoria de un arranque nuevo.
- Antes de diagnosticar un problema de viewer se comprobó `/health` 200 y `adb reverse tcp:8000→tcp:8000`. La primera sesión viewer no quedó activa por error de escritura automatizada de la contraseña; tras el login manual de Oskar funcionó. No se atribuyó el fallo a la app.

## 5. Correcciones

Ninguna. No se encontró un defecto reproducible de plataforma o presentación en este recorrido: el DTO se muestra íntegro, la abstención es correcta, la sesión se recupera y el viewer conserva restricciones. La pertinencia de A/B/C pertenece al frente de Diery y no se ajustó umbral, extractor, ranking ni generación.

## 6. Limpieza y estado final

Se cerró el laboratorio de Windows antes de empezar Android. El backend del piloto quedó en `127.0.0.1:8000` con `/health` 200 y `adb reverse 8000→8000` activo. Pixel_36, usuario 0, `co.ucc.cuyielite`, bases y Keystore intactos; solo se usó `co.ucc.cuyielite.lab`. No se crearon bases, respaldos ni contenedores nuevos. `cuyielite-s3-test` no se usó. No se promovieron datos reales ni se modificaron ámbitos, cursores o recibos.

