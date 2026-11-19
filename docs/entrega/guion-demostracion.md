# Guion de demostración — CuyiElite Ensayo, 20/11/2026

Presentación prevista, aún no realizada al escribir este guion. Duración estimada: **20–25 minutos**. Usar el escenario comprobado de [Ensayo aislado](ensayo-funcional-aislado.md); no modificar la aplicación principal ni importar datos reales para la exposición.

## Preparación previa (5 min, antes de la sesión)

1. Conservar el computador encendido/alimentado, abrir Docker Desktop y conectar el teléfono físico por USB. Mantener Pixel_36 cerrado para ahorrar memoria.
2. Ejecutar **Iniciar Ensayo Local.cmd** del Escritorio: esperar `ensayo listo` y `USB: teléfono enlazado con backend 8000`.
3. Abrir **CuyiElite Ensayo** en Windows y celular → **Entrar a trabajo**. Si pide acceso, usar `ensayo.admin` con la contraseña privada. No proyectar credenciales.
4. Sincronizar ambos y comprobar **Galpón Norte → P-01 → Animales**. Confirmar que no hay operaciones, conflictos o rechazos previos pendientes.
5. Tener a mano [observaciones](observaciones.md), [plan de aceptación](plan-aceptacion.md) y la [guía de recuperación](ensayo-funcional-aislado.md). No usar el backend habitual del piloto a mitad del recorrido.

## Apertura: qué decir (30–45 segundos)

«CuyiElite organiza galpones, animales e historial productivo en Windows y Android. Permite registrar localmente y sincronizar después. Las reglas explican la clasificación; el modelo es apoyo y el asistente muestra sus fuentes. Hoy enseñamos el sistema con un escenario de ensayo separado. El aval del proyecto está registrado; la prueba de aceptación con el Centro y la carga de sus registros reales se harán posteriormente.»

## Secuencia de pantallas

| # | Pantalla / acción | Caso sintético | Qué explicar al instructor | Min |
|---|---|---|---|---|
| 1 | Elegir modo → Trabajo | Abrir el mismo inventario en ambas apps | Ensayo tiene su propia base; principal y muestra de Demostración están separadas | 1 |
| 2 | Galpón Norte → P-01 → H-001 | Ubicación, cuatro partos, evento; P-02 contiene CR-001 | La ficha reúne identificación e historial; la chapa no reemplaza el UUID de identidad | 2 |
| 3 | Windows: H-002 → Registrar pesaje | Peso nuevo, por ejemplo 1001.25; etapa CONTROL; fecha real de la sesión o vacía conscientemente | Guardar escribe primero en SQLite; una fila nueva no es todavía publicación central | 2 |
| 4 | Sincronizar Windows y luego celular | Ver ese peso en H-002 del teléfono; repetir sync | Los dos clientes comparten el cambio publicado; repetir no lo duplica | 2 |
| 5 | Desconectar solo el USB y registrar en celular | Otro peso nuevo, por ejemplo 1002.50; guardar sin enlace | El registro queda local/pendiente. No pulsar repetidamente sincronizar sin conexión | 2 |
| 6 | Reconectar USB → Reconectar celular Ensayo.cmd | Sincronizar celular y Windows; ver el nuevo peso una vez | La operación pendiente se envía al recuperar conexión. Revisar resumen; no editar cursores | 2 |
| 7 | H-002 → Predicciones → Candidata | Parámetros indicados abajo, Evaluar candidata | ELITE por reglas; RF exploratorio separado. Consultar no cambia categoría ni alertas | 3 |
| 8 | Evidencia y fichas H-001/H-004/H-005 | Consultar evidencia; contrastar confirmada, provisional y fecha ausente | Evidencia revisada no es declarada; una propuesta no es categoría oficial y ninguna alerta ejecuta descarte | 3 |
| 9 | Trabajo → Asistente, Resultados 5 | Consulta del manual y control Wi-Fi indicados abajo | Mostrar respuesta/citas y abstención; no atribuir validación global a fuentes reales | 3 |
| 10 | Acceso viewer y reapertura | Cambiar a ensayo.viewer; comprobar consulta sin edición, cerrar/reabrir; volver a admin al terminar | Permisos reales, sesión y datos conservados. La prueba de Luis/SENA sigue siendo posterior | 2 |

