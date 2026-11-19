# Instalar CuyiElite en Windows y en un celular Android

Los instaladores de la candidata están en `%USERPROFILE%\Downloads\CuyiElite-Piloto-20261118\`, junto a `SHA256SUMS.txt`. Puedes copiarlos a una nube privada y descargarlos en tus dispositivos. No subas credenciales, bases, respaldos ni modelos con ellos.

## Windows

1. Cierra CuyiElite antes de instalar. Conserva el perfil y las bases; no desinstales ni borres datos para actualizar.
2. Ejecuta `CuyiElite-Piloto-Windows-x64.exe`. Es una instalación por usuario; no requiere permisos de administrador. El archivo no tiene firma comercial. Si Windows solicita una decisión de seguridad, debe revisarla Oskar manualmente, comprobando procedencia y hash.
3. Abre el acceso directo **CuyiElite** del Escritorio o del menú Inicio. Destino esperado: `%LOCALAPPDATA%\Programs\cuyielite-electron\CuyiElite.exe`.
4. Entra a **Demostración** para practicar sin backend. Para **Trabajo**, inicia el backend mediante el procedimiento de [piloto local](../operacion/piloto-local.md) y usa las credenciales privadas de tu cuenta.

El instalador se comprobó sobre la instalación existente y se repitió sin alterar las bases. No es necesario utilizar el antiguo acceso directo «CuyiElite Candidata ac81eef», que apunta a una carpeta de compilación del repositorio.

## Celular Android: descargar e instalar

Requisito: Android 7.0/API 24 o superior. El APK incluye ARM de 32/64 bits y x86/x86_64. Es una candidata **debug** firmada con certificado de desarrollo, sin publicación en tienda.

1. Sube solo `CuyiElite-Piloto-Android-lab.apk` a tu nube privada, por ejemplo tu Drive. No hace falta convertirlo a un documento ni cambiar la extensión `.apk`.
2. Descárgalo en el celular y ábrelo desde Descargas. Android puede solicitar autorización para instalar desde esa aplicación: revisa y realiza tú mismo la autorización correspondiente.
3. Instálalo y abre **CuyiElite**. Paquete: `co.ucc.cuyielite.lab`. Tiene sus propias bases y Keystore; puede coexistir con `co.ucc.cuyielite`. Ambas pueden mostrar el mismo nombre/icono: distingue la variante por los detalles de la aplicación.
4. Elige **Demostración** para empezar sin computador ni internet. La instalación empieza con almacenamiento propio; no copia las bases del emulador.
5. Para actualizar esta variante, instala otro APK del mismo paquete y certificado sobre el existente. Si Android informa conflicto de firma, detente: no desinstales ni borres sus datos para resolverlo a ciegas.

No se ha comprobado aún la instalación en el teléfono físico de Oskar. La firma del APK sí se verificó y el mismo archivo tiene evidencia nativa en Pixel_36.

## Trabajo conectado al piloto local por USB

Descargar el APK desde una nube **no aloja el backend**. `127.0.0.1` dentro del celular es el propio teléfono; no es el computador. La candidata conserva su transporte loopback, por lo que no se debe introducir una IP Wi-Fi arbitraria.

Para login, sincronización y servicios centrales del piloto local:

1. En el computador, inicia el piloto y comprueba `http://127.0.0.1:8000/health`.
2. Conecta el celular por USB, activa Depuración USB y acepta la autorización del computador. Android Platform Tools debe estar instalado.
3. Ejecuta `adb devices -l`. Si también está abierto Pixel, identifica el serial del **teléfono**, no `emulator-5554`.
4. Ejecuta, sustituyendo `SERIAL_DEL_TELEFONO`:

```powershell
adb -s SERIAL_DEL_TELEFONO reverse tcp:8000 tcp:8000
adb -s SERIAL_DEL_TELEFONO reverse --list
```

5. Abre **Trabajo → Acceso**, inicia sesión con tu cuenta del piloto y comprueba el rol. Después prueba sincronización o asistente.

La conexión necesita el computador y backend encendidos. Al desconectar USB o reiniciar el dispositivo puede ser necesario repetir `adb reverse`. La consulta y edición local permitida conservan el diseño offline existente; una instalación nueva necesita autenticarse y recibir los datos para utilizar ese ámbito. No se incluyen cuentas ni datos reales en el APK.

Si prefieres instalar desde el computador, usa `adb -s SERIAL_DEL_TELEFONO install -r "RUTA_DEL_APK"`; no ejecutes `pm clear` ni desinstales para actualizar.

## Identificar los archivos

| Archivo | Bytes | SHA-256 |
|---|---:|---|
| `CuyiElite-Piloto-Windows-x64.exe` | 121691665 | `79d7c194edb4b0d6838344677c1562cd66d20b060d555974910f683a3809f164` |
| `CuyiElite-Piloto-Android-lab.apk` | 14260229 | `ef41d9d628c16c02013ee8a24a9bd3bcb8cd4e25f7389eb7b3a8d1b5916ec1d3` |

La base de la candidata sigue siendo `ac81eef`; no cambió código de cliente para generar estos archivos. Windows declara versión `0.0.0`, Android `1.0`/código 1: el nombre de candidata y los hashes permiten distinguir la entrega. No se inventó una versión publicada. Consulta la [evidencia del instalador](../verificaciones/instaladores-piloto.md).
