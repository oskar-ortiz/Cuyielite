# Preparación operativa del piloto para recibir decisiones (2026-11-17)

Estado: **preparación operativa completada; promoción real no autorizada**. El registro de aprobación técnica de Oskar con reservas ya existe en `docs/verificaciones/aprobacion-tecnica-documentos-lope.md` (PR #171, commit `739326f`): no se duplica ni se contradice. Los requisitos humanos siguen en la matriz canónica `docs/verificaciones/matriz-carga-real-lope.md`; este documento enlaza esa matriz en vez de copiarla.

Base: `origin/dev` `9546e4f` (PR #171 fusionado). Rama `chore/preparacion-operativa-carga-piloto`.

## 1. Auditoría de lo ya listo

### a) Implementado y comprobado

| Bloque | Evidencia existente |
|---|---|
| Flujo revisión → decisiones → manifiesto → promoción → publicar_cambios → pull | `tools/lope_import/{adapt,decisions,manifest,promote}.py`; `docs/verificaciones/etl-manifiesto-integracion.md`; ensayo sintético `tools/lope_import/rehearse.py` |
| Contrato de decisiones `lope_import_review_decisions/v1`, ACEPTADO con revisor/evidencia/identidad, estados PENDIENTE/AMBIGUO/RECHAZADO | `tools/lope_import/decisions.py`; suites de `tools/lope_import/tests` |
| Clave global y lote estable; rechazo de reutilización en otro ámbito | `importacion_lotes` con 0009; pruebas de replay y ámbito |
| Transacción exterior, rollback, no-op y versión +1 | `promote.py` + `backend/app/services/publication.py`; `docs/verificaciones/etl-manifiesto-integracion.md` |
| RF real (presente y ausente) y fila de pozas en Android/Windows | PR #168 y #169; `docs/verificaciones/rf-visualizacion-nativa.md` |
| Aprobación técnica con reservas | `docs/verificaciones/aprobacion-tecnica-documentos-lope.md` |
| Esquema efectivo y unicidad (chapa repetible, identidad `id`) | `docs/verificaciones/piloto-paridad-documentacion.md` §5 |
| Respaldo/restauración del piloto | `scripts/piloto-local.ps1`; esta entrega corrigió y verificó el respaldo binario |

### b) Preparado pero pendiente de ejecución

- Dry-run real con conteos por entidad y decisión: comando listo (§2), no ejecutado sobre datos reales.
- Respaldo inmediatamente anterior a una promoción concreta: procedimiento listo (§3); el ensayo de hoy no sustituye esa comprobación futura.
- Recepción de D1–D14 y de las decisiones humanas: flujo listo, archivos privados sin aceptaciones.
- Demostración sintética reproducible: guion en §5.

### c) Dependiente de Diery/Lope

- Documento D1–D14 y su numeración definitiva (Diery).
- Decisiones zootécnicas y designación del revisor (Centro Lope / Oskar).
- Pertinencia RAG, procedencia de preguntas y validación experta (Diery).
- Lista exacta de pendientes y responsables: matriz canónica enlazada arriba.

### d) Defectos técnicos reproducibles encontrados y corregidos en esta entrega

1. **`scripts\piloto-local.ps1 backup` corrompía el dump.** `pg_dump -Fc > archivo` en Windows PowerShell 5.1 convierte la salida binaria a UTF-16: el archivo empezaba `FF FE 50 00 47 00` en vez de `PGDMP`. Corregido generando el archivo dentro del contenedor y copiándolo con `docker cp`, con verificación de cabecera `PGDMP`, tamaño y `$LASTEXITCODE`. Verificado: `cuyielite-piloto-20261117-210125.dump` (80.795 bytes, cabecera `PGDMP`).
2. **`restore-check` usaba `CREATE DATABASE ... TEMPLATE`, no el dump.** Se añadió `restore-dump-check`, que restaura un `pg_restore` en base aislada y comprueba migraciones, restricción de pesajes, ámbitos y cuyes. No sobrescribe `cuyielite_pilot_restaurado` salvo que se indique ese nombre explícitamente. Verificado en `cuyielite_restore_test_20261117`: `migraciones=9; constraint_pesajes=1; ambitos=1; cuyes=0`.
3. **`tools/piloto/servidor.py` confiaba en un PID reutilizado.** Un PID obsoleto podía bloquear `start` o hacer que `stop` terminara un proceso ajeno. Ahora se verifica la línea de comandos (`uvicorn ... backend.app.main:app`); si el PID vivo no corresponde, se descarta el registro sin matar nada. Regresión: `tools/piloto/tests/test_servidor.py` (5 pruebas).
4. **`tools/lope_import/rehearse.py` no era idempotente sobre un destino ya preparado.** Se añadió la guarda de bootstrap; el segundo ensayo sobre la misma base pasó sin `DuplicateTable`.

No se reabrieron verificaciones RF/UI aprobadas: no hubo cambios en esos componentes.

## 2. Recepción de decisiones y dry-run

Comprobado con PostgreSQL/pgvector temporal (`cuyielite_test`, `cuyielite_rehearsal` en `cuyelite-prep-lab`, puerto `55450`) y datos sintéticos:

```text
pytest tools/lope_import/tests tools/db_migrate/tests -q   86 passed
python -m tools.lope_import.rehearse                       dry-run 0 filas / 0 cambios / 0 lotes
                                                           commit  1 cuyo / 1 cambio / secuencia 1
                                                           replay sobre la misma base: OK
```

El ensayo cubrió: lote válido, decisiones no aceptadas (1 ACEPTADO, 5 RECHAZADO), manifiesto con una sola entidad, referencia y correspondencia, rollback del dry-run, publicación transaccional y verificación posterior. No se construyó un segundo orquestador ni publicador.

### Comando exacto para el futuro dry-run real

Sustituir las rutas privadas por las de la entrega de Diery. No ejecutar hasta que existan decisiones aceptadas con evidencia y la matriz canónica esté cerrada en lo humano.

```powershell
# 1) Auditoría de los Excel autorizados (salidas fuera de Git)
python -m tools.lope_import.preparar_revision `
  --entradas "$env:LOCALAPPDATA\CuyiElite\piloto-local\entradas" `
  --reportes "$env:LOCALAPPDATA\CuyiElite\piloto-local\reportes"

# 2) Revisión humana: editar decisiones-pendientes-*.json, sin aceptaciones automáticas
# 3) Manifiesto con el ámbito autorizado del handoff privado
python -m tools.lope_import.decisions build-manifest `
  <revision.json> <decisiones.json> `
  --scope-id <scope_id del handoff privado> `
  --config-alias CUYIELITE-LOPE-REAL `
  --output <ruta privada>\manifiesto-real.json

# 4) Dry-run: NO usa --commit; imprime conteos por entidad y decisión
$env:ETL_DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL=').Line.Split('=',2)[1]
python -m tools.lope_import.promote `
  --manifiesto <ruta privada>\manifiesto-real.json `
  --scope-id <scope_id del handoff privado> `
  --database-url-env ETL_DATABASE_URL
```

La promoción real añadiría `--commit` y requiere la autorización explícita de Oskar sobre esa promoción concreta. Las credenciales y el `scope_id` no se escriben en este documento.

## 3. Respaldo y restauración operativos

```powershell
.\scripts\piloto-local.ps1 backup
# verifica: cabecera PGDMP, tamaño y código de salida; imprime la ruta privada

$dump = '<ruta privada del respaldo>';
.\scripts\piloto-local.ps1 -Action restore-dump-check `
  -RestoreDatabase cuyielite_pilot_restaurado -RestoreSource $dump
```

| Procedimiento | Qué acredita | Qué NO acredita |
|---|---|---|
| `pg_dump -Fc` + `pg_restore` (`backup`, `restore-dump-check`) | Copia lógica íntegra, portable; las migraciones y datos restaurados efectivamente pueden reconstruirse | No prueba que los conteos sean correctos para el negocio |
| `CREATE DATABASE ... TEMPLATE` (`restore-check`) | Que una copia física instantánea de la base activa es consistente y consultable | No usa el dump; no sustituye la comprobación de restauración del respaldo |

Comprobaciones para el respaldo **inmediatamente anterior** a una promoción real:

1. Respaldar la base destino explícita con `backup` y confirmar cabecera `PGDMP` y tamaño.
2. Restaurar con `restore-dump-check` en base aislada con nombre nuevo.
3. Verificar `count(schema_migrations)`, `pesajes_contexto_exclusivo_chk`, `sync_scopes` y conteos por entidad esperados.
4. Confirmar que la base principal sigue intacta y que no se tocó ninguna base ajena.
5. Repetir justo antes de `--commit`; el ensayo de hoy no sustituye esa comprobación.

## 4. Arranque, estado y recuperación

```powershell
.\scripts\piloto-local.ps1 status
.\scripts\piloto-local.ps1 start
.\scripts\piloto-local.ps1 stop
```

`tools/piloto/servidor.py` registra el PID en `%LOCALAPPDATA%\CuyiElite\piloto-local\estado\backend.pid` y los logs en `...\logs`. `start` no lanza un segundo servidor si `/health` responde; `stop` no mata un PID que no corresponda a `backend.app.main:app`.

Diagnóstico ante una falla de la app:

| Síntoma | Comprobación first |
|---|---|
| Backend apagado | `/health` y `python -m tools.piloto.servidor status`; si hace falta, `start` |
| Puente ADB ausente | `adb reverse --list`; si falta, `adb reverse tcp:8000 tcp:8000` |
| Credenciales inválidas | Solo después de confirmar `/health` y `adb reverse`; no borrar sesiones |
| Desajuste de ámbito | Revisar el perfil en la pantalla Acceso; no cambiar `scope_id` ni `device_id` |

Causa de las caídas anteriores: los logs muestran inicio/parada normales, sin traceback de aplicación. En las sesiones previas se detuvo y reinició el backend deliberadamente para ensayos con otro puerto; además se observó presión extrema de memoria. No hay evidencia para atribuir la caída a un único defecto de código y no se añadió un watchdog ni servicios de Windows.

## 5. Guion de demostración sintética

| Paso | Evidencia reutilizable | Estado |
|---|---|---|
| Demo/Trabajo separadas | `docs/verificaciones/cliente-modos-s1.md` | Comprobado |
| Admin/viewer, outbox y permisos | `docs/verificaciones/acceso-piloto-integracion.md` | Comprobado |
| Sync v1/v2/v3 y conflictos | `docs/verificaciones/cierre-integracion-laboratorio.md` | Comprobado |
| Evaluación definitiva/provisional y evidencia | `docs/verificaciones/cierre-integracion-laboratorio.md` | Comprobado |
| Categorías y alertas | `docs/verificaciones/etl-manifiesto-integracion.md` | Comprobado |
| RF presente/ausente, reglas separadas | `docs/verificaciones/rf-visualizacion-nativa.md` | Comprobado en Android y Windows |
| Asistente RAG | `docs/verificaciones/piloto-local-rag-revision.md` | Integración comprobada; **pertinencia pendiente con Diery** |
| Backend indisponible y recuperación sin perder outbox | `docs/verificaciones/acceso-piloto-integracion.md` | Comprobado en laboratorio |

Los datos de la demostración son sintéticos; no se presentan como registros reales del Centro Lope.

## 6. Estado final y reanudación

| Frente | Estado | Responsable |
|---|---|---|
| Plataforma (esquema, integración, respaldo, operación) | COMPLETADO | Oskar |
| Aprobación técnica con reservas | EMITIDA (`739326f`, PR #171) | Oskar |
| Entrega D1–D14 | PENDIENTE de recepción | Diery |
| Revisor de dominio | PENDIENTE de designación | Oskar / Centro Lope |
| Decisiones humanas con evidencia | PENDIENTE | Revisor designado |
| Dry-run real revisado | PENDIENTE | Diery prepara; revisor valida |
| Respaldo inmediato previo | PENDIENTE | Oskar / plataforma |
| Promoción concreta autorizada | PENDIENTE | Oskar |
| Pertinencia RAG, procedencia y validación experta | PENDIENTE | Diery |

Procedimiento para retomar cuando llegue la entrega de Diery:

1. Verificar entrega y versiones (hash de decisiones, manifiesto, revisiones) y contrastarlas con la matriz canónica.
2. Registrar responsables y estados reales en esa matriz, sin convertir propuestas en hechos.
3. Ejecutar únicamente las operaciones autorizadas: auditoría, decisiones revisadas, dry-run y respaldo inmediato.
4. Entregar resultados revisables antes de pedir autorización de promoción.

La matriz canónica permanece como única fuente de requisitos: `docs/verificaciones/matriz-carga-real-lope.md`.


