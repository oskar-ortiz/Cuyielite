# Acceso de piloto e integración de entregas (laboratorio)

Estado: **IMPLEMENTADO Y VERIFICADO EN LABORATORIO; NO APROBADO PARA PRODUCCIÓN NI PARA DATOS REALES.** Este documento distingue lo ejecutado de lo que sigue bloqueado por decisiones de Diery o por recursos externos.

Rama: `feat/piloto-auth-integracion`, desde `origin/dev` `3be399f` (PR #133 fusionado).

## 1. Acceso admin/viewer

### Backend

- Migración `0006_auth_piloto.sql`: usuarios, sesiones de refresh, auditoría, intentos de login y estado de dispositivos. No modifica `0001`–`0004` ni crea la `0005` reservada por Diery.
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` y `POST /auth/change-password`.
- Argon2id para contraseñas; access JWT de 15 minutos; refresh opaco de 30 días con hash, rotación y familia.
- Reintento dentro de una ventana corta tras una respuesta perdida: no deja dos sesiones activas. La reutilización fuera de esa ventana revoca la familia.
- Roles `admin` y `viewer`: el viewer puede pull y consultar ML/RAG; push, escritura y resolución de conflictos responden 403.
- El `scope_id` se deriva de la identidad y el `device_id` del body debe coincidir con el token.
- Revocación por dispositivo/usuario: incrementa `auth_version`, invalida access en la siguiente petición y revoca refresh.
- CLI `python -m backend.app.auth_cli` para alta, cambio de contraseña, estado y revocación de dispositivos.

### Cliente

- Pantalla `Acceso` con login, perfil, rol, ámbito, instalación, cierre/cambio de usuario y cambio de contraseña.
- El access token vive solo en memoria. El refresh se cifra con Android Keystore o Electron `safeStorage` (DPAPI).
- El `device_id`, `dataset_id`, `scope_id`, filas, cursores, recibos y outbox no cambian al cambiar de cuenta.
- Viewer: botones de escritura ocultos y, además, repositorios locales bloquean `create/update`, conflictos y envío de outbox. Ocultar botones no es la única defensa.
- Una sesión offline conserva el rol y una vigencia de 7 días; al vencer pasa a solo consulta. La revocación central no es instantánea sin red.
- La sincronización de viewer usa `allowPush=false`: descarga cambios y conserva la outbox pendiente.

### Identidad técnica del ETL

El ETL no usa cuentas personales ni refresh. Debe usar un rol PostgreSQL dedicado con `DATABASE_URL` fuera de Git y privilegios mínimos sobre el ámbito; conserva la transacción y llama a `publicar_cambios` con la conexión prestada.

## 2. Integración ETL verificada

El orquestador existente `tools/lope_import` ya usa `publicar_con_d1`, no una segunda transacción. Se agregó una prueba integrada con base PostgreSQL temporal y registros sintéticos:

- dry-run sin persistencia;
- rollback total ante fallo posterior a la publicación;
- conteos y estados;
- replay idempotente sin nueva versión ni historial;
- pull v2 real después de la publicación.

Resultado: `tools/lope_import/tests/test_promote.py` **9 passed**. La publicación usa el contador, historial y recibos existentes; no se cargaron Excel reales.

## 3. RF y RAG

- Las funciones ML reales y las reglas existentes se ejercitaron en la suite backend (124 pruebas), incluyendo aplicabilidad, sexo/estado, faltantes, ausencia de RF y errores controlados.
- No hay artefacto RF autorizado en el checkout (`ml/models` sin `.joblib`).
- No hay corpus/embeddings autorizados para RAG real. La ruta de indisponibilidad y el DTO de dos campos tienen pruebas; no se declara RAG real.
- El respaldo extractivo y la abstención están cubiertos en pruebas de endpoint con dobles, no con corpus real.

## 4. Persistencia de categorías y alertas

**No implementada.** La diferencia entre el código actual (`NORMAL + REVISAR` ante faltantes, con destete 15 días y empadre 900–1000 g para ELITE) y la propuesta de Diery (`DATOS_INSUFICIENTES` sin clase) no está resuelta de forma inequívoca. No se cambiaron umbrales, reglas, DTO, categoría ni alertas.

Se dejó preparado `docs/integracion/contrato-evaluacion-alertas-piloto.md` con el DTO condicionado, la política de persistencia, la identidad de alerta, la UI esperada y 12 pruebas de aceptación. Las preguntas exactas para Diery están en ese documento.

## 5. Verificación ejecutada

```text
python -m pytest backend -q                         124 passed
python -m pytest tools/db_migrate/tests tools/lope_import/tests -q  48 passed
npx vitest run --maxWorkers=1                       41 archivos, 223 pruebas
npm run lint                                        OK
npm run build (pilot)                               OK
npm run build:electron (pilot)                      OK
npm run build:migration                             OK
gradlew assembleDebug                               BUILD SUCCESSFUL
electron-builder --dir                              OK
```

### Windows nativo

Perfil aislado, backend/PostgreSQL temporales y el mismo ámbito Centro Lope. Segunda pasada con el código final, instalación nueva `20646bde…`:

1. Login `admin-lope`; scope `1fa8fd97…`.
2. Alta de `Galpon Windows piloto` y sincronización: **10 recibidos, 1 enviado**, pendientes 0.
3. Alta de `Galpon Windows pendiente` sin sincronizar: 1 pendiente.
4. Cambio a `consulta-lope` en el mismo dispositivo: mismo `device_id` y scope; los botones de escritura desaparecen; sincronización **0 enviados**, 1 pendiente conservado.
5. Intento de alta directa como viewer: rechazado con “La sesión actual solo permite consulta”.
6. Nuevo login de `admin-lope`: sincronización **1 enviado**; pendientes 0.
7. `auth-session.bin` cifrado (361 bytes); no contiene usuario, refresh ni access token en claro.
8. Recarga de la ventana: la sesión se recuperó desde `safeStorage` y siguió como administrador.

### Android nativo (Pixel_36, datos preservados)

Ejecutado sobre el emulador existente sin borrar ni reiniciar sus datos (`cuyieliteSQLite.db` y `pocSQLite.db` conservan fecha original). Backend por `adb reverse`.

1. Login `admin-lope`; dispositivo `3720974e…`, scope `1fa8fd97…`.
2. Alta de galpón desde la UI y sincronización: **3 enviados** (incluye pendientes previos), 0 pendientes.
3. Alta de galpón sin sincronizar: 1 pendiente.
4. Cambio a `consulta-lope`: mismo `device_id` y scope; la pantalla de galpones ya no muestra “Nuevo”.
5. Sincronización como viewer: **0 enviados**, 1 pendiente conservado; el backend registró solo `context` y `pull`, ningún `POST /sync/push`.
6. Intento de escritura como viewer: rechazado por el repositorio local.
7. Nuevo login de `admin-lope`: sincronización **1 enviado**, 0 pendientes; central con `last_sequence=29`.
8. Cierre forzado y reapertura de la app: la sesión se recuperó del Keystore; `cuyielite_secure_session.xml` contiene solo ciphertext Base64 y el IV, sin texto plano.

### Defecto encontrado y corregido en Android

Durante la verificación nativa aparecieron dos fallos reales de la capa SQLite, corregidos en esta entrega:

- **Conexión nativa huérfana tras recrear el WebView**: `createConnection` encontraba la conexión anterior y `open()` fallaba con `database is locked ... PRAGMA journal_mode`, dejando la app sin base. Ahora se consulta `checkConnectionsConsistency`/`isConnection`, se reutiliza la conexión registrada o se liberan las huérfanas con `closeAllConnections`, con reintento acotado.
- **Auditoría de esquema repetida en cada operación**: `initializeWorkSyncDatabase` revalidaba checksums, tablas e índices en cada transacción, lo que en el puente nativo hacía que una sincronización no terminara. La validación se cachea por conexión y solo el contexto (ámbito y cursores) se relee en cada llamada; las pruebas de esquema alterado siguen pasando al reabrir la base.

## 6. Límites y pendientes

- No hay VPS, dominio, TLS público, MFA ni recuperación automática por correo.
- El modo piloto se activa con `CUYIELITE_AUTH_MODE=pilot`; el modo laboratorio se conserva para pruebas.
- La política de categorías/alertas sigue bloqueada por la decisión de Diery.
- RF real, RAG real, ETL con Excel real y carga real no se ejecutaron.
- La sincronización nativa se verificó con galpones; el conflicto de dominio conserva la evidencia de PR #132 y no se repitió.
- La revocación central no es instantánea con el equipo sin conexión; la vigencia offline es de 7 días.

## 7. Archivos principales

- `db/migrations/central/0006_auth_piloto.sql`
- `backend/app/services/auth.py`, `backend/app/repositories/auth.py`
- `backend/app/controllers/auth.py`, `backend/app/controllers/auth_api.py`
- `backend/app/auth_cli.py`
- `client/src/data/auth.session.ts`, `auth.transport.ts`, `auth.storage.ts`
- `client/src/data/work.database.android.ts`, `work.sync.migration.ts`
- `client/src/pages/Acceso.tsx`
- `client/android/app/src/main/java/co/ucc/cuyielite/SecureSessionPlugin.java`
- `client/plugins/sync-lab/electron/dist/plugin.mjs`
- `docs/decisiones/0007-autenticacion-piloto.md`
- `docs/operacion/auth-piloto-configuracion.md`
- `docs/integracion/contrato-evaluacion-alertas-piloto.md`
