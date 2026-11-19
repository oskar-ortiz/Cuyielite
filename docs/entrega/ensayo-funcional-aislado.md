# Usar CuyiElite Ensayo en Windows y celular

El ensayo está preparado en este equipo con PostgreSQL propio, un perfil Windows separado y Android `co.ucc.cuyielite.ensayo`. Permite mostrar operación local, intercambio de pesajes, reglas/RF, categorías, alertas y asistente. La aplicación principal conserva sus datos. Los registros tienen nombres naturales; su procedencia sigue siendo sintética, sin aceptaciones ni carga de datos reales de Lope.

## Empezar

1. Abrir Docker Desktop y esperar a que esté disponible el contenedor del piloto.
2. Conectar el celular por USB y aceptar la autorización de depuración en el teléfono.
3. Ejecutar **Iniciar Ensayo Local.cmd** del Escritorio. Debe indicar `ensayo listo` y `USB: teléfono enlazado con backend 8000`. Abre Windows con el perfil del ensayo y reutiliza el backend si ya corresponde a esa base.
4. En el teléfono abrir **CuyiElite Ensayo**. En ambos usar **Entrar a trabajo**, no la base independiente de Demostración.
5. Si no hay sesión, entrar en **Acceso** con `ensayo.admin`. Contraseña privada: `%LOCALAPPDATA%\CuyiElite\ensayo-funcional\cuentas.json`. `ensayo.viewer` es la cuenta de consulta.
6. Abrir **Sincronización → Sincronizar**. Al terminar, volver a **Galpones → Galpón Norte → P-01 → Animales**.

Si Windows funciona y el teléfono muestra `failed to connect /127.0.0.1:8000`, mantener el USB conectado y ejecutar **Reconectar celular Ensayo.cmd**. Repetir después la acción fallida. El enlace USB se debe restablecer tras una desconexión; no abre puertos de red.

## Qué mostrar

| Registro | Caso preparado |
|---|---|
| Galpón Norte | Unidad productiva con P-01 y P-02 |
| H-001, P-01 | Cuatro partos, DESCARTE confirmada; causa 01/11/2026 y límite sugerido 21/11/2026 |
| H-002, P-01 | Candidata ELITE; historial de pesajes y consulta informativa con RF |
| H-003, P-01 | Reproductora NORMAL confirmada |
| H-004, P-01 | Supuesto de dos abortos: provisional, sin categoría definitiva ni alerta |
| H-005, P-01 | Cuarto parto sin fecha: DESCARTE confirmada, sin vencimiento inventado |
| H-006, P-01 | Evidencia sin validar/datos incompletos; sin categoría oficial |
| M-001 / CR-001 | Macho en P-01 y cría en P-02, con vínculo cría–parto preparado |

Las evaluaciones iniciales y sus evidencias se prepararon mediante API reales con cuentas del laboratorio. Revisar evidencia sintética no representa una aprobación zootécnica de Lope. Consultar una predicción no equivale a guardar una evaluación oficial ni ejecuta un descarte.

## Recorrido de 15–20 minutos

1. **Inventario:** abrir el galpón, las dos pozas, H-001 y su historial; mostrar genealogía y actividades de las fichas.
2. **Windows → celular:** en H-002 registrar un peso nuevo, guardar y sincronizar Windows; sincronizar el celular y comprobar el mismo registro. Se ejecutó con **982,75 g**.
3. **Celular sin enlace → Windows:** interrumpir USB, registrar otro pesaje y conservarlo pendiente. Reconectar, ejecutar el acceso de reconexión y sincronizar ambos. Se comprobó con **990,25 g**: pendiente offline, envío aceptado y una sola fila en Windows. Repetir sync terminó **0/0**.
4. **Predicción:** H-002 → Predicciones → Candidata. NUPAR `3`, TCNV `4`, nacimiento `150`, destete `320`, días `15`, monta `950`, ojos `1 / Negro`. Pulsar **Evaluar candidata**, sin declarar evidencia ni guardar evaluación. Se observó **ELITE / CONFIRMADO**, apoyo exploratorio separado **ELITE 83,4 % / NORMAL 16,6 %**. Es el resultado de ese artefacto y esos datos, no una garantía para otros casos. Más abajo, **Consultar evidencia del servidor** permite leer los siete criterios revisados; no los modifica.
5. **Categorías y alertas:** comparar H-001, H-004 y H-005. La alerta recomienda; no cambia automáticamente el estado productivo. Sus fechas son fijas: pueden quedar vencidas con el paso del tiempo.
6. **Asistente:** Resultados `5`; consultar el manual y después `¿Cómo configuro una impresora Wi-Fi?`. La segunda se abstiene sin fuentes. Mostrar las citas y los límites de la primera sin presentar un fragmento poco pertinente como respuesta correcta.
7. **Consulta y reapertura:** con `ensayo.viewer` la escritura está bloqueada. Cerrar/reabrir conserva datos y sesión; la autorización offline sigue limitada por la política vigente. Volver a admin para continuar registrando.

