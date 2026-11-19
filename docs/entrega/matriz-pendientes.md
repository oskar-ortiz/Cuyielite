# Matriz final de pendientes

La fuente canónica de requisitos de carga sigue siendo `docs/verificaciones/matriz-carga-real-lope.md`. Esta tabla es un índice operativo de la candidata `candidata-ac81eef-20261118`; no la reemplaza ni marca decisiones como aprobadas.

| Pendiente | Responsable | Estado | Condición de cierre |
|---|---|---|---|
| Plataforma Windows (ejecutable empaquetado, perfil aislado, reapertura) | Oskar | **Cerrado por plataforma** | Verificado en esta sesión; `ensayo-candidata-luis-sena.md` |
| Plataforma Android (`.lab`, A–D, viewer, reapertura) | Oskar | **Cerrado por plataforma** | Verificado con evidencia equivalente; `rag-comprobacion-ui.md` |
| Instalador NSIS actualizado | Oskar | **Comprobado, sin firma comercial** | Instalación y reinstalación con datos conservados; [evidencia](../verificaciones/instaladores-piloto.md) |
| Acceso directo habitual | Oskar | **Actualizado** | Destino instalado contrastado con ejecutable y app.asar verificados |
| APK para celular físico | Oskar | **Archivo preparado; teléfono no observado** | Firma/debug y ABI comprobados; Oskar instalará según la [guía](instalar-piloto.md) |
| Pertinencia RAG (gestación, vitamina C), procedencia de preguntas y validación experta | Diery | **Pendiente** | Revisión de fuentes/páginas y criterio experto; no se ajustó umbral ni generación |
| Aprobación técnica de los cuatro documentos Lope | Oskar | **Emitida con reservas** | No volver a presentar como pendiente |
| Validación zootécnica / correspondencias | Luis / SENA + revisor | **Pendiente** | Revisión de los cuatro documentos sobre datos sintéticos y criterio de dominio |
| Decisiones humanas y dry-run revisado | Diery / SENA | **Pendiente** | 3.428 propuestas permanecen `PENDIENTE`; no se promovió ninguna |
| Autorización de carga real | Luis / SENA + Oskar | **Pendiente** | Revisión humana, respaldo inmediato y autorización explícita |
| Regeneración del bundle RF y validación científica | Diery | **Pendiente** | Hash verificado en backend; apoyo separado, sin aprobación científica |

## Condiciones para una promoción real

1. Correspondencias revisadas por el revisor de dominio.
2. Pertinencia RAG resuelta por Diery sin cambiar el frente de generación de este paquete.
3. Decisiones humanas registradas y dry-run revisado sobre la matriz canónica.
4. Respaldo inmediato y comprobación de restauración en destino aislado.
5. Autorización explícita de Luis/SENA y de Oskar.

Hasta que se cumplan, **no** se cargan datos reales, **no** se declara finalizado el proyecto y **no** se presenta la candidata como release de producción.
