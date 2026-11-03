# 0002. Persistencia local: SQLite en Android y Windows

**Estado:** aceptada (2026-11-02). Sustituye únicamente la elección de base local
de la ADR 0001; el resto de esa decisión sigue vigente.

## Contexto

La ADR 0001 eligió PostgreSQL como base local, administrado con DBeaver, y dejó
como riesgo pendiente validar su viabilidad en el celular Android de campo:
PostgreSQL es cliente-servidor y el dispositivo debe operar sin depender de un
servidor local corriendo junto a la app.

La validación con el asesor se comunicó y Oskar la confirmó: la base local no se
mantiene en PostgreSQL y pasa a SQLite.

## Decisión

- Base **local** en **SQLite** para el cliente en **Android y Windows**.
- Base **central** en **PostgreSQL + pgvector**, sin cambios: sigue siendo el
  repositorio central y el almacén de vectores del motor RAG.
- **Ionic + React** (cliente) y **FastAPI** (backend) mantienen su alcance vigente
  de la ADR 0001; esta ADR solo sustituye la elección de base local.

## Alcance explícito

- Local: SQLite en el dispositivo Android de campo y en Windows.
- Central: PostgreSQL + pgvector.

## Pendiente (no decidido en esta ADR)

- Conector o plugin de SQLite y su empaquetado en Windows: requieren una prueba
  con documentación primaria vigente antes de proponer dependencias.
- Esquema/DDL local y su mapeo con el esquema central: no traducir
  automáticamente UUID, TIMESTAMPTZ, triggers ni dialecto PostgreSQL a SQLite;
  requiere revisión de Oskar y Diery.
- Reglas de sincronización (Last Write Wins, asignación de `updated_at`,
  contratos `/sync`): sin cambios ni decisiones en esta ADR.
- Cifrado, migraciones y política de backups locales.

## Historial

La elección de «PostgreSQL local administrado con DBeaver» de la ADR 0001 queda
sustituida por esta ADR; su registro se conserva como historial y no se borra.
