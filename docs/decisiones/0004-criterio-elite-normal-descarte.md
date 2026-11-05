# 0004. Criterio ELITE / NORMAL / DESCARTE

**Estado:** PROPUESTA. No aceptada; requiere validación del instructor del SENA
y revisión de Oskar.

## Contexto y alcance

El esquema ELITE/NORMAL/DESCARTE es nuevo; el libro del SENA no define estas
tres clases. El criterio ELITE comunicado y aprobado por el SENA contiene cuatro
condiciones: partos de la madre 2 o 3, camada de 3 o 4, ojos negros y peso desde
850 g. NORMAL y DESCARTE siguen sin definición.

En la visita se describieron cuatro galpones (dos de reproducción y dos de
levante/engorde), selección de futuras madres y padres, cruces por grupos para
evitar consanguinidad y registros manuales por galpón. Estos antecedentes
provienen del resumen de visita aportado por Diery, no de una extracción del
libro.

Las referencias de página siguientes usan la numeración impresa del libro del
SENA (`db/raw_Lope/produccion_cuyes.pdf`); el PDF tiene una página preliminar
adicional. Se extrajo texto de las 86 páginas:
portada y contraportada no tienen texto extraíble, pero el cuerpo sí. Las tablas
de selección y los formatos relevantes se rasterizaron y revisaron visualmente.

## Evidencia técnica del libro

| Tema | Evidencia para la propuesta | Fuente |
|---|---|---|
| Pesos por edad | Peso al nacimiento >150 g; al destete >300 g; a las 4 semanas 500 g; a las 8 semanas 900 g; ganancia diaria 15 g. El destete se realiza a los 15 días. | Libro pp. 28 y 62 |
| Empadre | Madurez sexual entre 60 y 80 días; empadre al alcanzar 800–900 g. La tabla de selección precisa “peso al cruzamiento: a partir de 850 g”. No asigna una edad específica a los 850 g. | Libro pp. 25 y 62 |
| Camada | Los partos pueden tener de 1 a 9 crías; se prefieren 3–4 por parto. El texto asocia las camadas numerosas con menor rendimiento de peso durante el ciclo, pero no define una clase para 1–2 o 5–9. No cuantifica una relación de tamaño de camada con mortalidad o peso al nacer. | Libro pp. 26, 28 y 62 |
| Selección | Se recomienda comparar pesos entre animales de edad y sexo similares. El grupo D corresponde al 50 % inferior y podría destinarse a venta; no se define como descarte reproductivo automático. Para reproducción, el libro menciona desparasitación, ausencia de enfermedades infecciosas, peso homogéneo, conformación y evitar cruces entre parientes. | Libro pp. 25, 61–62 |
| Partos e intervalos | La tabla de selección indica que la madre tenga 2 o 3 partos y un intervalo entre partos de 70 días. El ciclo se describe como ideal con 4 partos y máximo 5; otra tabla registra 4 como máximo. | Libro pp. 25, 62 y 70 |
| Gestación y vida | Gestación de 63–70 días; la tabla de constantes indica 68 días. La misma tabla indica vida reproductiva de 4 partos como máximo y vida total de 6–8 años. | Libro pp. 25 y 70 |
| Mortalidad | La tabla indica 2 % en reproducción y 10 % en levante/engorde. Son referencias de etapa, no umbrales individuales para asignar una clase a una hembra. | Libro p. 62 |
| Registros y descarte | El formato individual define NUPAR como número de partos de la madre, TCN como total de crías vivas y muertas, y OJOS 1=negros, 2=rojos. El formato reproductivo registra peso a la monta, partos P1–P4, TCN por parto y fecha de descarte 15 días después del último parto; también registra abortos, sin regla de descarte por número de abortos. | Libro pp. 65–66 |

No encontré en el libro un umbral de infertilidad, abortos, edad de descarte o
mala crianza que permita asignar por sí solo la clase DESCARTE. Los abortos se
registran y también aparecen como posible síntoma de enfermedades; no se
establece una frecuencia que determine descarte.

## Validación de los criterios ELITE

