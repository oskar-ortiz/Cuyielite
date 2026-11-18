# Entrega final de datos e IA para Oskar

| Campo | Valor |
|---|---|
| Versión | 1.1 |
| Fecha | 2026-11-17 |
| Rama | `feat/entrega-final-datos-ia` |
| Base de trabajo | `70eb84cec9251913a523a8928037451f4cad7c96` |
| Estado | Integrada mediante #163; revisión documental y del RF real pendiente en el piloto; sin autorización de carga real |

No se incluyeron identificadores de animales, chapas, mediciones individuales,
`scope_id` ni el artefacto binario. El entrenamiento local se hizo con las
fuentes autorizadas únicamente para ese fin. No se consultó la base
`cuyielite`, no se promovieron datos y no se ejecutó carga real.

### Actualización posterior a la entrega

- La entrega basada en `f03f0ad` quedó integrada mediante #163 (merge
  `2c1512c`).
- El ámbito autorizado ya se compartió por canal privado; su identificador no
  se copia a este repositorio.
- En el piloto se revisarán los documentos y el RF real. La integración no
  equivale a aprobación del modelo ni a autorización para promover datos.

## 1. Documentación Lope — commit `ecd4b66`

- Incluye los cuatro documentos con versión, fecha, commit base, estado
  **PROPUESTA: pendiente de aprobación documental sobre esta versión** y
  registro de aprobación vacío:
  - `docs/datos/lope-diccionario-mapeo.md`
  - `docs/datos/lope-identidad-conciliacion.md`
  - `docs/datos/lope-modelo-ddl-propuesto.md`
  - `docs/datos/lope-plan-migracion-validacion.md`
- Las afirmaciones distinguen `CONFIRMADO` (con fuente),
  `PROPUESTO` (requiere acuerdo) y `PENDIENTE` (insumo y responsable).
- Permanecen abiertas, con evidencia pendiente: relación `parto_crias`,
  significado contextual de `R`, catálogo de eventos, fuente de abortos, fuente
  del peso de monta y discrepancia de unicidad documentada para el esquema
  central.
- El plan enumera, sin marcar cumplidas, las compuertas de revisor técnico,
  decisiones humanas, dry-run revisado, respaldo restaurable y ámbito
  autorizado por canal privado.

## 2. Paquete Random Forest — commit `09dc702`

Incluye `ml/model/{dataset,evaluate,train}.py`, pruebas en
`ml/tests/{test_model,test_artifact}.py`, metadata agregada en
`ml/models/metadata.json`, métricas en `ml/reports/informe_metricas.md`,
versiones completas del entorno en `ml/models/entorno_entrenamiento.txt` y
comando actualizado en `ml/README.md`.

Ejecución realizada con el entorno del proyecto:

```powershell
$env:CUYIELITE_RF_MODEL_PATH = Join-Path (Get-Location) 'ml\models\candidate_random_forest_b.joblib'
$env:CUYIELITE_RF_METADATA_PATH = Join-Path (Get-Location) 'ml\models\metadata.json'
.\.venv\Scripts\python.exe -m ml.model.train --training-code-commit 70eb84cec9251913a523a8928037451f4cad7c96
```

El commit base se registró para evitar una referencia autorrecursiva al commit
que contiene sus propios outputs. Artefacto local ignorado por Git:
`ml/models/candidate_random_forest_b.joblib`. SHA-256:
`744349c43b4781dc5acef88e3db9dd6522d7b76c26a3f91e82d578792d6adce9`.
SHA-256 de las claves de fila usadas, ordenadas y sin publicar las claves:
`7cf80a4d2504f6febc6e30ec7f00dce8fdd148dc8d86b4d6664fb424f1bbfa3a`.
Metadata: Python `3.14.3`, scikit-learn `1.9.1`, semilla `42`, fecha
`2026-11-17`.

### Trazabilidad agregada

| Origen anonimizado | Leídas | CONFLICTO_DUPLICADO | NO_APLICA | REVISAR | Otras etapas/sin etiqueta | Elegibles | Duplicados retirados | Sin madre | Usadas | Predictores faltantes imputados |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| origen_01 | 853 | 0 | 508 | 58 | 0 | 287 | 0 | 0 | 287 | 0 |
| origen_02 | 1403 | 0 | 884 | 1 | 0 | 518 | 0 | 0 | 518 | 0 |
| Total | 2256 | 0 | 1392 | 59 | 0 | 805 | 0 | 0 | 805 | 0 |

