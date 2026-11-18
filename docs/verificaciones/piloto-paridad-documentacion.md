# Evidencia: migración 0005, paridad de dominio y revisión documental (2026-11-16)

Rama `chore/piloto-paridad-documentacion`, desde `origin/dev` `1e56162` (PR #158 fusionado). `0005_pesajes_check.sql` viene del PR #157, commit `5d1ac64`: **no se recreó ni se renumeró**.

## 1. Migración 0005 en el piloto

### Estado previo

| Base | Migraciones | CHECK `pesajes_contexto_exclusivo_chk` | Pesajes con ambos contextos |
|---|---|---|---|
| `cuyielite` | 8 (0001–0004, 0006–0009) | ausente | 0 |
| `cuyielite_rag` | 8 (igual) | ausente | 0 |
| `cuyielite_pilot_restaurado` | 8 (instantánea) | ausente | 0 |

`cuyielite_pilot_restaurado` se conserva deliberadamente como instantánea previa a 0005 y **no** se actualizó. Es un artefacto de verificación, no una base gestionada por el runner.

### Respaldo y restauración

Se generó un `pg_dump -Fc` por cada base activa en `%LOCALAPPDATA%\CuyiElite\piloto-local\respaldos`:

```text
pre-0005-cuyielite-20261116-224643.dump       77.678 bytes
pre-0005-cuyielite_rag-20261116-224643.dump  408.862 bytes
```

Cada respaldo se restauró con `pg_restore` en una base aislada (`cuyielite_pre0005_check`, `cuyielite_rag_pre0005_check`): **ambos OK**. Las bases de comprobación se eliminaron al terminar; los respaldos se conservan.

### Aplicación y comprobación

Aplicada con `apply_migrations()` del runner oficial (`tools/db_migrate/runner.py`), una base por URL, sin `ALTER` manual ni cambios de checksum:

```text
cuyielite      aplicadas: ['0005_pesajes_check.sql'] | segunda ejecución: no-op
cuyielite_rag  aplicadas: ['0005_pesajes_check.sql'] | segunda ejecución: no-op
cuyielite      | 0005 checksum OK | constraint presente | migraciones: 9
cuyielite_rag  | 0005 checksum OK | constraint presente | migraciones: 9
```

Comportamiento de la restricción en base temporal `TEMPLATE cuyielite`, con datos sintéticos y `rollback` (cero filas persistentes):

```text
permitido: ningún vínculo
permitido: solo parto_id
permitido: solo evento_id
rechazado: ambos vínculos -> CheckViolation (esperado)
cuyes sintéticos persistentes: 0
```

**Conclusión:** 0005 está aplicada y registrada, la segunda ejecución es no-op y la restricción se comporta según el contrato. El runner aplicó una migración "atrasada" respecto de 0006–0009 sin falsear el historial: `validate_history` solo verifica los archivos ya registrados y el bucle aplica los que faltan.

## 2. Paridad PostgreSQL / SQLite

La paridad se entiende como **conservar significado y comportamiento de los datos compartidos**, no como igualar bases. El esquema SQLite efectivo es `client/src/data/work.schema.ts` (`cuyielite-work`, `user_version=2`), con extensiones auditadas de sincronización y del feed derivado. `db/ddl/local/001_sqlite.sql` es una referencia histórica y no describe el esquema efectivo del cliente actual.

| Entidad | PostgreSQL (columnas relevantes) | SQLite efectivo | Resultado |
|---|---|---|---|
| galpones / `galpon` | `id UUID`, `nombre`, `ubicacion NULL`, `scope_id`, `server_version`, `last_client_edited_at`, `synced_at`, `deleted_at` | `id TEXT`, `nombre`, `ubicacion NULL`, `created_at/updated_at`, `deleted_at` | PAR. `scope_id` y metadatos de servidor no se transportan; el dispositivo es de un solo ámbito y el contexto lo fija el login |
| pozas / `poza` | `galpon_id`, `codigo`, `tipo`, `capacidad_maxima`, `scope_id`, versión | mismos campos de negocio; `galpon_id REFERENCES galpones` | PAR |
| cuyes | `poza_id NULL`, `galpon_origen_id`, `codigo_identificacion NOT NULL` con índice **no único** (`idx_cuyes_codigo`), `sexo NULL`, fechas, colores, padres, `categoria_*`, versión | `poza_id NULL`, `galpon_origen_id`, `codigo_identificacion` sin UNIQUE, mismos campos de negocio, `ultimo_peso_g TEXT` | PAR: ambos permiten repetir la chapa. No hay diferencia de unicidad que justificar. Identidad técnica = `id` UUID (PK central y `TEXT PRIMARY KEY` local). `categoria_*` centrales no se transportan por pull de dominio: llegan por el feed derivado v3 |
| partos | `madre_id`, `fecha_parto NULL`, conteos NULL, `numero_parto`, versión | mismos campos, conteos `INTEGER` NULL | PAR: NULL ≠ 0 se conserva |
| pesajes | `peso_gramos NUMERIC(8,2)`, `etapa`, `parto_id`, `evento_id`, CHECK exclusivo (0005) | `peso_gramos TEXT` validado como decimal de 2 cifras, mismos vínculos | PAR tras la corrección de esta entrega: la validación de pull ahora rechaza `parto_id` y `evento_id` simultáneos, espejo del CHECK central. El SQLite no lleva CHECK propio para no romper la cadena de checksum del esquema local |
| eventos | `cuy_id`, `tipo`, `fecha`, `macho_id`, `poza_origen_id/destino_id`, `detalle`, versión | mismos campos | PAR |
| parto_crias | `parto_id`, `cuy_id`, `rol`, `UNIQUE(parto_id,cuy_id)`, `UNIQUE(cuy_id)`, sin `deleted_at` | idéntico | PAR |
| categoría derivada | columnas `categoria_*` en `cuyes`, `sync_derived_changes` | `categorias_animal` (solo lectura), `sync_derived_cursor` | PAR por protocolo 3, feed separado; la categoría oficial no se escribe desde el cliente |
| alertas derivadas | `alertas`, `sync_derived_changes` (`categoria`, `alerta`) | `alertas_derivadas` (solo lectura) | PAR; sin acciones de escritura sobre alertas |

### Detalles comprobados

- **Identidades:** UUID v4 central se transporta como `TEXT`; la validación de pull exige UUID v4 y no regenera identidades.
- **Pertenencia al ámbito:** central `scope_id` en cada tabla de dominio; local `sync_context.scope_id` ligado al `device_id` de la instalación. No se mezclan ámbitos: un dispositivo pertenece a un solo ámbito y el backend rechaza otro distinto.
- **Nulabilidad:** `fecha_parto`, conteos, `poza_id`, `fecha_nacimiento` y `color_codigo` aceptan NULL en ambos lados; 0 no se usa como "desconocido" (regresión `NULL se distingue de cero` en `work.migration.test.ts`).
- **Fechas:** `DATE` central → `TEXT` con formato `YYYY-MM-DD` local; `created_at/updated_at/synced_at/last_client_edited_at` → ISO 8601 con `Z` u offset (validado en `work.sync.pull.validation.ts`).
- **Pesos:** `NUMERIC(8,2)` central → `TEXT` local con patrón decimal de hasta 2 cifras; evita convertir en `REAL` y perder exactitud.
- **Versiones y metadatos:** `server_version BIGINT` → `version` decimal en texto; `sync_changes.sequence` → `seq` opaco; `last_client_edited_at` se transporta. `sync_scopes.last_sequence` y `derived_sequence` son exclusivamente centrales.
- **Borrado lógico:** `deleted_at` se transporta donde existe en ambos lados; `parto_crias` no lo tiene en ninguno.
- **Campos centrales que no se transportan:** `scope_id`, `server_version`, `last_client_edited_at` como columnas locales, `categoria_*` en el pull de dominio, `categoria_evaluada_at`, `categoria_procedencia`, metadatos de evaluación y evidencia. Llegan por v3 o por endpoints específicos.

### Tablas exclusivas

- **Solo PostgreSQL:** `app_users`, `auth_sessions`, `auth_audit`, `auth_login_attempts`, `sync_devices`, `sync_receipts`, `sync_scopes`, `sync_changes`, `importacion_lotes`, `importacion_correspondencias`, `importacion_origenes`, `evidencias_evaluacion`, `embeddings_sena`, `schema_migrations`, `sync_derived_changes`, `mortalidad` (no está en la base de Trabajo), y las columnas de categoría/alerta de `cuyes`/`alertas`.
- **Solo SQLite:** `sync_context`, `sync_record_state`, `sync_outbox`, `sync_inbox`, `sync_record_state`/`sync_derived_cursor`, `categorias_animal`, `alertas_derivadas`, `meta` y las tablas de la base de demostración (separadas de Trabajo).

### Protocolos y cursores (existentes, sin rediseñar)

- Pull/push v1: `protocol_version=1`, cursor opaco en `sync_context.cursor`.
- Pull/push v2 de dominio: `protocol_version=2`, cursor independiente en `sync_context.cursor_v2`.
- Feed derivado v3: `protocol_version=3`, cursor en `sync_derived_cursor`, entidades `categoria` y `alerta`, solo lectura.
- Los recibos de push se guardan centralmente en `sync_receipts`; localmente la outbox conserva `operation_id` y estado. No se cambió ninguno de estos contratos.

### Defecto corregido en este bloque

`client/src/data/work.sync.pull.validation.ts` aceptaba un `pesaje` con `parto_id` y `evento_id` a la vez. Ahora los rechaza con el mismo criterio que `pesajes_contexto_exclusivo_chk`. Regresión: `work.sync.pull.validation.test.ts` (`5 passed`). Es una validación de lectura; **no** se cambió el DDL local ni su checksum, y **no** se amplió la sincronización a tablas nuevas.

## 3. Android: punto exacto alcanzado y bloqueo de recursos

- Se recompiló `app-debug.apk` de la variante aislada `co.ucc.cuyielite.lab` con JDK 21 y `-PlabAppId=true`, después de `npm run build` + `npx cap copy android` con el código validado en este bloque. `BUILD SUCCESSFUL`.
- Se conservaron `Pixel_36`, el paquete habitual `co.ucc.cuyielite`, sus bases y su usuario. Solo se reinstaló la variante `.lab`.
- `adb reverse tcp:8000 tcp:8000` activo; la app abrió correctamente hasta la pantalla **«Elegir modo»**.
- Al intentar entrar a Trabajo apareció el cuadro **«System UI isn't responding»**. Se pulsó «Wait» una sola vez y la pantalla quedó en negro. Conforme a la instrucción del encargo, se detuvieron los intentos repetidos, se documentó el punto exacto y se cerró el emulador que habíamos iniciado (sin borrar sus datos).

Por tanto, en Android **no** se observaron login, consulta al asistente, cita, abstención, reapertura de sesión ni permisos de viewer. No se simularon mediante SQLite ni se presentó la verificación de Windows como si fuera Android. El mismo cambio de pantalla y de plazos quedó cubierto por pruebas unitarias y por el recorrido real en Windows/Electron de la entrega anterior.

## 5. Unicidad de `cuyes.codigo_identificacion` (aclaración D10)

| Estado | Evidencia verificable |
|---|---|
| Histórico | `db/ddl/central/002_nucleo.sql:27` declara `codigo_identificacion VARCHAR(50) NOT NULL UNIQUE`. |
| Migración vigorante | `db/migrations/central/0001_lope_domain.sql:46-47` elimina `cuyes_codigo_identificacion_key` y crea `idx_cuyes_codigo` como índice **no único**. |
| Base efectiva del piloto | Consulta de solo lectura sobre `cuyielite`: `cuyes_pkey PRIMARY KEY (id)`; `idx_cuyes_codigo CREATE INDEX ... btree (codigo_identificacion)`; columna `NOT NULL` sin default. No aparece ninguna restricción UNIQUE sobre la chapa. |
| SQLite efectivo | `client/src/data/work.schema.ts` declara `codigo_identificacion TEXT NOT NULL` sin UNIQUE; `client/src/data/work.migration.test.ts` conserva una regresión que permite dos filas con el mismo código. |

Consecuencia: la chapa es un dato de negocio que **puede repetirse**; la identidad técnica es `id`. Que dos registros compartan código **no demuestra** que sean el mismo animal y **no autoriza** a fusionarlos. Esta aclaración resuelve solo la parte técnica de D10; la decisión de dominio asociada sigue pendiente y se registra en la matriz canónica.

## 6. Pruebas ejecutadas en este bloque

```text
python -m pytest tools/db_migrate/tests -q   31 passed  (incluye los casos de 0005 del PR #157)
npx vitest run --maxWorkers=1                44 archivos, 244 pruebas
npm run lint                                 OK
npm run build / npx cap copy android         OK
assembleDebug -PlabAppId=true (JDK 21)       BUILD SUCCESSFUL
```

No se repitieron las suites de `tools/lope_import` ni de backend: no hubo cambios en esos componentes en este bloque.
