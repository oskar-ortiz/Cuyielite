# Plan de prueba de aceptación — Luis / Centro Lope (SENA)

Versión del escenario: **CuyiElite Ensayo, PR #191 (`0e76da1`)**. Presentación prevista para el 20/11/2026; la prueba de aceptación de Luis/SENA se registrará cuando ocurra. Rutas/hashes vigentes en [Ensayo aislado](ensayo-funcional-aislado.md#artefactos). **Resultados, participantes, fecha real y evidencia se completan durante la sesión; no están preaprobados.**

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
| AT-01 | Identificar Ensayo | Ejecutar Iniciar Ensayo Local y abrir CuyiElite Ensayo en ambos equipos | Windows usa su ejecutable/perfil propio; Android es `.ensayo`; principal intacta |  |  |
| AT-02 | Separar Demo/Trabajo | Entrar a Demo, volver con «Cambiar modo» y entrar a Trabajo | Cada modo muestra su propia base; no se mezclan registros |  |  |
| AT-03 | Consultar galpones/pozas/animales | Trabajo → Galpón Norte → P-01/P-02 → animales | Ocho animales del escenario; la muestra independiente Demo no se confunde con Trabajo |  |  |
| AT-04 | Rol viewer | Iniciar sesión como viewer e intentar una acción de escritura | Solo consulta; sin acciones de edición |  |  |
| AT-05 | Registro local autorizado | Admin: H-002 → Registrar pesaje, guardar un valor nuevo | Persiste local; la operación queda pendiente hasta sincronizar |  |  |
| AT-06 | Offline y outbox | Registrar sin backend y comprobar la operación pendiente | La operación queda conservada |  |  |
| AT-07 | Reconexión y sincronización | Reconectar y sincronizar dos veces | Sin duplicación; mensaje de registros recibidos/enviados |  |  |
| AT-08 | Conflicto (opcional, si está preparado) | Resolver un conflicto real del escenario con una acción autorizada | Sin merge automático ni edición de versiones; si no hay caso, registrar NO EJECUTADO y citar evidencia previa |  |  |
| AT-09 | Reglas y RF | H-002, parámetros del guion; Evaluar candidata | ELITE/CONFIRMADO y RF separado; no cambia categoría. El caso sin modelo tiene evidencia previa, no cambiar configuración durante la exposición |  |  |
| AT-10 | Evaluaciones y alertas | Revisar dos abortos, cuarto parto y evidencia declarada/revisada | Provisional vs oficial; fecha ausente no inventada; sin descarte automático |  |  |
| AT-10b | Leer evidencia existente | H-002 → Predicciones → Consultar evidencia del servidor | Siete criterios REVISADA; no declarar ni guardar de nuevo |  |  |
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
