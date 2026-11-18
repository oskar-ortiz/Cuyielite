# Valores de eventos encontrados en los registros Lope

| Campo | Valor |
|---|---|
| Versión | 1.0-propuesta |
| Fecha | 2026-11-17 |
| Estado | **PENDIENTE de revisión del Centro; ningún valor aprobado** |

**Información y propuesta de Oskar, pendiente de validación del responsable del
Centro.**

## Alcance y privacidad

- Este documento se apoya en la lectura agregada de los archivos locales
  ignorados por Git `db/raw_Lope/*` y `ml/data/*`. No se versiona ningún dato de
  origen.
- Se usan alias de archivo y "hoja 1"; no se publican rutas, nombres reales de
  archivo, identificadores de animal, chapas, fechas ni pesos.
- Las frecuencias son conteos agregados de celdas. No permiten reconstruir un
  animal ni un registro individual.
- Un valor observado no implica semántica aprobada: el catálogo de eventos sigue
  PENDIENTE (decisión D7 en `lope-decisiones-parto-crias.md`).

## Fuentes y alias

| Alias | Tipo de registro | Hoja |
|---|---|---|
| individual G1 | registro individual, galpón 1 | hoja 1 |
| individual G2 | registro individual, galpón 2 | hoja 1 |
| reproductivo G1 | registro reproductivo, galpón 1 | hoja 1 |
| reproductivo G2 viejo | registro reproductivo, galpón 2 (histórico) | hoja 1 |

## 1. Tipos previstos en el sistema (no prueban uso)

- `eventos.tipo` es texto de longitud limitada sin catálogo cerrado ni `CHECK`
  en `0001_lope_domain.sql`. Fuente: migración 0001.
- Las etiquetas que el sistema prevé hoy son de diseño, no evidencia de lo que
  registra el Centro:
  - `DESTINO`: `M`, `D`, `V`, `R`, `SP`, `L`, `E` (`ml/etl/config.py`,
    `DESTINO_CODES`).
  - Patrones `T.C.N.`: `N`, `NM`, `N+NM`, `AB`, `M`, `X`
    (`ml/etl/config.py`, `TCN_CONFIRMED_PATTERNS`).
  - Etapas propuestas: `MONTA` y vínculo con `EMPADRE`
    (`tools/lope_import/adapt.py` y decisión D9).
- Que una etiqueta exista en el código no prueba que el Centro la use ni qué
  significa en cada columna.

## 2. Valores observados en T.C.N. (Parto 1–4)

- Universo leído: 80 bloques de poza, 353 filas de hembra y 1412 celdas
  `T.C.N.` (cuatro partos por fila).
- Se observaron 47 valores distintos: 46 no vacíos y la celda vacía.
- La "familia" describe solo la forma del valor; no es una semántica aprobada.
- Los valores irregulares se listan sin normalizar. No se corrigen ni se
  reinterpretan.

