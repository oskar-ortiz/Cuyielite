# Plan de migración y validación — importación Lope

Estado: INTEGRACIÓN SINTÉTICA CERRADA; CARGA REAL PENDIENTE.
La migración `0005_pesajes_check.sql` está aplicada y verificada en el piloto;
no se importaron registros reales mediante este plan.

## Hitos verificados al 2026-11-16

- PR #159 documenta la aplicación de 0005, su segunda ejecución no-op y la
  paridad PostgreSQL/SQLite para el contexto exclusivo de pesajes.
- La integración sintética del parser, las decisiones, el manifiesto y la
  promoción quedó cerrada; `publicar_cambios` registra publicación e historial
  dentro de la transacción que abre el orquestador. El orquestador conserva la
  escritura de dominio y el `COMMIT`.
- Esto no constituye autorización de carga real ni aprobación de las
  correspondencias.

## Precondiciones

- Aprobación de Oskar y Diery sobre el diccionario, identidad y DDL propuesto.
- Validación de dominio: identidad, unidades, catálogos, nulabilidad.
- Base central de pruebas aislada (no cuyielite ni otra base preexistente).
- Backup de la base central antes de cualquier carga real.
- Parser y flujo Lope: 55 pruebas en `tools/lope_import`; la verificación de
  integración sintética y las migraciones tiene resultados separados en
  `docs/verificaciones/etl-manifiesto-integracion.md`.

## Transacción única de promoción (integración sintética)

Una sola transacción por lote. El publicador recibe la conexión y transacción
abiertas por el orquestador; no escribe dominio ni ejecuta `COMMIT`. No existe
una segunda publicación independiente. Esta verificación sintética no equivale
a una carga de los Excel reales.

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

- Migraciones centrales bajo `db/migrations/central/`; no reescribir migraciones
  históricas ni tratar `db/ddl/` como el historial aplicado.
- `0005_pesajes_check.sql` ya existe, está aplicada y verificada en el piloto.
  Toda migración futura debe continuar la secuencia efectiva del repositorio.
- Herramienta oficial: `python -m tools.db_migrate --env-var <ENV>`, que valida
  checksums y registra `schema_migrations`; no aplicar SQL manualmente al piloto.

## Recuperación ante errores

- Cualquier fallo revierte dominio, versiones, contador, historial y estado del lote.
- La cola de revisión conserva lo excluido y el motivo.
- Reintentar la misma carga no genera entidades, eventos ni UUID adicionales (idempotencia por lote).

## Sincronización vigente y límites

- El pull de dominio ya cubre `cuyes`, `partos`, `pesajes`, `eventos` y
  `parto_crias`; el feed v3 transporta categorías y alertas derivadas en modo
  solo lectura. Ver la matriz vigente en
  `docs/verificaciones/piloto-paridad-documentacion.md`.
- La publicación sigue requiriendo el ámbito autorizado y el mecanismo de ADR
  0006; no se debe asumir un `scope_id` ni un `DEFAULT 1`.
- Los registros nuevos aceptados reciben versión inicial y los existentes
  conservan su versión. No reiniciar versiones ni publicar filas que el cliente
  no pueda representar.
- La paridad de esquema no significa que haya correspondencias reales aceptadas.

## Casos de aceptación sintéticos

La integración sintética y sus pruebas están documentadas en
`docs/verificaciones/etl-manifiesto-integracion.md`. Incluyen identidad sin
fusión automática, NULL para desconocidos, pesajes en contexto, idempotencia,
rollback, conservación de versiones y separación de datos demo/Trabajo. No se
presentan como validación de carga real ni como aprobación de decisiones.

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

- Aprobar el diseño actualizado y designar al revisor técnico de las
  correspondencias y los errores de Excel.
- Recibir el `scope_id` autorizado por canal privado; no incluir credenciales
  ni valores secretos en Git.
- Registrar cada decisión de conciliación con evidencia y revisor. La
  aceptación documental no sustituye esas decisiones.
- Antes de cualquier carga real: dry-run con conteos por entidad y respaldo
  verificable con restauración comprobada. Hasta entonces, no promover datos.