# Informe de métricas — Random Forest de candidatas

- Fecha: 2026-11-09
- Versión scikit-learn: 1.9.1
- SHA-256 del CSV etiquetado: `9268ba03436af223c1ee983aed95170dbe7bd534b1c5ef10fcfce48fc10b8c57`
- Protocolo: RepeatedStratifiedKFold, 5 pliegues × 3 repeticiones; ajuste interno StratifiedKFold de 3 pliegues.
- Clasificador: `RandomForestClassifier(class_weight='balanced', random_state=42)`; búsqueda de hiperparámetros dentro de cada pliegue de entrenamiento.

## Dataset

| Filas | ELITE | NORMAL | NO_APLICA excluidas | REVISAR excluidas | Duplicados retirados |
| --- | --- | --- | --- | --- | --- |
| 805 | 200 | 605 | 1392 | 59 | 0 |

Filas elegibles sin identificador utilizable: 805; por ello no fue posible comprobar duplicados para esas filas.

## Resultados de validación cruzada

Se informa media ± desviación estándar entre pliegues. Las matrices agregan las predicciones de todos los pliegues repetidos y usan orden de clase NORMAL, ELITE.

| Experimento | Variables | Precisión ELITE | Recall ELITE | F1 ELITE |
| --- | --- | --- | --- | --- |
| A_completo | nupar_madre, tcnv, peso_nacimiento_g, peso_destete_g, ratio_destete_nacimiento, ojos | 0.995 ± 0.010 | 1.000 ± 0.000 | 0.998 ± 0.005 |
| B_nacimiento | nupar_madre, tcnv, peso_nacimiento_g, ojos | 0.731 ± 0.055 | 0.995 ± 0.014 | 0.842 ± 0.035 |

### Matriz de confusión — A_completo

|  | Predicho NORMAL | Predicho ELITE |
| --- | --- | --- |
| Real NORMAL | 1812 | 3 |
| Real ELITE | 0 | 600 |

#### Precisión, recall y F1 por clase

| Clase | Precisión | Recall | F1 |
| --- | --- | --- | --- |
| NORMAL | 1.000 ± 0.000 | 0.998 ± 0.003 | 0.999 ± 0.002 |
| ELITE | 0.995 ± 0.010 | 1.000 ± 0.000 | 0.998 ± 0.005 |

#### Importancia media de variables

| Variable | Importancia media | Desviación estándar |
| --- | --- | --- |
| nupar_madre | 0.3091 | 0.0088 |
| tcnv | 0.2571 | 0.0108 |
| ratio_destete_nacimiento | 0.2419 | 0.0119 |
| peso_nacimiento_g | 0.0945 | 0.0085 |
| peso_destete_g | 0.0926 | 0.0071 |
| ojos | 0.0047 | 0.0022 |

| Línea base | Precisión ELITE | Recall ELITE | F1 ELITE |
| --- | --- | --- | --- |
| majority_class | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 |
| decision_tree_depth_1 | 0.362 ± 0.025 | 1.000 ± 0.000 | 0.531 ± 0.027 |

### Matriz de confusión — B_nacimiento

|  | Predicho NORMAL | Predicho ELITE |
| --- | --- | --- |
| Real NORMAL | 1591 | 224 |
| Real ELITE | 3 | 597 |

#### Precisión, recall y F1 por clase

| Clase | Precisión | Recall | F1 |
| --- | --- | --- | --- |
| NORMAL | 0.998 ± 0.005 | 0.877 ± 0.035 | 0.933 ± 0.019 |
| ELITE | 0.731 ± 0.055 | 0.995 ± 0.014 | 0.842 ± 0.035 |

#### Importancia media de variables

| Variable | Importancia media | Desviación estándar |
| --- | --- | --- |
| nupar_madre | 0.4794 | 0.0184 |
| tcnv | 0.3610 | 0.0167 |
| peso_nacimiento_g | 0.1586 | 0.0109 |
| ojos | 0.0010 | 0.0018 |

| Línea base | Precisión ELITE | Recall ELITE | F1 ELITE |
| --- | --- | --- | --- |
| majority_class | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 |
| decision_tree_depth_1 | 0.367 ± 0.018 | 1.000 ± 0.000 | 0.537 ± 0.020 |

## DESCARTE en reproductoras

Hay 58 ejemplos `DESCARTE`, 266 `NORMAL` y 29 sin clase entre las filas reproductoras. No se entrenó este modelo: hay pocos ejemplos de descarte, y el historial de empadres y el cruce madre-cría siguen siendo limitaciones; por ahora se mantienen las reglas.

## Limitaciones e interpretación

- Las etiquetas se derivan de las reglas del ADR 0004, no de una evaluación independiente del resultado productivo. El experimento A incluye los criterios usados directamente para crear la etiqueta; su puntuación alta es fuga de información y no evidencia de generalización.
- El experimento B excluye peso al destete y ratio; estima la clase derivada posteriormente a partir de variables disponibles al nacer. Su resultado no confirma que la candidata llegue a cumplir los criterios de destete.
- La muestra procede de una sola explotación/centro e incluye registros de Galpón 1 y Galpón 2. La validación mezcla ambos galpones; no equivale a validación externa ni a evaluación en un galpón aislado.
- Las filas sin identificador utilizable no permiten detectar posibles duplicados entre archivos. Los datos no se separaron por animal ni por galpón, lo cual puede inflar métricas si hay dependencias entre registros.
- Random Forest y líneas base se evaluaron sobre una muestra de 805 observaciones clasificables; las métricas dependen del tamaño y composición de esta muestra.

El modelo guardado corresponde al experimento B, ajustado con todos los ejemplos elegibles después de completar la evaluación anidada. Las métricas informadas son las de validación cruzada, no las del ajuste final.
