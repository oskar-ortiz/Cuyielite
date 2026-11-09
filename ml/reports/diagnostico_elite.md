# Diagnóstico de cohorte y criterios ELITE — Galpón 2

## Comparación 398 vs. 519

El número de **519** se reproduce con el ETL actual sobre
`REG IND GALPON 2 2025-2026.xlsx`:

| Paso de inclusión actual | Hembras |
|---|---:|
| Registros aceptados por el ETL con sexo hembra | 703 |
| Destino `Muerte` excluido | 184 |
| Hembras que quedan en la cohorte actual | **519** |
| De esas 519: destino vacío | 391 |
| De esas 519: destino `Vendido` | 128 |

El incremento respecto de la cifra exploratoria es **121 hembras** (519 − 398,
un 30,4 % de 398). El universo actual excluye hembras con destino `Muerte`,
pero conserva las de destino `Vendido`; la cifra inicial 398 no viene
acompañada de un filtro reproducible en el repositorio. Quitar todas las
vendidas a las 519 actuales deja **391**, no 398: quedan **7** registros de
diferencia. Por tanto, los datos disponibles no permiten atribuir
definitivamente el cambio de 398 a 519 a una causa exacta ni afirmar que
aparecieron 121 animales nuevos. Es una diferencia de cohortes/filtros hasta
que se recupere el procedimiento de la exploración inicial.

## Fallos de criterios en la cohorte actual

Denominador: 519 hembras tras excluir destino `Muerte`. Los fallos de cada fila
se cuentan **por separado**; una misma hembra puede fallar varios criterios.
El único valor faltante se considera no cumplido para esta tabla, aunque la
clasificación por reglas lo deja para revisión.

| Criterio | Cumple | Incumple con dato | Faltante | No cumple, incluido faltante |
|---|---:|---:|---:|---:|
| NUPAR de la madre 2 o 3 | 295 | 224 | 0 | 224 |
| TCNV de 3 o 4 nacidos vivos | 348 | 171 | 0 | 171 |
| Peso al nacimiento ≥135 g | 459 | 60 | 0 | 60 |
| Peso al destete ≥2× peso al nacimiento | 364 | 154 | 1 | 155 |
| Ojos negros | 515 | 4 | 0 | 4 |

Como comprobación adicional, aplicados en ese orden y contando el faltante de
destete como no apto, quedan **519 → 295 → 205 → 186 → 145 → 145**. Así,
**145/519** pasan los cinco criterios actuales. Los conteos de fallos
individuales no son sumables porque se solapan.

El criterio de peso al empadre de 900–1000 g no está incluido en esta
reproducción: no forma parte de estos campos individuales de Galpón 2. Tampoco
se infiere con datos ausentes.

## Repetidos y deduplicación

En la cohorte candidata viva, hay **18 códigos de animal** que aparecen tanto
en el archivo de Galpón 2 como en el de Galpón 1; al quitar las filas de
Galpón 2 que coinciden con Galpón 1, su conteo pasa de 519 a 501. No se
publican los códigos.

**La deduplicación no está implementada en el ETL actual.** El ETL filtra los
códigos inválidos, pero no conserva el identificador en las features ni
deduplica registros. Además, estos 18 pares no son filas idénticas: se
observaron diferencias en NUPAR en 9 pares, TCNV y peso al nacimiento en 16
pares cada uno, peso al destete en los 18 pares, ojos en 1 par y destino en 7
pares. Por eso no se eliminaron silenciosamente: el ETL necesita una regla
acordada de precedencia/conciliación antes de poder consolidar observaciones
conflictivas. El conteo 501 es solo el resultado agregado de elegir la fila de
Galpón 1, no una resolución de cuál registro es correcto.

## Método y límites

Se usó el ETL de features y las reglas de `ml.rules.clasificar` sobre los
libros locales en modo solo lectura. Los identificadores se usaron solo en
memoria para contar coincidencias; no se incluyen en este informe. Las cifras
son agregados exploratorios de una sola explotación, no validación
independiente ni etiquetas confirmadas por un experto.
