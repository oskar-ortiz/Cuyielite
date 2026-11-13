# 0007. Autenticación para el piloto real de CuyiElite

**Estado: PROPUESTA.** No aprobada por Oskar ni por Diery. No autoriza código,
migraciones, credenciales, contratación de servicios ni cambios de despliegue.
Número provisional: el worktree de diseño de sincronización usa 0007–0009 para
otras decisiones aún no integradas; renumerar si se fusionan antes.

## Resumen ejecutivo

Para el piloto se propone **autenticación propia en FastAPI**, con librerías
estándar y sin proveedor externo: usuarios con contraseña Argon2id, access token
JWT de vida corta, refresh token opaco rotatorio, dispositivos vinculados a
usuario y ámbito, roles por ámbito y revocación inmediata por versión de
autenticación. El refresh token se guarda en almacenamiento seguro del sistema
operativo; el access token vive solo en memoria.

La recomendación es deliberadamente **de piloto**, no de producción. Antes de
usar datos reales de forma permanente o ampliar usuarios, la decisión debe
revisarse contra una alternativa OIDC gestionada o autogestionada (MFA,
recuperación automática, auditoría y operación). No se debe presentar el Bearer
estático de laboratorio como solución de piloto.

## Contexto verificado en el repositorio

| Tema | Estado actual | Consecuencia |
| --- | --- | --- |
| Bearer | `Authorization: Bearer <token>`; SHA-256 del token contra `sync_devices.token_hash` | No hay usuario, rol, expiración ni renovación |
| Ámbito | `scope_id` se deriva del token; el `device_id` del body debe coincidir | Correcto: no se confía en un scope enviado por el cliente |
| Dispositivos | `sync_devices(id, scope_id, token_hash, created_at)`; único por `(scope_id, token_hash)` | No hay propietario, estado, revocación ni último uso |
| Usuarios/roles | No existen tablas ni endpoints | No se puede distinguir administrador, operador o consulta |
| Token en cliente | Solo memoria; se pierde al cerrar; se escribe a mano en la UI | No hay sesión durable ni almacenamiento seguro |
| Transporte | Android `CapacitorHttp` y Electron contra `http://127.0.0.1:8000` fijo | Sirve para laboratorio; no para piloto fuera de loopback |
| TLS | No hay terminación TLS ni configuración de proxy en el backend | Obligatorio antes de exponer la API |
| FastAPI | Sin CORS, TrustedHost, rate limiting, bloqueo de intentos ni auditoría | Faltan controles mínimos de exposición |
| Offline | La base SQLite local funciona sin red; solo sync/ML/RAG requieren token | Debe conservarse: autenticar no debe bloquear el trabajo local |
| Recibos | `sync_receipts` usa `(scope_id, device_id, operation_id)` | El `device_id` existente debe preservarse para no perder idempotencia |
| Despliegue | README solo cubre PostgreSQL local con Docker y build de desarrollo | No hay runbook de piloto, TLS, respaldo ni secretos |

La autenticación de laboratorio está además protegida por
`CUYIELITE_SYNC_LAB_ENABLED=1`; sin la bandera las rutas devuelven 404. Esa
bandera es un control de laboratorio, no autenticación de piloto.

## Decisión propuesta

### Para el piloto

1. **Autenticación propia en FastAPI**, sin integrar un proveedor en esta etapa.
2. **Contraseñas con Argon2id** mediante una librería mantenida; nunca hash propio
   ni contraseñas en texto plano.
3. **Access token JWT** firmado por el backend, con expiración de 10–15 minutos.
4. **Refresh token opaco** de 256 bits, almacenado solo como hash, con rotación en
   cada uso y detección de reutilización.
5. **Dispositivo vinculado a usuario y ámbito**, conservando el `device_id` actual
   cuando ya exista, para no invalidar recibos ni cursores.
