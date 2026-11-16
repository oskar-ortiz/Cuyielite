# Handoff para Diery — promoción del contrato ETL

Estado: **el camino existe y está probado con datos sintéticos**. Falta la carga real y las decisiones de la §6 de la evidencia.

## 1. Formato de entrada definitivo

`lope_promocion/v1` (el ejemplo acordado está en `docs/integracion/contrato-dominio-etl-plataforma.md` §9.7):

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

## 2. Función o comando existente que debes usar

```bash
python -m tools.lope_import --manifiesto <manifiesto.json> --scope-id <UUID-autorizado> [--commit]
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

El ámbito lo resuelve el ejecutor, no el JSON. El adaptador compara el `scope.scope_id` del manifiesto con el ámbito autorizado y aborta si difieren. El lote queda ligado a su ámbito (`importacion_lotes.scope_id`, migración `0009`), de modo que la misma huella con otras versiones no se puede reutilizar en otro ámbito.

## 4. Identidad e idempotencia

- **Lote**: `lote_id` del manifiesto, con la tupla `(huella_archivo, parser_version, mapeo_version)` como clave de idempotencia.
- **Origen**: `(huella_archivo, hoja, celda, fila, rol, entidad_tipo)`; se resuelve por esa clave y se reutiliza.
- **Dominio**: `entity` + UUID; un UUID aceptado se conserva entre reintentos y versiones.
- Solo las correspondencias `ACEPTADO` entran en registros; las demás se registran con su estado y no crean entidad.

## 5. Qué aporta la plataforma

El orquestador escribe el dominio y confirma el lote; `publicar_cambios` publica versiones, historial y contador **con la misma conexión y transacción**. La plataforma no confirm��, no revierte y no cierra tu conexión.

## 6. Qué falta para una carga real

1. Decidir la corrección pendiente de la evidencia (§6): la tupla de idempotencia es única de forma global y la repetición del mismo manifiesto choca con ella; hay que elegir entre única por ámbito o reconocer el replay por `lote_id`.
2. Confirmar el catálogo de `eventos.tipo` y el uso de `detalle`.
3. Confirmar la fuente de `abortos` y del peso de monta para las evaluaciones oficiales.
4. Autorizar el índice de `importacion_correspondencias` por lote: hoy la clave única es `(origen_id, estado)`.
5. Entregar el artefacto RF con hash y el corpus RAG si se quiere cerrar la evaluación automática.
