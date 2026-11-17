# Evidencia: integración ETL del piloto, cierre sintético y preparación operativa (2026-11-16)

Estado: **integración sintética terminada y procedimiento de carga real preparado y ensayado con datos sintéticos**. RF y RAG reales siguen pendientes por insumos externos. No hubo carga real ni datos del Centro Lope.

Base: `dev` `4543337` (PR #155 de Diery fusionado). Rama: `feat/integracion-etl-ia-piloto`.

## 1. Inventario de la cadena (una vez)

| Pieza | Ubicación | Entrada | Salida | Conexión real |
| --- | --- | --- | --- | --- |
| Auditoría de campo | `tools/lope_import/readers.py`, `__main__.py` | Excel de campo (REG IND GALPON / REGISTRO REPRODUCTIVO) | `lope_import_audit/v1` con huellas | Solo lectura, sin base de datos |
| Adaptador de revisión | `tools/lope_import/adapt.py` | Reporte de auditoría | `lope_import_review/v1` con propuestas `PENDIENTE_REVISION` | Sin base de datos |
| Decisiones humanas | `tools/lope_import/decisions.py` | Revisión + decisiones | `lope_import_review_decisions/v1` y manifiesto `lope_promocion/v1` | Sin base de datos |
| Orquestador | `tools/lope_import/promote.py` | Manifiesto + lote | Dominio escrito y publicado en una transacción | Conexión prestada del ejecutor |
| Publicador de plataforma | `backend/app/services/publication.py` | `RegistroPublicacion` | Versiones, historial, contador, recibos | Usa la conexión del orquestador; no confirma ni revierte |
| Feed derivado (v3) | `backend/app/services/derived.py` | Cambios derivados | Categoría y alertas de solo lectura | Propio cursor, no mezcla v1/v2 |

El ETL de features (`ml/etl/`) es una biblioteca que lee los Excel reales y produce agregados; no es el orquestador de promoción y no se ejecutó.

## 2. Correcciones realizadas en esta entrega

| Hallazgo | Corrección |
| --- | --- |
| `python -m tools.lope_import.adapt` y `python -m tools.lope_import.decisions` terminaban sin hacer nada: faltaba el guard `__main__` | Guard añadido a ambos módulos, con regresión `test_cli_entrypoints.py` que ejecuta `--help` de los cuatro puntos de entrada |
| El ensayo de carga no tenía un ejecutable reproducible | Nuevo `tools/lope_import/rehearse.py`: genera el Excel sintético y ejecuta auditoría → revisión → decisiones → manifiesto → dry-run → promoción → verificación → respaldo y restauración |
| La evidencia de #153 reportaba dos casos pendientes (replay del manifiesto y su pull v2) | Resueltos por la entrega fusionada de Diery: ambos pasan hoy de verdad y el archivo de pruebas ya no lleva marcas `xfail` |

## 3. Los dos casos de #153

| Caso | Estado en `dev` | Verificación |
| --- | --- | --- |
| Replay del mismo lote (`lote_id` y clave global iguales) | **PASA** | `test_repetir_el_mismo_lote_no_duplica_nada` |
| Pull v2 del resultado promovido | **PASA** | `test_pull_v2_entrega_lo_publicado` |

## 4. Matriz del cierre sintético

| Caso | Componentes | Resultado |
| --- | --- | --- |
| Cinco entidades y sus relaciones | reales | HECHO |
| Exclusión de decisiones no aceptadas | reales | HECHO (1 ACEPTADO, 5 RECHAZADO en el ensayo) |
| Requisitos de revisor, evidencia, identidad y campos completos | reales | HECHO (`decisions.py` los exige) |
| Dry-run sin persistencia | reales | HECHO (0 filas, 0 cambios, 0 lotes tras el dry-run) |
| Promoción atómica | reales | HECHO (1 cuy, 1 cambio, 1 lote, 1 correspondencia, secuencia 1) |
| Rollback de dominio, publicación y lote | reales + publicador falso | HECHO |
| No-op sin versiones ni historial | reales | HECHO |
| Corrección efectiva con versión esperada | reales | HECHO (versión 2 y un cambio) |
| Replay del mismo `lote_id` | reales | HECHO |
| Clave global y ámbito sin duplicados | reales | HECHO |
| Rechazo de la misma identidad en otro ámbito | reales | HECHO (sin cambios parciales) |
| Referencias cruzadas entre ámbitos | reales | HECHO (rechazo) |
| Pull v2 con ámbito, UUID, versiones, decimales, fechas y referencias | reales | HECHO |
| Evidencia declarada no queda revisada por importar | backend | HECHO en la suite de evaluación |
| Concurrencia del mismo lote | reales | HECHO (suite existente) |

## 5. Ensayo del procedimiento de carga

Ejecutado con `python -m tools.lope_import.rehearse` sobre base temporal:

```text
0. Destino preparado: bootstrap central + todas las migraciones + ámbito sintético
1. Inventario: registro-individual-sintetico.xlsx sha256=...
2. Auditoría: lope_import_audit/v1 (6 propuestas, 1 incidencia)
3. Revisión: lope_import_review/v1
4. Plantilla de decisiones: 6 propuestas PENDIENTE, lote_id estable
5. Decisiones: 1 ACEPTADO, 5 RECHAZADO
6. Manifiesto: lope_promocion/v1 con 1 registro aceptado
7. Dry-run: registros 1, cambios 1 -> estado tras el dry-run: 0/0/0/0/0
8. Promoción: 1 cuy, 1 cambio, secuencia 1, 1 lote, 1 correspondencia
9. Respaldo y restauración: {'cuyes': 1, 'cambios': 1}
```

Procedimiento completo, con el bloque de aprobación previo a una carga real, en `docs/operacion/carga-lope-piloto.md`.

## 6. RF y RAG: bloqueados por insumos externos

| Recurso | Estado comprobado | Qué falta |
| --- | --- | --- |
| Artefacto Random Forest | **No existe** en el repositorio: no hay `.joblib` ni `.pkl` fuera de entornos virtuales | El `.joblib` autorizado con su hash y versión, y la ruta `CUYIELITE_RF_MODEL_PATH` |
| `ml/models/metadata.json` | Es metadata de experimento (`dataset_sha256`, métricas), **no** un modelo entrenado | Nada: no debe confundirse con el artefacto |
| Corpus RAG | **No existe**: `db/raw_Lope` no está en el checkout | El manual autorizado y la decisión de indexarlo en laboratorio |
| Entorno RAG | `rag/.venv` no existe; el embeddings por defecto es `intfloat/multilingual-e5-base` | El entorno con dependencias y el modelo de embeddings permitido |

Con esos insumos, la verificación pendiente es la de la §4 del encargo: conectar el adaptador, ejecutar inferencias con ejemplos acordados y comprobar que `apoyo_modelo` queda separado de la clase de reglas; indexar el corpus autorizado en un entorno aislado, consultar por `POST /assistant/query`, comprobar fuentes con documento y página reales, abstención fuera del corpus y el respaldo extractivo con Ollama apagado.

Lo que sí está verificado hoy es la **ruta de indisponibilidad** (`test_ml_endpoints.py`: 10 pruebas) y que la plataforma no confunde la ausencia de modelo con un modelo defectuoso. No se declara integración real de RF ni de RAG.

## 7. Pruebas

```text
pytest tools/lope_import/tests   54 passed
pytest tools/db_migrate/tests    27 passed
```

El ensayo del procedimiento corre como script, no como pytest, porque crea y destruye su propio destino y su copia restaurada.

## 8. Límites y limpieza

- Solo datos sintéticos y bases temporales propias; `cuyielite-s3-test` y cualquier base preexistente no se usaron ni se modificaron.
- No se ejecutó carga real, ni se tocó Excel real, ni se deployó nada.
- Los recursos temporales (contenedor `cuyelite-etl-lab2` y bases `cuyelite_etl_lab`, `cuyelite_lope_restaurado`) se eliminaron al terminar.
