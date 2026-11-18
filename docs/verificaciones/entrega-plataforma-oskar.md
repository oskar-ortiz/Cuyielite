# Anexo para el informe — frente de plataforma y piloto local de CuyiElite

Anexo preparado por Oskar para incorporar al informe de Trabajo de Grado. No reemplaza las secciones académicas existentes (`docs/CuyiElite_Seccion3_Metodologia_Investigacion.md`, `CuyiElite_Seccion4_Analisis_Diseno_Software.md`, `CuyiElite_Arquitectura_Tecnica.md`, `CuyiElite_Informe_Roles_y_Responsabilidades.md`); se cita y anexa. No contiene secretos, UUID privados, datos reales ni capturas con información sensible.

## 1. Responsabilidades

- **Oskar Julián Ortiz Ortiz (plataforma e integración):** arquitectura, persistencia, sincronización, autenticación, transporte, operación del piloto, respaldo, preparación de carga y documentación técnica.
- **Diery Alejandro Valencia Itacual (datos e IA):** ETL, modelos, corpus, RAG, evaluación científica y validación experta.
- **Centro Agropecuario Lope (SENA) / revisor designado:** interpretación zootécnica, validación de datos y correspondencias, aprobación institucional.
- **Asesores:** Ing. Cristian Camilo Ordóñez Quintero y Mangin Luis Montenegro.

## 2. Resultados por tipo de evidencia

### a) Implementación comprobada

| Componente | Evidencia |
|---|---|
| Ionic React + Capacitor (Android) y Electron (Windows) | Builds `npm run build`, `build:electron`, `gradlew assembleDebug` en verde en las entregas correspondientes |
| SQLite local, separación Demo/Trabajo | `client/src/data/work.schema.ts` (familia `cuyielite-work`, versión 2); `docs/verificaciones/cliente-modos-s1.md` |
| Trabajo offline, outbox transaccional e idempotencia | `work.sync.transport.ts`, `work.outbox.ts`, `work.sync.pull.apply.ts`; `docs/verificaciones/cierre-integracion-laboratorio.md` |
| PostgreSQL + pgvector y publicación transaccional | `backend/app/services/publication.py`, `tools/lope_import/promote.py`; `docs/verificaciones/etl-manifiesto-integracion.md` |
| Protocolos v1/v2/v3 y conflictos | `backend/app/schemas/sync.py`, `sync_v2.py`, `sync_v3.py`; `docs/verificaciones/conflictos-dominio-ui.md` |
| Autenticación piloto, admin/viewer, dispositivos compartidos | `backend/app/services/auth.py`, `auth_cli.py`, `0006_auth_piloto.sql`; `docs/verificaciones/acceso-piloto-integracion.md` |
| Sesiones y almacenamiento seguro | `auth.session.ts`, `auth.storage.ts`; evidencia de Android Keystore y Electron `safeStorage` en `acceso-piloto-integracion.md` |
| Animales y dominio reproductivo | `cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias` en DDL y esquema local |
| Evaluaciones, evidencia, categorías y alertas | `backend/app/services/evaluation.py`, `derived.py`; `docs/verificaciones/cierre-integracion-laboratorio.md` |
| RF: reglas principales y modelo como apoyo | `ml/model/artifact.py`, `backend/app/services/ml.py`; hash `744349c4…d578792d6adce9`; endpoints en base aislada |
| RAG: integración y abstención | `rag/src/*`, 76 fragmentos, 768 dims; `docs/verificaciones/piloto-local-rag-revision.md` |

### b) Ensayos sintéticos

- Flujo ETL `revisión → decisiones → manifiesto → promoción → publicar_cambios → pull v2`: 55 pruebas de `tools/lope_import` + 27 de migraciones en verde.
- `rehearse.py`: dry-run 0 filas, promoción 1 cuyo, secuencia 1, respaldo/restauración comprobados.
- RF: 32 pruebas de cargador/endpoints; ausencia y hash inválido con comportamiento distinto.
- RAG: 39 pruebas pasadas, 1 skipped; 5 preguntas con cita correcta y 3 abstenciones en la integración HTTP.

### c) Observación nativa Windows/Android

