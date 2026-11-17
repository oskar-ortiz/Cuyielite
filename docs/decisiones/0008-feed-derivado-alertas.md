# 0008. Feed derivado de solo lectura para categorías y alertas

Estado: **IMPLEMENTADA EN LABORATORIO**. Aprobación de Oskar pendiente. No cambia el contrato v1/v2.

## Contexto

Las alertas no son una entidad del protocolo de sincronización. El pull v1/v2 falla de forma determinista (`HISTORIAL_NO_SOPORTADO`) cuando encuentra una entidad desconocida y no avanza el cursor. Agregar `alerta` a `sync_changes` habría dejado a los clientes desplegados sin poder sincronizar nada.

## Decisión

1. Las alertas y la categoría persistida viajan en un feed separado y de solo lectura:
   - `sync_derived_changes` con su propio contador `sync_scopes.derived_sequence`;
   - entidades `categoria` (una por animal) y `alerta` (una por alerta), cada una con snapshot y versión;
   - `GET /sync/v3/context` y `GET /sync/v3/pull` con cursor firmado de protocolo 3.
2. `sync_changes`, `last_sequence` y las allowlists v1/v2 no se tocan: los cursores existentes siguen válidos y los clientes antiguos no ven cambios nuevos que no sepan aplicar.
3. En el cliente las tablas son `categorias_animal`, `alertas_derivadas` y `sync_derived_cursor`, creadas por la migración local `0005_work_derived_readonly` (versión 1 del feed), con su propio identificador en `meta`. No altera la cadena de checksums de la base de Trabajo.
4. La aplicación local solo avanza si la versión entrante es mayor; un replay no retrocede ni duplica.
5. No existe escritura de alertas desde el cliente.

## Consecuencias

- Un servidor anterior responde 404 al pull derivado: el cliente lo trata como "feed no disponible" y la sincronización de dominio sigue igual.
- La categoría sigue llegando a los clientes v2 por `cuyes.categoria_ml`; la procedencia, los motivos y los faltantes solo llegan por el feed derivado.
- Agregar una tercera entidad derivada no requiere cambiar el protocolo v2.

## Alternativas descartadas

| Alternativa | Motivo |
| --- | --- |
| `alerta` dentro de `sync_changes` | Rompe a los clientes v1/v2 desplegados |
| Reutilizar `cuyes` para transportar motivos | Mezcla datos derivados con dominio editable y rompe la validación estricta del snapshot |
| Endpoint REST sin cursor | Duplica descargas y no permite reapertura offline determinista |
| Escritura de alertas desde la UI | No hay flujo aprobado para "atendida" ni para ejecutar un descarte |