| Valor | Familia | Origen (alias, hoja, columna) | Frecuencia | Ejemplo textual |
|---|---|---|---:|---|
| `1` | N (solo número) | reproductivo G1, hoja 1, T.C.N. (Parto 2: 3)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 3: 1) | 4 | `1` |
| `2` | N (solo número) | reproductivo G1, hoja 1, T.C.N. (Parto 1: 16, Parto 2: 5)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 5, Parto 2: 10, Parto 3: 13) | 49 | `2` |
| `3` | N (solo número) | reproductivo G1, hoja 1, T.C.N. (Parto 1: 28, Parto 2: 23)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 23, Parto 2: 34, Parto 3: 27, Parto 4: 7) | 142 | `3` |
| `4` | N (solo número) | reproductivo G1, hoja 1, T.C.N. (Parto 1: 30, Parto 2: 15)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 35, Parto 2: 21, Parto 3: 29, Parto 4: 11) | 141 | `4` |
| `5` | N (solo número) | reproductivo G1, hoja 1, T.C.N. (Parto 1: 9, Parto 2: 8)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 15, Parto 2: 13, Parto 3: 6, Parto 4: 3) | 54 | `5` |
| `6` | N (solo número) | reproductivo G1, hoja 1, T.C.N. (Parto 2: 2)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 3, Parto 2: 3, Parto 3: 5, Parto 4: 3) | 16 | `6` |
| `7` | N (solo número) | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 2) | 2 | `7` |
| `1M` | N+M | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 4: 1) | 1 | `1M` |
| `2M` | N+M | reproductivo G1, hoja 1, T.C.N. (Parto 1: 1)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 4, Parto 2: 1, Parto 3: 1, Parto 4: 4) | 11 | `2M` |
| `3M` | N+M | reproductivo G1, hoja 1, T.C.N. (Parto 1: 24, Parto 2: 5)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 14, Parto 2: 6, Parto 3: 7, Parto 4: 6) | 62 | `3M` |
| `4M` | N+M | reproductivo G1, hoja 1, T.C.N. (Parto 1: 23, Parto 2: 5)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 8, Parto 2: 12, Parto 3: 5, Parto 4: 8) | 61 | `4M` |
| `5M` | N+M | reproductivo G1, hoja 1, T.C.N. (Parto 1: 22, Parto 2: 4)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 12, Parto 2: 3, Parto 3: 4) | 45 | `5M` |
| `6M` | N+M | reproductivo G1, hoja 1, T.C.N. (Parto 1: 4, Parto 2: 5)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 4, Parto 2: 4, Parto 3: 2) | 19 | `6M` |
| `7M` | N+M | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 1, Parto 3: 1) | 2 | `7M` |
| `8M` | N+M | reproductivo G1, hoja 1, T.C.N. (Parto 1: 1)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 2: 1, Parto 3: 1) | 3 | `8M` |
| `1+1M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 2: 1)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 1, Parto 2: 3, Parto 3: 1) | 6 | `1+1M` |
| `1+2M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 1, Parto 2: 4)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 4, Parto 2: 2, Parto 3: 2) | 13 | `1+2M` |
| `1+3M` | N+NM | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 2, Parto 2: 3, Parto 3: 1) | 6 | `1+3M` |
| `1+4M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 1) | 1 | `1+4M` |
| `1+6M` | N+NM | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 2: 1) | 1 | `1+6M` |
| `2+1M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 1, Parto 2: 7)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 7, Parto 2: 7) | 22 | `2+1M` |
| `2+2M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 1, Parto 2: 1, Parto 3: 1)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 5, Parto 4: 3) | 11 | `2+2M` |
| `2+3M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 2, Parto 2: 2)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 2: 1) | 5 | `2+3M` |
| `2+4M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 2: 3)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 3: 1) | 4 | `2+4M` |
| `2+7M` | N+NM | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 4: 1) | 1 | `2+7M` |
| `3+1M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 9, Parto 2: 7)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 8, Parto 2: 11, Parto 3: 8, Parto 4: 2) | 45 | `3+1M` |
| `3+2M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 4, Parto 2: 5)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 4, Parto 2: 6, Parto 3: 3, Parto 4: 2) | 24 | `3+2M` |
| `3+3M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 3, Parto 2: 1)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 1) | 5 | `3+3M` |
| `3+4M` | N+NM | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 3: 2) | 2 | `3+4M` |
| `4+1M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 1: 2, Parto 2: 3)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 8, Parto 2: 3, Parto 3: 1) | 17 | `4+1M` |
| `4+2M` | N+NM | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 2: 3, Parto 3: 2, Parto 4: 1) | 6 | `4+2M` |
| `4+4M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 2: 1)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 4: 1) | 2 | `4+4M` |
| `5+1M` | N+NM | reproductivo G1, hoja 1, T.C.N. (Parto 2: 2)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 3, Parto 3: 1) | 6 | `5+1M` |
| `5+2M` | N+NM | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 2: 1) | 1 | `5+2M` |
| `6+1M` | N+NM | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 3: 1) | 1 | `6+1M` |
| `7+1M` | N+NM | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 2: 1) | 1 | `7+1M` |
| `AB` | AB | reproductivo G1, hoja 1, T.C.N. (Parto 1: 1, Parto 2: 5)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 1: 1, Parto 2: 6, Parto 3: 3, Parto 4: 1) | 17 | `AB` |
| `X` | X | reproductivo G1, hoja 1, T.C.N. (Parto 2: 9, Parto 3: 18, Parto 4: 19)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 2: 12, Parto 3: 27, Parto 4: 56) | 141 | `X` |
| `2+2` | irregular | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 3: 1) | 1 | `2+2` |
| `2+5` | irregular | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 4: 1) | 1 | `2+5` |
| `3+1` | irregular | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 3: 1) | 1 | `3+1` |
| `2+M` | irregular | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 3: 1) | 1 | `2+M` |
| `4+` | irregular | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 4: 1) | 1 | `4+` |
| `4+M` | irregular | reproductivo G1, hoja 1, T.C.N. (Parto 2: 3) | 3 | `4+M` |
| `5N` | irregular | reproductivo G2 viejo, hoja 1, T.C.N. (Parto 3: 1) | 1 | `5N` |
| `>` | irregular | reproductivo G1, hoja 1, T.C.N. (Parto 3: 1) | 1 | `>` |
| (vacío) | vacío | reproductivo G1, hoja 1, T.C.N. (Parto 2: 54, Parto 3: 163, Parto 4: 164)<br>reproductivo G2 viejo, hoja 1, T.C.N. (Parto 2: 2, Parto 3: 11, Parto 4: 58) | 452 | celda vacía |

