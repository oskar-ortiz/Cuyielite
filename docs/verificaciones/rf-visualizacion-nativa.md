# Matriz de visualización nativa del RF (2026-11-17)

Estado: **los cinco casos observados en UI real en Android y Windows**. La fila de pozas quedó corregida y verificada en ambas plataformas. Fecha de observación: 2026-11-17. Dispositivo: `emulator-5554` (Pixel_36, API 36, usuario 0). Paquete: `co.ucc.cuyielite.lab`. No se usó `wipe-data`, `pm clear` ni cambio de scope/device/cursor/recibo. El paquete habitual `co.ucc.cuyielite` y sus datos quedaron intactos.

## Configuración de laboratorio (sin secretos)

- Backend de laboratorio en `127.0.0.1:8001`; `adb reverse tcp:8000 tcp:8001` para que la app, que apunta a `127.0.0.1:8000` en el dispositivo, alcance ese backend.
- Base aislada `cuyielite_rf_lab`, mismo `scope_id` del piloto para respetar la identidad ya vinculada a la instalación `.lab`. Cuatro animales sintéticos `RF-SIN-000..003` publicados con D1 (secuencias 3–6) y galpón/poza publicados por v1 (secuencias 1, 2, 7, 8). Ningún dato sintético en `cuyielite`.
- Sincronización desde la UI: terminó con «Se recibieron 4 registro(s) y se enviaron 0 cambio(s)», sin spinner permanente. Captura: `%TEMP%\opencode\rf_sync13.png`.
- Modelo: `candidate_random_forest_b.joblib`, SHA-256 `744349c43b4781dc5acef88e3db9dd6522d7b76c26a3f91e82d578792d6adce9`, verificado por `load_verified_model` antes de deserializar. No versionado.

## Matriz caso × plataforma

| Caso | Android (UI real) | HTTP | Captura | Windows | Límite |
|---|---|---|---|---|---|
| Candidata completa | `Clase de reglas: ELITE`, `Calidad: CONFIRMADO`, motivo «cumple todos los criterios ELITE». Bloque separado «Apoyo exploratorio del modelo»: estimada ELITE (no calibrada; no reemplaza la regla), `ELITE 81.6%`, `NORMAL 18.4%` | `POST /ml/predict/candidata` 200 | `rf_case1c.png` | **Igual**: `ELITE/CONFIRMADO`, apoyo separado, `ELITE 81.6%` / `NORMAL 18.4%` (`win-rf-result.png`) | — |
| Candidata con faltantes | `NORMAL` / `REVISAR`, chip «Datos insuficientes: requiere revisión», motivos «dato faltante: nupar_madre», «dato faltante: tcnv»; «Sin apoyo del modelo para esta consulta. La clase principal sigue siendo la de reglas.» | 200 | `rf_case1b.png` | **Igual**: `NORMAL/REVISAR`, motivo «dato faltante: ojos», sin apoyo (`win-rf-case1.png` de la primera pasada) | La ausencia de apoyo aquí es porque no se aplica el modelo con datos incompletos; no equivale a modelo no configurado |
| Sin modelo configurado | **VERIFICADO**: `ELITE/CONFIRMADO`, «Sin apoyo del modelo para esta consulta. La clase principal sigue siendo la de reglas.», sin probabilidades ni 503 | `POST /ml/predict/candidata` 200, `apoyo_modelo: null`, `clase=ELITE` | `nm_result2.png` | **VERIFICADO**: mismo resultado con perfil aislado y backend sin RF en `8000` | Configuración temporal del proceso; artefacto y `.env` del piloto sin cambios |
| Reproductora cuarto parto | `DESCARTE` / `CONFIRMADO`, motivo «ciclo completo»; «Fecha de descarte sugerida: sin fecha (dato no disponible). Es informativa y no ejecuta…» | `POST /ml/predict/hembra` 200 | `rf_case4.png` | **Igual**, con texto completo: «sin fecha (dato no disponible). Es informativa y no ejecuta ningún descarte» (`win-rf-case4.png`) | — |
| Viewer | Se observó sesión `lope.viewer` con rol «Consulta» y etiqueta «Base de trabajo · solo consulta» | — | `rf_native4.png` | **Verificado con build final**: `Cuenta lope.viewer`, `Rol Consulta`, `solo consulta`, botón «Nuevo» ausente (`win-rf-viewer.txt`) | No se repitió el view en Android con el build final; evidencia previa de la misma instalación |
| Categorías/alertas antes y después | «Sin evidencia registrada para este animal» antes y después de las consultas informativas; no se pulsó «Evaluar y guardar» | — | `rf_prednew2.png`, `rf_case1c.png` | **Igual**, además el texto «Solo una evaluación confirmada cambia la categoría…» | Las consultas no cambiaron la categoría oficial |

## Fila de pozas: causa, corrección y verificación

Causa: `.app-list__title` se inserta en el slot de `ion-item` y conservaba el `flex: 0 1 auto` del shadow DOM; en pantallas estrechas las acciones con `width: 100%` le dejaban 48 px (la etiqueta, 12 px) y el texto se partía en una letra por línea. La corrección acotada:

- `ion-item .app-list__title { flex: 1 1 auto; min-width: 0 }` con mayor especificidad que el estilo por defecto;
- en la media query estrecha, `.app-list ion-item > .record-actions { flex: 0 0 auto; max-width: 130px; flex-direction: column; align-items: flex-end; gap: 4px }` y botones `width: auto`, padding reducido y `min-height: 32px`.

No se oculta texto, no se fija un ancho arbitrario y no se rediseña la pantalla. Se mantienen icono, etiquetas, foco y navegación.

Mediciones y capturas del build final:

| Plataforma | Título (px) | Etiqueta (px) | Acciones (px) | Captura |
|---|---:|---:|---:|---|
| Android `.lab`, pantalla estrecha (360 css px) | 178 | 117 | 100 | `poza_final3.png` |
| Windows, ventana 720 px | 409 | 114 | 229 | `poza-win-720.png` |
| Windows, ventana 1200 px | 881 | 114 | 229 | `poza-win-1200.png` |

Antes: Android 48/12/230 (`poza_fixed3.png`). En las tres composiciones finales el código `P-RF2` y `cria · capacidad 10` se leen completos, sin recortes ni desplazamiento horizontal. Se comprobó que pulsar **Animales** abre el inventario de la poza, tanto en Android (`poza_action.png`) como en Windows. No se probó una chapa artificialmente larga: el cambio usa flex y no un ancho fijo, pero esa variante queda como cobertura pendiente.

## Configuración temporal del caso sin modelo

Backend de laboratorio en `8001` (Android) y `8000` (Windows), con `CUYIELITE_RF_MODEL_PATH` eliminado del entorno del proceso mediante script temporal. No se borró ni renombró el artefacto, no se cambió `.env` ni la configuración permanente del piloto. Se confirmó por HTTP que `apoyo_modelo` era `null` antes de usar la UI. Al terminar se detuvo ese proceso y se restauró el backend del piloto en `8000` y `adb reverse 8000→8000`.

## Defectos de plataforma corregidos

1. **`PrediccionesAnimal.tsx` exigía un token de laboratorio en modo piloto.** El ayudante `accessToken()` ya existía para usar la sesión, pero `run()` comprobaba `token.trim()` y enviaba ese valor al transporte: en piloto la consulta nunca se enviaba y no aparecía resultado. Corregido para resolver el bearer con `ensureAccessToken()` cuando `AUTH_MODE === 'pilot'`, y se oculta el campo de token manual en piloto. Regresión: `PrediccionesAnimal.pilot.test.tsx` (2 pruebas). Verificado en UI: el campo desapareció («Las consultas usan la sesión activa del piloto») y la consulta devolvió 200 con resultado visible.
2. **Defecto visual observado, NO corregido:** en la ficha del galpón, las acciones de la fila de pozas dejan el código de la poza en una columna de pocos píxeles (una letra por línea). Se probaron dos ajustes de CSS; el último hizo desaparecer el texto, por lo que **se revirtieron ambos** y el repositorio queda con el CSS original. Requiere corrección con revisión visual dedicada; no se presenta como resuelto. Capturas: `rf_galdet.png` (antes) y `rf_css3.png` (intento revertido).

## Windows

Perfil aislado (`%TEMP%\cuyielite-rf-win-profile`), Electron iniciado desde `client/electron/node_modules/electron` con CDP en 9226. Backend de laboratorio atendiendo en `8000` de forma temporal; el backend del piloto se restauró al terminar. Sincronización desde la UI: «Se recibieron 8 registro(s) y se enviaron 0 cambio(s)», ciclo terminado. Los cuatro casos compartidos se observaron con el mismo resultado que en Android; capturas `win-rf-result.png`, `win-rf-case4.png` y `win-rf-galpones2.png`.

## Builds

- APK final instalado en `.lab`: SHA-256 `ef41d9d628c16c02013ee8a24a9bd3bcb8cd4e25f7389eb7b3a8d1b5916ec1d3`, compilado con JDK 21 (`-PlabAppId=true`) desde el código de esta rama. `adb install -r` conservó datos y sesión. Las capturas `poza_final3.png` y `poza_action.png` corresponden a este artefacto.
- Electron: build con `npm run build:electron` + `cap sync` + `tsc`, ejecutado con el mismo código en perfil aislado; capturas `poza-win-720.png` y `poza-win-1200.png`.
- Electron: `npm run build:electron` + `cap sync` + `tsc` con el mismo código, en perfil aislado.
- Código: rama `fix/rf-visualizacion-nativa` desde `origin/dev` `bb1661f` (PR #167 fusionado).

## Conservación y limpieza

Pixel_36, usuario 0, `co.ucc.cuyielite`, sus bases y Keystore intactos. Sin cambios manuales de identidad. Se cerraron los procesos y perfiles temporales creados en esta corrida; `adb reverse` quedó restaurado a `tcp:8000 → tcp:8000` y el backend del piloto volvió a escuchar en `8000`. No se tocó `cuyielite` ni `cuyielite_rag` con datos sintéticos; `cuyielite-s3-test` no se usó.
