param(
    [string]$Avd = 'Pixel_36',
    [ValidateRange(60, 600)][int]$TimeoutSeconds = 240,
    [ValidateRange(512, 8192)][int]$AvdRamMb = 2560
)

# Start the existing AVD visibly, preserving userdata and bypassing old snapshots.
# Keep API 36's minimum: low-RAM experiments booted but produced system ANRs.
$ErrorActionPreference = 'Stop'
$sdkCandidates = @($env:ANDROID_SDK_ROOT, $env:ANDROID_HOME, "$env:LOCALAPPDATA\Android\Sdk")
$sdk = $sdkCandidates | Where-Object {
    $_ -and (Test-Path -LiteralPath (Join-Path $_ 'emulator\emulator.exe')) -and
    (Test-Path -LiteralPath (Join-Path $_ 'platform-tools\adb.exe'))
} | Select-Object -First 1
if (-not $sdk) { throw 'No se encontro un SDK Android con emulator y adb.' }
$emulator = Join-Path $sdk 'emulator\emulator.exe'
$adb = Join-Path $sdk 'platform-tools\adb.exe'
$knownAvds = & $emulator -list-avds
if ($knownAvds -notcontains $Avd) { throw "No existe el AVD $Avd. No se creara ni borrara ninguno." }

$serial = $null
foreach ($device in (& $adb devices)) {
    if ($device -match '^(emulator-\d+)\s+device$') {
        $candidateSerial = $Matches[1]
        $name = & $adb -s $candidateSerial emu avd name
        if ($name -contains $Avd) { $serial = $candidateSerial; break }
    }
    if ($device -match '^emulator-\d+\s+offline$') {
        throw 'Hay un emulador iniciando o sin conexion. Espera y revisa su ventana antes de abrir otro.'
    }
}

if (-not $serial) {
    $memory = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
    $commitFree = [double]$memory.CommitLimit - [double]$memory.CommittedBytes
    $availableMb = [double]$memory.AvailableMBytes
    Write-Host "RAM disponible: $([math]::Round($availableMb)) MB; margen de memoria comprometida: $([math]::Round($commitFree / 1MB)) MB; AVD solicitado: $AvdRamMb MB."
    # El margen de commit puede ser alto gracias al archivo de paginacion mientras
    # la RAM fisica disponible es minima. En ese caso el emulador arranca pero
    # System UI entra en ANR y la app queda en pantalla negra. Exigir RAM real
    # disponible evita ese fallo sin cerrar aplicaciones de nadie.
    if ($availableMb -lt $AvdRamMb) {
        throw "RAM disponible insuficiente para el AVD ($AvdRamMb MB). No se inicia el emulador; libera memoria con el operador antes de reintentar. No se cierran aplicaciones ni se cambia el archivo de paginacion."
    }
    if ($commitFree -lt 4GB) {
        throw 'Falta margen de memoria comprometida para Android. No se inicia el emulador; no se cambiara el archivo de paginacion.'
    }
    $logBase = Join-Path $env:TEMP ('cuyielite-pixel-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    $launch = Start-Process -FilePath $emulator -ArgumentList @(
        '-avd', $Avd, '-memory', "$AvdRamMb", '-cores', '2',
        '-no-snapshot', '-no-boot-anim', '-gpu', 'host'
    ) -RedirectStandardOutput "$logBase.log" -RedirectStandardError "$logBase.err" -WindowStyle Normal -PassThru
    Write-Host "Pixel se abre en ventana propia. Logs: $logBase.log y $logBase.err"
    Write-Host 'Si aparece un aviso de fallo anterior, revisa el aviso en la ventana; no es la app CuyiElite.'
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    if (-not $serial) {
        foreach ($device in (& $adb devices)) {
            if ($device -match '^(emulator-\d+)\s+device$') {
                $candidateSerial = $Matches[1]
                $name = & $adb -s $candidateSerial emu avd name
                if ($name -contains $Avd) { $serial = $candidateSerial; break }
            }
        }
    }
    if ($serial -and ((& $adb -s $serial shell getprop sys.boot_completed) -join '').Trim() -eq '1') {
        Write-Host "Android listo: $serial. Memoria efectiva:"
        & $adb -s $serial shell head -n 3 /proc/meminfo
        Write-Host 'No se instalaron apps ni se modificaron bases, usuarios o ambitos.'
        exit 0
    }
    Start-Sleep -Seconds 3
}
throw 'Android no completo el arranque a tiempo. Revisa ventana y logs; no reintentes en bucle ni borres sus datos.'