- Windows/Electron: RAG real con respuesta y cita `produccion_cuyes.pdf, p. 12`; RF con reglas en bloque principal y apoyo separado (`ELITE 81.6%` / `NORMAL 18.4%`); viewer sin `Nuevo`.
- Android (PR #165): admin/viewer, sincronización vacía, consultas reales, abstención para impresora Wi-Fi, sesión restaurada, viewer solo consulta.
- Android RF (PR #168/#169): candidata completa y con faltantes, cuarto parto sin fecha inventada, viewer sin escritura. Caso «sin modelo» observado por HTTP y UI.

### d) Datos reales auditados, no promovidos

- Cuatro Excel del Centro Lope: 3.428 propuestas, todas `PENDIENTE`, 11 y 10 celdas `#VALUE!` visibles. No se promovió ningún registro.

### e) Pendientes externos

La **aprobación técnica de Oskar con reservas ya fue emitida el 2026-11-17**, sobre las versiones y hashes identificados en el [registro de aprobación](aprobacion-tecnica-documentos-lope.md), incorporado mediante el PR #171. No acepta correspondencias reales, no sustituye la validación zootécnica ni autoriza una promoción de datos.

- D1–D14, revisor técnico, decisiones humanas, dry-run revisado, respaldo inmediato y autorización de promoción: Diery/Centro Lope/Oskar.
- Pertinencia RAG (gestación, vitamina C), procedencia de preguntas y validación experta del RF: Diery.

## 3. Guion de demostración académica (estimaciones de tiempo)

1. **Elegir Demo/Trabajo** — mostrar separación de datos; 2 min. Evidencia: `cliente-modos-s1.md`.
2. **Admin frente a viewer** — login, permisos, sincronización como viewer; 3 min. Evidencia: `acceso-piloto-integracion.md`.
3. **Registro local y persistencia** — alta de animal/poza, cierre y reapertura; 3 min. Evidencia: `registro-trabajo-galpones-pozas.md`.
4. **Sincronización y recuperación** — `context` → `pull` → `push`; caída de backend y reenvío; 4 min. Evidencia: `acceso-piloto-integracion.md`, `cierre-integracion-laboratorio.md`.
5. **Conflicto y resolución** — conservar central o reenviar edición revisada; 3 min. Evidencia: `conflictos-dominio-ui.md`.
6. **Reglas, RF presente y RF ausente** — clase de reglas principal, apoyo separado, probabilidades; con modelo ausente, «Sin apoyo del modelo»; 4 min. Evidencia: `rf-visualizacion-nativa.md`.
7. **Evaluación definitiva/provisional y alertas** — cuarto parto y dos abortos; 3 min. Evidencia: `cierre-integracion-laboratorio.md`.
8. **Asistente RAG** — pregunta respaldada por el manual con fuente y página; pregunta fuera de corpus con abstención. **No** presentar como validación total: la pertinencia está pendiente. 3 min. Evidencia: `piloto-local-rag-revision.md`.

Tiempo total estimado: **25 minutos**. Si el entorno falla, usar la matriz de evidencia y los logs; no simular UI ni datos reales.

## 4. Hoja del expositor

- **Problema:** mortalidad y optimización en la producción de cuyes; apoyo a la decisión, no automatización del descarte.
- **Alcance:** piloto local con base persistente, RAG extractivo y preparación de carga; sin despliegue público.
- **Decisiones técnicas:** SQLite local + PostgreSQL/pgvector central; una sola transacción de publicación; reglas por encima del RF; RAG extractivo por defecto; Ollama opcional.
- **Aporte Oskar:** plataforma, integración, autenticación, sincronización, respaldo y operación.
- **Aporte Diery:** ETL, corpus, modelos, evaluación científica.
- **Aporte Lope/SENA:** validación de campo y revisor técnico.
- **Resultados respaldados:** 55 pruebas ETL + 27 migraciones + 243 pruebas de cliente + 39 RAG; 76 fragmentos indexados; RF verificado por hash; 3.428 propuestas de carga pendientes.
- **Limitaciones:** pertinencia RAG parcial, validación experta pendiente, carga real no autorizada, RF sin aprobación científica.
- **Preguntas previsibles:** offline (outbox no se pierde, reenvío al reconectar); sincronización (cursor firmado, idempotencia); conflictos (resolución revisada, sin merge automático); seguridad (roles, almacenamiento seguro, tokens rotatorios); reglas vs ML (reglas determinan clase; RF es apoyo); duplicados (chapa reutilizable; identidad por UUID); recuperación (pg_dump, restore-check, instantánea).

## 5. Guía de usuario y operador

- **Identificación de versión:** rama `dev`, commit de plataforma `e1725c6` (PR #166 fusionado); builds con `npm run build`, `build:electron`, `gradlew assembleDebug` y `npm run build:migration`.
- **Inicio:** `sh scripts/setup.sh`, `.env` completo, `docker compose up -d`, `pip install -r backend/requirements.txt`, `pytest backend`, backend con `python -m tools.piloto.servidor start`, app con `npm run dev` o Electron.
- **Estado:** `scripts\piloto-local.ps1 status` (base, health, cuentas).
- **Cuentas:** canal privado `%LOCALAPPDATA%\CuyiElite\piloto-local\credenciales\`; admin escribe, viewer solo consulta.
- **Trabajo sin conexión:** la base local sigue operando; la outbox conserva cambios y los envía al reconectar.
- **Sincronización:** `context` → `pull` v1/v2 → `pull` v3; «Se recibieron X registro(s)». Si falla, reintentar; los datos quedan disponibles.
- **Recuperación:** si `/health` no responde, `servidor.py start`; si falta `adb reverse`, `adb reverse tcp:8000 tcp:8000`; no diagnosticar credenciales antes de esos dos pasos.
- **Predicción/recomendación:** la clase principal la determinan las reglas; el RF es apoyo exploratorio; «Evaluar y guardar» es la única acción que persiste una evaluación oficial.
- **Respaldo/restauración:** `piloto-local.ps1 backup` y `restore-dump-check` en base aislada; nunca sobre la base principal.
- **Separación:** instrucciones del usuario final en este bloque; comandos de administración y respaldo en `docs/operacion/piloto-local.md` y `carga-lope-piloto.md`.

## 6. Actualización final pendiente

Se actualizarán cuando lleguen:
- Documento D1–D14 de Diery.
- Revisor de dominio y decisiones aceptadas.
- Corrección y validación de pertinencia RAG.
- Validación experta.
- Dry-run revisado.
- Autorización y resultado de la promoción real, si se ejecuta.
- Recorrido posterior con datos autorizados.

La [matriz canónica de carga](matriz-carga-real-lope.md) es la fuente única de requisitos. La [aprobación técnica de Oskar](aprobacion-tecnica-documentos-lope.md) (PR #171) está emitida con sus reservas; siguen pendientes la validación de dominio, las correspondencias y la autorización de una promoción concreta. Las secciones pendientes están marcadas con responsable e insumo necesario, no como resultados completados.

## 7. Verificación

- Enlaces relativos revisados; `git diff --check` sin errores. No se ejecutaron suites ni builds por cambios exclusivamente documentales. No se publicaron secretos ni datos reales. `README.md` puede enlazar este anexo y `docs/operacion/piloto-local.md` como entrada del piloto local.
