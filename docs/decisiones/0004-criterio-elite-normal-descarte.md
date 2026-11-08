# 0004. Criterio ELITE / NORMAL / DESCARTE

**Estado:** VALIDADA POR EL INSTRUCTOR DEL SENA (respuestas por WhatsApp,
2026-11-07). Pendiente de revisión y aceptación final de Oskar.

## Contexto y alcance

Este ADR registra las reglas comunicadas por el instructor del SENA para
clasificar hembras por etapa. Las clases siguen siendo `ELITE`, `NORMAL` y
`DESCARTE`; el contrato y el `CHECK` de `categoria_ml` no cambian.

La clasificación se aplica por etapa:

- **Candidata:** cría hembra que puede clasificarse como `ELITE` o `NORMAL`.
- **Reproductora:** hembra que puede clasificarse como `NORMAL` o `DESCARTE`.

Se registra el campo `etapa`, con los valores `candidata` o `reproductora`.
`NORMAL` es la clase por defecto. Este registro documental no modifica el
contrato de `PredictionRequest` ni implementa cambios de esquema.

## Histórico (superado)

Las reglas anteriores se basaron en la lectura del libro del SENA con apoyo de
IA. Se conservan aquí como antecedente, pero quedan reemplazadas por las
respuestas del instructor incluidas en este ADR; no son los criterios vigentes.

| Cifra o regla anterior | Criterio actualizado |
|---|---|
| Empadre desde 850 g | De 900 a 1000 g; ideal 950 g |
| Peso al nacimiento >150 g | Peso al nacimiento de 135 g como mínimo |
| Peso al destete >300 g | Al destete, a los 15 días, al menos el doble del peso al nacer |
| Descarte 15 días después del último parto | Salida 20 días después del cuarto parto |
| Retiro tras 4–5 partos; máximo sin resolver | Se deja hasta 4 partos |

También quedan superadas las propuestas anteriores de asignación de clases y
las simulaciones de conteos construidas con esos umbrales. No se deben tratar
como etiquetas confirmadas por el instructor.

## Respuestas del instructor (2026-11-07)

Transcripción de las respuestas recibidas por WhatsApp:

1. Q sea de 2do o 3er parto, tamaño de camada 3 o 4, peso nac 135 en adelante, peso destete doble al nacimiento en adelante, ojos negros.
2. el tamaño ideal de crías por parto 3 o 4.
3. peso de empadre de la hembra desde los 900 hasta los 1000 gramos, ideal 950.
4. se la deja 4 partos
5. Después de 20 días de haber tenido su 4to parto.
6. siempre se la deja un parto más si pasa eso,, si sigue presentando eso ya se la descarta.
7. en su mayoría las hembras si gestan pero dado el caso se descartará al momento.
8. si sus crías q mueren no presentan algo anormal se deja la hembra q siga su reproducción.
9. 135 como mínimo y deben doblar su peso al destete q es a los 15 días.
10. 4 vivos y un muerto , 5 muertos, AB aborto, x llena casillas vacías , M muerto

## Reglas vigentes

### ELITE — candidata (cría hembra)

Una candidata es `ELITE` cuando cumple conjuntamente estos criterios:

- NUPAR de la madre: 2 o 3.
- Camada: 3 o 4 crías.
- Peso al nacer: al menos 135 g.
- Peso al destete: al menos el doble del peso al nacer; destete a los 15 días.
- Ojos negros.
- Al empadre: de 900 a 1000 g; ideal 950 g.

Una candidata que no cumpla todos los criterios es `NORMAL`. La respuesta 6
no añade un criterio ELITE; su interpretación para la regla de descarte se
detalla en la sección DESCARTE.

### NORMAL — clase por defecto

`NORMAL` corresponde a lo demás dentro de la etapa aplicable. Es la clase por
defecto cuando no corresponde asignar `ELITE` o `DESCARTE`.

### DESCARTE — reproductora

- La reproductora sale 20 días después de su cuarto parto.
- Ante un problema (aborto, crías con bajo peso u otro), se deja un parto más;
  si el problema se repite, se descarta. La aplicación de esta regla es una
  **interpretación por confirmar** de la respuesta 6, cuyo “eso” no está
  especificado.
- Si no queda preñada, se descarta en el momento.
- La muerte de crías sin anomalía no es motivo para descartar a la reproductora.

## Códigos de registro

| Código o dato | Significado |
|---|---|
| `4+1M` | 4 vivos y 1 muerto |
| `5M` | 5 muertos |
| `AB` | Aborto |
| `M` | Muerto |
| `X` | Relleno de casillas vacías; no significa descarte |
| DESTINO | `M`, `D`, `V`, `R`, `SP`, `L`, `E` |
| OJOS | `1` = negro; `2` = rojo |
| SEXO | `1` = macho; `2` = hembra |

El significado de `R` en DESTINO queda por confirmar.

## Evidencia exploratoria

Agregados exploratorios del Galpón 2 aportados por Diery; no se incluyen
códigos de animales ni datos individuales:

- El destete se registra a los 15 días en 760 de 760 crías.
- 52 de 398 hembras cumplirían ELITE según la exploración. En los datos
  disponibles hoy solo existen NUPAR 1 o 2.
- Hay casi ningún ejemplo de DESCARTE: casi ninguna hembra llega al tercer o
  cuarto parto.

Estos agregados son evidencia exploratoria, no validación independiente ni
etiquetas confirmadas. La escasez de ejemplos de DESCARTE limita los datos
disponibles para entrenar esa clase.

## Puntos abiertos

- Qué significa `R` en el campo DESTINO.
- Si “camada 3 o 4” cuenta crías vivas o el total de crías.
- Cómo se registran la infertilidad y “algo anormal” en las crías; actualmente
  no hay un campo para ello.
- Obtener datos de ciclos anteriores para disponer de ejemplos de DESCARTE.
- La respuesta 6 usa “eso” sin precisar a qué problema se refiere; confirmar la
  interpretación de dejar un parto adicional y descartar si se repite.
- El criterio ELITE requiere peso al nacimiento, peso al destete, ojos y
  NUPAR de la madre, datos que no están en el contrato de `PredictionRequest`
  descrito en Arquitectura §10. Se coordinará con Oskar; no se cambia aquí el
  contrato.

Lo que no esté verificado queda **Por confirmar**. No se modifican el contrato,
el `CHECK` de `categoria_ml` ni otros archivos.
