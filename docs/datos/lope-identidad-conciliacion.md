# Identidad y conciliación — importación Lope

Estado: DISEÑO EN REVISIÓN. Parte del flujo de identidad y promoción está
implementada; este documento no equivale a aprobación de diseño ni a
autorización de carga real.

## Estado vigente al 2026-11-16

- PR #159 quedó fusionado; la migración `0005_pesajes_check.sql` fue aplicada
  y verificada en el piloto. La regla de contexto exclusivo también se valida
  al recibir pesajes en SQLite, sin modificar el checksum del esquema local.
- Las tablas de origen, lote, correspondencia y la relación `parto_crias`
  existen en el esquema central vigente. Sus restricciones no convierten una
  coincidencia sugerida por el parser en una identidad aceptada.
- La revisión técnica de conciliaciones sigue pendiente de asignación. Cada
  aceptación o exclusión requiere decisión, evidencia y responsable; este
  documento no aprueba correspondencias reales.
- La matriz de paridad vigente está en
  `docs/verificaciones/piloto-paridad-documentacion.md`; este diseño conserva
  reglas conceptuales y no sustituye la descripción del esquema efectivo.

## Conceptos

- **Fila de origen**: una fila en un Excel privado. No es una entidad.
- **Candidato**: un registro extraído y normalizado por el parser, con referencia
  a hoja/celda. No es una entidad confirmada.
- **Entidad confirmada**: un registro aceptado en PostgreSQL central con UUID v4.
- **Identidad de origen**: huella de archivo + hoja + celda/fila. Identifica de dónde
  vino un candidato. Es estable entre versiones.
- **Identidad de entidad**: UUID v4 asignado una vez en central. No se deriva de la
  chapa ni de la identidad de origen.
- **Ejecución/versiones de extracción**: parser_version + mapeo_version. Pueden cambiar.
- **Correspondencia revisada**: importacion_correspondencias con lote_id, estado, entidad_id.
  Vincula origen estable con entidad confirmada.

Un cambio de versión de parser o de mapeo NO autoriza crear otra vez el mismo animal.

## Reglas de identidad

1. UUID v4 asignado una sola vez al aceptar una entidad en central.
2. Correspondencia durable entre origen y entidad aceptada: un reintento no crea
   nuevos UUID ni entidades.
3. Identificación de origen mediante huella del archivo, hoja y fila/celda/rango,
   junto con versiones del parser y del mapeo.
4. Ninguna fusión automática por chapa, año o parecido de nombres.
5. Coincidencias entre registros individuales y reproductivos son propuestas
   revisables. Si falta la fecha o hay varios candidatos compatibles, exigir
   revisión humana.
6. Cambios de ubicación históricos no se confunden con la ubicación actual.
7. Referencias a padres/madres sin resolver se conservan en revisión; no se crean
   animales ficticios.
8. Un parto compartido por varias filas de crías se representa una sola vez; no
   sumar su camada por cada cría.
9. Un registro histórico no demuestra que el animal esté ACTIVO hoy.
10. La aceptación y la exclusión deben tener motivo, evidencia y responsable de
    revisión.

## Identidad estable entre versiones

Separación de tres capas:
- **Origen estable**: huella_archivo + hoja + fila/celda. No cambia entre versiones.
- **Ejecución/versiones**: parser_version + mapeo_version. Pueden cambiar.
- **Correspondencia revisada**: importacion_correspondencias con lote_id, estado, entidad_id.

Regla de reutilización:
- Si el origen estable coincide con una correspondencia ACEPTADA, se reutiliza la
  entidad existente (mismo UUID). No se crea una nueva.
- Si el origen cambió (archivo modificado, fila desplazada), exige revisión antes
  de crear entidades. No se duplica automáticamente.
- Un Excel modificado no autoriza duplicar animales automáticamente.

## Chapa reutilizable

- Una chapa puede reutilizarse para animales diferentes, incluso dentro del mismo
  galpón en años o ciclos distintos.
- La chapa es un código de negocio; el UUID de sistema es distinto.
- Chapa + galpón + fecha de nacimiento sirve para buscar coincidencias, pero NO
  es restricción UNIQUE ni prueba automática de identidad.

