# Informe de métricas — Random Forest de candidatas

- Fecha: 2026-11-09
- Versión scikit-learn: 1.9.1
- SHA-256 del CSV etiquetado: `9268ba03436af223c1ee983aed95170dbe7bd534b1c5ef10fcfce48fc10b8c57`
- Protocolo: StratifiedGroupKFold, 5 pliegues externos y 3 internos; agrupación por código crudo `MADRE No.` y random_state=42.
- Clasificador: `RandomForestClassifier(class_weight='balanced', random_state=42)`; búsqueda de hiperparámetros dentro de cada pliegue de entrenamiento.

## Dataset

| Filas | ELITE | NORMAL | NO_APLICA excluidas | REVISAR excluidas | Duplicados retirados | Madre no identificada |
| --- | --- | --- | --- | --- | --- | --- |
| 805 | 200 | 605 | 1392 | 59 | 0 | 0 |

Grupos de madre utilizados: 275. Filas elegibles sin identificador de animal utilizable: 805; esas filas no permitían comprobar duplicados y las observaciones sin madre se excluyeron del experimento agrupado.

## Resultados de validación cruzada

Precisión, recall y F1 se informan por clase como media ± desviación estándar entre pliegues externos. Cada observación aparece una vez en la matriz agregada, con orden de clase NORMAL, ELITE.

| Experimento | Variables | Precisión ELITE | Recall ELITE | F1 ELITE |
| --- | --- | --- | --- | --- |
| A_completo | nupar_madre, tcnv, peso_nacimiento_g, peso_destete_g, ratio_destete_nacimiento, ojos | 0.995 ± 0.011 | 1.000 ± 0.000 | 0.998 ± 0.006 |
| B_nacimiento | nupar_madre, tcnv, peso_nacimiento_g, ojos | 0.731 ± 0.061 | 1.000 ± 0.000 | 0.844 ± 0.042 |

### Matriz de confusión — A_completo

|  | Predicho NORMAL | Predicho ELITE |
| --- | --- | --- |
| Real NORMAL | 604 | 1 |
| Real ELITE | 0 | 200 |

#### Métricas por clase (media ± desviación estándar)

| Clase | Precisión | Recall | F1 |
| --- | --- | --- | --- |
| NORMAL | 1.000 ± 0.000 | 0.998 ± 0.004 | 0.999 ± 0.002 |
| ELITE | 0.995 ± 0.011 | 1.000 ± 0.000 | 0.998 ± 0.006 |

#### Importancia media de variables

| Variable | Importancia media | Desviación estándar |
| --- | --- | --- |
| nupar_madre | 0.3120 | 0.0086 |
| tcnv | 0.2545 | 0.0176 |
| ratio_destete_nacimiento | 0.2417 | 0.0116 |
| peso_nacimiento_g | 0.0944 | 0.0074 |
| peso_destete_g | 0.0924 | 0.0085 |
| ojos | 0.0050 | 0.0018 |

| Línea base | Clase | Precisión | Recall | F1 |
| --- | --- | --- | --- | --- |
| majority_class | NORMAL | 0.752 ± 0.003 | 1.000 ± 0.000 | 0.858 ± 0.002 |
| majority_class | ELITE | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 |
| regla_simple_B | NORMAL | 1.000 ± 0.000 | 0.878 ± 0.041 | 0.934 ± 0.023 |
| regla_simple_B | ELITE | 0.734 ± 0.061 | 1.000 ± 0.000 | 0.845 ± 0.042 |

Métricas de línea base calculadas sobre los mismos pliegues agrupados; la línea mayoritaria predice la clase más frecuente del entrenamiento de cada pliegue y la regla simple aplica los cuatro umbrales de B.

#### Detalle por pliegue externo

| Pliegue | Grupos test | Filas test | F1 NORMAL | F1 ELITE |
| --- | --- | --- | --- | --- |
| 1 | 54 | 164 | 1.000 | 1.000 |
| 2 | 52 | 161 | 1.000 | 1.000 |
| 3 | 56 | 161 | 1.000 | 1.000 |
| 4 | 53 | 160 | 1.000 | 1.000 |
| 5 | 60 | 159 | 0.996 | 0.988 |

