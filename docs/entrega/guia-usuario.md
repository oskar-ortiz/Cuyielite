# Guía breve de usuario — Ensayo Windows y celular

Versión de código: PR #191 (`0e76da1`), actualizada el 19/11/2026. Inicio completo y hashes en [Ensayo aislado](ensayo-funcional-aislado.md). Abrir Docker, conectar USB y ejecutar **Iniciar Ensayo Local.cmd**. Usar **CuyiElite Ensayo** en ambos equipos; la app principal queda separada.

## Demo y Trabajo

Al abrir se elige **Demostración** o **Trabajo**. Cada modo conserva su base separada. Para el recorrido completo actual elegir **Trabajo**: Galpón Norte → P-01/P-02 → Animales. Demostración conserva su muestra independiente de galpones/pozas; no es el inventario preparado de Ensayo.

## Acceso admin y viewer

En Trabajo → «Acceso» usar las cuentas privadas de Ensayo (`ensayo.admin` / `ensayo.viewer`). Contraseñas por canal privado de Oskar, nunca en la presentación. No usar las cuentas `lope.*` en este laboratorio.

- **Administrador**: puede registrar y editar en la base local; la sesión tiene ámbito y dispositivo propios.
- **Viewer (`ensayo.viewer`)**: solo consulta. Descarga cambios sin enviar operaciones pendientes y no puede escribir ni resolver conflictos.
- Tras cerrar y reabrir, la sesión activa se recupera según el comportamiento vigente. Si se pierde, volver a «Acceso».

## Registro y consulta

En Galpones se pueden crear galpones y pozas; desde una poza se consultan los animales. «Nuevo» y «Editar» son las acciones locales autorizadas según el rol. Trabaja sin conexión: los cambios quedan en la base local y en la outbox.

## Offline, sincronización y conflictos

- Sin backend, la consulta y el registro local siguen funcionando; la operación pendiente se conserva.
- «Sincronización» envía y recibe cambios mediante los protocolos correspondientes. Repetir un ciclo completo no duplica registros; comprobar siempre el resumen y los pendientes.
- Si aparece un conflicto, «Revisar conflictos» ofrece conservar la versión central o reenviar una edición revisada. No se hacen merges automáticos y no se editan manualmente versiones ni recibos.

## Reglas frente al apoyo del modelo

La clase principal la determinan las **reglas zootécnicas**. El Random Forest es un **apoyo separado**: la ausencia se explica sin inventar probabilidades; un artefacto defectuoso puede producir un error y no equivale a modelo ausente. La consulta informativa no cambia categoría ni alertas. **Evaluar y guardar**, con permisos y evidencia aplicables, solicita una evaluación oficial.

## Evaluaciones, evidencia y alertas

- «Declarada» y «Revisada» son estados distintos; no se presenta evidencia declarada como revisada.
- **Consultar evidencia del servidor** lee los criterios existentes sin declararlos, revisarlos ni guardar otra evaluación. Antes de consultar, la pantalla no afirma que falten evidencias.
- Dos abortos son una **propuesta provisional**: sin categoría oficial ni alerta.
- El cuarto parto confirmado se trata con reglas; si falta la fecha, no se inventa.
- El descarte **no** se ejecuta automáticamente.

## Asistente y límites de sus respuestas

Escribir una pregunta concreta, conservar `top_k=5` y pulsar «Preguntar». La respuesta muestra el texto devuelto por el servidor y el bloque «Fuentes» con páginas del manual. Fuera del corpus responde: «No encontré esta información en los manuales.» y sin fuentes.

**Importante:** que haya fuentes y HTTP 200 no significa que la respuesta sea pertinente o esté validada. La pertinencia de gestación y vitamina C sigue en revisión con Diery. No presentar estas respuestas como validadas.

## Recuperación básica y responsables

- Si el backend no responde: abrir Docker y ejecutar **Iniciar Ensayo Local.cmd**; comprobar `ensayo listo`.
- Si el celular no conecta: reconectar USB, autorizarlo en el teléfono y ejecutar **Reconectar celular Ensayo.cmd**. El reverse por serial también funciona en el teléfono físico autorizado; no requiere exponer la API por Wi-Fi.
- No borrar datos ni desinstalar la app habitual para “arreglar” la sesión.
- Responsables: Oskar (plataforma/integración), Diery (datos, IA y pertinencia), Luis/SENA (dominio y aceptación). Canal privado de credenciales: Oskar.

Detalle: [Ensayo aislado](ensayo-funcional-aislado.md) y [evidencia vigente](../verificaciones/ensayo-funcional-windows-celular.md). Para volver a la principal hay que restaurar el modo piloto del backend según esa guía; no basta cambiar de acceso directo.
