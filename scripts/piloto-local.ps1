param(
    [ValidateSet('start', 'stop', 'status', 'backup', 'restore-check', 'provision')]
    [string]$Action = 'status',
    [int]$Port = 8000,
    [string]$RestoreDatabase = 'cuyielite_pilot_restaurado'
)

# Control del piloto local de CuyiElite (PostgreSQL/pgvector + API FastAPI).
#
# El piloto usa su propio volumen persistente (pgdata) y su propio puerto de
# base (DB_PORT en .env). No toca el PostgreSQL nativo de Windows ni el
# contenedor de pruebas cuyielite-s3-test.
#
#   .\scripts\piloto-local.ps1 start
#   .\scripts\piloto-local.ps1 status
#   .\scripts\piloto-local.ps1 backup
#   .\scripts\piloto-local.ps1 stop
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repo '.env'
$stateDir = Join-Path $env:LOCALAPPDATA 'CuyiElite\piloto-local\estado'
$logDir = Join-Path $env:LOCALAPPDATA 'CuyiElite\piloto-local\logs'
$backupDir = Join-Path $env:LOCALAPPDATA 'CuyiElite\piloto-local\respaldos'
New-Item -ItemType Directory -Force -Path $stateDir, $logDir, $backupDir | Out-Null

function Get-PilotEnv {
    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "No existe $envFile. Copia .env.example a .env y completa los valores."
    }
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $envFile) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#') -or -not $trimmed.Contains('=')) { continue }
        $index = $trimmed.IndexOf('=')
        $values[$trimmed.Substring(0, $index)] = $trimmed.Substring($index + 1)
    }
    return $values
}

function Get-DatabaseUrl {
    $values = Get-PilotEnv
    return $values['DATABASE_URL']
}

function Invoke-Sql {
    param([string]$Sql, [string]$Database = 'cuyielite')
    $values = Get-PilotEnv
    $url = $values['DATABASE_URL']
    $env:PGPASSWORD = $values['DB_PASSWORD']
    docker exec -e "PGPASSWORD=$($values['DB_PASSWORD'])" cuyielite-db-1 psql -U cuyielite -d $Database -t -A -c $Sql
}

function Invoke-BackendController {
    param([string]$Command)
    Push-Location $repo
    try {
        python -m tools.piloto.servidor $Command --port $Port
        if ($LASTEXITCODE -ne 0) { throw "El controlador del backend devolvio $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
}

switch ($Action) {
    'start' {
        docker compose up -d db
        $deadline = (Get-Date).AddSeconds(60)
        while ((Get-Date) -lt $deadline) {
            docker exec cuyielite-db-1 pg_isready -U cuyielite -d cuyielite *> $null
            if ($LASTEXITCODE -eq 0) { break }
            Start-Sleep -Seconds 2
        }
        Write-Host 'Base del piloto lista.'
        Invoke-BackendController -Command 'start'
    }
    'stop' {
        Invoke-BackendController -Command 'stop'
        docker compose stop db
        Write-Host 'Base del piloto detenida (el volumen pgdata se conserva).'
    }
    'status' {
        $values = Get-PilotEnv
        $dbState = docker inspect -f '{{.State.Status}}' cuyielite-db-1 2>$null
        Write-Host "Base (contenedor cuyielite-db-1): $dbState; puerto $($values['DB_PORT'])"
        Invoke-BackendController -Command 'status'
        $counts = Invoke-Sql -Sql "SELECT 'ambitos=' || count(*) FROM sync_scopes"
        Write-Host $counts
        $users = Invoke-Sql -Sql "SELECT username || '/' || role || '/' || status FROM app_users ORDER BY username"
        Write-Host $users
    }
    'backup' {
        $values = Get-PilotEnv
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $file = Join-Path $backupDir "cuyielite-piloto-$stamp.dump"
        docker exec -e "PGPASSWORD=$($values['DB_PASSWORD'])" cuyielite-db-1 pg_dump -U cuyielite -d cuyielite -Fc > $file
        Write-Host "Respaldo: $file ($((Get-Item $file).Length) bytes)"
    }
    'restore-check' {
        $values = Get-PilotEnv
        $env:PGPASSWORD = $values['DB_PASSWORD']
        docker exec -e "PGPASSWORD=$($values['DB_PASSWORD'])" cuyielite-db-1 psql -U cuyielite -d postgres -c "DROP DATABASE IF EXISTS $RestoreDatabase WITH (FORCE)" *> $null
        docker exec -e "PGPASSWORD=$($values['DB_PASSWORD'])" cuyielite-db-1 psql -U cuyielite -d postgres -c "CREATE DATABASE $RestoreDatabase TEMPLATE cuyielite" *> $null
        $rows = Invoke-Sql -Sql "SELECT count(*) FROM cuyes" -Database $RestoreDatabase
        $scopes = Invoke-Sql -Sql "SELECT name FROM sync_scopes ORDER BY name" -Database $RestoreDatabase
        $migrations = Invoke-Sql -Sql "SELECT count(*) FROM schema_migrations" -Database $RestoreDatabase
        Write-Host "Restauracion comprobada en $RestoreDatabase : cuyes=$rows; ambitos=$scopes; migraciones=$migrations"
    }
    'provision' {
        $cred = Join-Path $env:LOCALAPPDATA 'CuyiElite\piloto-local\credenciales\cuentas-piloto.json'
        python -m tools.piloto.aprovisionar --credentials-file $cred
    }
}
