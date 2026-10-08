# 0001. Stack: Ionic + React y PostgreSQL local

**Estado:** aceptada, con un punto pendiente de validar.

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
