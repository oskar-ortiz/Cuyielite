param(
    [ValidateSet('start', 'stop', 'status', 'backup', 'restore-check', 'restore-dump-check', 'provision')]
    [string]$Action = 'status',
    [int]$Port = 8000,
    [string]$RestoreDatabase = 'cuyielite_pilot_restaurado',
    [string]$RestoreSource = ''
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

function Invoke-DockerQuiet {
    param([string[]]$DockerArgs)
    # psql escribe NOTICE y WARNING por stderr; con ErrorActionPreference=Stop
    # PowerShell 5.1 los convierte en errores aunque el proceso termine bien.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & docker @DockerArgs 2>$null | Out-Null }
    finally { $ErrorActionPreference = $previous }
    return $LASTEXITCODE
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
        # Un dump -Fc es binario: redirigirlo con '>' en Windows PowerShell lo
        # convierte a UTF-16 y lo corrompe. Se genera dentro del contenedor y
        # se copia con docker cp, que preserva los bytes.
        $remote = "/tmp/cuyielite-piloto-$stamp.dump"
        docker exec -e "PGPASSWORD=$($values['DB_PASSWORD'])" cuyielite-db-1 pg_dump -U cuyielite -d cuyielite -Fc -f $remote
        if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo con codigo $LASTEXITCODE; no se publica el respaldo." }
        docker cp "cuyielite-db-1:$remote" "$file"
        if ($LASTEXITCODE -ne 0) { throw "docker cp fallo con codigo $LASTEXITCODE; no se publica el respaldo." }
        docker exec cuyielite-db-1 rm -f $remote | Out-Null
        $stream = [System.IO.File]::OpenRead($file)
        try {
            $header = New-Object byte[] 5
            $read = $stream.Read($header, 0, 5)
        } finally { $stream.Dispose() }
        if ($read -ne 5 -or [System.Text.Encoding]::ASCII.GetString($header) -ne 'PGDMP') {
            throw "El archivo $file no tiene cabecera PGDMP; no se anuncia exito."
        }
        if ((Get-Item $file).Length -lt 1024) { throw "El respaldo $file es demasiado pequeno; no se anuncia exito." }
        Write-Host "Respaldo verificado: $file ($((Get-Item $file).Length) bytes, cabecera PGDMP)"
    }
    'restore-check' {
        $values = Get-PilotEnv
        $env:PGPASSWORD = $values['DB_PASSWORD']
        $null = Invoke-DockerQuiet -DockerArgs @('exec','-e',"PGPASSWORD=$($values['DB_PASSWORD'])",'cuyielite-db-1','psql','-U','cuyielite','-d','postgres','-c',"DROP DATABASE IF EXISTS $RestoreDatabase WITH (FORCE)")
        $null = Invoke-DockerQuiet -DockerArgs @('exec','-e',"PGPASSWORD=$($values['DB_PASSWORD'])",'cuyielite-db-1','psql','-U','cuyielite','-d','postgres','-c',"CREATE DATABASE $RestoreDatabase TEMPLATE cuyielite")
        $rows = Invoke-Sql -Sql "SELECT count(*) FROM cuyes" -Database $RestoreDatabase
        $scopes = Invoke-Sql -Sql "SELECT name FROM sync_scopes ORDER BY name" -Database $RestoreDatabase
        $migrations = Invoke-Sql -Sql "SELECT count(*) FROM schema_migrations" -Database $RestoreDatabase
        Write-Host "Restauracion comprobada en $RestoreDatabase : cuyes=$rows; ambitos=$scopes; migraciones=$migrations"
    }
    'restore-dump-check' {
        if (-not $RestoreSource -or -not (Test-Path -LiteralPath $RestoreSource)) {
            throw "Debe indicar -RestoreSource con un respaldo PGDMP existente."
        }
        $values = Get-PilotEnv
        # Se restaura SIEMPRE en una base aislada; nunca en cuyielite ni en otra
        # base preexistente del piloto.
        $code = Invoke-DockerQuiet -DockerArgs @('exec','-e',"PGPASSWORD=$($values['DB_PASSWORD'])",'cuyielite-db-1','psql','-U','cuyielite','-d','postgres','-c',"DROP DATABASE IF EXISTS $RestoreDatabase WITH (FORCE)")
        if ($code -ne 0) { throw "No se pudo preparar la base aislada $RestoreDatabase" }
        $code = Invoke-DockerQuiet -DockerArgs @('exec','-e',"PGPASSWORD=$($values['DB_PASSWORD'])",'cuyielite-db-1','psql','-U','cuyielite','-d','postgres','-c',"CREATE DATABASE $RestoreDatabase")
        if ($code -ne 0) { throw "No se pudo crear la base aislada $RestoreDatabase" }
        $remote = "/tmp/$([System.IO.Path]::GetFileName($RestoreSource))"
        docker cp "$RestoreSource" "cuyielite-db-1:$remote"
        if ($LASTEXITCODE -ne 0) { throw "No se pudo copiar el respaldo al contenedor" }
        $restoreCode = Invoke-DockerQuiet -DockerArgs @('exec','-e',"PGPASSWORD=$($values['DB_PASSWORD'])",'cuyielite-db-1','pg_restore','-U','cuyielite','-d',$RestoreDatabase,'--no-owner','--exit-on-error',$remote)
        docker exec cuyielite-db-1 rm -f $remote | Out-Null
        if ($restoreCode -ne 0) { throw "pg_restore fallo con codigo $restoreCode" }
        $migrations = Invoke-Sql -Sql "SELECT count(*) FROM schema_migrations" -Database $RestoreDatabase
        $constraint = Invoke-Sql -Sql "SELECT count(*) FROM pg_constraint WHERE conrelid='public.pesajes'::regclass AND conname='pesajes_contexto_exclusivo_chk'" -Database $RestoreDatabase
        $scopes = Invoke-Sql -Sql "SELECT count(*) FROM sync_scopes" -Database $RestoreDatabase
        $cuyes = Invoke-Sql -Sql "SELECT count(*) FROM cuyes" -Database $RestoreDatabase
        Write-Host "Respaldo restaurado en $RestoreDatabase : migraciones=$migrations; constraint_pesajes=$constraint; ambitos=$scopes; cuyes=$cuyes"
    }
    'provision' {
        $cred = Join-Path $env:LOCALAPPDATA 'CuyiElite\piloto-local\credenciales\cuentas-piloto.json'
        python -m tools.piloto.aprovisionar --credentials-file $cred
    }
}
