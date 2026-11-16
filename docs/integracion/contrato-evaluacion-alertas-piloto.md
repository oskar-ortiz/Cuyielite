# Contrato de evaluación persistente y alertas

Estado: **IMPLEMENTADO CON DATOS SINTÉTICOS (2026-11-16)**. Las reglas y umbrales son de Diery; la plataforma no los redefinió. Actualizado con las aclaraciones de Diery del 2026-11-16: dos abortos es provisional, el cuarto parto es el único criterio confirmado y la evidencia oficial debe estar revisada.

## 1. Política confirmada por Diery

| Punto | Decisión |
| --- | --- |
| ELITE | Exige los criterios vigentes, incluidos destete a los 15 días y peso de monta entre 900 y 1000 g |
| Candidata con faltantes | predecir_candidata conserva NORMAL, agrega los faltantes a motivos y marca REVISAR |
| Datos faltantes | La función conserva `NORMAL`, agrega el faltante a los motivos y marca `estado_calidad=REVISAR`; la clase no queda vacía |
| `NORMAL+REVISAR` en la API | Es informativo; **no** es categoría definitiva para persistir |
| Modelo RF | Si no hay modelo o faltan sus predictores, `apoyo_modelo=null`; nunca modifica la clase de reglas |
| Candidata no hembra | Error de validación |
| `NO_APLICA` | No es `NORMAL` ni genera descarte |
| Recomendación de descarte | No ejecuta el descarte del animal |
| Datos insuficientes | No actualiza `cuyes.categoria_ml`, no crea alerta y no borra la categoría anterior; la anterior queda histórica/no confirmada |
| Alerta | Tipo `DESCARTE_REPRODUCTORA`, causas de las reglas de Diery; identidad idempotente por ámbito + animal + tipo + regla + evento causal |
| Fecha límite | Solo si existe la fecha del parto y la regla identifica inequívocamente el cuarto parto |
| Categoría obsoleta | Una corrección posterior no puede ser pisada por una evaluación anterior |

## 2. Implementación

### Evaluación

`GET /evaluaciones/reproductoras/{cuy_id}` (cualquier rol) devuelve lo necesario para decidir y evaluar: aplicabilidad, `base_version` del animal, `base_partos_version`, partos centrales, categoría persistida y alertas.

`POST /evaluaciones/reproductoras/{cuy_id}` (solo `admin`) recibe únicamente lo que el esquema central todavía no tiene:

```json
{ "abortos": 0, "peso_monta_g": "950", "base_version": 3, "base_partos_version": 2 }
```

El servidor calcula la clase con `ml.prediccion.predecir_hembra` y datos centrales:

| Dato | Origen |
| --- | --- |
| `partos_acumulados` | `count(partos)` del animal en el ámbito |
| `fecha_ultimo_parto` | `max(fecha_parto)` central |
| `abortos` | Declarado por el admin (no existe columna central) y guardado en la procedencia |
| `peso_monta_g` | Declarado por el admin y guardado en la procedencia |

`procedencia` conserva la versión del animal, el resumen de partos con `max_server_version`, los valores declarados y `reglas_version`. Queda pendiente definir la fuente central de `abortos` y del peso de empadre; hasta entonces no se infieren.

`base_version`/`base_partos_version` son opcionales. Si llegan y no coinciden con la base, responde `409 EVALUACION_OBSOLETA` y no escribe nada.

### Persistencia

| Caso | Efecto |
| --- | --- |
| Definitiva (`NORMAL`/`DESCARTE`, sin `REVISAR`) | Escribe `categoria_ml`, estado `DEFINITIVA`, motivos, faltantes, reglas y procedencia |
| Misma clase y mismo contenido | No incrementa `server_version`, no crea historial ni versión derivada |
| Misma clase con contenido distinto | Actualiza procedencia y versión derivada; no publica versión nueva del animal |
| Datos insuficientes | No escribe categoría; si existía una, la marca `HISTORICA` |
| `NO_APLICA` | `422`, sin escritura |

El cambio efectivo de `categoria_ml` se publica con `publicar_cambios` dentro de la misma transacción (`expected_version` = versión actual, `before` = último snapshot). Categoría, alertas, publicación y feed derivado se confirman o revierten juntos.

### Alertas

- Tipo único: `DESCARTE_REPRODUCTORA`.
- `regla_id`: `partos_reproductora_descarte` (motivo "ciclo completo") o `abortos_repetidos_descarte` (motivo "problema repetido"). Se derivan de los motivos de `ml/rules`; un motivo no mapeado no crea alerta y se informa en `causas_no_reconocidas`.
- `causa_tipo`: `PARTO` con `causa_id` cuando existe `numero_parto = 4`; `HISTORIA_REPRODUCTIVA` cuando no hay evento identificable.
- `fecha_limite`: `fecha_parto + 20 días` solo en el caso anterior. Se lee de `ml.rules.criterios`.
- Estados: `activa`, `obsoleta`. Una causa que desaparece cierra la alerta como `obsoleta` con `closed_reason='CAUSA_INVALIDADA'`; la falta de datos no cierra nada.
- Unicidad por índice parcial `(scope_id, cuy_id, tipo_alerta, regla_id, causa_tipo, COALESCE(causa_id, cero))` donde `estado='activa'`; la fila del animal se bloquea antes, así que dos evaluaciones concurrentes producen una sola alerta.
- `atendida` permanece `false`: no existe flujo aprobado para marcarla ejecutada.

## 3. Transporte

Las alertas **no** se escriben en `sync_changes`. Un cliente v1/v2 que encuentra una entidad desconocida falla de forma determinista (`HISTORIAL_NO_SOPORTADO`) y no avanza el cursor; agregarlas ahí rompería a los clientes desplegados.

Se agregó un feed propio de solo lectura:

- Central: `sync_derived_changes` + `sync_scopes.derived_sequence`, entidades `categoria` y `alerta`, con snapshot y versión por registro.
- Endpoints `GET /sync/v3/context` y `GET /sync/v3/pull` con cursor firmado de protocolo 3 (no intercambiable con v1/v2).
- Local: `categorias_animal`, `alertas_derivadas` y `sync_derived_cursor` (migración `0005_work_derived_readonly`, versión 1 del feed).
- El cliente aplica solo si la versión entrante es mayor; un replay no retrocede ni duplica.
- No existe escritura de alertas desde el cliente.

## 3.1 Evidencia revisable (migración 0008)

Una declaración del cliente (abortos, peso de monta o criterios de candidata) **no** autoriza persistencia oficial. Se guarda en evidencias_evaluacion con origen, archivo/huella, hoja, fila, celda y versiones de parser/mapeo, en estado DECLARADA.

- POST /evaluaciones/{cuy_id}/evidencias registra la declaración; nunca acepta pruebas de revisión.
- POST /evaluaciones/{cuy_id}/evidencias/revision exige sesión de administrador autenticada: el revisor sale del token, no del cuerpo. Decisiones: REVISADA o RECHAZADA.
- Solo la evidencia REVISADA sostiene una categoría oficial o una alerta.
- Una declaración nueva sobre un campo ya revisado lo devuelve a DECLARADA.
- Regla aplicada: la reproductora NORMAL exige bortos revisado; la candidata exige sus siete campos revisados; el descarte por cuarto parto no se bloquea por evidencia ajena a ese criterio.

## 4. Pendiente

- Fuente central de `abortos` y del peso de empadre (hoy declarados y auditados en la procedencia).
- Flujo aprobado para marcar una alerta como atendida o descartada.
- Integración real de RF y RAG: el contrato HTTP existe, pero no hay artefacto ni corpus autorizados.
