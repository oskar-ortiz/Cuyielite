# Ensayo funcional Windows y teléfono — 19/11/2026

Recorrido sobre Windows instalado con perfil Ensayo y teléfono físico con paquete `.ensayo`. La aplicación principal y Pixel_36 permanecieron fuera del recorrido. No hubo carga institucional ni aceptación de correspondencias reales.

## Preparación y datos

PostgreSQL separado con bootstrap/migraciones oficiales: **1 galpón, 2 pozas, 8 animales, 10 partos, 4 pesajes al cierre, 1 evento y 1 vínculo cría–parto**. Evidencias de evaluación: 9 registros. Los clientes descargaron **6 estados de evaluación y 2 alertas**. Datos y cuentas sintéticos y privados.

La primera ampliación usó por error UUIDv5; el validador rechazó correctamente el pull porque el contrato exige UUIDv4. Se respaldaron bases/perfil y Oskar autorizó reiniciar solo Ensayo. El teléfono exigió borrar los datos de Ensayo manualmente por restricciones del fabricante. El nuevo escenario usa UUIDv4 sin cambiar la validación. El validador JavaScript compilado aceptó páginas reales v1 (29 items) y v2 (26); los feeds se solapan, no son 55 entidades distintas.

Galpón/pozas y nombres se publicaron por push v1; dominio por D1/v2. Evaluaciones/evidencia por servicios reales con admin sintético. Se conservaron NULL y fechas fijas. El pesaje previo de 975,50 g se recuperó por push real, sin modificar cursores, recibos ni versiones.

## Resultados

| Caso | Windows instalado | Teléfono físico / comprobación |
|---|---|---|
| Admin y descarga inicial | UI: 29 recibidos / 0 enviados; 0 pendientes/conflictos/rechazados | Login/sync manual; SQLite: 8 animales, 6 evaluaciones, 2 alertas, integridad OK |
| Registros | Galpón Norte, P-01/P-02 y H-001…H-006, M-001, CR-001 | Usuario confirmó navegación con los mismos nombres |
| Pesaje 982,75 g | Creado por UI, CONTROL, fecha NULL; sync 12 recibidos / 1 enviado; outbox accepted | Usuario vio el peso tras sincronizar; central una sola fila |
| Sin enlace USB | — | Usuario guardó 990,25 g con reverse retirado. SQLite queued y central sin la fila. La verificación final central/local mostró fecha 20/11/2026 y etapa NULL; no se atribuyen los valores propuestos por el guion a lo realmente ingresado |
| Envío posterior | Sync UI: 1 recibido / 0 enviados; SQLite una fila 990,25 | Reverse restablecido; sync manual: 1 enviado. Central una fila y outbox Android accepted |
| Repetición | UI: 0 recibidos / 0 enviados; sin pendientes/conflictos/rechazados | Sin duplicar el registro central |
| Predicción H-002 | UI: ELITE/CONFIRMADO; RF separado ELITE 83,4 % / NORMAL 16,6 % | Formulario manual confirmado; captura corroboró bloques y porcentajes |
| H-001 | Ficha: DESCARTE/Confirmada, causa 01/11/2026, límite 21/11/2026; no ejecuta descarte | Estado descargado; no se repitió su pantalla individual |
| H-004 | Ficha: Provisional, propuesta pendiente, sin clase definitiva ni recomendaciones | Estado descargado; no se repitió su pantalla individual |
| H-005 | Ficha: Confirmada; fecha del cuarto parto pendiente, sin vencimiento | Estado descargado; no se repitió su pantalla individual |
| RAG con fuentes | Materiales, top_k=5: fuentes 23,43,21,40,16. Extracto mezcla jaulas/pozas: no se afirma pertinencia | Usuario confirmó respuesta y fuentes |
| RAG fuera del corpus | «¿Cómo configuro una impresora Wi-Fi?» → abstención y ninguna fuente | UI leída: «cómo configuro una impreso wi-fi ?» (texto del usuario), abstención y ninguna fuente |
| Reapertura | Usuario cerró/reabrió: sesión y Galpón Norte sin escribir contraseña | Mismo resultado confirmado manualmente |

