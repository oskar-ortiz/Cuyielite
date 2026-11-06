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

## Criterios pendientes (bloqueo real)
- Integracion nativa del transporte:
  - Comando requerido: `npm run build:electron` + empaquetado Electron, y `npx cap sync android && ./gradlew assembleDebug`.
  - Bloqueo: el main de Electron delega en `@capawesome/capacitor-electron` sin preload IPC propio; anadir metodos acotados context/push exige modificar `client/electron/main.ts` y un preload, mas pruebas en runtime empaquetado. No se pudo verificar en este entorno sin ejecutar el empaquetado.
  - Criterio exacto no cumplido: "metodos acotados en proceso principal, fetch de Node, sin URL/ruta/metodo desde renderer, rechazo de redirecciones y destinos fuera de loopback, token solo en memoria".
- Vinculacion explicita de base al scope:
  - Implementada y probada en `work.sync.scope.ts` (bindContext) con 5 pruebas unitarias (primera vinculacion, no-op, scope distinto, dispositivo distinto, reapertura).
  - Pendiente de integracion en el flujo de sync del cliente (llamada a bindContext antes de enviar).
- Verificacion E2E en dispositivos/emulador:
  - Bloqueo: no hay emulador Android ni build empaquetado de Electron ejecutandose en este entorno.
  - Criterio exacto no cumplido: "flujo completo en Windows empaquetado y Android emulado".

## Lo que SI esta verificado
- Backend push/recibos/auth: 41 pruebas backend en verde.
- Cliente S3 (prepare/freeze/send/receipt validation/scope binding): 89 pruebas unitarias en verde.
- E2E backend con PostgreSQL cuyielite_test: contexto, alta, reintento, FK poza, conflicto (ver resultados anteriores).