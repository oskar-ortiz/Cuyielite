# Aprobación técnica de los cuatro documentos Lope

Fecha de aprobación: **2026-11-17**, zona horaria America/Bogota.

Aprobador: **Oskar**, responsable de plataforma. Estado: **APROBACIÓN TÉCNICA CON RESERVAS EMITIDA**.

## Evidencia y versiones

Oskar respondió en esta conversación a la solicitud de confirmación de la aprobación técnica de los cuatro documentos con las reservas descritas. Texto recibido literalmente:

> pruebo técnicamente esos cuatro documentos con esas reservas

Se registra en el contexto de la confirmación solicitada inmediatamente antes: «apruebo técnicamente esos cuatro documentos con esas reservas». No se atribuye esta aprobación a Diery ni al Centro Lope.

La aprobación corresponde al contenido de los archivos en el commit `b0204ea`, incorporado mediante el PR #170 (merge `0bb3a98`). Los hashes se comprobaron antes de solicitar la aprobación y deben verificarse al reutilizar este registro.

| Documento en `docs/datos/` | SHA-256 del contenido aprobado |
|---|---|
| `lope-diccionario-mapeo.md` | `8da952de085324830344efa6424e4eb398aa84d76744d4e3030c3859cea05591` |
| `lope-identidad-conciliacion.md` | `8c053cd61c832a267ca1a334532d8f77baaf5ee79c21d8728f48500660e2f027` |
| `lope-modelo-ddl-propuesto.md` | `9df87433326834e9e39894d607e9c1884608a47fa87551819e924b25da153c0f` |
| `lope-plan-migracion-validacion.md` | `511758c12d010a868780da98b069b1778fe8d98aaf527c14124b3297b6928575` |

Los cuatro archivos se conservan sin modificación para mantener verificables los contenidos aprobados. Sus encabezados y registros vacíos describen su estado al publicarse; este registro posterior acredita exclusivamente la aprobación técnica de Oskar.

## Alcance

Conformidad técnica con las cinco entidades de dominio, `parto_crias` como filas con identidad estable y restricciones vigentes, replay con mismo `lote_id` y clave global, aislamiento de ámbito, transacción exterior única, versiones 1/+1/no-op, NULL distinto de cero y separación de consultas informativas respecto de evaluaciones oficiales.

Se incluye la corrección documental de unicidad: el UUID `id` identifica al animal; la chapa puede repetirse en PostgreSQL y SQLite. La repetición no demuestra identidad ni autoriza fusión de registros.

## Reservas y operaciones pendientes

- Revisor técnico/de dominio por designar y decisiones sobre vínculos, identidades, roles y correspondencias de registros reales.
- Catálogo de eventos y fuentes verificadas de abortos, peso de monta y motivos de salida. `R = REEMPLAZO` conserva la procedencia de la aclaración de Oskar, sin atribuir confirmación institucional.
- Validación experta ciega y pendientes de procedencia/calidad de RAG.
- Revisión de dry-run, respaldo restaurable, destino autorizado y autorización explícita de una promoción concreta.

Esta aprobación **no acepta correspondencias reales, no sustituye la validación zootécnica y no autoriza una promoción de datos**. No declara cerradas las reservas ni aprobadas todas las propuestas incluidas en los documentos.

La [matriz canónica de carga](matriz-carga-real-lope.md) mantiene los requisitos operativos. La [revisión técnica](revision-entrega-diery-final.md) contiene el contraste y las reservas previas. Cambios posteriores al contenido aprobado requieren revisar su impacto y no heredan automáticamente esta aprobación.