Windows se operó con Computer Use sobre la ventana del perfil Ensayo, no con HTTP/SQL para simular UI. Android bloquea inyección (`INJECT_EVENTS`): Oskar operó formularios; ADB se limitó a preparación, reverse y lectura. Capturas/configuración privadas quedan fuera de Git. La captura RF incluye una superposición ajena al ensayo y no se publica como material de presentación.

La ficha de H-002 ya mostraba la categoría preparada; la consulta informativa no declara/revisa evidencia. Se detectó un defecto de presentación: el estado inicial vacío de `evidence` mostraba «Sin evidencia registrada» sin haber consultado el servidor. Se corrigió: estado inicial «todavía no se ha consultado», consulta explícita de solo lectura, carga/error y ausencia solo tras respuesta vacía correcta. Windows leyó los siete criterios REVISADA por UI; Oskar confirmó lo mismo en el APK actualizado. No se declaró ni revisó evidencia nueva para esta comprobación.

La primera parte del recorrido utilizó el ejecutable instalado con perfil separado y el APK anterior (`b031f5a7…`). Para desplegar el ajuste sin cambiar la app principal, se empaquetó un ejecutable Windows propio de Ensayo y se actualizó solo el APK `.ensayo`, conservando los perfiles. La pantalla corregida se verificó en esos artefactos; no se atribuye una repetición completa de todos los casos al nuevo build.

## Comprobaciones complementarias

- **HTTP real, 7 casos:** candidata con RF; faltantes NORMAL/REVISAR y apoyo NULL; viewer 403 en evaluación y push v2; asistente con fuentes; abstención; sin token 401.
- Tras integrar `origin/dev` (#192/#194), reinicio exclusivo del backend Ensayo; `rag/tests/test_select.py`: **5 passed**. Servicios re-verificados sin reindexar; E5, corpus, umbral y top_k=5 conservados.
- RF privado verificado por SHA-256 autorizado antes de cargar, sin reentrenar; límites científicos vigentes.
- Ajuste del cliente: **8 pruebas de predicciones passed**, `npm run lint`, build web/Electron, sincronización Electron y empaquetado `--dir` correctos. Android `assembleDebug -PensayoAppId=true`, JDK21/SDK36: **BUILD SUCCESSFUL**. Un primer comando no propagó las variables de Java/SDK; se corrigió la invocación sin cambiar dependencias. Detector Impeccable del archivo UI: sin hallazgos.
- SQLite Windows: 990,25 una vez, outbox accepted, `integrity_check=ok`.
- Dominio del piloto habitual: conteos de las siete tablas iguales al baseline (cero); sin promoción en él.
- **Backup final:** PGDMP de 85.091 bytes, SHA-256 `535fa09d2f61e6035eba1dc646451ae07b57d11dfd17420d840b61113a4b816a`. `pg_restore` en base aislada: mismos conteos de las ocho tablas comprobadas. Base de comprobación y dump temporal del contenedor eliminados; respaldo privado conservado.

## Límites y estado final

Acceso, sync bidireccional, registro offline, repetición sin duplicados, RF nativo y conexión del asistente comprobados. Casos de categorías/alertas preparados y sus fichas observadas en Windows. Viewer se verificó por HTTP aquí; su UI y conflictos conservan evidencia previa de [RF nativo](rf-visualizacion-nativa.md) y [conflictos](conflictos-dominio-ui.md), sin atribuir una repetición nueva.

La selección extractiva RAG mantiene limitaciones (#194), incluida B8. Gestación/vitamina C no se declaran resueltas. No se reindexó ni se modificó el selector para fabricar respuestas. Las decisiones D1–D15, revisión experta y promoción real conservan sus puertas de aprobación.

Backend Ensayo en `127.0.0.1:8000`, USB reverse restablecido y accesos **Iniciar Ensayo Local / Reconectar celular Ensayo** comprobados. Sesión/datos conservados al reabrir según confirmación manual. Controles locales al equipo: no garantizan estabilidad ante memoria agotada ni sustituyen un despliegue remoto.
