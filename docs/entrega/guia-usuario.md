# Guía breve de usuario — candidata `candidata-ac81eef-20261118`

## Demo y Trabajo

Al abrir la app se elige **Demostración** o **Trabajo**. Cada modo conserva su base por separado y se puede cambiar con «Cambiar modo». Demo contiene galpones y pozas de prueba; Trabajo es la base del piloto y puede estar vacía en un perfil nuevo. No mezclar registros entre modos.

## Acceso admin y viewer

En Trabajo → «Acceso» se inicia sesión con la cuenta personal. Las credenciales del piloto se entregan por canal privado de Oskar y no están en este paquete.

- **Administrador**: puede registrar y editar en la base local; la sesión tiene ámbito y dispositivo propios.
- **Viewer (`lope.viewer`)**: solo consulta. No muestra acciones de escritura y no puede sincronizar cambios propios.
- Tras cerrar y reabrir, la sesión activa se recupera según el comportamiento vigente. Si se pierde, volver a «Acceso».

## Registro y consulta

En Galpones se pueden crear galpones y pozas; desde una poza se consultan los animales. «Nuevo» y «Editar» son las acciones locales autorizadas según el rol. Trabaja sin conexión: los cambios quedan en la base local y en la outbox.

## Offline, sincronización y conflictos

- Sin backend, la consulta y el registro local siguen funcionando; la operación pendiente se conserva.
- «Sincronización» ejecuta `context → pull → push`. El reenvío es idempotente: repetir la sincronización no duplica registros.
- Si aparece un conflicto, «Revisar conflictos» ofrece conservar la versión central o reenviar una edición revisada. No se hacen merges automáticos y no se editan manualmente versiones ni recibos.

## Reglas frente al apoyo del modelo

La clase principal la determinan las **reglas zootécnicas**. El Random Forest es un **apoyo separado**: muestra probabilidades cuando el modelo está disponible y «Sin apoyo del modelo» cuando falta o no es válido. «Evaluar y guardar» es la única acción que persiste una evaluación oficial.

## Evaluaciones, evidencia y alertas

- «Declarada» y «Revisada» son estados distintos; no se presenta evidencia declarada como revisada.
- Dos abortos son una **propuesta provisional**: sin categoría oficial ni alerta.
- El cuarto parto confirmado se trata con reglas; si falta la fecha, no se inventa.
- El descarte **no** se ejecuta automáticamente.

## Asistente y límites de sus respuestas

Escribir una pregunta concreta, conservar `top_k=5` y pulsar «Preguntar». La respuesta muestra el texto devuelto por el servidor y el bloque «Fuentes» con páginas del manual. Fuera del corpus responde: «No encontré esta información en los manuales.» y sin fuentes.

**Importante:** que haya fuentes y HTTP 200 no significa que la respuesta sea pertinente o esté validada. La pertinencia de gestación y vitamina C sigue en revisión con Diery. No presentar estas respuestas como validadas.

## Recuperación básica y responsables

- Si `/health` no responde: `python -m tools.piloto.servidor start` (o `status` para diagnosticar).
- Si el emulador no alcanza el backend: `adb reverse tcp:8000 tcp:8000`. En un teléfono físico esa configuración no aplica.
- No borrar datos ni desinstalar la app habitual para “arreglar” la sesión.
- Responsables: Oskar (plataforma/integración), Diery (datos, IA y pertinencia), Luis/SENA (dominio y aceptación). Canal privado de credenciales: Oskar.

Detalle operativo: `docs/operacion/piloto-local.md`. Ensayo de esta candidata: `docs/verificaciones/ensayo-candidata-luis-sena.md`.
