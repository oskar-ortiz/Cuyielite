# Evidencia del libro de producción (Lope)

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 2026-11-17 |
| Estado | **EVIDENCIA DOCUMENTAL DISPONIBLE; no aprueba ninguna decisión** |

Evidencia recogida del libro de producción del Centro Lope para los puntos
abiertos D6, D7, D8, D9 y D15. La evidencia no cambia estados: las decisiones
siguen PENDIENTES o PROPUESTAS hasta la validación del responsable del Centro.

## Fuente, alcance y método de cita

- Fuente: `db/raw_Lope/produccion_cuyes.pdf` (archivo local ignorado por Git; no
  se versiona). Lectura de solo consulta.
- Libro: *Producción de Cuyes*, SENA, Centro Internacional de Producción Limpia
  Lope, 2018; 86 páginas de PDF. El contenido con números de página está en la
  p. 8 del PDF.
- **Convención de cita:** las páginas citadas son físicas del PDF (visor). La
  página impresa se añade solo cuando Diery la ha verificado; no se infiere
  para las referencias de D15: p. 66 (física; impresa p. 65, verificada por
  Diery) y p. 67 (física; impresa p. 66, verificada por Diery).
- Citas textuales cortas, de una frase. No se copian tablas completas,
  identificadores ni datos de animales.

## Resumen

| Punto | Resultado | Páginas físicas del PDF (visor) |
|---|---|---|
| 1. Significado de `R` | Evidencia encontrada; contradice la lectura `R` = REEMPLAZO | 66, 67 |
| 2. Códigos `M` y `V` en `DESTINO` | Evidencia encontrada | 66 |
| 3. Registro del motivo de salida | Evidencia parcial | 61, 66, 67 |
| 4. Significado de `AB` y conteo de abortos | Evidencia parcial | 67 |
| 5. Qué se pesa en la monta o empadre | Evidencia encontrada | 26, 67 |
| 6. Catálogo de eventos reproductivos | Evidencia parcial | 66, 67 |

## 1. Significado de la sigla `R`

**Evidencia encontrada.** El libro usa `R` con dos significados, según la
columna; ninguno es "reemplazo".

- Color, p. 66 (física; impresa p. 65, verificada por Diery): «COLOR: color del pelo la cría. B: blanco; By: bayo; R:
  rojo; N: negro; G: gris; Ag: agutí».
- Destino, p. 66 (física; impresa p. 65, verificada por Diery): «R: reproductor; D: descarte; V: vendido; M:muerto; L:
  levante; E: engorde».
- El término "reemplazo" aparece en el registro reproductivo como una fecha de
  observación, no como la sigla `R`, p. 67 (física; impresa p. 66, verificada por Diery): «OBSERVACIONES: reporte de fecha de
  reproductores muertos y fecha de reemplazo».

**Contradicciones.** La aclaración de Oskar dice `R` = REEMPLAZO. El libro
asigna `R` = rojo en `COLOR` y `R` = reproductor en `DESTINO`; la palabra
"reemplazo" se usa para una fecha de observación de reproductores. Los archivos
de datos revisados muestran `R` solo en `COLOR` (15 celdas; 14 en G1 y 1 en G2)
y ninguna `R` en `DESTINO`. La evidencia del libro respalda que la `R` observada
en `COLOR` es un color, y contradice la lectura de `R` como reemplazo. No se
resuelve aquí: queda para el responsable del Centro.

## 2. Códigos `M` y `V` en la columna `DESTINO`

**Evidencia encontrada.** El libro define ambos códigos en la nomenclatura de
`DESTINO`, p. 66 (física; impresa p. 65, verificada por Diery): «V: vendido; M:muerto».

- La lista completa de `DESTINO` en el libro es `R`, `D`, `V`, `M`, `L`, `E`
  (reproductor, descarte, vendido, muerto, levante, engorde).
- Los archivos de datos observados tienen `M` 545 y `V` 297, sin otra letra en
  `DESTINO`; no se observó `R`. Coincide con el libro en `M` y `V`.
- `SP` no aparece en la lista del libro. No se deduce su significado.

## 3. Registro del motivo de salida

**Evidencia parcial.** El libro registra el destino por código y algunas fechas
en observaciones, pero no un campo de "motivo" ni una causa de enfermedad.

- `DESTINO`, p. 66 (física; impresa p. 65, verificada por Diery): «V: vendido; M:muerto» y «D: descarte». El código indica
  la salida, no la causa.
- Observaciones del registro reproductivo, p. 67 (física; impresa p. 66, verificada por Diery): «reporte de fecha de
  reproductores muertos y fecha de reemplazo». Son fechas, no un motivo.
- La decisión de destino se describe por disponibilidad, p. 61 (física;
  impresa p. 60, verificada por Diery): «El destino de
  cada grupo dependerá de la disponibilidad de animales para cubrir los
  requerimientos para venta o reproducción».
- **No se encuentra en el libro** un campo o código para registrar "enfermedad"
  como motivo de salida, ni un texto libre de motivo. Tampoco se indica cómo
  registrar la venta como causa (el código `V` solo marca la salida).

