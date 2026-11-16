# Contrato preparado: evaluación de reglas, categoría y alertas

Estado: **PREPARADO, NO IMPLEMENTADO; BLOQUEADO POR UNA DECISIÓN DE DOMINIO.** No cambia reglas, umbrales, DTO, migraciones ni UI. Sirve para que Oskar y Diery cierren la política antes de persistir.

## 1. Por qué no se implementó todavía

El checkout actual y el handoff de Diery no describen la misma semántica:

| Punto | Código/handoff actual | Propuesta nueva de Diery |
| --- | --- | --- |
| Datos faltantes | `NORMAL` + calidad `REVISAR` | `DATOS_INSUFICIENTES` sin clase |
| Confirmar ELITE | Exige destete a los 15 días y empadre entre 900 y 1000 g | No está precisado si esos criterios siguen siendo necesarios o suficientes |
| DTO HTTP | `clase` no nula (`NORMAL/DESCARTE` o `ELITE/NORMAL`) | Clase nullable o ausente en evaluación incompleta |
| Persistencia | No persistir categoría/alertas aún | Persistir solo clase definitiva y alertas idempotentes |

No se puede cambiar un umbral, una etapa ni un criterio zootécnico por inferencia. Tampoco alcanza con cambiar una etiqueta en la UI: el contrato HTTP, la base y los clientes anteriores deben seguir funcionando.

## 2. Decisión exacta que falta

Diery debe responder, con ejemplos y versión de reglas:

1. ¿El destete a 15 días es condición **necesaria**, **suficiente** o solo parte de ELITE?
2. ¿El empadre entre 900 y 1000 g sigue siendo obligatorio para confirmar ELITE?
3. ¿`DATOS_INSUFICIENTES` es una clase nullable, un estado de evaluación separado o ambos?
4. ¿Qué respuesta deben recibir los clientes antiguos que esperan `clase` no nula?
5. ¿Cuál es la identidad estable de una alerta: ámbito + animal + tipo + regla + qué evento causal exacto (parto, pesaje, evento)?
6. ¿Cómo se representa una causa sin evento identificable, sin deducirla de texto libre?
7. ¿Qué evaluación invalida una alerta previa y cuál solo la marca como no confirmada?
8. ¿Qué datos de procedencia/versión deben conservarse para auditar una categoría?

Hasta responder eso, la plataforma no debe escribir `categoria_ml` desde una evaluación nueva ni crear alertas automáticas.

## 3. Contrato propuesto, condicionado a esa decisión

### Evaluación

```json
{
  "cuy_id": "UUID",
  "estado_evaluacion": "DEFINITIVA | DATOS_INSUFICIENTES | NO_APLICA",
  "clase": "ELITE | NORMAL | DESCARTE | null",
  "motivos": ["texto de la regla"],
  "campos_faltantes": ["peso_monta_g", "dias_destete"],
  "etapa": "NACIMIENTO | DESTETE | EMPADRE | null",
  "reglas_version": "string",
  "apoyo_modelo": {
    "clase": "ELITE | NORMAL",
    "probabilidades": { "ELITE": 0.0, "NORMAL": 0.0 },
    "modelo_version": "string | null"
  }
}
```

`apoyo_modelo` es informativo y separado; nunca modifica `clase`. `clase` solo puede ser no nula cuando `estado_evaluacion=DEFINITIVA`. `DATOS_INSUFICIENTES` no equivale a NORMAL. `NO_APLICA` no es un error HTTP de validación ni una recomendación.

### Persistencia propuesta

| Cambio | Regla |
| --- | --- |
| `cuyes.categoria_ml` | Escribir solo clase de reglas definitiva, nunca la del RF |
| Misma clase | No incrementar versión del animal por el mismo valor; evaluar igualmente causas de alerta |
| Datos insuficientes | No escribir categoría; conservar categoría previa como histórica/no confirmada |
| Evaluación obsoleta | Rechazar si la versión de datos/procedencia no coincide; no pisar una corrección reciente |
| Categoría + alerta | Confirmar o revertir juntas dentro de `publicar_cambios` cuando correspondan |
| Reintento exacto | No duplicar publicación, categoría ni alerta; recuperar el resultado durable |

### Alertas

Propuesta de identidad: `scope_id + cuy_id + tipo_alerta + regla_id + causa_tipo + causa_id`. La base debe imponer unicidad para alertas activas y resolver concurrencia; no basta una consulta previa. Una alerta es una **recomendación**, no un descarte ejecutado.

Estados propuestos: `activa`, `obsoleta`, `no_confirmada`. `atendida` no debe implementarse como “descartada” sin un flujo aprobado.

### Transporte

Las alertas **no** son una entidad de sync actual. Antes de mostrarlas como sincronizadas se requiere:

1. DTO de solo lectura con ámbito, versión y referencias.
2. Migración central y local; no reutilizar `cuyes` para transportar motivos.
3. Descarga con cursor compatible y clientes antiguos que no pierdan registros.
4. UI de solo lectura; no edición/atención sin flujo aprobado.
5. Pruebas de idempotencia, ámbito, versión y reapertura offline.

## 4. UI preparada (sin implementar)

La ficha debe distinguir:

- clase de reglas y motivos;
- faltantes y estado de calidad;
- apoyo RF en bloque separado y etiquetado como exploratorio;
- alertas como recomendaciones con causa, fuente y estado;
- `DATOS_INSUFICIENTES` como dato faltante, nunca como NORMAL;
- `NO_APLICA` como no evaluable;
- carga, vacío, error, offline, credencial vencida y reintento.

No se debe presentar una recomendación como descarte ejecutado ni una categoría histórica como confirmación actual.

## 5. Pruebas de aceptación preparadas

| ID | Caso | Resultado esperado |
| --- | --- | --- |
| EVAL-01 | Faltan destete/monta | `DATOS_INSUFICIENTES`; categoría no escrita; alerta no creada |
| EVAL-02 | Reglas confirman ELITE con criterios completos | clase ELITE; versión solo si cambia la categoría |
| EVAL-03 | RF estima otra clase | `apoyo_modelo` separado; `categoria_ml` no cambia por RF |
| EVAL-04 | Misma clase | sin nueva versión; se evalúan causas de alerta |
| EVAL-05 | Evaluación con datos de versión anterior | rechazo/conflicto; no pisa la fila reciente |
| EVAL-06 | DESCARTE recomendado | alerta creada una sola vez; estado productivo no cambia |
| EVAL-07 | Reintento exacto | sin publicación, categoría ni alerta duplicada |
| EVAL-08 | Dos evaluaciones concurrentes | una alerta activa; constraint/transacción resuelve |
| EVAL-09 | Datos insuficientes tras alerta previa | alerta no se cierra como falsa; queda no confirmada |
| EVAL-10 | Corrección invalida la causa | alerta obsoleta con trazabilidad |
| ALT-01 | Alerta descargada offline | visible como recomendación; no se edita ni ejecuta |
| ALT-02 | Cliente antiguo | no pierde registros ni cursores por la extensión |

## 6. Secuencia recomendada

1. Diery responde la sección 2 con reglas y ejemplos versionados.
2. Oskar congela el DTO compatible y el esquema de evaluación/alertas.
3. Implementar evaluación y persistencia con pruebas de procedencia, idempotencia y alertas.
4. Implementar descarga/local/UI de alertas.
5. Verificar con datos sintéticos y luego con los recursos autorizados.

Mientras no ocurra, el código actual sigue devolviendo `NORMAL+REVISAR` y no persiste categorías ni alertas nuevas. No se declara esta parte implementada.
