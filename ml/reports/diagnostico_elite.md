# Diagnóstico de los agregados ELITE

## Alcance y método

Se leyeron en modo de solo lectura los dos registros individuales configurados
en el ETL. Se aplicó `clasificar_candidata` y el mismo denominador de
`ml.rules.report._female_candidate_reference`: sexo `Hembra` y destino distinto
de `Muerte`. Las filas en estado `REVISAR` permanecen en el denominador, pero
no se cuentan como ELITE.

Para deduplicar, los códigos de animal se mantuvieron solo en memoria y se
normalizaron sin distinguir mayúsculas/minúsculas. Se contabilizó una vez cada
código único entre los archivos; cuando estaba en ambos, se asignó al primer
archivo por orden alfabético. No hubo códigos faltantes ni duplicados dentro
de un mismo archivo. No se incluyen códigos, filas, datos individuales ni
ningún dato de animales en este informe.

## Resultado por archivo de origen

| Archivo | Hembras candidatas antes de deduplicar | ELITE antes de deduplicar | NORMAL | REVISAR | Hembras únicas tras deduplicación global | ELITE únicas |
|---|---:|---:|---:|---:|---:|---:|
| REG IND GALPON 1 2026.xlsx | 344 | 55 | 232 | 57 | 344 | 55 |
| REG IND GALPON 2 2025-2026.xlsx | 519 | 145 | 373 | 1 | 501 | 143 |
| **Total** | **863** | **200** | **605** | **58** | **845** | **198** |

El agregado sin deduplicar reproduce **200/863**. Hay **18 duplicados entre
archivos**: al asignarlos al primer origen, 18 filas de Galpón 2 dejan de
contar en el total único. No se detectaron duplicados dentro de cada archivo.

## Comprobación de 52/398

Al procesar únicamente `REG IND GALPON 2 2025-2026.xlsx`, el resultado con el
filtro y las reglas actuales es **145/519** antes de deduplicar contra el otro
archivo. La deduplicación global deja **143/501**. Como no hay duplicados
internos en Galpón 2, deduplicar solo ese archivo no cambia sus **145/519**.

Por tanto, **52/398 no se reproduce** con el archivo actual de Galpón 2 y el
denominador/reglas descritos. El libro contiene 703 filas aceptadas de hembras:
184 clasifican como destino `Muerte`, 391 no tienen destino registrado y 128
tienen destino `Vendido`; la cohorte candidata usada aquí excluye solo
`Muerte`. Esto confirma que el resultado depende de la definición de cohorte,
además de las reglas y la versión de los datos. No hay evidencia en los
archivos actuales que permita atribuir de forma verificable el agregado
histórico 52/398 a otro filtro concreto.

## Interpretación y límites

- **200/863** combina Galpón 1 y Galpón 2, antes de deduplicar; no es una cifra
  exclusiva de Galpón 2 ni una proporción de ejemplos utilizables para el
  entrenamiento.
- La deduplicación reduce el agregado combinado a **198/845**. No se deben
  comparar directamente estos totales con el conteo previo si no se explicita
  si se deduplicó.
- Los conteos son el resultado de las reglas vigentes del ADR 0004 sobre los
  archivos disponibles; no validan resultados productivos ni etiquetas
  independientes.
- Este trabajo fue diagnóstico. No se modificaron reglas, ETL, archivos fuente
  ni datos locales.