6. **Roles por ámbito**: `admin`, `operator`, `viewer`. El administrador global
   gestiona usuarios, ámbitos y dispositivos; el operador sincroniza y edita su
   ámbito; el visor solo lee.
7. **TLS obligatorio** en el piloto mediante proxy inverso; HTTP solo en desarrollo
   local y builds de laboratorio.
8. **Almacenamiento seguro**: refresh token en Android Keystore y en Electron
   `safeStorage` (DPAPI); access token en memoria. Nunca en SQLite, localStorage,
   archivos de log ni Git.
9. **Recuperación asistida por administrador** en el piloto; recuperación por
   correo autoservicio queda para producción.
10. **Operación local primero**: sin red se sigue leyendo y escribiendo en SQLite;
    la sesión solo se exige para sincronizar y para ML/RAG.

### Para producción

No se propone extender esta autenticación propia sin una revisión de seguridad.
Antes de producción se debe decidir entre OIDC gestionado y OIDC autogestionado,
con MFA, recuperación automática, auditoría centralizada, rotación de claves,
alta disponibilidad y revisión de protección de datos. Esta ADR deja ese cambio
explícitamente abierto.

## Opciones comparadas

Costos en orden de magnitud para un piloto de 3–10 usuarios; verificar precios y
condiciones al contratar.

| Opción | Costo operativo | Ventajas | Riesgos / límites | Veredicto |
| --- | --- | --- | --- | --- |
| Bearer estático actual | Casi cero | Ya funciona; mínimo código | Sin usuarios, roles, expiración, revocación ni recuperación | **No apto para piloto** |
| FastAPI propio | VPS/backend existente; ~USD 10–25/mes si se suma piloto | Control total; encaja con scopes/devices; sin dependencia externa; offline sencillo | Hay que implementar y revisar seguridad, límites y recuperación | **Recomendado para piloto** |
| OIDC gestionado (Auth0, Clerk, Supabase Auth, Cognito) | Gratis o bajo en piloto; producción desde ~USD 25/mes | Password reset, MFA y operación maduros; menos código sensible | Dependencia y costo; datos fuera del piloto; claims/scope personalizados; integración offline | **Candidato para producción** |
| OIDC autogestionado (Keycloak, Ory) | Sin licencia; VPS y horas de operación | Estándar, MFA, control de datos | Más infraestructura, actualizaciones, respaldo y experiencia operativa | **Solo si producción exige control local** |

La opción propia gana en el piloto porque el equipo ya tiene FastAPI y PostgreSQL,
el número de usuarios es pequeño y el modelo de ámbito/dispositivo ya existe. La
decisión se revisa antes de producción; no se congela como arquitectura definitiva.

## Modelo conceptual propuesto

No se crea ninguna migración en esta entrega.

| Tabla / cambio | Campos mínimos | Nota |
| --- | --- | --- |
| `app_users` | `id`, `username/email`, `password_hash`, `status`, `created_at`, `password_changed_at`, `auth_version` | `auth_version` invalida access tokens al deshabilitar o cambiar contraseña |
| `app_scope_memberships` | `user_id`, `scope_id`, `role`, `created_at`, `revoked_at` | Muchos usuarios por ámbito; roles `admin/operator/viewer` |
| `auth_sessions` | `id`, `user_id`, `device_id`, `scope_id`, `refresh_hash`, `family_id`, `expires_at`, `revoked_at`, `created_at`, `last_used_at` | Refresh opaco con rotación y detección de reutilización |
| `sync_devices` extendida | `user_id`, `name`, `platform`, `status`, `revoked_at`, `last_seen_at`, `auth_version` | Conservar `id` actual; no romper `sync_receipts` |
| `auth_audit` | `id`, `event`, `user_id`, `device_id`, `scope_id`, `ip`, `created_at`, `detail` sin secretos | Login, refresh, revocación, alta de dispositivo |
| `auth_login_attempts` | `key`, `window_start`, `count`, `blocked_until` | Alternativa sin Redis; complementar con rate limit del proxy |