## 3. Abortos (`AB`)

- `AB` aparece en las celdas `T.C.N.` de los registros reproductivos: 17
  apariciones en total.
  - reproductivo G1, hoja 1: 6 (Parto 1: 1; Parto 2: 5).
  - reproductivo G2 viejo, hoja 1: 11 (Parto 1: 1; Parto 2: 6; Parto 3: 3;
    Parto 4: 1).
- `AB` se interpreta como aborto según la información de Oskar, pero **no hay
  cantidad verificable** en la celda ni una regla aprobada para contar
  ocurrencias. No se convierte en un número de abortos ni de crías abortadas.
- Al cargar, la herramienta debe conservar archivo, hoja y celda de cada
  ocurrencia como procedencia; esa procedencia no se versiona en Git.
- La regla de conteo queda PENDIENTE (decisión D8).

## 4. Destino observado (registros individuales)

| Valor | Origen (alias, hoja, columna) | Frecuencia | Ejemplo textual |
|---|---|---|---:|---|
| (vacío) | individual G1: 3454; individual G2: 3011; columna `DESTINO` | 6465 | celda vacía |
| `M` | individual G1: 179; individual G2: 366; columna `DESTINO` | 545 | `M` |
| `V` | individual G1: 0; individual G2: 297; columna `DESTINO` | 297 | `V` |
| `R` | columna `DESTINO` | 0 | no observado en `DESTINO` |

- Total de filas de datos leídas: 7307. No aparecen `D`, `SP`, `L` ni `E` en
  `DESTINO` en estos archivos.
- `ml/data/features_crias*.csv` confirma los mismos valores de `destino` (`M`
  545, `V` 297, vacío 1414) y tampoco contiene `R`.
- El valor exacto `R` sí aparece 15 veces, **todas en la columna `COLOR`**
  (individual G1: 14; individual G2: 1). Pertenece a la columna de color, no a la
  de destino: no debe leerse como salida del animal ni como reemplazo.

## 5. Observaciones (categorías)

- Se leyeron 124 celdas de texto no vacías en filas/columnas de
  `OBSERVACIONES` (reproductivo G1: 53; reproductivo G2 viejo: 71). Una celda
  puede mencionar más de una categoría.
- Menciones agregadas, sin exclusividad: `EMPADRE`/`MONTA` 13, `VENTA` 5,
  `MUERTE` 1 (la mención de muerte corresponde a un macho), y 0 menciones de
  `ABORTO`, `DESCARTE`, `REEMPLAZO` o `ENFERMEDAD`.
- Marcadores de una sola letra: `M` 29, `V` 2, `R` 0. Su semántica no está
  confirmada y no se interpretan como eventos.
- Contenido redactado (sin chapas, fechas, ids ni pesos):

| Categoría | Celdas | Contenido (sin datos) |
|---|---:|---|
| EMPADRE/MONTA | 13 | mención de empadre o monta |
| VENTA | 5 | mención de venta |
| MUERTE | 1 | mención de muerte de un macho |

- Las observaciones no tienen vínculo por fila con el `DESTINO` de una cría: no
  permiten atribuir un motivo de salida a un animal concreto.

## 6. Valores no obtenidos sin exponer datos

- **Motivo de salida de `R`:** no se puede agregar "junto a `R`" porque `R` no
  aparece en `DESTINO` en estos archivos. No se identificó un campo de motivo de salida en los archivos revisados.
- **Textos completos de observaciones:** no se publican; solo categorías y
  conteos agregados.
- **Pesos:** no se publican valores; ver §7.
- **Listados por registro:** no se publican; solo conteos agregados.

## 7. Peso de monta (D9)

- Fuente identificada: columna `Peso` de la fila de la hembra en el bloque
  reproductivo.
- Celdas con valor numérico: 353 (reproductivo G1: 183; reproductivo G2 viejo:
  170) en 80 bloques de poza. No se publican los valores.
- Interpretarla como peso de monta requiere revisión por registro con
  procedencia (archivo, hoja y celda). Destino propuesto: pesaje de etapa
  `MONTA` vinculado a un evento `EMPADRE`, respetando el `CHECK` de `0005` que
  impide tener `parto_id` y `evento_id` a la vez. Estado PROPUESTO, pendiente de
  validación.

## Estado

- Toda la información de este documento es "Información y propuesta de Oskar,
  pendiente de validación del responsable del Centro".
- No se aprueba ningún catálogo, valor, regla de conteo ni mapeo. Las decisiones
  D7, D8, D9 y D15 siguen PENDIENTES o PROPUESTAS en
  `lope-decisiones-parto-crias.md`.
