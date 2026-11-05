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

> ⚠️ Ejecutar **una sola vez** y solo sobre una base **vacía**. Los scripts no son
> idempotentes. Para repetir, usa otra base (por ejemplo `cuyielite_test`), nunca
> borres `cuyielite` si ya tiene datos.

Requisito: Docker Compose con PostgreSQL y pgvector en ejecución:

```powershell
docker compose up -d
```

Ejecuta los scripts de `ddl/central/` en orden, deteniéndose si alguno falla:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new()
$db = "cuyielite"   # cambia por una base temporal para pruebas
$files = Get-ChildItem db\ddl\central\*.sql | Sort-Object Name
foreach ($file in $files) {
    Get-Content $file.FullName -Raw -Encoding UTF8 |
        docker compose exec -T db psql -U cuyielite -d $db -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "Falló $($file.Name)" }
}
```

La CI actual **no valida el esquema**; `backend.yml` instala dependencias y
ejecuta las pruebas del backend.