`sync_scopes` se conserva. Un ámbito representa una unidad operativa (por definir
con Diery); un usuario puede pertenecer a varios ámbitos, pero un dispositivo
tiene un ámbito activo por sesión en el piloto. Cambiar de ámbito exige una nueva
sesión/dispositivo o una operación administrativa explícita, no un campo libre.

## Flujos

### 1. Alta inicial y primer inicio de sesión

1. El administrador crea el ámbito, el usuario y su membresía con rol.
2. Entrega una contraseña temporal por un canal fuera del repositorio.
3. El usuario inicia sesión por HTTPS; el servidor verifica Argon2id, estado y
   membresía.
4. El servidor crea/actualiza el dispositivo y emite access + refresh. El primer
   dispositivo del usuario queda activo; un dispositivo adicional queda
   `pending` hasta aprobación administrativa.
5. El cliente exige cambiar la contraseña temporal antes de sincronizar.
6. El refresh se guarda en almacenamiento seguro; el access queda en memoria.

### 2. Inicio de sesión normal

1. `POST /auth/login` con usuario/contraseña sobre TLS.
2. Rate limit por usuario/IP y bloqueo temporal tras intentos fallidos.
3. Respuesta: access token (10–15 min), refresh token (30 días), `device_id`,
   `scope_id`, rol y expiración.
4. El cliente no guarda la contraseña ni el access token.

### 3. Renovación

1. `POST /auth/refresh` con el refresh token.
2. El servidor busca el hash, comprueba expiración, dispositivo, usuario,
   membresía y estado.
3. Si es válido, rota: invalida el refresh usado y emite uno nuevo de la misma
   familia.
4. Si detecta reutilización de un refresh ya rotado, revoca la familia completa y
   exige nuevo inicio de sesión.
5. El access token nuevo se mantiene en memoria; el refresh se reemplaza en el
   almacenamiento seguro.

### 4. Autorización de sincronización

1. El cliente envía `Authorization: Bearer <access>` y su `device_id`.
2. FastAPI valida firma, `iss`, `aud`, `exp`, `iat`, `jti`, `auth_version`.
3. Deriva `user_id`, `device_id`, `scope_id` y rol del token; no del body.
4. Comprueba que el `device_id` del body coincide con el token.
5. Comprueba usuario activo, dispositivo activo y membresía vigente en el ámbito.
6. Aplica el rol: `operator` puede push/pull de su ámbito; `viewer` solo pull;
   `admin` puede además gestionar usuarios/dispositivos.
7. Los endpoints ML/RAG usan la misma identidad y ámbito; no reciben scope libre.

### 5. Revocación y pérdida de dispositivo

1. El administrador revoca un dispositivo o usuario.
2. Se incrementa `auth_version` y se marcan refresh tokens como revocados.
3. El access token deja de valer en la siguiente petición (comparación de
   `auth_version`); no se espera a que expire.
4. El dispositivo revocado puede seguir leyendo/escribiendo localmente, pero no
   sincronizar ni consultar ML/RAG.
5. El usuario se autentica en un dispositivo nuevo; se crea un `device_id` nuevo
   y el anterior queda inactivo. Los recibos del anterior no se reutilizan.
6. Si se recupera el mismo dispositivo, se reenrola; no se reutiliza el refresh
   revocado.

### 6. Expiración sin conexión

1. Sin red, la app sigue operando sobre SQLite y encola cambios.
2. Si el access token expiró, la próxima sincronización falla con un código
   distinguible (`AUTH_REQUIRED`/`TOKEN_EXPIRED`), no con “sin conexión”.
3. Si el refresh token expiró o fue revocado, se pide inicio de sesión; los datos
   locales y la outbox no se borran.
4. Al volver la red, se renueva la sesión y se reintenta el mismo ciclo; los
   cuerpos congelados y recibos no se alteran.
