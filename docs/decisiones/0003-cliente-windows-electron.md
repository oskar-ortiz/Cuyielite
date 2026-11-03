# 0003. Cliente Windows: plataforma Electron adicional sobre Capacitor

**Estado:** aceptada (2026-11-02). Corrige la afirmación del numeral 0 de la
Arquitectura sobre el alcance de Capacitor; no modifica la ADR 0001 ni la
ADR 0002.

## Contexto

La ADR 0001 y el numeral 0 de la Arquitectura Técnica presentaron el cliente
como empaquetado con **Capacitor** para «Android y Windows Desktop». Esa
afirmación es incorrecta: el núcleo oficial de Capacitor soporta **Android e
iOS**; Windows no es un target nativo de Capacitor.

El Trabajo de Grado necesita un entregable Windows instalable y verificable en
el equipo de campo, reutilizando la misma base de código Ionic + React y sin
duplicar pantallas. Las restricciones del proyecto se mantienen: el cliente se
construye sobre el stack aprobado (Ionic + React + Capacitor) y se admite una
**plataforma adicional aprobada para Windows**, `@capawesome/capacitor-electron`
(MIT) sobre Electron, sin dependencias de pago ni registro privado, y sin
exponer Node, SQL ni el sistema de archivos al renderer.

## Decisión

- **Android:** Capacitor 8.6.0, el núcleo oficial.
- **Windows:** plataforma adicional `@capawesome/capacitor-electron` 0.2.2
  (licencia MIT) sobre **Electron 45.2.1**, sirviendo el mismo bundle web del
  cliente.
- **Identidad única:** `appId` `co.ucc.cuyielite` y `productName` `CuyiElite`
  en ambas plataformas.
- El renderer carga los assets locales del build; no se configura `server.url`
  para la entrega.
- Se conservan `sandbox`, `contextIsolation` y la CSP estricta de la plataforma
  (`script-src 'self'`). No se expone Node, SQL ni archivos al renderer para
  lograr que la aplicación arranque.

Consecuencias técnicas aplicadas en el cliente:

- Dos compilaciones del bundle web: `npm run build` (web/Android, con
  `@vitejs/plugin-legacy`) y `npm run build:electron` (sin el plugin legacy).
  Electron incluye un Chromium moderno y el plugin legacy inyecta scripts
  inline y una prueba `data:` que la CSP de la plataforma bloquea.
- `src/main.tsx` importa `@capacitor/core` para que la API pública
  (`getPlatform`, `isPluginAvailable`, `registerPlugin`) exista en el renderer;
  sin ese import, Ionic falla al consultar el motor de háptica.
- `client/electron/` versiona solo fuentes, configuración y los dos lockfiles.
  `node_modules`, `build`, `app`, `generated`, `dist` y `vendor` quedan
  ignorados.

## Alcance explícito

- Windows se entrega con una plataforma Electron **adicional**; no se presenta
  como target nativo del núcleo de Capacitor.
- La base de código, la identidad y el recorrido de la aplicación son los
  mismos en Android y Windows.

## Pendiente (no decidido en esta ADR)

- Instalador Windows x64 NSIS por usuario, con verificación de la aplicación
  empaquetada: paso posterior del plan.
- Firma de código y notarización: no incluidas.
- Conector de SQLite y prueba de persistencia real: dependen del diseño de la
  ADR 0002.
- Empaquetado de plugins con implementación Electron: no hay ninguno instalado
  todavía.

## Historial

El numeral 0 de `docs/CuyiElite_Arquitectura_Tecnica.md` afirmaba que Capacitor
empaquetaba el cliente para Windows Desktop. La afirmación se corrigió en el
texto vigente y esta ADR deja el registro del cambio; la decisión de Ionic +
React y el resto del stack no se modifican.
