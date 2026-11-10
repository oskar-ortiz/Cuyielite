# Diagnóstico de los agregados ELITE

## Alcance y método

Se leyeron en modo de solo lectura los dos registros individuales configurados
en el ETL. Se aplicó `clasificar_candidata` y el mismo denominador de
`ml.rules.report._female_candidate_reference`: sexo `Hembra` y destino distinto
de `Muerte`. Las filas en estado `REVISAR` permanecen en el denominador, pero
no se cuentan como ELITE.

Los códigos se mantuvieron solo en memoria y se normalizaron sin distinguir
mayúsculas/minúsculas. Cuando una misma identidad tiene filas con datos
distintos en ambos archivos dentro de la cohorte candidata, ambas filas se
marcan `CONFLICTO_DUPLICADO` y se excluyen de la clasificación ELITE y del
entrenamiento. No se elige arbitrariamente un archivo. Este informe contiene
solo agregados, sin códigos ni datos individuales de animales.

## Resultado por archivo antes y después de excluir conflictos

| Archivo | Candidatas antes | ELITE antes | Filas en conflicto excluidas | Candidatas después | ELITE después |
|---|---:|---:|---:|---:|---:|
| REG IND GALPON 1 2026.xlsx | 344 | 55 | 18 | 326 | 52 |
| REG IND GALPON 2 2025-2026.xlsx | 519 | 145 | 18 | 501 | 143 |
| **Total** | **863** | **200** | **36** | **827** | **195** |

El ETL detectó **18 identidades en conflicto** con **36 filas** (18 por
archivo). Los agregados de ELITE disminuyen en cinco al excluir las filas
conflictivas que antes cumplían las reglas. Las filas permanecen en las
características para trazabilidad, marcadas con `CONFLICTO_DUPLICADO`; el
clasificador deja su etiqueta vacía y el cargador del modelo las filtra.

## Comprobación de 52/398

Con el archivo actual de Galpón 2, el resultado es **145/519** antes de excluir
conflictos y **143/501** después. Por tanto, la cohorte histórica **52/398 no
se reproduce exactamente** con los archivos, el denominador y las reglas
actuales; en adelante deben usarse los conteos actuales indicados en este
informe. El libro contiene 703 filas aceptadas de hembras: 184 clasifican como
destino `Muerte`, 391 no tienen destino registrado y 128 tienen destino
`Vendido`; la cohorte candidata excluye solo `Muerte`. No hay evidencia en los
archivos actuales que permita atribuir de forma verificable el agregado
histórico a otro filtro concreto.

## Interpretación y límites

- **195/827** combina los dos archivos después de excluir las 36 filas en
  conflicto; no es una cifra exclusiva de Galpón 2 ni una proporción de
  ejemplos utilizables para el entrenamiento.
- Los conteos son el resultado de las reglas vigentes del ADR 0004 sobre los
  archivos disponibles; no validan resultados productivos ni etiquetas
  independientes.
- La validación cruzada del Random Forest no se recalculó para este cambio; las
  métricas previamente reportadas no deben interpretarse como evaluación con
  la exclusión de conflictos.