5. Desfase de reloj: tolerancia de 60 s y autoridad del servidor; no se usan
   fechas del dispositivo para autorizar.

### 7. Recuperación de cuenta

- **Piloto:** el administrador verifica identidad por un canal acordado y emite
  una contraseña temporal; el usuario la cambia al entrar. No hay correo
  automático obligatorio.
- **Producción:** enlace de un solo uso por correo, expiración corta, rate limit,
  invalidación de sesiones y notificación al usuario.
- La recuperación nunca revela si un usuario existe.

### 8. Migración desde el laboratorio

1. Congelar el laboratorio y respaldar la base central.
2. Crear el usuario administrador y las membresías de ámbito.
3. Mapear cada `sync_devices.id` existente a un dispositivo del piloto **con el
   mismo UUID**, para conservar `sync_receipts`, cursores e idempotencia.
4. Marcar el Bearer estático como revocado; no se convierte en refresh ni se
   reutiliza como contraseña.
5. El usuario inicia sesión, obtiene refresh nuevo y el mismo `device_id`; no se
   fuerza una resincronización completa ni se borra la base local.
6. Verificar que el dispositivo antiguo no puede autenticarse y que los recibos
   anteriores siguen recuperables.

## Seguridad y operación

| Tema | Piloto | Producción |
| --- | --- | --- |
| Contraseñas | Argon2id; mínimo 12 caracteres; sin reutilización | + política, MFA, verificación de filtraciones |
| Access token | JWT 10–15 min, HS256 con `kid` y secreto rotable | RS256/EdDSA, claves gestionadas, rotación |
| Refresh | Opaco, hash SHA-256, rotación, familia, 30 días | + detección de reutilización centralizada, revocación global |
| TLS | Proxy Caddy/NGINX con Let's Encrypt, HSTS, TLS 1.2+ | + WAF, certificate pinning evaluado, monitoreo |
| Rate limit | Proxy + intentos por usuario/IP | + bot/abuse protection, alertas |
| Secretos | Variables de entorno/secret manager; nunca Git | + rotación, auditoría de acceso |
| Respaldos | `pg_dump` diario, restauración probada | + PITR, réplica, pruebas periódicas |
| Auditoría | Login, refresh, revocación y alta de dispositivo | + SIEM, retención y alertas |
| Datos personales | Minimizar; aviso y finalidad; Ley 1581 | + evaluación de impacto y retención formal |
| Disponibilidad | Un backend y una base; ventana de mantenimiento | + HA, health checks, presupuesto de error |

### Despliegue de referencia para el piloto

- Un VPS pequeño o contenedor gestionado con FastAPI y PostgreSQL 16/pgvector.
- Caddy o NGINX delante, TLS automático y redirección permanente a HTTPS.
- PostgreSQL sin puerto público; solo la red del backend.
- Backend con `DATABASE_URL`, secreto JWT y clave de cursor en variables/secret
  manager; no en el repositorio.
- Logs sin tokens, contraseñas, refresh ni cuerpos sensibles.
- Copia diaria fuera del VPS y una restauración de prueba antes del piloto.
- Android release sin `usesCleartextTraffic`; Electron con URL base HTTPS fija.

### Costos de referencia

| Rubro | Orden de magnitud | Nota |
| --- | --- | --- |
| VPS 2 vCPU/2–4 GB | USD 5–15/mes | Depende del proveedor y región |
| Dominio | USD 10–20/año | TLS Let's Encrypt sin costo |
| Respaldo/objeto | USD 1–5/mes | Copia diaria y retención corta |
| PostgreSQL gestionado | USD 0–20/mes | Opcional; el piloto puede usar el VPS |
| OIDC gestionado | Gratis/bajo en piloto; ~USD 25+/mes producción | Verificar plan y límites |
| Keycloak autogestionado | Sin licencia; horas de operación | Requiere VPS, TLS, respaldo y actualizaciones |

