# Base de datos

## Bootstrap vs migración

- **Bootstrap**: archivos en `db/ddl/central/001-005*.sql`. Se ejecutan una sola vez
  sobre una base vacía para crear el esquema histórico (galpones, pozas, cuyes, partos,
  pesajes, mortalidad, alertas, RAG, índices).
- **Migración incremental**: archivos en `db/migrations/central/`. Se aplican sobre una
  base que ya contiene el bootstrap. La primera es `0001_lope_domain.sql`.

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