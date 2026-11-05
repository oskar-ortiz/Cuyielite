# Plan de migración y validación — importación Lope

Estado: PROPUESTA. No ejecutada. No se ha importado ni migrado ninguna base.

## Precondiciones

- Aprobación de Oskar y Diery sobre el diccionario, identidad y DDL propuesto.
- Validación de dominio: identidad, unidades, catálogos, nulabilidad.
- Base central de pruebas aislada (no cuyielite ni otra base preexistente).
- Backup de la base central antes de cualquier carga real.
- Parser Entrega A verificado: 19 pruebas (6 en test_basic.py, 13 en test_cli.py), 2609 candidatos.

## Transacción única de promoción (futuro, no ejecutada)

Una sola transacción por lote. No existe una segunda publicación independiente.

Orden dentro de la transacción:
1. Bloquear ámbito/contador (ADR 0006) y coordinar el lote (importacion_lotes).
2. Verificar correspondencias revisadas (importacion_correspondencias, estado ACEPTADO).
3. Escribir dominio (cuyes, partos, pesajes, eventos) según correspondencias.
4. Asignar versiones (server_version = 1 para registros nuevos; existentes conservan versión).
5. Incrementar contador de ámbito.
6. Insertar snapshots en historial de cambios (inmutables).
7. Actualizar correspondencias (entidad_id) y confirmar lote (estado APLICADO, aplicado_at).
8. COMMIT.

Cualquier fallo en cualquier paso ejecuta ROLLBACK de todo: dominio, versiones, contador,
historial, correspondencias y estado del lote. No quedan efectos parciales.

## Control de versiones

- Migraciones bajo db/migrations/central/ (nueva carpeta, no modificar db/ddl/).
- Numeración secuencial (ej. 006_importacion.sql).
- Herramienta: psql con ON_ERROR_STOP=1.
- Schema_migrations con número, checksum y applied_at (rechazar cambio de checksum).

## Recuperación ante errores

- Cualquier fallo revierte dominio, versiones, contador, historial y estado del lote.
- La cola de revisión conserva lo excluido y el motivo.
- Reintentar la misma carga no genera entidades, eventos ni UUID adicionales (idempotencia por lote).

## Dependencias pendientes de sincronización

- Ámbito autorizado: el importador central debe usar el mecanismo de publicación de ADR 0006
  (bloqueo del contador de ámbito, snapshot inmutable, recibo). No es un DEFAULT 1.
- Versiones: registros nuevos aceptados reciben server_version = 1; registros existentes
  conservan su versión. No reiniciar.
- Contrato ampliado: la especificación actual de sync cubre solo galpones/pozas. Extenderla a
  animales y eventos es una entrega explícita (Entrega E del plan de importación). No basta con
  añadir server_version a las tablas.
- No publicar una fila animal que el cliente aún no puede descargar/representar.

## Casos de aceptación sintéticos (DISEÑADOS, NO EJECUTADOS)

1. Chapa reutilizada: dos animales con mismo código en mismo galpón → dos entidades distintas.
2. Fechas y parentescos ausentes: NULL conservado, no inventar datos.
3. Pesos de madre y cría: PESO PARTO (pesaje con etapa PARTO, parto_id) no se asigna a cría.
4. Parto repetido en filas de hermanos: un solo evento de parto.
5. Importación repetida: no duplica entidades ni publicaciones (idempotencia por lote).
6. Fallo intermedio: revierte la promoción (dominio, versiones, contador, historial, lote).
7. Conservación de identidades existentes: registros preexistentes no se reinician a versión 1.
8. Datos históricos: no inventar estado ACTIVO.
9. Demo intacta: base demo sin seed real, trabajo sin seed.
10. Mismos UUID y relaciones en Android/Windows cuando se implemente la descarga.

## Compatibilidad con sincronización (ADR 0004-0009)

- Importar una sola vez en PostgreSQL central.
- Los clientes reciben los mismos UUID.
- Registro nuevo aceptado: server_version = 1.
- No reiniciar versiones de registros existentes.
- Dato, versión, contador e historial deben publicarse atómicamente (misma transacción).
- Un DEFAULT 1 no implementa sincronización.
- La especificación actual de galpones/pozas todavía no descarga animales y eventos;
  esa ampliación será una entrega posterior.

## Pendientes

- Aprobación de Oskar y Diery sobre el diccionario y el DDL propuesto.
- Validación de dominio: identidad, unidades, catálogos, nulabilidad.
- No ejecutar migraciones ni importaciones hasta aprobación.