No se contrata ni configura nada en esta entrega.

### Dependencias técnicas de la opción propia

| Capa | Dependencia propuesta | Nota |
| --- | --- | --- |
| Backend | `argon2-cffi`, `PyJWT`, utilidades estándar de `secrets`/`hashlib` | Librerías mantenidas; no criptografía propia |
| Base | PostgreSQL existente | Sin Redis en el piloto; intentos y auditoría en PostgreSQL |
| Proxy/TLS | Caddy o NGINX + Let's Encrypt | Terminación TLS y rate limit básico |
| Android | Almacenamiento respaldado por Android Keystore | Plugin acotado o librería mantenida; no SQLite ni Preferences |
| Windows | Electron `safeStorage` (DPAPI) | Ya disponible en Electron; sin módulo nativo adicional |
| Correo | SMTP opcional | Solo si se habilita recuperación por correo; el piloto puede ser asistido |
| Operación | VPS/contenedor, respaldo y monitoreo | Costos de la tabla anterior |

## Requisitos del piloto vs producción

| Requisito | Piloto | Producción |
| --- | --- | --- |
| Usuarios | 3–10, alta manual | Autoservicio o directorio |
| Roles | `admin`, `operator`, `viewer` | RBAC más granular y segregación |
| Dispositivos | Alta asistida; primer dispositivo aprobado | Enrollment con atestación y política |
| Recuperación | Administrador | Correo autoservicio + MFA |
| Tokens | 15 min / 30 días rotatorio | Más cortos, rotación y revocación central |
| MFA | No exigido | Obligatorio para administradores |
| TLS | Obligatorio | Obligatorio + monitoreo/pinning evaluado |
| Auditoría | Eventos mínimos | Centralizada, alertas y retención |
| Offline | Local siempre; sync al reconectar | Igual, con políticas de sesión más estrictas |
| Respaldos | Diario y restauración probada | PITR, réplica y RPO/RTO definidos |
| Alta disponibilidad | No obligatoria | Requerida según operación |

## Pruebas de aceptación propuestas

| ID | Caso | Resultado esperado |
| --- | --- | --- |
| AUTH-01 | Login correcto | Access + refresh; dispositivo y ámbito correctos |
| AUTH-02 | Contraseña incorrecta repetida | 401 genérico, rate limit/bloqueo, sin filtrar usuario |
| AUTH-03 | Usuario deshabilitado | Login y refresh rechazados; access existente invalidado |
| AUTH-04 | Access expirado | 401 `TOKEN_EXPIRED`; refresh válido renueva |
| AUTH-05 | Refresh rotado y reutilizado | Familia revocada; se exige login |
| AUTH-06 | Dos refresh concurrentes | Uno rota; el otro no deja la sesión en estado ambiguo |
| AUTH-07 | Dispositivo revocado | Sync/ML/RAG rechazados; datos locales intactos |
| AUTH-08 | `device_id` del body ajeno | 403; no se usa el scope del body |
| AUTH-09 | Usuario sin membresía en scope | 403; no se revelan datos de otro ámbito |
| AUTH-10 | Viewer intenta push | 403; pull permitido |
| AUTH-11 | Operador intenta administrar | 403; solo admin |
| AUTH-12 | Offline con access expirado | Trabajo local continúa; sync falla con código de auth |
| AUTH-13 | Refresh expirado offline | Datos y outbox persisten; login al reconectar |
| AUTH-14 | Pérdida de dispositivo | Revocación; nuevo dispositivo con id nuevo; sin duplicar recibos |
| AUTH-15 | Reinicio de app | Refresh seguro persiste; access no se escribe en SQLite |
| AUTH-16 | Inspección de almacenamiento/logs | Sin refresh, contraseña ni access en claro |
| AUTH-17 | TLS | HTTP rechazado; certificado válido; HSTS |
| AUTH-18 | Migración desde laboratorio | `device_id`, scope, recibos y cursores existentes se preservan |
| AUTH-19 | Recuperación de cuenta | Cambio de contraseña invalida sesiones previas |
| AUTH-20 | Respaldo/restauración | Usuarios, dispositivos y recibos coherentes tras restaurar |