| Parámetro | Valor SENA comunicado | Apoyo en el libro | Veredicto | Duda abierta |
|---|---|---|---|---|
| Partos de la madre | 2 o 3 | Tabla de selección; NUPAR se define como partos de la madre de la cría registrada. (p. 62 y p. 65) | Consistente | La lectura más respaldada es la paridad de la madre de la candidata al nacer. Confirmar si la clase se evalúa sobre la cría o sobre la hembra adulta misma. |
| Tamaño de camada | 3 y 4 | Tabla: 3 y 4; texto: se prefieren camadas de 3 a 4 por parto. (p. 28 y p. 62) | Consistente | Rango inclusivo 3–4 es la lectura más razonable; el libro no asigna 1–2 ni 5 o más a NORMAL/DESCARTE ni dice si se evalúa una camada, todas o el promedio. |
| Color de ojos | Negro | La ficha define OJOS 1=negros y 2=rojos; los Excel usan esos códigos. (p. 65–66) | Consistente | Confirmar que el código se mantenga igual en todos los registros y decidir cómo tratar ojos faltantes. |
| Peso | Desde 850 g | La tabla dice peso al cruzamiento desde 850 g; el texto ubica el empadre en 800–900 g y la madurez sexual en 60–80 días. (p. 25 y p. 62) | Consistente | Lo más razonable es medirlo al empadre, no al nacimiento, destete o una edad fija. Confirmar si hay una ventana de edad y cómo tratar pesos posteriores. |
| Intervalo entre partos | 70 días | Tabla de selección: I.E.P. de la madre 70 días. (p. 62) | Consistente como referencia adicional | El umbral no está entre los cuatro criterios comunicados para ELITE. Confirmar si forma parte de la etiqueta y cómo calcularlo. |
| Mortalidad en reproducción | 2 % | Tabla de selección por etapa. (p. 62) | Consistente como indicador de etapa | No es una medición individual de la hembra. Confirmar si se excluye de la etiqueta individual. |

## Propuesta para NORMAL y DESCARTE

- **ELITE — regla de trabajo:** exigir simultáneamente las cuatro condiciones
  comunicadas por el SENA, midiendo el peso al cruzamiento y conservando la
  semántica maternal de NUPAR hasta confirmarla. No imputar datos faltantes.
  Fuente: SENA (criterio comunicado) y libro p. 62. La interpretación de
  “madre” y de camada queda por confirmar.
- **NORMAL — sin umbral respaldado:** como propuesta contable, podría ser una
  hembra con datos suficientes que no cumple todos los criterios ELITE, pero
  tampoco tiene una causa confirmada de retiro reproductivo. Esto es un
  **residuo operativo, no un criterio del libro ni una etiqueta aprobada**.
  El libro aporta condiciones cualitativas para reproductores (salud, manejo,
  peso homogéneo y conformación), pero no el umbral que separa NORMAL de ELITE.
  **PROPUESTA sin respaldo, por validar.**
- **DESCARTE — retiro reproductivo, no destino final:** una posibilidad es
  retirar de reproducción al completar 4 partos, respaldada por la tabla de
  vida reproductiva (p. 70) y el formato que registra el cierre 15 días después
  del último parto (p. 66). Sin embargo, el texto de p. 25 dice cuatro partos
  ideales y máximo cinco. **No se fija aquí si el límite es cuatro o cinco.**
  El grupo D por bajo peso relativo puede destinarse a venta (p. 61), pero eso
  no equivale automáticamente a DESCARTE de la población ni a una clase ML.
- **Camadas de 1–2 o 5–9, infertilidad, abortos, bajo peso y mala crianza:**
  el libro no ofrece umbrales para mapearlas a NORMAL o DESCARTE. No asignarlas
  automáticamente; preguntar al instructor.

## Conteos exploratorios de los Excel

Lectura local en modo aislado (`py -3 -I`, `openpyxl` en solo lectura); sin
entrenamiento y sin guardar ni copiar los libros. Se contaron filas de hembras,
no animales activos únicos: la identidad puede repetirse entre galpones o
ciclos. El documento conserva solo agregados.

### Interpretación A: “madre” es la madre de la candidata

