# Verificación — API central de consulta de galpones y pozas

Rama: `feat/backend-consulta-galpones`.

## Entorno

- Python 3.13.7, Docker 29.8.0.
- PostgreSQL 16 + pgvector (imagen `pgvector/pgvector:pg16`).
- Base de pruebas: `cuyielite_test` en localhost:5433 (exclusiva, desechable).
- DDL central aplicado en orden documentado (001_extensiones.sql, 002_nucleo.sql).
- Datos sintéticos: 3 galpones (Alfa, Bravo, Eliminado), 4 pozas (P-A, P-B, P-ELIM, P-201, P-202, P-301).

## Comandos reproducibles

```bash
# Levantar PostgreSQL de pruebas
docker run -d --name cuyielite-test \
  -e POSTGRES_USER=cuyielite -e POSTGRES_PASSWORD=cuyielite \
  -e POSTGRES_DB=cuyielite_test -p 5433:5432 pgvector/pgvector:pg16

# Aplicar DDL
export PGPASSWORD=cuyielite
for f in db/ddl/central/*.sql; do
  psql -h localhost -p 5433 -U cuyielite -d cuyielite_test -f "$f"
done

# Ejecutar pruebas
export TEST_DATABASE_URL="postgresql://cuyielite:cuyielite@localhost:5433/cuyielite_test"
export DATABASE_URL="$TEST_DATABASE_URL"
pytest backend

# Levantar FastAPI
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# Verificar endpoints
curl http://127.0.0.1:8000/health
curl "http://127.0.0.1:8000/galpones?limit=2&offset=0"
curl "http://127.0.0.1:8000/galpones/{galpon_id}/pozas"

# Limpieza
docker stop cuyielite-test && docker rm cuyielite-test
```

## Resultados

- `pytest backend`: 21 passed (13 unitarias + 8 integración).
- `git diff --check`: limpio.
- `/health`: 200 `{"status":"ok"}` sin base configurada.
- `/galpones`: 200 con paginación, orden estable, exclusión de eliminados,
  ubicación NULL.
- `/galpones/{id}/pozas`: 200 con paginación, orden estable, exclusión de
  eliminados, 404 para galpón inexistente.
- Validación: 422 para UUID inválido, limit fuera de rango, offset negativo.
- Base no disponible: 503 con mensaje genérico (sin credenciales ni SQL).

## Configuración de DATABASE_URL

Sin guardar credenciales en Git ni logs:

```bash
# Linux/macOS
export DATABASE_URL="postgresql://usuario:contraseña@host:5432/base"

# Windows PowerShell
$env:DATABASE_URL = "postgresql://usuario:contraseña@host:5432/base"
```

## Límites

- No se implementó autenticación, eliminación, LWW ni /sync.
- No se modificó el esquema central ni seeds compartidos.
- No se cambió el workflow del cliente.
- Pruebas manuales solo en localhost.