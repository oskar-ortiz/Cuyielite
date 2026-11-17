# Handoff para Diery — promoción del contrato ETL

Estado: **contrato aprobado por Diery; promotor y flujo de decisiones probados con datos sintéticos**. No se han revisado archivos reales ni autorizado una carga real.

## 1. Formato de entrada aprobado

`lope_promocion/v1` (ejemplo sintético integrado en `docs/integracion/contrato-dominio-etl-plataforma.md` §9.8):

```json
{
  "contract_version": "lope_promocion/v1",
  "batch": {
    "lote_id": "UUID",
    "idempotency_key": {
      "huella_archivo": "sha256",
      "parser_version": "p1.0.0",
      "mapeo_version": "m1.0.0"
    }
  },
  "scope": { "scope_id": "UUID", "config_alias": "LOPE-G1" },
  "correspondencias_aceptadas": [
    {
      "origen_id": "UUID",
      "origen": { "hoja": "Individual", "celda": "A2", "fila": 2, "rol": "ANIMAL", "entidad_tipo": "cuyes" },
      "estado": "ACEPTADO",
      "entidad_id": "UUID",
      "revisor": "revision-humana",
      "evidencia": "texto de la revision"
    }
  ],
  "registros": [
    {
      "entity": "cuyes",
      "id": "UUID",
      "expected_version": null,
      "before": null,
      "after": { "...campos publicables...": "..." }
    }
  ]
}
```

Las cinco entidades admitidas son `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`. `before` y `after` llevan exactamente los campos publicables de la entidad, con los `null` explícitos; `parto_crias` no lleva `deleted_at`.

### 1.1 Conciliación humana en `lope_import_review_decisions/v1`

Crear una plantilla desde un reporte de revisión:

```bash
python -m tools.lope_import decisions template <review.json> --output <decisiones.json>
```

La plantilla conserva un `lote_id` estable y está enlazada al hash exacto del
reporte. Editar las entradas `decisions` (campo `estado`):

- `ACEPTADO`: completar `revisor`, `evidencia`, `entidad_id` (UUID estable) y
  todos los campos de `after`. Para una fila nueva, `before` y
  `expected_version` quedan `null`; para corregir una fila existente, completar
  el snapshot `before` vigente y su `expected_version`.
- `RECHAZADO`, `AMBIGUO` o `PENDIENTE`: conservar revisor y evidencia cuando
  corresponda. Nunca se convierten en registros publicables.

Construir el manifiesto solo después de la revisión:

```bash
python -m tools.lope_import decisions build-manifest <review.json> <decisiones.json> --scope-id <UUID-autorizado> --config-alias <alias> --output <manifiesto.json>
```

El conversor no consulta ni modifica la base; el orquestador vuelve a validar
`before` y `expected_version` dentro de la transacción. Cada manifiesto admite
un solo archivo fuente porque la clave de idempotencia contiene una sola
`huella_archivo`; separar auditorías de varios archivos en manifiestos
independientes. Mantener reporte, decisiones y manifiesto fuera del repositorio.

## 2. Función o comando existente que debes usar

```bash
python -m tools.lope_import promote --manifiesto <manifiesto.json> --scope-id <UUID-autorizado> [--commit]
```

- Sin `--commit` es dry-run: no persiste nada y revierte.
- `--scope-id` viene de tu configuración autorizada. El `scope.scope_id` del manifiesto solo se valida: si no coincide, se rechaza.
- `--batch-id` ya no es obligatorio con este formato: el lote viaja en el manifiesto.

Si prefieres llamarlo desde Python:

```python
from tools.lope_import.manifest import promover_manifiesto
promover_manifiesto(conn, scope_id, manifiesto, dry_run=False)
```

## 3. Contexto autorizado de ámbito

El ámbito lo resuelve el ejecutor, no el JSON. El adaptador compara el `scope.scope_id` del manifiesto con el ámbito autorizado y aborta si difieren. El lote queda ligado a su ámbito (`importacion_lotes.scope_id`, migración `0009`), de modo que la misma tupla de idempotencia no se puede reutilizar en otro ámbito.

## 4. Identidad e idempotencia

- **Lote**: `lote_id` del manifiesto, con la tupla `(huella_archivo, parser_version, mapeo_version)` como clave de idempotencia.
- **Origen**: `(huella_archivo, hoja, celda, fila, rol, entidad_tipo)`; se resuelve por esa clave y se reutiliza.
- **Dominio**: `entity` + UUID; un UUID aceptado se conserva entre reintentos y versiones.
- Solo las correspondencias `ACEPTADO` se incluyen en el manifiesto. Las pendientes, ambiguas o rechazadas permanecen en la revisión humana y no se escriben ni publican mediante este contrato.
- El replay probado reutiliza el mismo manifiesto, incluido el `lote_id`. Una tupla de idempotencia con otro `lote_id` se rechaza; la tupla es global y tampoco se reutiliza en otro ámbito.

## 5. Qué aporta la plataforma

El orquestador escribe el dominio y confirma el lote; `publicar_cambios` publica versiones, historial y contador **con la misma conexión y transacción**. La plataforma no confirma, no revierte y no cierra tu conexión.

## 6. Qué falta para una carga real

1. Diery debe completar y verificar las decisiones humanas de los archivos autorizados; el flujo ya existe, pero aquí solo se probaron decisiones sintéticas.
2. Confirmar el catálogo de `eventos.tipo` y el uso de `detalle`.
3. Confirmar la fuente de `abortos` y del peso de monta para las evaluaciones oficiales.
4. Revisar si `UNIQUE(origen_id, estado)` permite el historial de correspondencias requerido por lotes y versiones posteriores.
5. Entregar el artefacto RF con hash y el corpus RAG si se quiere cerrar la evaluación automática.