## Ejemplos sintéticos

### Ejemplo 1: chapa reutilizada en el mismo galpón
- Galpón 1, chapa C001, nacimiento 2025-01-15.
- Galpón 1, chapa C001, nacimiento 2026-03-20.
- Resultado: dos candidatos distintos; no se fusionan automáticamente.
- Requiere revisión humana.

### Ejemplo 2: fecha ausente
- Galpón 2, chapa C042, fecha de nacimiento NULL.
- Resultado: candidato con fecha pendiente; no se asigna fecha ficticia.
- Requiere revisión humana.

### Ejemplo 3: reproductor vinculado al individual
- El registro reproductivo menciona hembra A1246.
- El registro individual tiene un animal con código A1246.
- Resultado: propuesta de vinculación; se conserva la referencia si no se confirma.

### Ejemplo 4: referencia ambigua
- Un animal tiene padre "B014" pero no hay ficha completa de B014.
- Resultado: referencia conservada en revisión; no se crea animal ficticio.

### Ejemplo 5: camada repetida por cría
- Un parto de 5 crías aparece en 5 filas (una por cría).
- Resultado: un solo evento de parto con tamano_camada=5; no se suman 5 veces.

## Correspondencia 1:N por rol

Una fila de origen puede originar múltiples entidades (animal, parto, pesajes).
Se modela con `origen_rol` explícito en `importacion_correspondencias`:
- ANIMAL, PARTO, PESAJE_MADRE, PESAJE_CRIA, EVENTO, etc.
- UNIQUE(lote_id, origen_hoja, origen_celda, origen_fila, origen_rol, entidad_tipo).
- No duplica la entidad de dominio; solo registra la relación origen↔entidad.

## Restricciones vigentes y decisiones pendientes

- En el esquema efectivo central, `partos.fecha_parto`, `pesajes.fecha_pesaje`,
  `cuyes.poza_id`, `cuyes.sexo` y `cuyes.estado` admiten NULL; `cuyes.estado`
  no asigna `ACTIVO` por defecto y los conteos de parto no inventan cero.
- `cuyes.codigo_identificacion` continúa `NOT NULL UNIQUE` en PostgreSQL.
  La aceptación de chapas reutilizadas requiere una decisión de esquema
  explícita; la tolerancia local a duplicados sirve para retenerlos en revisión,
  no para declarar su identidad.
- La regla de `0005_pesajes_check.sql` permite como máximo un contexto (`parto_id`
  o `evento_id`). Su aplicación central y validación de pull local están
  documentadas en la verificación de paridad.
- No cambiar estas restricciones ni aceptar coincidencias reales sin revisión,
  evidencia y aprobación técnica.

## Verificación

Ninguno de esos ejemplos requiere adivinar identidad ni crear duplicados para
cumplir una FK. Todas las referencias no resueltas se conservan en revisión.


## Tablas físicas de soporte

Las siguientes estructuras ya están implementadas en el esquema central; se
enumeran aquí como referencia del diseño, no como DDL pendiente de crear.

### importacion_origenes (origen estable, independiente de lote/versiones)
- id UUID PK
- huella_archivo, origen_hoja, origen_celda, origen_fila, origen_rol, entidad_tipo
- UNIQUE(huella_archivo, origen_hoja, origen_celda, origen_fila, origen_rol, entidad_tipo)
- No depende de parser_version, mapeo_version ni lote_id.

### parto_crias (relación cría–parto implementada)
- id UUID PK
- parto_id UUID FK partos(id)
- cuy_id UUID FK cuyes(id)
- rol VARCHAR(30) DEFAULT 'CRIA'
- UNIQUE(parto_id, cuy_id)
- Un origen_rol con un único entidad_id no representa por sí solo esta relación.

## Coordinación concurrente
- UNIQUE(origen_id, estado) en importacion_correspondencias impide dos aceptaciones
  simultáneas del mismo origen. La segunda ejecución obtiene conflicto y reutiliza
  o revisa. La transacción bloquea el ámbito/contador antes de verificar correspondencias.
- Un archivo modificado exige conciliación, no una nueva entidad automática.
