# Matriz final de pendientes

Actualizada el **19/11/2026** para el Ensayo de Windows/teléfono, código PR #191 (`0e76da1`). La fuente canónica de requisitos de carga sigue siendo `docs/verificaciones/matriz-carga-real-lope.md`. Este índice no la reemplaza ni acepta correspondencias.

| Pendiente | Responsable | Estado | Condición de cierre |
|---|---|---|---|
| Ensayo Windows (ejecutable propio, perfil, reapertura) | Oskar | **Comprobado** | [Recorrido vigente](../verificaciones/ensayo-funcional-windows-celular.md); principal intacta |
| Ensayo Android (teléfono físico `.ensayo`) | Oskar | **Comprobado** | Registro offline, sync bidireccional, RF, RAG y reapertura; no confundir con la evidencia previa `.lab` |
| Instalador NSIS actualizado | Oskar | **Comprobado, sin firma comercial** | Instalación y reinstalación con datos conservados; [evidencia](../verificaciones/instaladores-piloto.md) |
| Acceso directo habitual | Oskar | **Actualizado** | Destino instalado contrastado con ejecutable y app.asar verificados |
| APK para celular físico | Oskar | **Instalado y actualizado sin borrar datos** | Hash instalado coincide con el [APK Ensayo](ensayo-funcional-aislado.md#artefactos); evidencia en UI |
| Integración RAG en ambas apps | Oskar | **Comprobada** | Respuesta/fuentes, abstención y permisos; no equivale a pertinencia global |
| Pertinencia RAG (incluida B8) y validación experta | Diery / Luis | **Pendiente de mejora/validación** | Procedencia de preguntas entregada en el repo; conservar evaluación y límites, sin afirmar corrección global |
| Aprobación técnica de los cuatro documentos Lope | Oskar | **Emitida con reservas** | No volver a presentar como pendiente |
| Aval del proyecto y responsable de dominio | Oskar / Luis | **Confirmados por Oskar el 19/11/2026** | Aval entregado por Diery; Luis Mangin registrado; soporte privado, sin inspección de firma atribuida al agente |
| Validación zootécnica / correspondencias | Luis / SENA + revisor | **Pendiente** | Revisión de los cuatro documentos sobre datos sintéticos y criterio de dominio |
| Decisiones humanas y dry-run revisado | Diery / SENA | **Pendiente** | 3.428 propuestas permanecen `PENDIENTE`; no se promovió ninguna |
| Autorización de carga real | Luis / SENA + Oskar | **Pendiente** | Revisión humana, respaldo inmediato y autorización explícita |
| Entrega reconciliada RF e integración | Diery / Oskar | **Entregada y comprobada técnicamente** | Hash autorizado, backend y UI con apoyo separado; no se requiere regenerar el mismo bundle para este cierre |
| Validación científica/experta del RF | Diery / revisor | **Pendiente** | Etiquetas de reglas y límites de identidad/deduplicación documentados; prueba experta posterior |

## Condiciones para una promoción real

Aplicar únicamente la puerta de ejecución de la [matriz canónica](../verificaciones/matriz-carga-real-lope.md#puerta-de-ejecución): decisiones aceptadas con evidencia, destino autorizado, dry-run revisado, respaldo restaurable y autorización concreta, con responsable registrado. La pertinencia RAG es un frente de calidad independiente; no se agrega aquí como requisito inventado de importación.

La presentación de Ensayo puede realizarse antes de esa carga y de la prueba posterior con Luis/SENA. No se declara aceptación de campo ni release de producción por haber mostrado el ensayo.
