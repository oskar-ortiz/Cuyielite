# 0001. Stack: Ionic + React y PostgreSQL local

**Estado:** aceptada; la elección de base local (PostgreSQL administrado con
DBeaver) fue sustituida por la [ADR 0002](0002-persistencia-local-sqlite.md)
(2026-11-02). El resto de la decisión — Ionic + React con Capacitor — sigue
vigente.

## Contexto
El stack inicial era React Native + Expo con SQLite/WatermelonDB como base local.

## Decisión (recomendación del asesor)
- Cliente con **Ionic + React**, empaquetado con Capacitor.
- Base local en **PostgreSQL**, administrada con **DBeaver** (cliente de administración, no motor).

## Alternativas descartadas
- Ionic sobre React Native: combinación poco convencional, mayor riesgo de compatibilidad.
- SQLite/WatermelonDB: reemplazado por recomendación del asesor.

## Riesgo pendiente
PostgreSQL es cliente-servidor. Validar con el asesor su viabilidad en el celular Android de campo antes de la Fase 3 (construcción).

**Resuelto (2026-11-02):** validado con el asesor. La base local pasa a SQLite en
Android y Windows; el riesgo queda cerrado por la ADR 0002.
