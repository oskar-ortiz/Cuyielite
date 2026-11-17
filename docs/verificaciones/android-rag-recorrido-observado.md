# Recorrido Android del piloto RAG — 2026-11-17

Estado: **PARCIAL**, con interacción real y una desviación de recuperación pendiente.

## Entorno y método

- Pixel_36 ya encendido, `emulator-5554`, usuario 0; paquete aislado `co.ucc.cuyielite.lab`.
- Backend iniciado mediante `scripts/piloto-local.ps1 start`; `/health` 200 y puente `adb reverse tcp:8000 tcp:8000`.
- Acceso manual de Oskar con `lope.admin`, confirmado visualmente como Administrador. Sin publicar credenciales.
- Navegación con Computer Use. Oskar introdujo y envió las preguntas porque la entrada automatizada no escribía texto de forma fiable.
- El backend y APK usados ya estaban disponibles antes de cambiar el checkout a `origin/dev` `2c1512c`. Este recorrido no acredita la nueva entrega RF de #163.

## Observaciones

| Caso | Evidencia | Resultado |
|---|---|---|
| Acceso admin | Pantalla de sesión activa, cuenta `lope.admin`, rol Administrador | Completado con acceso manual |
| Sincronización | UI: «Se recibieron 0 registro(s) y se enviaron 0 cambio(s)»; context/pull v1/v2 y pull v3 HTTP 200 | Completado con conjunto vacío; no acredita envío ni descarga de filas nuevas |
| Consulta de gestación | Pregunta visible; estado Consultando; HTTP 200; respuesta y citas visibles | Transporte completado, pertinencia pendiente/fallida en los fragmentos observados |
| Pregunta fuera del corpus | «¿Cómo configuro una impresora Wi-Fi?»; «No encontré esta información en los manuales»; sin fuentes; HTTP 200 | Abstención verificada en pantalla |
| Consulta de vitamina C | Pregunta introducida por Oskar; respuesta visible con citas, incluida `produccion_cuyes.pdf, p. 32` | Conexión y fuente verificadas; no acredita una explicación correcta del motivo nutricional |
| Reapertura y recuperación de sesión | Tras la reapertura manual se abrió inicialmente el paquete habitual; se lanzó explícitamente `.lab` (splash y PID 3709), se entró en Trabajo y Acceso mostró `lope.admin`, Administrador, mismo ámbito e instalación `62479309` | Restauración visible comprobada; esta observación no verifica por sí sola el cifrado del almacenamiento |
| Viewer | Login manual confirmado por Oskar; captura aportada de Galpones con «Base de trabajo · solo consulta», sin botón Nuevo; sincronización manual informada por Oskar: 0 recibidos / 0 enviados; consulta de impresora con abstención y sin fuentes, informada por Oskar | Flujo manual verificado con captura de permisos y reporte de resultados; no acredita rechazo de escritura HTTP en esta corrida |

## Desviación de pertinencia

La pregunta «Cuál es la duración de la gestación de los cuyes?» devolvió fragmentos sobre placas de identificación, lactancia y procesamiento de carne, entre otros. Se observaron citas a `produccion_cuyes.pdf`, páginas 28 y 80. No se verificó una duración de gestación respaldada por la respuesta. No se marca este caso como respuesta correcta ni se cambia el umbral para favorecerlo.

El informe existente `rag/reports/evaluacion_validacion.md` también registra limitaciones de recuperación: hit@5 de 0.9412 en 17 preguntas válidas, abstención en 7/10 fuera de corpus y 0/3 preguntas en dominio sin respuesta. La pertinencia requiere revisión con el responsable del pipeline y comprobación contra el PDF.

La segunda consulta, «¿Por qué los cuyes necesitan vitamina C en su alimentación?», incluye la tabla de requerimientos de la página física 32. Se comprobó con `pdftotext` sobre el PDF autorizado: esa página contiene una fila de vitamina C. Sin embargo, los fragmentos observados no explican por qué la necesitan y mezclan alimentación, identificación y bibliografía. Una cita auténtica y relacionada no demuestra que se haya respondido el «por qué». Se conserva como limitación de pertinencia, sin ajustar umbrales ni atribuir al manual explicaciones no verificadas.

## Memoria y conservación

La condición de RAM disponible igual a la RAM solicitada del AVD se usa antes de arrancar un emulador nuevo. `scripts/start-pixel.ps1` ya distingue el AVD existente; no se cambió ni debilitó su guarda. Este recorrido reutilizó el Pixel abierto por Oskar y esperó los resultados, con retrasos visibles de entrada y renderizado.

Sin cambios de reglas, umbrales, datos de negocio, cursores o recibos manuales. Sin suites ni builds nuevos porque el cambio es documental. El piloto y el Pixel quedan abiertos para continuar el recorrido.

## Reconexión durante la prueba de viewer

Al iniciar sesión como viewer, Oskar observó `failed to connect to /127.0.0.1:8000`. Se comprobó que el backend no escuchaba y que `adb reverse --list` estaba vacío, con el emulador conectado. Se inició el piloto con el controlador oficial (`/health` 200, PID 10812) y se restableció `tcp:8000 -> tcp:8000`. Oskar confirmó el login y las acciones posteriores. El error de conexión no se atribuye a las credenciales ni prueba un defecto de la app. La causa por la que el backend dejó de ejecutarse no se determinó en esta corrida.

## Resultado del tramo

Se observaron acceso admin, sincronización vacía, consultas RAG con respuesta y fuentes, abstención, restauración visible de la sesión y permisos de consulta del viewer. Se distinguen las acciones automatizadas, las capturas y las comprobaciones manuales de Oskar. La pertinencia de las respuestas de gestación y vitamina C sigue pendiente; este recorrido no valida la calidad global de RAG ni la nueva entrega RF. El cifrado del almacenamiento no se reexaminó en este tramo.
