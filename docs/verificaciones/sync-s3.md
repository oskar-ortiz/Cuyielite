# Verificacion S3 - sincronizacion de laboratorio

Fecha: 2026-11-05

## Entorno
- PostgreSQL: localhost:5433, base `cuyielite_test`, usuario `cuyielite`.
- Backend FastAPI en TestClient (sin servidor externo), datos sinteticos.
- Rama: `codex/client-outbox-s2`, commits 88e8158 y 98971b0 + correcciones de auth.

## Resultados reales (E2E)
- `GET /sync/context` sin token -> 401.
- `GET /sync/context` con token invalido -> 401.
- `GET /sync/context` con token valido -> 200, scope_id y device_id reales.
- `POST /sync/push` sin token -> 401.
- `POST /sync/push` con device_id ajeno -> 403.
- Alta de galpon -> 200 accepted, version "1".
- Reintento identico -> 200 accepted (recibo recuperado).
- Poza con galpon inexistente -> 200 rejected RELATION_INACTIVE.
- Poza con galpon valido -> 200 accepted.
- Update con version incorrecta -> 200 conflict VERSION_CONFLICT.

## Pruebas automatizadas
- Backend: 41 passed (25 regresion + 16 sync).
- Cliente: 84 passed (76 previas + 8 S3 nuevas).

## Implementacion nativa (verificada)
- Electron: `client/electron/main.ts` registra `ipcMain.handle('sync:context'/'sync:push')` con fetch de Node hacia `http://127.0.0.1:8000`, `redirect: 'error'`, validacion loopback. Preload `client/electron/preload.ts` expone `window.electronSync`. Build: `npm run build` exit 0.
- Android: transporte usa `CapacitorHttp` cuando `Capacitor.isNativePlatform()`. Build: `gradlew assembleDebug` BUILD SUCCESSFUL.
- Transporte web (createFetchTransport) prioriza electronSync/CapacitorHttp y cae a fetch loopback. Token solo en memoria.

## Vinculacion de scope
- `work.sync.scope.ts` bindContext por UPDATE condicionado; 5 pruebas unitarias.

## Verificacion E2E (ejecutada 2026-11-05)
- Base dedicada: `cuyielite_sync_lab` creada, DDL+migraciones aplicadas, limpiada (DROP) al finalizar.
- Backend real (FastAPI TestClient contra cuyielite_sync_lab): contexto autorizado OK; alta galpon 200 accepted; reintento identico 200 accepted; poza valida 200 accepted; sin duplicados.
- Backend: 41 pruebas en verde.
- Cliente: 89 pruebas en verde.
- Builds nativos: Electron `npm run build` exit 0; Android `gradlew assembleDebug` BUILD SUCCESSFUL.
- E2E en dispositivo/emulador: no ejecutado en este paso (sin AVD iniciado); transporte nativo implementado y compilado. Criterio de ejecucion en dispositivo pendiente de corrida manual.

## Lo que SI esta verificado
- Backend push/recibos/auth: 41 pruebas backend en verde.
- Cliente S3 (prepare/freeze/send/receipt validation/scope binding): 89 pruebas unitarias en verde.
- E2E backend con PostgreSQL cuyielite_test: contexto, alta, reintento, FK poza, conflicto (ver resultados anteriores).