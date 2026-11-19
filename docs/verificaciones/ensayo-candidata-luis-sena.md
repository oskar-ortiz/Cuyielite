# Ensayo de la candidata para Luis/SENA (2026-11-18)

Candidata: `candidata-ac81eef-20261118`. Base: `origin/dev` `ac81eef` (#186–#188 integrados). Último cambio de código del cliente: `50cb59e`. Rama de trabajo: `feat/candidata-piloto-entrega-luis`. El índice RAG actualizado de PR #186 se conservó; no se reindexó. No se cambiaron ranking, extractor, modelo, umbral, corpus ni generación. No se promovieron datos reales.

Este ensayo es **representativo**, no una repetición de las matrices ya aprobadas. Cuando el código es equivalente se reutiliza la evidencia indicada. Los casos A–L siguen el guion de `docs/verificaciones/entrega-plataforma-oskar.md`.

## Plataforma y artefacto

| Paso | Windows (ejecutable empaquetado) | Android (`.lab`, `emulator-5554`) |
|---|---|---|
| Artefacto | `client/electron/dist/win-unpacked/CuyiElite.exe`, SHA-256 `05799d0dec2d91ce18a81a6f0a23718ca8563b80ee7e4e2c88d000b8f0db2c5a` | `app-debug.apk`, SHA-256 `ef41d9d628c16c02013ee8a24a9bd3bcb8cd4e25f7389eb7b3a8d1b5916ec1d3`, instalado como `co.ucc.cuyielite.lab` |
| Datos | Perfil aislado `%TEMP%\opencode\cuyielite-candidata-profile`; base Demo y base Trabajo vacía del perfil | Perfil y bases aisladas de `.lab`; datos sintéticos de las verificaciones previas |
|Backend| `http://127.0.0.1:8000`, `/health` 200, PID 3628 | `adb reverse tcp:8000→tcp:8000` activo |

## Matriz del recorrido

| # | Caso | Resultado esperado | Observado | Evidencia | Estado |
|---|---|---|---|---|---|
| A | Demo/Trabajo y separación de bases | Cada modo conserva su base | Demo mostró «Datos de demostración» y 4 galpones (`Galpón Norte/Sur/Occidente/Este`); Trabajo mostró «La base de trabajo todavía no tiene galpones». «Cambiar modo» volvió a la selección | `cand-win-demo2`, salida del ensayo; `cliente-modos-s1.md` | Aprobado |
| B | Admin y viewer con restricciones | Admin escribe; viewer solo consulta | Windows: sesión admin activa tras reapertura; viewer cubierto en evidencia previa equivalente. Android: `lope.viewer` consultó el asistente y Galpones mostró «solo consulta» sin acciones de edición | `cand-win-01/02`, `viewer_query.png`, `viewer_final_profile.png`, `acceso-piloto-integracion.md` | Aprobado (viewer por evidencia equivalente) |
| C | Galpones, pozas y animales | Consulta local coherente | Demo: `Galpón Norte` → 3 pozas `P-101` cría/50, `P-102` engorde/30, `P-103` reproducción/80. Animales cubiertos en `registro-trabajo-galpones-pozas.md` | salida del ensayo; `registro-trabajo-galpones-pozas.md` | Aprobado |
| D | Registro/edición local autorizada | Alta sintética en base aislada | No se ejecutó en este ensayo para no introducir animales en el dominio persistente; cobertura previa equivalente | `registro-trabajo-galpones-pozas.md`, `rf-visualizacion-nativa.md` | No ejecutado (evidencia previa) |
| E | Offline y outbox | Operación pendiente conservada | No se repitió; procedimiento y pruebas vigentes | `cierre-integracion-laboratorio.md` | No ejecutado (evidencia previa) |
| F | Reconexión y sincronización, sin duplicación | Reenvío idempotente | No se repitió; `context → pull → push` verificado antes | `cierre-integracion-laboratorio.md`, `acceso-piloto-integracion.md` | No ejecutado (evidencia previa) |
| G | Conflicto sintético resuelto por acción autorizada | Sin merge automático ni edición manual de versiones/recibos | No se repitió; resolución «conservar central»/reenvío revisado verificada antes | `conflictos-dominio-ui.md` | No ejecutado (evidencia previa) |
| H | Reglas como bloque principal, RF como apoyo | Clase por reglas; apoyo separado; ausencia explicada | No se repitió; cinco casos observados en UI real en ambas plataformas | `rf-visualizacion-nativa.md`, `cierre-plataforma-piloto.md` | No ejecutado (evidencia previa) |
| I | Evaluación oficial, evidencia y alertas | Declarada≠revisada; dos abortos provisionales; cuarto parto; sin descarte automático | No se repitió; verificado en el cierre del frente | `cierre-integracion-laboratorio.md` | No ejecutado (evidencia previa) |
| J | Asistente con fuentes, abstención y límite de pertinencia | Fuente visible; abstención fuera de corpus; sin declarar validado | En el ejecutable empaquetado, «¿Cómo configuro una impresora Wi-Fi?» → «No encontré esta información en los manuales.» y «El asistente no devolvió fuentes para esta respuesta.», HTTP 200 en 2.1 s. En Android, A–D con fuentes `28,25,26,85,80` / `28,85,26,25,80` / `31,28,85,32,12` y abstención en D | `cand-win-03-asistente.png`, `rag-comprobacion-ui.md` | Aprobado (integración y abstención); pertinencia pendiente |
| K | Cierre/reapertura y continuidad | Sesión y datos según comportamiento vigente | Ejecutable cerrado (PID 17140) y reabierto (PID 30384); misma ruta, «Sesión activa», cuenta admin; consulta J correcta tras reapertura. Android: `force-stop` + reapertura con sesión activa | `cand-win-02-acceso.png`, `rag_reopen.png`, `rag_afterreopen.png` | Aprobado |
| L | Respaldo y restauración en destino aislado | Restauración comprobada sin tocar la base principal | No se repitió; `pg_dump -Fc` + `pg_restore` ya comprobados, incluida la actualización del índice | `rag-actualizacion-piloto.md`, `operacion/piloto-local.md` | No ejecutado (evidencia previa) |

## Comprobación específica del ejecutable empaquetado

- Arranque con `Start-Process` sobre `dist\win-unpacked\CuyiElite.exe`; `ProcessName=CuyiElite`, `Path` confirmado, CDP `Electron/45.2.1`, `Chrome/156.0.8078.75`.
- Recursos y estilos: 1 bundle `index-BroHUhiR.js`, 3 hojas de estilo, `body` con fondo `rgb(244,246,249)`, `ion-app` en `display:flex`.
- Plugins disponibles en el proceso real: `CapacitorCookies`, `CapacitorHttp`, `CapacitorSQLite`, `SqlitePoc`, `SyncLab`, `SystemBars`; plataforma `electron`.
- Acceso al piloto por el mecanismo vigente: login admin desde la UI, `POST /auth/login` y `/auth/refresh` 200, «Sesión activa» con rol Administrador.
- Cierre y reapertura verificados con el mismo binario y perfil.
- **No se declaró firma ni distribución certificada**: electron-builder informó `no code signing certificate configured, signing is skipped`. El artefacto es `win-unpacked`, no un instalador firmado.

### Hallazgo del arnés (no defecto del producto)

El primer intento usó `page.goto('capacitor-electron://localhost/trabajo/asistente')` justo después del login. Esa recarga completa descarta el token en memoria del renderer y produjo «No se pudo contactar al asistente» sin que llegara `POST /assistant/query` al backend. Al navegar por los controles de la aplicación (`Entrar a trabajo` → `Asistente`) la consulta devolvió 200 y la abstención correcta. Se documenta como **limitación del arnés de pruebas**, no como fallo del ejecutable; no se modificó código.

## Limpieza y estado

Se cerró el laboratorio de Windows de la sesión anterior antes de usar Android. En esta sesión el backend quedó activo en `127.0.0.1:8000`, `adb reverse 8000→8000` activo, Pixel_36 y usuario 0 intactos. No se hicieron wipe, `pm clear`, desinstalaciones, cambios de ámbito ni promociones. No se subieron binarios al repositorio; el inventario es local y la documentación es versionada.
