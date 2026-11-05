# Verificación de migraciones centrales Lope (C1)

## Versiones reales utilizadas

- Python: 3.13.7 (CI usa 3.12; diferencia registrada).
- PostgreSQL: 16 (imagen pgvector/pgvector:pg16, contenedor temporal, puerto 5433).
- psycopg: 3.3.7 (dependencia declarada en backend/requirements.txt).
- pytest: 9.2.0.

## Comandos ejecutados (PowerShell)

```powershell
# CLI: variable explícita pasada mediante --env-var
$env:CUYI_DB_URL = "postgresql://usuario:clave@host:puerto/base"
python -m tools.db_migrate --env-var CUYI_DB_URL

# Pruebas de migraciones: TEST_DATABASE_URL
$env:TEST_DATABASE_URL = "postgresql://usuario:clave@host:puerto/base"
python -m pytest tools/db_migrate/tests -q

# Pruebas de backend: TEST_DATABASE_URL y DATABASE_URL
$env:TEST_DATABASE_URL = "postgresql://usuario:clave@host:puerto/base"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
python -m pytest backend -q

# Bootstrap (solo base nueva)
python -c "
import psycopg, glob, os
url = os.environ['CUYI_DB_URL']
conn = psycopg.connect(url, autocommit=True)
for f in sorted(glob.glob('db/ddl/central/*.sql')):
    conn.execute(open(f, encoding='utf-8').read())
conn.close()
"
```

## Resultados de pruebas

- tools/db_migrate/tests: 20 passed.
- backend (base aislada migrada): 25 passed.
- tools/lope_import/tests: 19 passed (no repetidos, sin cambios de riesgo).

## Regresión sobre esquema migrado

- Base aislada creada (DROP/CREATE cuyielite_test), bootstrap 001-005 aplicado, migración 0001 aplicada.
- pytest backend: 25 passed sobre base migrada.
- Fixture de integración modificado para aplicar migración idempotente y siempre insertar datos de prueba.

## Evidencia de conservación, rollback y concurrencia

- Conservación: UUID, FK, fechas técnicas y de negocio, estados existentes, valores NUMERIC,
  filas de partos/pesajes, NULL vs cero conocido (test_conservacion_datos_sinteticos).
- Base vacía: sin filas de negocio tras migrar (test_base_vacia_sin_filas_negocio).
- Rollback: fallo intermedio revierte esquema, datos y registro (test_fallo_intermedio_rollback,
  test_fallo_intermedio_conserva_datos).
- Concurrencia: una sola aplicación, cero errores, un aplicado + un no-op, un registro
  (test_concurrencia_coordinada).
- No-op: segundo apply sin cambios (test_segundo_apply_noop).
- Checksum alterado: error antes de aplicar (test_checksum_alterado_error).
- Historial alterado: no aplica cambios nuevos (test_historial_alterado_no_aplica).
- Directorio inexistente/vacío: error (test_directorio_inexistente_error, test_directorio_vacio_error).

## Aislamiento

- El arnés crea bases nuevas con nombres únicos (cuyielite_c1_<hex>), registra cuáles creó
  y limpia exclusivamente esas bases. No reutiliza ni borra cuyielite_test.
- Si TEST_DATABASE_URL falta, las pruebas fallan (no skip).

## Recursos temporales utilizados y limpieza

- Contenedor temporal eliminado. Verificado sin contenedores cuyielite activos.

## Limitaciones y dependencias todavía pendientes

- C2 (SQLite de trabajo) no iniciado.
- Importador central (Entrega D) no iniciado.
- Sincronización ampliada (animales/eventos) no iniciada.
- CI no verificado en GitHub (solo local).