# Configuración del acceso de piloto

Estado: **PROPUESTA IMPLEMENTADA EN LABORATORIO; no es una guía de producción aprobada.** No contiene credenciales reales. La aprobación y el despliegue público corresponden a Oskar.

## 1. Base de datos

Aplicar la migración nueva una sola vez sobre una base con `0001`–`0004`:

```powershell
python -m tools.db_migrate --env-var DATABASE_URL
```

La migración `0006_auth_piloto.sql` agrega usuarios, sesiones, auditoría, intentos de login y estado de dispositivo. No modifica migraciones anteriores ni crea cuentas. La `0005` sigue reservada para el CHECK de pesajes de Diery.

## 2. Variables del backend

| Variable | Obligatoria en piloto | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Sí | PostgreSQL central |
| `CUYIELITE_AUTH_MODE=pilot` | Sí | Activa JWT y roles; sin ella se conserva el modo laboratorio |
| `CUYIELITE_AUTH_JWT_SECRET` | Sí | Secreto de firma de al menos 32 caracteres; fuera de Git |
| `CUYIELITE_AUTH_ISSUER` | Opcional | Emisor JWT; por defecto `cuyielite` |
| `CUYIELITE_AUTH_AUDIENCE` | Opcional | Audiencia JWT; por defecto `cuyielite-pilot` |
| `CUYIELITE_AUTH_ACCESS_TTL` | Opcional | Segundos del access token; por defecto 900 |
| `CUYIELITE_AUTH_REFRESH_TTL` | Opcional | Segundos del refresh; por defecto 2592000 |
| `CUYIELITE_AUTH_REFRESH_GRACE` | Opcional | Ventana de reintento tras rotación; por defecto 60 |
| `SYNC_CURSOR_SIGNING_KEY` | Sí | Firma de cursores; no rotar sin plan de compatibilidad |

No usar el token de laboratorio como contraseña ni como refresh. El modo de laboratorio y el de piloto son excluyentes para una instalación.

## 3. Alta inicial

El primer administrador se crea explícitamente; no hay registro público. Con `DATABASE_URL` configurada:

```powershell
python -m backend.app.auth_cli create-user --username admin-lope --role admin --scope <UUID-del-ambito>
python -m backend.app.auth_cli create-user --username consulta-lope --role viewer --scope <UUID-del-ambito>
python -m backend.app.auth_cli list-users
```

El comando pide la contraseña de forma interactiva (mínimo 12 caracteres). La cuenta nace con `must_change_password=true`; la UI permite cambiarla después del primer login.

Para revocar una instalación:

```powershell
python -m backend.app.auth_cli list-devices
python -m backend.app.auth_cli revoke-device --device-id <UUID>
```

Revocar un dispositivo invalida sus sesiones y access tokens en la siguiente petición. No borra la base local ni la outbox del equipo.

## 4. Cliente

### Android

Compilar con la URL HTTPS y el modo de piloto:

```powershell
$env:VITE_AUTH_MODE='pilot'
$env:VITE_API_BASE_URL='https://api.ejemplo-del-piloto'
npm run build
npx cap copy android
```

El refresh se cifra con una clave AES del Android Keystore. El access token vive solo en memoria. En release no se debe habilitar tráfico HTTP en claro; el HTTP loopback queda para builds de laboratorio.

### Windows/Electron

El renderer no elige la URL ni el método. El proceso principal usa `CUYIELITE_API_URL` (HTTPS o loopback) y guarda el refresh con `safeStorage` (DPAPI):

```powershell
$env:CUYIELITE_API_URL='https://api.ejemplo-del-piloto'
npm run build:electron
npm run sync:electron
```

Sin `CUYIELITE_API_URL` usa el loopback de laboratorio. No se debe distribuir una build de piloto apuntando a `http://` fuera de loopback.

## 5. Sesión y permisos

- `admin`: pull, push, escritura local, resolución de conflictos y ML/RAG.
- `viewer`: pull, consulta local, ML/RAG de consulta; nunca push, escritura, resolución de conflictos ni envío de outbox ajena.
- Cambiar de cuenta conserva `device_id`, `scope_id`, filas, cursores, recibos y outbox. La sesión activa es una por instalación.
- El refresh se renueva al sincronizar; si el access expiró, se renueva una vez. Si el refresh es inválido o vence, se pide login.
- Sin red, el trabajo local sigue disponible según el rol y la vigencia offline almacenada. La revocación central no es instantánea sin conexión.

## 6. TLS y operación

- Terminar TLS en Caddy/NGINX con certificado válido; redirigir HTTP a HTTPS.
- No exponer PostgreSQL; solo el backend en la red privada.
- Guardar secretos en variables/secret manager, nunca en Git, logs, capturas o SQLite.
- Copia diaria de PostgreSQL y restauración probada antes del piloto.
- Logs sin access tokens, refresh tokens, contraseñas ni cuerpos sensibles.
- Rate limit en el proxy y bloqueo de intentos en la aplicación.
- Rotar `CUYIELITE_AUTH_JWT_SECRET` con una ventana de transición; los access tokens existentes dejan de validar.

## 7. Límites de esta configuración

- No incluye VPS, dominio, certificado ni proveedor contratado.
- No incluye MFA ni recuperación automática por correo.
- No convierte el modo laboratorio en producción.
- La política de categorías/alertas y la integración real de RF/RAG siguen fuera de esta guía.