### Matriz de confusión — B_nacimiento

|  | Predicho NORMAL | Predicho ELITE |
| --- | --- | --- |
| Real NORMAL | 530 | 75 |
| Real ELITE | 0 | 200 |

#### Métricas por clase (media ± desviación estándar)

| Clase | Precisión | Recall | F1 |
| --- | --- | --- | --- |
| NORMAL | 1.000 ± 0.000 | 0.876 ± 0.040 | 0.933 ± 0.023 |
| ELITE | 0.731 ± 0.061 | 1.000 ± 0.000 | 0.844 ± 0.042 |

#### Importancia media de variables

| Variable | Importancia media | Desviación estándar |
| --- | --- | --- |
| nupar_madre | 0.4667 | 0.0120 |
| tcnv | 0.3696 | 0.0078 |
| peso_nacimiento_g | 0.1636 | 0.0072 |
| ojos | 0.0001 | 0.0001 |

| Línea base | Clase | Precisión | Recall | F1 |
| --- | --- | --- | --- | --- |
| majority_class | NORMAL | 0.752 ± 0.003 | 1.000 ± 0.000 | 0.858 ± 0.002 |
| majority_class | ELITE | 0.000 ± 0.000 | 0.000 ± 0.000 | 0.000 ± 0.000 |
| regla_simple_B | NORMAL | 1.000 ± 0.000 | 0.878 ± 0.041 | 0.934 ± 0.023 |
| regla_simple_B | ELITE | 0.734 ± 0.061 | 1.000 ± 0.000 | 0.845 ± 0.042 |

Métricas de línea base calculadas sobre los mismos pliegues agrupados; la línea mayoritaria predice la clase más frecuente del entrenamiento de cada pliegue y la regla simple aplica los cuatro umbrales de B.

#### Detalle por pliegue externo

| Pliegue | Grupos test | Filas test | F1 NORMAL | F1 ELITE |
| --- | --- | --- | --- | --- |
| 1 | 54 | 164 | 0.958 | 0.891 |
| 2 | 52 | 161 | 0.895 | 0.777 |
| 3 | 56 | 161 | 0.939 | 0.851 |
| 4 | 53 | 160 | 0.943 | 0.857 |
| 5 | 60 | 159 | 0.933 | 0.842 |

## DESCARTE en reproductoras

Hay 58 ejemplos `DESCARTE`, 266 `NORMAL` y 29 sin clase entre las filas reproductoras. No se entrenó este modelo: hay pocos ejemplos de descarte, y el historial de empadres y el cruce madre-cría siguen siendo limitaciones; por ahora se mantienen las reglas.

## Limitaciones e interpretación

- Las etiquetas se derivan de las reglas del ADR 0004, no de una evaluación independiente del resultado productivo. El experimento A incluye los criterios usados directamente para crear la etiqueta; su puntuación alta es fuga de información y no evidencia de generalización.
- El experimento B excluye peso al destete y ratio; estima la clase derivada posteriormente a partir de variables disponibles al nacer. Su resultado no confirma que la candidata llegue a cumplir los criterios de destete.
- La muestra procede de una sola explotación/centro e incluye registros de Galpón 1 y Galpón 2. La validación mezcla ambos galpones; no equivale a validación externa ni a evaluación en un galpón aislado.
- Las etiquetas provienen de reglas de clasificación, no de un experto ni de una evaluación independiente.
- La agrupación usa el valor crudo `MADRE No.` porque no existe una reconciliación validada de esos códigos con una identidad global. Colisiones o reutilizaciones entre archivos podrían mezclar madres distintas o no detectar una misma madre con códigos diferentes.
- Las filas sin identificador utilizable no permiten detectar posibles duplicados entre archivos; los duplicados con identidad conocida se deduplican antes de la validación.
- Random Forest y líneas base se evaluaron sobre una muestra de 805 observaciones clasificables; las métricas dependen del tamaño y composición de esta muestra.

El modelo guardado corresponde al experimento B, ajustado con todos los ejemplos elegibles después de completar la evaluación anidada. Las métricas informadas son las de validación cruzada, no las del ajuste final.
