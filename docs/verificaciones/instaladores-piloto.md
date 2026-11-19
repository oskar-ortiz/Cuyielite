# Instalador Windows y APK de la candidata

Fecha: 2026-11-18. Rama `chore/instaladores-piloto`, base `c96d8bd` (#189 integrado). El contenido del cliente es el de la candidata `ac81eef`; no se cambiaron fuentes, contratos, modelos, índice RAG ni reglas. Instaladores disponibles fuera de Git en `%USERPROFILE%\Downloads\CuyiElite-Piloto-20261118\`.

## Generación y procedencia

El intento anterior falló durante `installAppDependencies`. Ya existía un `win-unpacked` comprobado. Se generó NSIS desde ese paquete con la opción oficial `--prepackaged`, evitando recompilar o ejecutar otra preparación de dependencias nativas:

```powershell
# Desde client/electron, con dist/win-unpacked previamente identificado y comprobado:
node node_modules/electron-builder/cli.js --win nsis --x64 --prepackaged dist/win-unpacked --config electron-builder.config.js --config.directories.output=dist/instaladores-piloto --config.nsis.runAfterFinish=false --publish never
```

Este comando **no actualiza el código del paquete de entrada**. Antes de reutilizarlo debe verificarse su procedencia. electron-builder 26.18.0 terminó con código 0. NSIS: x64, one-click, per-user, sin ejecución automática al finalizar. No se firmó comercialmente ni se publicaron binarios/releases.

El APK no se reconstruyó: se verificó con `aapt dump badging` y `apksigner verify --verbose --print-certs`. Paquete `.lab`, versión 1.0/código 1, mínimo API 24, target 36, ABI ARM32/ARM64/x86/x86_64. Firma v2 válida; certificado Android Debug SHA-256 `86c6669e49e8d67a23f60966783ea96ed6ae012533b438b8339c031bb4365f85`.

Los hashes completos y tamaños de ambos archivos constan en la [guía de instalación](../entrega/instalar-piloto.md). Se copiaron con nombres claros, junto con un manifiesto y `SHA256SUMS.txt`. No se cambió el contenido al renombrarlos.

## Instalación y conservación Windows

Antes de instalar se comprobó que no quedaban procesos CuyiElite. Se guardaron copias privadas de la instalación anterior y del perfil, excluyendo cachés de navegador; se registraron hashes, conteos por tabla e integridad de las bases propias de CuyiElite. Los datos privados no se versionan.

| Comprobación | Resultado |
|---|---|
| Instalación silenciosa `/S` sobre instalación existente | Código 0 |
| Bases originales después de instalar | Hashes y conteos idénticos; `integrity_check=ok` |
| Binario instalado | Igual al paquete de entrada |
| `resources/app.asar` instalado | Igual al paquete; SHA-256 `f3a80e2745387c22b799f2b3e3f3a20756712d171ed2368a982b9f890ba15baa` |
| Acceso directo Escritorio y menú Inicio | Ambos apuntan a `%LOCALAPPDATA%\Programs\cuyielite-electron\CuyiElite.exe`, sin argumentos |
| Arranque del ejecutable instalado | Ventana real, selección de modo y Demo observadas mediante Computer Use |
| Demo con perfil aislado | Cuatro galpones Norte/Sur/Occidente/Este visibles |
| Segunda instalación `/S` | Código 0; base Demo aislada conservó el hash |
| Bases originales después de reinstalar | Hashes y conteos idénticos; `integrity_check=ok` |

La prueba cubre una actualización sobre la instalación preexistente y una reinstalación de esta candidata. No se prueba desinstalación ni una migración de versión comercial futura. El arranque UI se hizo con perfil aislado, sin abrir ni migrar por UI el perfil habitual.

El primer intento de arranque no produjo ventana y una invocación independiente de PowerShell informó falta de memoria virtual. Se detuvo temporalmente el backend del piloto; después el mismo ejecutable abrió y navegó a Demo. No se atribuye a un defecto de producto ni se cambiaron pagefile, seguridad o aplicaciones ajenas. El backend se reinició después y confirmó `/health` OK.

## Teléfono y límites

Oskar prefirió recibir el APK y la guía para subirlos personalmente a una nube privada. No hubo dispositivo físico autorizado presente en ADB durante esta comprobación, por lo que **instalación, login y USB reverse en su teléfono quedan no observados**. No se sustituyó esa evidencia por el emulador. Pixel_36, la app habitual y sus datos permanecieron intactos.

Demo puede abrirse offline; los servicios centrales requieren backend accesible. Para el teléfono se documentó USB con reverse por serial, sin abrir firewall, cambiar loopback ni proponer Wi-Fi como si ya estuviera soportado. La candidata no contiene backend, cuentas ni bases del emulador.

No hay cambios de código ni suites nuevas. Se comprobaron el proceso NSIS, firma/manifiesto APK, instalación real, equivalencia de archivos, conservación SQLite y navegación real. Las guías se validan por enlaces y `git diff --check`.

Se conservan respaldos y reportes privados en `%LOCALAPPDATA%\CuyiElite\piloto-local\reportes\instaladores-20261118\`. No se alteraron recursos ajenos ni se promocionaron datos de Lope. La pertinencia RAG y revisión de dominio mantienen sus responsables.
