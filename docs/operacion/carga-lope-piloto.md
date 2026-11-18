# Procedimiento de carga Lope para el piloto (Centro Lope)

Estado: **PREPARADO Y ENSAYADO CON DATOS SINTÉTICOS**. No autoriza una carga real. La carga real exige la aprobación previa del bloque final de este documento y credenciales técnicas separadas de las cuentas personales.

La lista única de requisitos, responsables y estados está en `docs/verificaciones/matriz-carga-real-lope.md`; este procedimiento no mantiene una lista paralela.

## 0. Principios

- La revisión humana es un paso obligatorio: importar no revisa evidencia ni evalúa.
- Solo se promueve lo que tiene decisión `ACEPTADO` con identidad, revisor, evidencia y campos completos.
- El ETL controla la transacción y escribe el dominio; `publicar_cambios` publica con la conexión prestada. No hay segundo publicador.
- El acceso técnico del ETL es una credencial propia (rol PostgreSQL con privilegios mínimos sobre el ámbito), nunca una cuenta `admin` o `viewer` de la aplicación.

## 1. Inventario de entradas

```bash
python -m tools.lope_import <archivo.xlsx> --output <reporte-audit.json>
```

El reporte `lope_import_audit/v1` registra, por archivo, `sha256_before`, `sha256_after`, `file_id` y `files_unchanged`. Antes de cualquier decisión hay que confirmar que `files_unchanged` es `true`: si el archivo cambió durante la auditoría, la huella no es confiable y el lote debe repetirse.

## 2. Revisión humana y decisiones

```bash
python -m tools.lope_import.adapt <reporte-audit.json> --output <reporte-review.json>
python -m tools.lope_import.decisions template <reporte-review.json> --lote-id <UUID-estable> --output <decisiones.json>
```

La plantilla `lope_import_review_decisions/v1` deja cada propuesta en `PENDIENTE` sin identidad. La persona revisora debe, por propuesta:

- mantener `PENDIENTE` si no hay evidencia suficiente;
- marcar `RECHAZADO` o `AMBIGUO` con `revisor` y `evidencia`, y **sin** `entidad_id`, `expected_version` ni `before`;
- marcar `ACEPTADO` con `revisor`, `evidencia`, `entidad_id` (UUID estable), `expected_version` y `before` (`null` y `expected_version: null` para una fila nueva; el snapshot vigente y la versión para una corrección).

El `lote_id` debe ser estable entre reintentos del mismo archivo.

## 3. Manifiesto

```bash
python -m tools.lope_import.decisions build-manifest <reporte-review.json> <decisiones.json> \
  --scope-id <UUID-autorizado> --config-alias <alias> --output <manifiesto.json>
```

El manifiesto es `lope_promocion/v1`. La clave global de idempotencia es `(huella_archivo, parser_version, mapeo_version)`: la misma tupla no puede reutilizarse en otro ámbito y el replay se reconoce por el mismo `lote_id`.

## 4. Respaldo del destino

Antes de promover, respaldo del destino y comprobación de restauración:

```bash
pg_dump --format=custom --file=lope-$(date +%Y%m%d-%H%M%S).dump <url-destino>
createdb <base-de-prueba> && pg_restore --dbname=<base-de-prueba> --list lope-*.dump
```

En el ensayo sintético el respaldo se comprobó con `CREATE DATABASE ... TEMPLATE`, que reproduce el mismo estado en otra base aislada y permite verificar que el respaldo sirve.

## 5. Dry-run y reporte

```bash
python -m tools.lope_import.promote --manifiesto <manifiesto.json> \
  --scope-id <UUID-autorizado> --database-url-env ETL_DATABASE_URL
```

Sin `--commit` es dry-run: no persiste y revierte. El reporte entrega el modo, el total de registros, los cambios, los sin cambios y los conteos por entidad. Antes de promover hay que anexar el conteo de decisiones `ACEPTADO`, `RECHAZADO`, `AMBIGUO` y `PENDIENTE` del archivo de decisiones.

## 6. Promoción

```bash
python -m tools.lope_import.promote --manifiesto <manifiesto.json> \
  --scope-id <UUID-autorizado> --database-url-env ETL_DATABASE_URL --commit
```

## 7. Verificación posterior

Consultas de solo lectura: `cuyes.server_version` y `sync_changes` del ámbito, `sync_scopes.last_sequence`, `importacion_lotes.estado='APLICADO'` y `importacion_correspondencias.entidad_id` informada. Además, una descarga por pull v2 desde un cliente de laboratorio confirma que lo publicado llega al dispositivo.

## 8. Recuperación

Si la promoción falla a mitad, la transacción revierte: dominio, publicación, lote y correspondencias quedan como estaban. Si la promoción terminó pero el resultado no es el esperado, la vía de recuperación es restaurar el respaldo sobre una base nueva, corregir las decisiones y promover de nuevo con un `lote_id` nuevo solo si el archivo cambió de verdad.

## 9. Antes de la carga real, aprobación explícita

- [ ] Destino y `scope_id` autorizado (Centro Lope, un solo ámbito para ambos galpones).
- [ ] Archivos de entrada con `sha256_before`/`sha256_after` iguales y `files_unchanged: true`.
- [ ] `parser_version` y `mapeo_version` declarados.
- [ ] Resultado del dry-run con conteos por entidad.
- [ ] Conteos esperados de decisiones `ACEPTADO`/`RECHAZADO`/`AMBIGUO`/`PENDIENTE`.
- [ ] Respaldo hecho y restauración comprobada.
- [ ] Identidad técnica del ETL separada de las cuentas de la aplicación.

## 10. Lo que este procedimiento NO hace

- No revisa evidencia: la revisión es humana y ocurre en el paso 2.
- No evalúa animales: la evaluación oficial es una acción explícita y autorizada de la aplicación.
- No crea alertas automáticamente: las alertas nacen de una evaluación con fundamento confirmado.