Las 805 filas usadas carecen de identidad global utilizable; se agruparon en
275 grupos por el código crudo de madre extraído de Excel. No se pudo comprobar
deduplicación entre archivos ni separación por animal con una identidad
reconciliada. Los alias de origen preservan los conteos por archivo sin publicar
la correspondencia a nombres de archivos.

El experimento principal `B_nacimiento` obtuvo F1 `0.8437 ± 0.0418`, precisión
`0.7314 ± 0.0613` y recall `1.0000 ± 0.0000` en validación agrupada. La línea
base A muestra fuga de información porque incluye criterios usados para crear
las etiquetas; no se interpreta como evidencia de generalización. Las métricas,
metadata e informe se generaron junto al artefacto en la misma ejecución.

## 3. Cargador RF y validación experta — commit `673102b`

- `ml/model/artifact.py` verifica SHA-256 antes de deserializar; las pruebas
  cubren hash correcto, ausente e incorrecto y bloquean la deserialización ante
  mismatch. Las reglas conservan prioridad sobre una predicción RF discrepante.
- `ml/handoff/ENTREGA_CARGADOR.md` registra la inspección y las pruebas.
  `ml/handoff/PARA_OSKAR.md` ya no recomienda cargar el artefacto directamente
  con `joblib.load`.
- El paquete experto existente incluye protocolo
  `ml/validacion_experta/README.md`, plantilla vacía `plantilla.csv`, evaluador
  `evaluate.py` y pruebas sintéticas. No se realizó validación con clasificaciones
  expertas reales. No se necesitó crear un parche de pruebas no aplicado.
- El backend fue solo lectura. Resultado del selector:
  `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ml_adapters.py backend\tests\test_ml_endpoints.py -q` — `16 passed`.

## 4. Validación RAG — commit existente `67e09e3`

Se conserva el conjunto y el informe ya presentes en la rama base:
`rag/eval/preguntas_validacion.yaml`,
`rag/eval/evaluate_validation.py` y
`rag/reports/evaluacion_validacion.md`. El informe previo usa umbral fijo
`0.807566308073` y registra:

- Válidas (17): hit@1 `0.8235`, hit@3 `0.8824`, hit@5 `0.9412`, MRR `0.8578`,
  abstención `0/17`.
- Fuera de corpus (10): abstención `7/10`.
- En dominio sin respuesta (3): abstención `0/3`.

La evaluación no se recalibró ni se volvió a ejecutar en esta entrega; las
pruebas sí se ejecutaron. Las abstenciones observadas se producen por el umbral
vigente. El conjunto fue preparado y versionado por Diery en `67e09e3`: las
preguntas válidas remiten a páginas de `produccion_cuyes.pdf` (SENA / Centro
Internacional de Producción Limpia – Lope, 2018, ISBN 978-958-15-0336-0); las
preguntas fuera de corpus y en dominio sin respuesta son sondas de abstención.
No consta revisión zootécnica independiente de las preguntas o sus páginas
esperadas. El umbral fue calibrado previamente con otro conjunto. También
existe `rag/reports/evaluacion_generacion.md`; su calificación no registra fecha
ni revisor, por lo que no se usa como aprobación de extremo a extremo.

## 5. Verificación y límites

- `.\.venv\Scripts\python.exe -m pytest ml -q` — `83 passed`.
- `.\.venv\Scripts\python.exe -m pytest rag -q` — `36 passed, 1 skipped`.
- `.\.venv\Scripts\python.exe -m pytest backend\tests\test_ml_adapters.py backend\tests\test_ml_endpoints.py -q` — `16 passed`.
- `git diff --check` — sin errores antes de los commits.
- El artefacto `.joblib` está excluido por `*.joblib`; no se agregó a Git.
  La metadata versionada contiene agregados y hashes, no claves de fila.

## Insumos pendientes para Oskar / Centro Lope

1. Designar y registrar por canal autorizado al revisor técnico.
2. Completar decisiones humanas de correspondencias, con evidencia y revisor,
   incluyendo las decisiones concretas de `parto_crias` enumeradas en
   `docs/datos/lope-diccionario-mapeo.md`.
3. Revisar un dry-run autorizado y verificar un respaldo restaurable antes de
   cualquier promoción.
4. Resolver con evidencia del esquema autorizado la discrepancia de unicidad
   entre migración y documento de paridad.
5. Revisar en el piloto el artefacto RF real y contrastar su SHA-256 con la
   metadata; el binario no está en este repositorio.
6. Completar la validación ciega con revisor y datos autorizados si se requiere
   aceptación experta.

La carga real queda fuera de esta entrega y sigue bloqueada hasta cumplir esas
compuertas. No se registra ninguna aprobación.
