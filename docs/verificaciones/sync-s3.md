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

## Criterios pendientes
- Integracion nativa del transporte (Electron main acotado + Android CapacitorHttp) NO implementada en este turno; solo existe el modulo `work.sync.transport.ts` y `work.sync.scope.ts` en cliente web. Pendiente de adaptadores nativos y verificacion en dispositivo/emulador.
- Vinculacion explicita de base al scope implementada en `work.sync.scope.ts` (bindContext) pero no integrada en el flujo de sync del cliente.
- S3 NO se declara cerrada: push y recibos verificados en laboratorio; transporte nativo y vinculacion de base al scope pendientes.