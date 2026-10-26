# 0002. RAG: modelo de embeddings y dimensión de embeddings_sena

**Estado:** aceptada, con validación de calidad pendiente.

## Contexto
La documentación declaraba `VECTOR(1536)` sin que el modelo de embeddings estuviera elegido. Esa dimensión es solo el valor por defecto heredado de una API externa.

## Decisión
Usar un modelo de embeddings abierto, local y multilingüe: `intfloat/multilingual-e5-small` o `BAAI/bge-small-es-v1.5`, ambos con dimensión 384. La columna `embeddings_sena.embedding` se define como `VECTOR(384)`, derivada del modelo y no como una dimensión elegida independientemente.

La opción local tiene costo cero por consumo de API y evita que el corpus institucional del SENA salga del servidor, en coherencia con el uso interno establecido en la Sección 3 §3.5. Al no requerir llamadas a un servicio externo, es compatible con la operación de campo sin conectividad a ese servicio.

## Alternativas descartadas
Una API externa como `text-embedding-3-small` (1536 dimensiones) conservaría el DDL sin cambios, pero introduce dependencia de pago y el envío de material institucional a un tercero.

## Riesgo pendiente
La calidad de recuperación en español del modelo pequeño está pendiente de validación. Antes de la primera indexación, medirla con un conjunto de aproximadamente 20 preguntas reales del SENA. Si la calidad resulta insuficiente, escalar al modelo base correspondiente del proveedor elegido (768 dimensiones), actualizar el DDL y reindexar todo el corpus.