En los archivos `REG IND GALPON 1 2026.xlsx` y `REG IND GALPON 2 2025-2026.xlsx`,
sexo 2 corresponde a hembra (libro p. 65).
NUPAR, T.C.N.T. y OJOS permiten contar cuántas filas cumplen tres condiciones;
el peso al cruzamiento de la candidata no está en ese formato.

| Registro individual | Filas de hembras | NUPAR 2–3, TCN 3–4 y OJOS 1 | ELITE completa | NORMAL / DESCARTE |
|---|---:|---:|---|---|
| Galpón 1, 2026 | 435 | 147 | Por confirmar: falta peso al cruzamiento con vínculo de identidad validado | No asignables: NORMAL y DESCARTE no tienen regla aprobada |
| Galpón 2, 2025–2026 | 703 | 249 | Por confirmar: falta peso al cruzamiento con vínculo de identidad validado | No asignables: NORMAL y DESCARTE no tienen regla aprobada |

El cruce exploratorio por código literal entre las fichas individuales y
reproductivas no se usa para contar clases: la
[propuesta de conciliación de identidad](../datos/lope-identidad-conciliacion.md)
considera las coincidencias por chapa propuestas revisables, no vínculos
confirmados. Por tanto, las 147 y 249 filas son **candidatas parciales**, no
conteos de ELITE. Ninguna de las 435 y 703 filas tiene un vínculo validado al
peso de monta en la ficha separada; por eso ELITE completa queda sin contar.

Distribuciones adicionales en las fichas individuales:

| Registro | Partos de la madre (NUPAR) | Camada total (T.C.N.T.) | OJOS |
|---|---|---|---|
| Galpón 1, 2026 | 1: 170; 2: 189; 3: 76 | 2: 26; 3: 116; 4: 152; 5 o más: 141 | 1: 432; 2: 3 |
| Galpón 2, 2025–2026 | 1: 222; 2: 226; 3: 167; 4: 88 | 2: 38; 3: 162; 4: 266; 5 o más: 237 | 1: 697; 2: 6 |

### Interpretación B: partos y camada son de la hembra evaluada

En `REGISTRO REPRODUCTIVO GALPON 1.xlsx` y
`REGISTRO REPRODUCTIVO GALPON 2 VIEJO.xlsx` se registran el peso a la monta,
los partos P1–P4 y TCN por parto. Para esta comparación solamente se
clasificaron filas con peso y OJOS presentes, fechas de parto y TCN numérico
legible asociado a cada fecha. Valores TCN compuestos/no numéricos no se
interpretaron y quedan insuficientes.

Para mostrar la ambigüedad, “camada” se probó como (a) al menos una camada
registrada de 3 o 4, o (b) todas las camadas registradas de 3 o 4. En ambos
casos, ELITE requiere peso ≥850 g, OJOS 1 y 2–3 partos propios. Como escenario
no aprobado, DESCARTE significa 4 partos registrados; NORMAL es el residuo
completo antes de ese límite. La diferencia entre cuatro y cinco partos sigue
sin resolverse. En este escenario, las filas con cuatro partos se cuentan como
DESCARTE aunque falten otros campos; las faltantes restantes quedan como
insuficientes.

| Ficha reproductiva | Interpretación de camada | ELITE | NORMAL residual | DESCARTE con 4 partos | Insuficientes |
|---|---|---:|---:|---:|---:|
| Galpón 1, 2026 (301 filas) | Al menos una de 3–4 | 27 | 23 | 19 | 232 |
| Galpón 1, 2026 (301 filas) | Todas de 3–4 | 14 | 36 | 19 | 232 |
| Galpón 2, anterior (289 filas) | Al menos una de 3–4 | 10 | 0 | 114 | 165 |
| Galpón 2, anterior (289 filas) | Todas de 3–4 | 2 | 8 | 114 | 165 |

Estas son **simulaciones de reglas, no etiquetas del SENA**. Hay clases con
menos de 10 filas: NORMAL=0 en la lectura “al menos una” del Galpón 2; ELITE=2
y NORMAL=8 en la lectura “todas”. Además, la lectura materna no da una cuenta
completa de ELITE. No usar estos conteos para entrenar ni reportar métricas.

