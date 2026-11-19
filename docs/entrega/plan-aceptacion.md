# Plan de prueba de aceptación — Luis / Centro Lope (SENA)

Candidata: `candidata-ac81eef-20261118`. **Los campos de resultado, participante, fecha, versión y evidencia se completan en la sesión de prueba; no están prellenados.**

## Diferenciación de criterios

| Tipo | Qué evalúa | Quién decide |
|---|---|---|
| Usabilidad | Claridad de pantallas, navegación y comprensión de las acciones | Participantes de Luis/SENA |
| Funcionamiento técnico | Arranque, bases separadas, roles, sincronización, asistente, recuperación | Oskar con evidencia del ensayo |
| Validación de dominio | Correspondencias zootécnicas, pertinencia RAG, evaluación experta | Diery y revisor de Lope |

Un resultado de usabilidad favorable **no** equivale a validación de dominio ni autoriza carga real.

## Casos de aceptación

| ID | Objetivo | Tarea para el participante | Resultado esperado | Resultado observado | Evidencia |
|---|---|---|---|---|---|
| AT-01 | Identificar la candidata | Abrir el acceso directo `CuyiElite Candidata ac81eef.lnk` | Se abre el ejecutable verificado; no el instalado en `%LOCALAPPDATA%\Programs` |  |  |
| AT-02 | Separar Demo/Trabajo | Entrar a Demo, volver con «Cambiar modo» y entrar a Trabajo | Cada modo muestra su propia base; no se mezclan registros |  |  |
| AT-03 | Consultar galpones/pozas/animales | Recorrer Demo: galpón → pozas → animales | Listado coherente con datos sintéticos |  |  |
| AT-04 | Rol viewer | Iniciar sesión como viewer e intentar una acción de escritura | Solo consulta; sin acciones de edición |  |  |
| AT-05 | Registro local autorizado | Registrar un galpón o poza sintética con admin | Persiste en la base local del modo elegido |  |  |
| AT-06 | Offline y outbox | Registrar sin backend y comprobar la operación pendiente | La operación queda conservada |  |  |
| AT-07 | Reconexión y sincronización | Reconectar y sincronizar dos veces | Sin duplicación; mensaje de registros recibidos/enviados |  |  |
| AT-08 | Conflicto sintético | Resolver un conflicto con una acción autorizada | Sin merge automático; sin edición manual de versiones/recibos |  |  |
| AT-09 | Reglas y RF | Consultar una predicción con y sin modelo | Reglas en bloque principal; RF como apoyo separado o ausencia explicada |  |  |
| AT-10 | Evaluaciones y alertas | Revisar dos abortos, cuarto parto y evidencia declarada/revisada | Provisional vs oficial; fecha ausente no inventada; sin descarte automático |  |  |
| AT-11 | Asistente | Pregunta con fuentes y pregunta fuera de corpus | Fuentes visibles; abstención correcta |  |  |
| AT-12 | Límite del asistente | Preguntar por gestación/vitamina C | Se explica que la pertinencia está pendiente; no se declara validado |  |  |
| AT-13 | Cerrar y reabrir | Cerrar y reabrir la app | Sesión y datos según comportamiento vigente |  |  |
| AT-14 | Recuperación | Simular backend caído y restaurar el servicio | `/health` 200; sin pérdida de operación pendiente |  |  |

## Campos de la sesión

- Participante / rol: ____________________
- Plataforma y artefacto: ____________________
- Versión / SHA-256 del artefacto: ____________________
- Fecha: ____________________
- Evidencia (captura/log): ____________________

## Enlaces

- Guion: [guion-demostracion.md](guion-demostracion.md).
- Guía de usuario: [guia-usuario.md](guia-usuario.md).
- Formato de observaciones: [observaciones.md](observaciones.md).
- Ensayo real de la candidata: `docs/verificaciones/ensayo-candidata-luis-sena.md`.
- Documentos D1–D15 y matriz canónica: `docs/verificaciones/matriz-carga-real-lope.md`. **No se marcan decisiones como aprobadas en este plan.**