Para repetir el intercambio elegir valores nuevos y comprobar conteos; no borrar filas ni editar cursores/recibos para aparentar un ciclo nuevo. Conflictos conserva el flujo ya verificado **Conservar versión central / Reintentar cambio local**; no se dejó un conflicto artificial pendiente ni se repitió ese caso en este recorrido.

## Estado comprobado y límites

La [evidencia del recorrido](../verificaciones/ensayo-funcional-windows-celular.md) separa preparación API, observación nativa, intervención manual y comprobación de bases. Ambas apps intercambiaron pesajes, consultaron RF real y asistente. Oskar confirmó sesión y galpón conservados al reabrir ambos.

El selector RAG de #192 está activo. La consulta de materiales devuelve fuentes reales pero mezcla texto de jaulas/pozas: no acredita pertinencia. Gestación/vitamina C y la regresión B8 siguen con Diery; no se cambió corpus, modelo, umbral ni índice. Véase [handoff RAG](../integracion/handoff-diery-pertinencia-rag.md).

## Aislamiento y recuperación

Ensayo y piloto alternan en `127.0.0.1:8000`. **No usar la app principal mientras ese puerto sirva Ensayo.** Para volver al piloto, cerrar Ensayo y ejecutar desde la raíz del repositorio:

```powershell
python "$env:LOCALAPPDATA\CuyiElite\ensayo-funcional\control.py" piloto
```

Abrir después la app/perfil habitual. El controlador no reescribe `.env`, no borra bases ni cambia identidades. Los accesos del Escritorio son locales a este computador, no un backend portable.

Respaldo privado: `%LOCALAPPDATA%\CuyiElite\ensayo-funcional\respaldos\`, con dump `PGDMP`, hash y reporte de restauración. Se restauró en una base nueva y se eliminó solo esa copia. **No restaurar sobre una base activa**: reiniciar un escenario exige coordinar perfiles, sesiones, cursores y dispositivos. No hay reset destructivo automático.

El escenario anterior con UUID no admitidos se respaldó y sustituyó por uno UUIDv4; Oskar autorizó reiniciar exclusivamente Ensayo. El pesaje previo de 975,50 g se recuperó mediante push normal. No se relajó el contrato ni se alteraron manualmente cursores o recibos.

## Artefactos

- Windows: **CuyiElite Ensayo.lnk** apunta ahora a un ejecutable propio en `%LOCALAPPDATA%\CuyiElite\ensayo-funcional\windows-app\win-unpacked\CuyiElite Ensayo.exe`, con el mismo perfil separado. SHA-256 del ejecutable `fd34cd713c02e23d1e3f327bfbc10dcdba3574b284117cb186e95523af2a3eef`; del `app.asar`, `8a8c93381a98bc3e8b1057719705f0a799540edf7c983af708febfbbd4aa58c6`. El ejecutable y acceso habituales no cambiaron.
- APK actualizado: `%USERPROFILE%\Downloads\CuyiElite-Piloto-20261118\CuyiElite-Ensayo.apk`, SHA-256 `2f384c997e89e69b9da7b366ba93dd36ac447b1cf203117afc0fc89e435203a3`. Oskar lo actualizó manualmente sin desinstalar; el hash del APK instalado coincide. En esa carpeta se incluye `LEEME-ENSAYO.txt`.
- Android: `assembleDebug -PensayoAppId=true`, JDK 21, SDK API36. Flags `labAppId` y `ensayoAppId` excluyentes; sin flags queda el paquete habitual. APK debug, no publicación de tienda.

No se versionan contraseñas, configuraciones privadas, copias de bases, modelos ni binarios.