**Contradicciones.** La observación de "fecha de reemplazo" usa la palabra
reemplazo, mientras la aclaración de Oskar la asigna a la sigla `R`. El libro no
asocia `R` con el motivo de salida.

## 4. Significado de `AB` y conteo de abortos

**Evidencia parcial.** El libro indica registrar el aborto en la casilla
`T.C.N.`, pero no define la sigla `AB` ni una regla de conteo.

- Registro reproductivo, p. 67 (física; impresa p. 66, verificada por Diery): «ABORTOS: reportar fecha y en la casilla TCN,
  aborto».
- `T.C.N.`, p. 67 (física; impresa p. 66, verificada por Diery): «tamaño de camada o número de crías vivas y muertas al
  nacimiento».
- **No se encuentra en el libro** la sigla `AB` ni una instrucción de cuántos
  abortos contar por parto o por celda. La indicación es registrar la fecha y
  escribir "aborto" en la casilla, sin cantidad.
- Los archivos revisados tienen `AB` 17 veces en `T.C.N.` (6 en G1 y 11 en G2
  viejo). El libro es compatible con anotar el aborto en esa casilla, pero no
  permite derivar un número de abortos ni validar la sigla `AB`.

## 5. Qué se pesa en la monta o el empadre

**Evidencia encontrada.** Se pesa la hembra al empadre.

- Registro reproductivo, p. 67 (física; impresa p. 66, verificada por Diery): «PESO MONTA: peso en gramos (g) de la hembra
  al empadre».
- Reproducción, p. 26 (física; impresa p. 25, verificada por Diery): «el apareamiento o empadre deber ser al alcanzar pesos
  de 800 a 900 gramos».
- El registro distingue el peso del macho, p. 67 (física; impresa p. 66, verificada por Diery) («PESO: peso del macho en
  gramos (g)»), y el peso de la madre al parto, p. 66 (física; impresa p. 65, verificada por Diery) («PESO PARTO: peso en
  gramos (g) de la madre al parto»). El peso de monta es el de la hembra.

**Alcance.** El libro confirma qué se pesa y en qué momento; no confirma que la
columna `Peso` del archivo reproductivo corresponda a esa medición. Esa
correspondencia sigue requiriendo revisión por registro (D9 sigue PROPUESTO).

## 6. Catálogo de eventos reproductivos y sus abreviaturas

**Evidencia parcial.** El libro describe campos y abreviaturas del registro
reproductivo, no un catálogo cerrado de eventos.

- Registro reproductivo, p. 67 (física; impresa p. 66, verificada por Diery): «FECHA DE MONTA: fecha de empadre»; «FECHA P1:
  fecha del parto número 1» (y P2–P4); «FECHA DESCARTE: fecha de finalización de
  la etapa reproductiva»; «ABORTOS: reportar fecha y en la casilla TCN,
  aborto»; «OBSERVACIONES: reporte de fecha de reproductores muertos y fecha de
  reemplazo».
- `T.C.N.`, p. 67 (física; impresa p. 66, verificada por Diery): «tamaño de camada o número de crías vivas y muertas al
  nacimiento».
- `DESTINO`, p. 66 (física; impresa p. 65, verificada por Diery): «R: reproductor; D: descarte; V: vendido; M:muerto; L:
  levante; E: engorde».
- **No se encuentra en el libro** un catálogo de eventos con códigos de evento
  ni una lista de tipos publicables. Los nombres y abreviaturas son campos del
  registro, no un catálogo aprobado. D7 sigue PENDIENTE.

## Contradicciones y límites de esta evidencia

1. **`R`:** Oskar indicó `R` = REEMPLAZO. El libro dice `R` = rojo en `COLOR` y
   `R` = reproductor en `DESTINO`; "reemplazo" aparece como fecha de
   observación. Los datos tienen `R` solo en `COLOR`, no en `DESTINO`.
2. **`AB`:** el libro ordena anotar "aborto" en `T.C.N.`, pero no define `AB` ni
   una regla de conteo; no se puede convertir `AB` en número de abortos.
3. **Códigos de `DESTINO`:** el libro lista `R`, `D`, `V`, `M`, `L`, `E`; no
   incluye `SP`. El código `SP` del sistema no tiene respaldo en el libro.
4. **Formato de `T.C.N.`:** el libro lo define como número de crías vivas y
   muertas; no explica las formas observadas con `+`, `M`, `N`, `X` ni `AB`.
   Esas formas quedan sin semántica del libro.
5. **Vigencia:** el libro es un manual técnico de 2018. Describe la práctica
   esperada, no necesariamente el registro actual del Centro. La evidencia es
   documental y no sustituye la confirmación del responsable ni la revisión por
   registro.

## Estado

- La evidencia está disponible para la validación del responsable del Centro;
  no se marca nada como aprobado.
- D6, D7, D8, D9 y D15 mantienen el estado que tenían en
  `lope-decisiones-parto-crias.md`.
