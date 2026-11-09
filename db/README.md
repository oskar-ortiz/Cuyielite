# Base de datos

- `ddl/central/`: DDL versionado de la base central.
- `ddl/local/`: DDL versionado de la base local SQLite.
- `seeds/`: datos **sintéticos** de prueba. Nunca datos reales del Centro Lope.

## DDL local (SQLite)

`ddl/local/001_sqlite.sql` define las tablas de persistencia local del cliente.
SQLite guarda UUID y marcas de tiempo como `TEXT`; las tablas declaran sus
relaciones con `REFERENCES`. La aplicación debe ejecutar `PRAGMA
foreign_keys = ON` en cada conexión SQLite para que el motor aplique esas
restricciones.

## Ejecución del DDL central

No ejecutar el bootstrap sobre una base ya inicializada. No ejecutar migraciones sobre
una base sin bootstrap.

## Precondiciones

- PostgreSQL 16 (imagen `pgvector/pgvector:pg16`) con extensión uuid-ossp.
- Python 3.12+ con `psycopg[binary]` (declarado en `backend/requirements.txt`).
- Variable de entorno con la URL de conexión (nombre definido por el operador).

## Comandos reproducibles (PowerShell)

```powershell
# Definir la URL en una variable de entorno (sin credenciales reales en el comando)
$env:CUYI_DB_URL = "postgresql://usuario:clave@host:puerto/base"

# Bootstrap (solo base nueva)
python -c "
import psycopg, glob, os
url = os.environ['CUYI_DB_URL']
conn = psycopg.connect(url, autocommit=True)
for f in sorted(glob.glob('db/ddl/central/*.sql')):
    conn.execute(open(f, encoding='utf-8').read())
conn.close()
"

# Migración (CLI: nombre explícito pasado mediante --env-var)
python -m tools.db_migrate --env-var CUYI_DB_URL

# Pruebas de migraciones (TEST_DATABASE_URL)
$env:TEST_DATABASE_URL = "postgresql://usuario:clave@host:puerto/base"
python -m pytest tools/db_migrate/tests -q

# Pruebas de backend (TEST_DATABASE_URL y DATABASE_URL)
$env:TEST_DATABASE_URL = "postgresql://usuario:clave@host:puerto/base"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
python -m pytest backend -q
```

El endpoint de laboratorio `GET /sync/pull` requiere `SYNC_CURSOR_SIGNING_KEY`:
una clave aleatoria persistente de al menos 32 bytes, fuera de Git. No rotarla
entre reinicios del mismo laboratorio; los cursores anteriores dejarían de validar.
Para una prueba local aislada, generar y conservar la clave fuera del repositorio:

```powershell
$keyBytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($keyBytes)
$env:SYNC_CURSOR_SIGNING_KEY = [Convert]::ToBase64String($keyBytes)
```

Las pruebas automatizadas usan una clave sintética no válida para producción.

## Registro, checksum y no-op

- Tabla `schema_migrations(id TEXT PK, checksum TEXT, applied_at TIMESTAMPTZ)`.
- Cada migración se registra con SHA-256 del archivo.
- Reejecución sin cambios: no-op (sin duplicación del registro).
- Checksum distinto para migración ya aplicada: error antes de aplicar nuevos cambios.

## Recuperación ante fallo transaccional

- Migración y registro de checksum en la misma transacción.
- ROLLBACK si falla una sentencia; sin registro parcial.
- Bloqueo advisory (`pg_advisory_lock`) evita dos ejecutores concurrentes.
- Conexión cerrada y errores visibles, también ante fallo.

## Restricción de esta entrega

Esta entrega (C1) es de laboratorio. No cargar datos reales. No implementa importación
ni sincronización. El esquema de sincronización ampliado es una dependencia posterior.