Distribución del peso al empadre y de OJOS en las fichas reproductivas: de 590
filas de hembra, 353 tienen peso de monta y OJOS; las otras 237 no tienen ambos
datos. Las 353 mediciones de OJOS son código 1. De los pesos observados, 352
son ≥900 g y uno es 890 g; ninguno es menor de 850 g. El umbral de 850 g no
discrimina en las observaciones completas. En las fichas individuales, 1.129
de 1.138 filas de hembras tienen OJOS 1 y 9 tienen OJOS 2: también discrimina
poco en este conjunto.

Tratamiento recomendado de faltantes: **no asignar NORMAL ni DESCARTE por
defecto**; conservar “insuficiente/pendiente de revisión” hasta que existan
datos y reglas aprobadas. El registro individual tampoco tiene un campo de peso
a las 8 semanas en los formatos revisados.

## Riesgo de fuga de datos y contrato

[`PredictionRequest`](../CuyiElite_Arquitectura_Tecnica.md) de Arquitectura §10
recibe `tcn_promedio`, `partos_acumulados`, `peso_promedio_g` y
`tasa_mortalidad_camada`.

| Criterio de etiqueta | Relación con entradas del modelo |
|---|---|
| Tamaño de camada | Solapa directamente con TCN promedio. |
| Partos de la madre o propios | Solapa con partos acumulados, según la interpretación. |
| Peso al cruzamiento | No es idéntico al peso promedio, pero puede ser un sustituto o derivación del mismo historial y momento; definir ventana temporal. |
| Mortalidad | No está entre los cuatro criterios comunicados, pero la tasa de mortalidad de camada sí es entrada; si se incorpora a la etiqueta, el solapamiento sería directo. |
| OJOS | No aparece en `PredictionRequest`. Si es parte necesaria de la etiqueta, coordinar con Oskar antes de cambiar el contrato o decidir que el modelo no predice la regla ELITE completa. |

Con la interpretación de partos y camadas propios, la clase sería parcialmente
una función determinista de entradas cercanas o coincidentes con las variables
del contrato. Con la interpretación maternal, el vínculo de identidad y OJOS
añaden información que el contrato no representa; en ambos casos hay que fijar
la unidad y el momento de predicción antes de evaluar el modelo.

Opciones para discutir, sin seleccionar una:

1. Aplicar los criterios aprobados como regla explícita y entrenar un modelo
   separado para un resultado futuro (por ejemplo, crecimiento o supervivencia).
2. Mantener clasificación supervisada, pero definir una etiqueta experta
   independiente y excluir de las entradas las variables que la construyen.
3. Predecir un resultado productivo futuro con variables disponibles antes de
   ese resultado y usarlo como apoyo; la decisión de clase queda en una regla
   aprobada por el SENA.

## Preguntas para el instructor del SENA

1. ¿“Partos de la madre” es el NUPAR de la madre de la candidata al nacer, o los
   partos propios de la hembra que se evalúa?
2. ¿“Camada 3 y 4” significa exactamente 3 o 4 crías por parto? ¿Se evalúa una
   camada concreta, todas las camadas o un promedio? ¿Cómo se manejan 1–2 y 5–9?
3. ¿Los 850 g se pesan al empadre? ¿Hay edad/ventana objetivo además de la
   madurez sexual de 60–80 días?
4. ¿Confirma OJOS 1=negros y 2=rojos en todos los formatos vigentes? ¿Qué hacer
   cuando falta el dato?
5. ¿El retiro reproductivo ocurre al cuarto o al quinto parto? ¿“Descarte” es
   retiro de reproducción, venta/engorde o ambos? ¿Qué representa el intervalo
   de 70 días?
6. ¿Qué regla verificable separa NORMAL de DESCARTE para infertilidad, abortos,
   bajo peso, problemas de crianza o edad? ¿Qué periodo y número mínimo de
   observaciones requiere?
7. ¿El 2 % de mortalidad en reproducción es un indicador poblacional o debe
   afectar una decisión por hembra?
8. ¿Cómo se codifican los TCN compuestos y qué medida se entrega al modelo para
   no mezclar vivos, muertos y camada total?
