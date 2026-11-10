# Borrador para el trabajo de grado: datos e inteligencia artificial

## Preparación de los datos

Los registros individuales de los dos galpones se procesaron con el ETL del
proyecto y se analizaron mediante agregados, sin incluir identificadores de
animales en los informes. El diagnóstico de cohorte reportó 344 hembras
candidatas en Galpón 1 y 519 en Galpón 2, para un total de 863 antes de la
deduplicación diagnóstica. Se detectaron 18 códigos repetidos entre archivos;
la selección de una observación por código dejó 845 registros únicos en ese
ejercicio. Esta operación fue un análisis agregado y no una regla ya
implementada en el ETL. [Fuente: `ml/reports/diagnostico_elite.md`, PR #89,
secciones “Resultado por archivo de origen” y “Repetidos y deduplicación”.]

En Galpón 2, el conjunto actual se compone de 703 registros aceptados de
hembras; al excluir los 184 con destino Muerte, quedan 519. La cifra histórica
de 398 no se reproduce con el filtro documentado. Excluir también las vendidas
lleva a 391, por lo que permanece una diferencia de siete observaciones sin
explicación verificable. [Fuente: `ml/reports/diagnostico_elite.md`, PR #89,
sección “Comparación 398 vs. 519”.]

## Aplicación de reglas y clasificación

Sobre las 519 hembras de la cohorte actual de Galpón 2, el diagnóstico aplicó
por separado los cinco criterios de selección: número de partos de la madre
(2–3), tres o cuatro nacidos vivos, peso al nacimiento de al menos 135 g,
peso al destete de al menos el doble del peso al nacimiento y ojos negros.
Los incumplimientos registrados fueron, respectivamente, 224, 171, 60, 155
(incluido un dato faltante) y 4. Como una misma observación puede incumplir más
de una regla, estos valores no se suman para estimar una cantidad de hembras
únicas. [Fuente: `ml/reports/diagnostico_elite.md`, PR #89, sección “Fallos de
criterios en la cohorte actual”.]

## Evaluación del Random Forest

La evaluación exploratoria usó 805 observaciones etiquetadas, 200 ELITE y
605 NORMAL, agrupadas por el código crudo `MADRE No.` mediante validación
StratifiedGroupKFold anidada. El código de madre no está reconciliado como una
identidad global. En el experimento A, con todas las variables disponibles, la
precisión, recall y F1 de ELITE fueron 0.995 ± 0.011, 1.000 ± 0.000 y
0.998 ± 0.006. En el experimento B, limitado a `nupar_madre`, `tcnv`,
`peso_nacimiento_g` y `ojos`, las métricas fueron 0.731 ± 0.061,
1.000 ± 0.000 y 0.844 ± 0.042. [Fuente: informe agrupado de
`ml/reports/informe_metricas.md` en el PR #90, tablas de resultados de A y B;
el PR permanece abierto.]

Las líneas base se evaluaron en los mismos pliegues. Para la regla simple B,
el F1 de ELITE fue 0.845 ± 0.042; para la clase mayoritaria fue
0.000 ± 0.000. En el modelo B, las mayores importancias medias correspondieron
a `nupar_madre` (0.4667 ± 0.0120), `tcnv` (0.3696 ± 0.0078) y
`peso_nacimiento_g` (0.1636 ± 0.0072). [Fuente: informe agrupado de
`ml/reports/informe_metricas.md` en PR #90, secciones de líneas base e
importancia de variables.]

Estos resultados no constituyen una validación contra un patrón experto
independiente. Las etiquetas se generaron mediante reglas y A incluye variables
relacionadas con esas mismas reglas, por lo que su desempeño refleja fuga de
información. B utiliza información disponible al nacimiento para estimar una
etiqueta que también depende de condiciones posteriores; no demuestra que esas
condiciones se cumplan posteriormente. [Fuente: informe agrupado de
`ml/reports/informe_metricas.md` en PR #90, “Limitaciones e interpretación”.]

## Recuperación de información y asistente RAG

En la evaluación de recuperación con veinte preguntas dentro del corpus, BM25
obtuvo hit@1 de 0.4000 y MRR de 0.5517; la búsqueda semántica con embeddings
obtuvo 0.8000 y 0.8667, respectivamente. La recuperación semántica alcanzó
hit@3 y hit@5 de 0.9500. El umbral calibrado permitió abstenerse en las cinco
preguntas fuera del corpus y no perdió ninguna de las veinte preguntas válidas.
[Fuente: `rag/reports/evaluacion.md`.]

La evaluación de generación registró 25 preguntas: veinte respuestas en modo
extractivo y cinco abstenciones. Aunque el proveedor configurado fue Ollama,
ninguna de las respuestas quedó registrada en modo Ollama; el informe no
determina la causa de ese resultado. Las calificaciones manuales permanecen
vacías, por lo que no se reporta una medida de calidad humana de las respuestas.
[Fuente: `rag/reports/evaluacion_generacion.md`.]

## Limitaciones y trabajo pendiente

Los conteos de selección describen una cohorte exploratoria y no permiten
reproducir el agregado histórico 52/398. La deduplicación de los 18 códigos
compartidos entre galpones requiere tratar explícitamente las filas distintas,
no escoger una observación sin validar su procedencia. La validación por madre
usa códigos sin conciliación global. Además, el conjunto de etiquetas refleja
reglas de clasificación y no una evaluación experta independiente; por ello,
el experimento A presenta fuga y las métricas no deben interpretarse como
evidencia de desempeño clínico/productivo futuro. Finalmente, el corpus RAG y
las preguntas evaluadas son limitados y la generación requiere calificación
manual antes de extraer conclusiones sobre su calidad. [Fuentes: informes de
diagnóstico PR #89, validación agrupada PR #90, y evaluaciones RAG citadas
arriba.]
