# Evidencia: evaluación persistente y alertas de descarte

Fecha: 2026-11-16. Rama `feat/evaluacion-alertas-persistencia` y sus continuaciones, desde `dev` `2365544`.

Estado: **HECHO con datos sintéticos**. No se usaron Excel reales, datos del Centro Lope, `cuyelite_test` compartida, Demo ni bases personales. PostgreSQL temporal propio en contenedor desechable.

## 1. Qué se implementó

- Migración central `0007_evaluacion_alertas.sql`: procedencia de categoría en `cuyes`, alertas con identidad y ciclo de vida, feed derivado (`sync_derived_changes` y `derived_sequence`).
- Evaluación persistente con reglas reales de Diery y datos centrales.
- Alertas `DESCARTE_REPRODUCTORA` idempotentes con cierre por causa invalidada.
- Feed de solo lectura `categoria`/`alerta` en protocolo 3.
- SQLite local con `categorias_animal`, `alertas_derivadas` y cursor propio.
- Ficha de animal con categoría, estado de evaluación, motivos, faltantes y recomendaciones.

## 2. Verificación ejecutada

```text
pytest backend/tests/test_evaluation_persistence.py     13 passed
pytest backend/tests/test_derived_sync.py                5 passed
pytest backend (sin los 3 módulos D1 heredados)        112 passed
vitest --maxWorkers=1                                  43 archivos, 234 pruebas
npm run lint                                            OK
npm run build / build:electron / build:migration        OK
gradlew assembleDebug                                   BUILD SUCCESSFUL
```

Casos cubiertos por `test_evaluation_persistence.py`:

| Caso | Resultado verificado |
| --- | --- |
| Faltantes | `DATOS_INSUFICIENTES`, sin categoría, sin alerta, sin feed |
| Macho | `422 NO_APLICA`, sin escritura |
| Definitiva NORMAL | `categoria_ml=NORMAL`, `server_version=1`, procedencia central, feed `categoria` |
| Cuarto parto | `DESCARTE`, alerta `PARTO` con `causa_id`, `fecha_limite = fecha + 20 días` |
| Repetición idéntica | Sin versión nueva, sin feed nuevo, sin duplicar alerta |
| Misma clase | Sin `server_version` nuevo; alerta previa intacta |
| Causa invalidada | Alerta anterior `obsoleta`, alerta nueva `HISTORIA_REPRODUCTIVA` sin fecha límite |
| Evaluación obsoleta | `409 EVALUACION_OBSOLETA`, fila intacta |
| Rollback | Falla inyectada en la publicación: sin categoría, sin alerta, sin feed |
| Concurrencia | Dos evaluaciones simultáneas → una sola alerta activa |
| Permisos | Viewer lee contexto, `403 ROL_SIN_ESCRITURA` al evaluar |

Casos cubiertos por `test_derived_sync.py`:

- Contexto v3 con entidades `categoria` y `alerta`.
- Pull v3 entrega categoría y alerta con su versión; el siguiente pull no repite.
- Cursor v1 rechazado en v3 (`400 CURSOR_INVALID`).
- Alertas no mueven `last_sequence`: v1 y v2 siguen entregando solo dominio.
- Entidad desconocida en historial: `500 HISTORIAL_NO_SOPORTADO` sin avanzar cursor; al retirarla, el pull continúa.

## 3. Límites

- `abortos` y el peso de empadre no tienen columna central: se declaran, se validan y quedan en la procedencia. No se infirieron.
- No se ejecutaron RF ni RAG reales: siguen sin artefacto y corpus autorizados.
- Tres módulos heredados (`test_publication.py`, `test_galpones_integration.py`, `test_integracion_d1_d2.py`) exigen una base llamada `cuyelite_test`; se excluyeron de la corrida local para no usar la base compartida. Se validan en CI, donde el runner crea su propio servicio.
- La sección nueva de la ficha de animal se verificó con pruebas de componente, no con un recorrido nativo completo en Windows/Android en esta entrega.
- Una alerta no puede marcarse como atendida: no hay flujo aprobado.
