# Resultados agregados para el trabajo de grado

## Alcance y fuentes

Este resumen reúne únicamente cifras agregadas de informes existentes. Los
informes de diagnóstico y validación agrupada están en los PR #89 y #90, que
siguen abiertos y no están en `dev`; sus cifras se transcriben de esos informes
sin recalcularlas. La validación RF que aparece actualmente en `dev` es una
ejecución anterior con partición no agrupada; para las tablas RF de este
documento, la fuente es específicamente el informe de StratifiedGroupKFold del
PR #90.

## ETL y deduplicación diagnóstica

| Archivo de origen | Hembras candidatas | ELITE | NORMAL | REVISAR | Únicas en el diagnóstico | ELITE únicas |
|---|---:|---:|---:|---:|---:|---:|
| REG IND GALPON 1 2026.xlsx | 344 | 55 | 232 | 57 | 344 | 55 |
| REG IND GALPON 2 2025-2026.xlsx | 519 | 145 | 373 | 1 | 501 | 143 |
| **Total** | **863** | **200** | **605** | **58** | **845** | **198** |

El diagnóstico identificó 18 códigos repetidos entre archivos. Las columnas
“únicas” reflejan el ejercicio del informe #89 que asignó cada repetido al
archivo alfabéticamente primero; **no describen una deduplicación ya
implementada en el ETL**, ni resuelven qué fila conflictiva es correcta. El
informe RF del PR #90 registra 805 observaciones etiquetadas para evaluación
(200 ELITE y 605 NORMAL), 275 grupos de madre y cero filas excluidas por falta
de `MADRE No.`. Es un conjunto/reporting distinto de la cohorte exploratoria
de 863 hembras.