## Datos y frases para las pantallas clave

**Predicción H-002:** NUPAR `3`, TCNV `4`, nacimiento `150`, destete `320`, días `15`, monta `950`, ojos `1 / Negro`. Pulsar **Evaluar candidata**, no los botones de declaración/guardado oficial. Explicar: «La regla da ELITE/CONFIRMADO; el apoyo del modelo se ve aparte (en la comprobación: 83,4 % y 16,6 %), no sustituye la regla ni certifica el desempeño en campo». Debajo pulsar **Consultar evidencia del servidor**: se leen siete criterios REVISADA sin cambiarlos.

**Alertas:** H-001 tiene cuarto parto del 01/11/2026 y fecha sugerida 21/11/2026; H-004 muestra Provisional sin categoría definitiva ni alerta; H-005 señala fecha del cuarto parto pendiente, sin vencimiento inventado. Decir: «El sistema apoya una decisión; no saca automáticamente al animal». Son fechas fijas del escenario y no deben reinterpretarse como observaciones reales del Centro.

**Asistente:** preguntar `¿Qué materiales se pueden usar para construir comederos y pasteras?`, con Resultados `5`. Mostrar las fuentes; el extracto observado mezcla texto de jaulas/pozas, así que explicar la limitación si se repite, sin defenderlo como respuesta correcta. Después `¿Cómo configuro una impresora Wi-Fi?`: esperar abstención y fuentes vacías. Decir: «La conexión y trazabilidad están comprobadas; la pertinencia de algunas respuestas sigue en mejora con Diery». No cambiar umbral, índice o backend durante la exposición.

**Conflictos (opcional):** abrir Revisar conflictos; si está vacío, explicar las dos acciones disponibles con la evidencia previa. No crear a última hora un conflicto mediante SQL ni afirmar que se resolvió uno en esta sesión si no ocurrió.

## Cierre y registro (1 minuto)

Decir: «Hemos mostrado registro local, intercambio entre equipos, reglas/modelo separados y consulta documental. El aval permite el proyecto; la aceptación del sistema y las decisiones sobre datos reales se registrarán cuando el Centro haga la prueba». Anotar versión/hash, participantes, casos realmente ejecutados, observaciones y cualquier caso no ejecutado. No rellenar firmas ni resultados por adelantado.

## Plan alternativo

- **Sin backend**: conservar consulta/registro local en Trabajo y su pendiente; ejecutar Iniciar Ensayo Local. No simular una sincronización completada.
- **Sin enlace del celular**: reconectar USB y ejecutar Reconectar celular Ensayo. Si no se recupera, mostrar Windows y registrar el caso móvil como no ejecutado; no abrir el emulador como reemplazo pesado.
- **Si falta el modelo RF**: mostrar «Sin apoyo del modelo»; no es un fallo.
- **Si el asistente no responde**: comprobar `/health` y `adb reverse`; no inventar respuesta ni usar HTTP para simular la pantalla.

## Qué NO presentar como validado

- Pertinencia de las respuestas de gestación y vitamina C.
- Aceptación institucional, aprobación de correspondencias ni autorización de carga real.
- Firma/distribución certificada: el instalador principal ya fue comprobado, pero no tiene firma comercial; Ensayo usa ejecutable propio.
- La app principal como si estuviera sincronizando con su base mientras 8000 sirve Ensayo.
- Resultados de evaluaciones de dominio que no hayan sido revisados por Luis/SENA.
- El APK debug como “release de producción”.