## Riesgos

1. **Seguridad de autenticación propia.** Es el riesgo principal. Mitigación:
   librerías mantenidas, Argon2id, JWT estándar, revisión independiente, pruebas
   de abuso, rate limit, auditoría y no inventar criptografía.
2. **Complejidad de recuperación.** Sin correo automático, el piloto depende del
   administrador. Debe existir un procedimiento y un responsable.
3. **Dispositivos compartidos.** Si dos operadores usan el mismo teléfono, el
   refresh y el `device_id` deben corresponder a una sesión; se requiere logout
   explícito y política de dispositivo.
4. **Conectividad rural.** La expiración de sesión no debe impedir el trabajo
   local; el flujo offline debe probarse con tokens vencidos y sin red.
5. **Relojes desajustados.** Tolerancia corta y autoridad del servidor; no usar
   `updated_at` local para autorizar.
6. **Datos personales.** La autenticación agrega correo/teléfono y auditoría; debe
   revisarse finalidad, retención y acceso conforme a Ley 1581.
7. **Migración de dispositivos.** Cambiar `device_id` rompería la idempotencia de
   recibos; la migración debe conservar el UUID existente.
8. **Dependencia externa futura.** Si se elige OIDC, el piloto propio no debe
   presentarse como arquitectura definitiva ni duplicar identidades.

## Decisiones que requieren revisión de Diery

- Qué representa exactamente un `scope`: unidad productiva, galpón, técnico o
  combinación. Impacta la propiedad de los datos y la autorización.
- Si un usuario puede pertenecer a varios ámbitos y cómo se cambia de ámbito en
  un mismo dispositivo.
- Quién puede crear/editar datos y quién solo consultar; roles reales del piloto.
- Si el ETL de Diery usa una cuenta de servicio, qué rol y qué ámbito tiene.
- Identificador de usuario (correo, teléfono, documento) y canal de recuperación.
- Retención de auditoría, datos personales y obligaciones de la Ley 1581.
- Si el piloto comparte datos entre unidades o permanece aislado por ámbito.

## Decisiones que requieren revisión de Oskar

- Aprobación de autenticación propia para el piloto y de su deuda de seguridad.
- Aprobación de la tabla/ migración futura y de la conservación de `device_id`.
- Elección del proveedor de VPS, dominio y TLS; presupuesto.
- Política de contraseñas, duración de tokens y recuperación asistida.
- Si el refresh se maneja en un plugin nativo o en la capa JS con almacenamiento
  seguro; recomendación: plugin nativo para Android y `safeStorage` en Electron.

## Fuera de alcance de esta propuesta

- Implementar endpoints, migraciones, plugins, TLS o aprovisionamiento.
- Integrar Auth0, Clerk, Supabase, Cognito, Keycloak u otro proveedor.
- Guardar secretos, tokens o credenciales en el repositorio.
- Cambiar scopes, dispositivos, recibos o cursores existentes.
- Reabrir la verificación de D7 o repetir pruebas ya aprobadas.

## Próximo paso recomendado

1. Revisión de esta ADR por Oskar y Diery, empezando por la definición de ámbito y
   roles (Diery) y por la deuda de seguridad/despliegue (Oskar).
2. Si se aprueba, dividir la implementación en: modelo y migración; endpoints y
   middleware; almacenamiento seguro Android/Electron; TLS/despliegue; pruebas de
   aceptación y migración de dispositivos de laboratorio.
3. No implementar hasta que exista una decisión explícita sobre la alternativa
   propia vs OIDC para producción y sobre el tratamiento de datos personales.