**Fuente:** [diagnóstico de cohorte y criterios, PR #89](https://github.com/oskar-ortiz/Cuyielite/blob/docs/diagnostico-galpon2-cohorte/ml/reports/diagnostico_elite.md);
[informe RF agrupado, PR #90](https://github.com/oskar-ortiz/Cuyielite/blob/feat/ml-validacion-agrupada-madre/ml/reports/informe_metricas.md).

## Reglas ELITE del ADR 0004

Denominador: 519 hembras de Galpón 2 después de excluir destino `Muerte`.
Cada criterio se contó por separado, así que los fallos pueden solaparse.

| Criterio | Cumple | Incumple con dato | Faltante | No cumple, incluido faltante |
|---|---:|---:|---:|---:|
| NUPAR de la madre 2 o 3 | 295 | 224 | 0 | 224 |
| TCNV de 3 o 4 nacidos vivos | 348 | 171 | 0 | 171 |
| Peso al nacimiento ≥135 g | 459 | 60 | 0 | 60 |
| Peso al destete ≥2× peso al nacimiento | 364 | 154 | 1 | 155 |
| Ojos negros | 515 | 4 | 0 | 4 |

Aplicando los criterios secuencialmente en ese orden, los sobrevivientes son
519 → 295 → 205 → 186 → 145 → 145. El peso de empadre no se incluye porque no
está en los campos individuales usados para este diagnóstico.

**Fuente:** [diagnóstico de cohorte y criterios, PR #89](https://github.com/oskar-ortiz/Cuyielite/blob/docs/diagnostico-galpon2-cohorte/ml/reports/diagnostico_elite.md).

## Random Forest: validación agrupada por madre

Se usó StratifiedGroupKFold anidado (5 pliegues externos y 3 internos),
`random_state=42` y Random Forest con `class_weight="balanced"`. La agrupación
usa el código crudo `MADRE No.`; su identidad global no está reconciliada.
Métricas expresadas como media ± desviación estándar entre pliegues.

### Matrices de confusión

Orden de filas y columnas: NORMAL, ELITE.

| Experimento | Real NORMAL: predicho NORMAL / ELITE | Real ELITE: predicho NORMAL / ELITE |
|---|---:|---:|
| A (todas las variables) | 604 / 1 | 0 / 200 |
| B (nupar_madre, tcnv, peso_nacimiento_g, ojos) | 530 / 75 | 0 / 200 |

### Métricas por clase

| Experimento | Clase | Precisión | Recall | F1 |
|---|---|---:|---:|---:|
| A | NORMAL | 1.000 ± 0.000 | 0.998 ± 0.004 | 0.999 ± 0.002 |
| A | ELITE | 0.995 ± 0.011 | 1.000 ± 0.000 | 0.998 ± 0.006 |
| B | NORMAL | 1.000 ± 0.000 | 0.876 ± 0.040 | 0.933 ± 0.023 |
| B | ELITE | 0.731 ± 0.061 | 1.000 ± 0.000 | 0.844 ± 0.042 |

### Líneas base e importancia

| Línea base | Clase | Precisión | Recall | F1 |
|---|---|---:|---:|---:|
| Mayoritaria | NORMAL | 0.752 ± 0.003 | 1.000 ± 0.000 | 0.858 ± 0.002 |
| Mayoritaria | ELITE | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 |
| Regla simple B | NORMAL | 1.000 ± 0.000 | 0.878 ± 0.041 | 0.934 ± 0.023 |
| Regla simple B | ELITE | 0.734 ± 0.061 | 1.000 ± 0.000 | 0.845 ± 0.042 |

| Experimento | Variable | Importancia media ± desviación |
|---|---|---:|
| A | nupar_madre | 0.3120 ± 0.0086 |
| A | tcnv | 0.2545 ± 0.0176 |
| A | ratio_destete_nacimiento | 0.2417 ± 0.0116 |
| A | peso_nacimiento_g | 0.0944 ± 0.0074 |
| A | peso_destete_g | 0.0924 ± 0.0085 |
| A | ojos | 0.0050 ± 0.0018 |
| B | nupar_madre | 0.4667 ± 0.0120 |
| B | tcnv | 0.3696 ± 0.0078 |
| B | peso_nacimiento_g | 0.1636 ± 0.0072 |
| B | ojos | 0.0001 ± 0.0001 |

**Fuente:** [informe RF agrupado, PR #90](https://github.com/oskar-ortiz/Cuyielite/blob/feat/ml-validacion-agrupada-madre/ml/reports/informe_metricas.md), tablas por experimento y pliegue. Los resultados no deben confundirse con el informe anterior todavía presente en `dev`, que usa otra estrategia de validación.

## Recuperación y generación RAG

### Recuperación

| Métrica | BM25 léxico | Embeddings semánticos |
|---|---:|---:|
| hit@1 | 0.4000 | 0.8000 |
| hit@3 | 0.6500 | 0.9500 |
| hit@5 | 0.8000 | 0.9500 |
| MRR | 0.5517 | 0.8667 |

La calibración reporta abstención en 5/5 preguntas fuera de corpus y cero
preguntas válidas perdidas por el umbral (0/20). La exactitud balanceada de
calibración fue 1.0000; el umbral se ajustó con las mismas preguntas reportadas.

### Generación: revisión pendiente

| Estado observado en el informe | Preguntas |
|---|---:|
| Respuesta en modo extractivo | 20 |
| Abstención | 5 |
| Total medido | 25 |
| Calificación manual registrada | 0 |

El proveedor configurado fue Ollama (`qwen2.5:7b-instruct`), pero ninguna fila
del informe aparece con modo `ollama`: las 20 respuestas dentro del corpus se
registraron como extractivas y las cinco fuera de corpus como abstenciones.
El informe no atribuye la ruta extractiva a una causa específica; por tanto, no
se concluye si fue un fallo del proveedor o un respaldo por otra condición.
Las 25 calificaciones humanas siguen vacías.

**Fuentes:** [evaluación de recuperación](../../rag/reports/evaluacion.md) y
[evaluación de generación](../../rag/reports/evaluacion_generacion.md).

## Limitaciones

- Las etiquetas ELITE/NORMAL usadas por el RF provienen de reglas, no de una
  evaluación independiente de un experto. A incluye variables derivadas de
  las mismas reglas de etiquetado y refleja fuga de información; no es una
  medida de generalización.
- La cohorte exploratoria histórica de 398 hembras no se reproduce: con el
  filtro actual Galpón 2 tiene 519; retirar vendidas deja 391, una diferencia
  residual de 7 respecto de 398. No hay un filtro histórico verificable.
- Los 18 códigos repetidos entre galpones representan filas con valores
  distintos. El diagnóstico reportó una deduplicación agregada con selección
  de Galpón 1, pero el ETL descrito en los informes todavía no implementa una
  política de conflicto.
- `MADRE No.` se usó como grupo, pero no se ha reconciliado como identidad
  global; colisiones o reutilizaciones podrían afectar la separación.
- RAG se evaluó con un solo manual y un conjunto pequeño de preguntas. La
  calibración y la revisión manual de generación requieren validación adicional.

**Fuentes de limitaciones:** informes enlazados en las secciones anteriores;
en particular, [diagnóstico PR #89](https://github.com/oskar-ortiz/Cuyielite/blob/docs/diagnostico-galpon2-cohorte/ml/reports/diagnostico_elite.md)
y [validación agrupada PR #90](https://github.com/oskar-ortiz/Cuyielite/blob/feat/ml-validacion-agrupada-madre/ml/reports/informe_metricas.md).
