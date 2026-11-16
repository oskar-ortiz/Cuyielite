# Evidencia: cierre de integración en laboratorio (2026-11-16)

Estado: **PARCIAL Y EXPLÍCITO**. Windows verificado, Android bloqueado, ETL sintético verificado, RF/RAG no disponibles. Todo con datos sintéticos y PostgreSQL temporal; sin datos reales ni despliegue.

## 1. Windows (Electron, perfil aislado) — HECHO

Fixture publicado por el contrato D1 (`publicar_cambios`) en un ámbito sintético con tres animales: cuarto parto con fecha, cuarto parto sin fecha y un parto con dos abortos declarados.

| Paso | Resultado observado |
| --- | --- |
| Login admin | Sesión por instalación, ámbito correcto |
| Declarar evidencia (`abortos=2`) | Estado `DECLARADA` visible en la pantalla de evaluación |
| Revisar evidencia (admin) | Estado `REVISADA` |
| Evaluar reproductora | `PROVISIONAL`, calidad `REVISAR\|PROPUESTA`, "no modificada" la categoría |
| Ficha tras sincronizar | Chip `Provisional`, "Propuesta pendiente de validación", "Sin clase definitiva", sin recomendaciones |
| Cerrar y reabrir | El estado provisional persiste en la ficha |
| Cuarto parto con fecha | `DESCARTE` confirmada, alerta con causa `2026-01-10` y límite `2026-01-30` |
| Cuarto parto sin fecha | Confirmada; "Fecha del cuarto parto pendiente de validar"; **sin** fecha límite inventada |
| Viewer | Consulta y sincroniza; sin botones de declarar, revisar ni evaluar oficial |
| Demo | Separada de Trabajo |

La categoría y la alerta solo aparecieron con fundamento confirmado. La propuesta de dos abortos no escribió `categoria_ml` ni creó alerta.

### Defecto encontrado y corregido en esta fase

El validador local del feed derivado solo aceptaba `DEFINITIVA` y `DATOS_INSUFICIENTES`; al recibir `PROVISIONAL` abortaba la página y **no avanzaba el cursor**, por lo que la ficha nunca mostraba el estado provisional. Se corrigió la validación y se agregó regresión: el pull acepta `PROVISIONAL` y `EVIDENCIA_NO_VALIDADA`.

## 2. Android (Pixel_36) — BLOQUEADO

- Emulador conectado (`emulator-5554`), APK de piloto instalado sobre los datos existentes. Memoria libre del host: **~640 MB**.
- La app restaura una sesión anterior de otro ámbito (`admin-lope`, ámbito `7c1e5d10…`) mientras su SQLite local está vinculado al ámbito del Pixel (`1fa8fd97…`). El inicio de sesión nuevo no reemplazó la sesión y la sincronización falló por el desajuste de ámbito.
- No se limpió ni reinició Pixel_36 porque la consigna prohíbe borrar sus datos, y borrar la app eliminaría la evidencia previa. **Android queda pendiente**, sin declarar verificado.

## 3. ETL sintético — HECHO

Ejecutado sobre PostgreSQL temporal aislado (`cuyelite_cierre_*`), sin Excel reales:

```text
pytest tools/lope_import/tests/test_promote.py tools/db_migrate/tests -q   29 passed
```

Cubre dry-run sin persistencia, rollback total tras publicar, idempotencia, publicación D1 y migraciones.

Se agregó una prueba de integración (`backend/tests/test_evaluation_persistence.py`) que publica el animal por `publicar_cambios`, declara `abortos=0` y comprueba que la evaluación queda en `EVIDENCIA_NO_VALIDADA` sin categoría; luego revisa el mismo dato como admin y obtiene `DEFINITIVA` con `categoria_ml=NORMAL` y versión nueva.

### Corrección del arnés

Las guardas de `tools/db_migrate/tests` y `tools/lope_import/tests` exigían una base llamada literalmente `cuyelite_test`, lo que impedía usar instancias temporales únicas. Se cambiaron por una regla acotada: host local y nombre con prefijo `cuyelite_`/`cuyielite_`, con lista de bases protegidas (`cuyelite`, `cuyelite_pilot`, `cuyelite_lope`, `postgres`). No se usó ninguna base compartida.

## 4. Recorrido integral — PARCIAL

Windows cubrió publicación → evaluación → categoría/alerta → feed derivado → cliente → reapertura. La secuencia completa con carga por ETL real no se ejecutó porque el ETL de Diery no está disponible como componente ejecutable en el repo.

## 5. RF y RAG — NO DISPONIBLES

- `ml/models` contiene solo `metadata.json`: no hay artefacto `.joblib`.
- No hay corpus ni embeddings autorizados en `rag/`.
- No se ejecutó integración real. Solo existe la ruta de indisponibilidad ya probada con dobles; no se declara verificada.

## 6. Suites y builds de HEAD

```text
pytest backend/tests/test_evaluation_persistence.py     15 passed
pytest tools/lope_import/tests tools/db_migrate/tests   29 passed
vitest work.derived.apply.test.ts                        7 passed
npm run build (Android web) / assembleDebug              OK
electron-builder --dir                                   OK
```

No se repitieron suites completas sin cambios; el resto de la evidencia previa sigue vigente.
