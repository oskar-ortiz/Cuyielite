# ETL de features

El ETL lee en modo solo lectura los Excel configurados en `db/raw_Lope/` y
genera dos tablas independientes en `ml/data/`:

- `features_reproductoras.csv`
- `features_crias.csv`

El resumen agregado se imprime en consola: conteos, patrones de T.C.N. sin
valores originales, códigos categóricos reconocidos y shapes. No incluye filas,
chapas ni `NUPAR`. La ejecución solo escribe los dos CSV en `ml/data/`.

Los nombres de archivo, encabezados, columnas, catálogos y patrones de relleno
están en `ml/etl/config.py`; se inspeccionan todas las hojas y no se depende de
nombres de hoja ni números de fila fijos. El código de animal solo se usa como
filtro y no se exporta. `NUPAR` se conserva en crudo, sin conciliación ni cruce.

`4+1M` y `5M` se decodifican como vivos y muertos según los códigos confirmados
por el instructor. `AB` cuenta como parto y como aborto, pero su tamaño queda
vacío; `X` se ignora. Patrones con cantidad junto a `AB` se reportan como
`NO_INTERPRETADO_AB_CON_CANTIDAD`, sin inferir su significado. Un T.C.N. que
contiene solo dígitos se interpreta como vivos, muertos cero y total igual al
número, con estado `INFERIDO_POR_DATOS`. La semántica de NUPAR y la dirección
del código R siguen sin interpretar. Las columnas atómicas TCNV/TCNM/TCNT se
procesan aparte. Según Arquitectura §10 y confirmación del instructor,
`tcn_promedio` corresponde a `tcn_vivos_promedio` (`CONFIRMADO`).
`etiqueta` siempre queda vacía.

Los libros reproductivos se descubren con los patrones declarados en
`ml/etl/config.py`, incluido `REGISTRO REPRODUCTIVO GALPON 2 VIEJO`. El reporte
agregado contiene hembras por archivo y por número de partos (AB incluido), así
como la cantidad de observaciones que mencionan `EMPADRE`; no publica filas ni
códigos de animales.

## Comandos

Desde la raíz del repositorio:

```powershell
py -m venv ml\.venv
ml\.venv\Scripts\python -m pip install -r ml\requirements.txt
ml\.venv\Scripts\python -m pytest ml\tests -q
ml\.venv\Scripts\python -m ml.etl.load
```

El último comando requiere los Excel reales en `db/raw_Lope/`; el origen no se
modifica. Los resultados en `ml/data/` están ignorados por Git.

## Funciones para los endpoints ML

`ml.prediccion` expone las funciones que puede conectar el backend a los
endpoints acordados en el ADR 0004. No implementa rutas HTTP ni modifica
`backend/`.

```python
from ml.prediccion import predecir_candidata, predecir_hembra

hembra = predecir_hembra({
    "partos_acumulados": 4,
    "abortos": 0,
    "fecha_ultimo_parto": "2026-01-15",
})
# clase DESCARTE; fecha sugerida 20 días después del cuarto parto.

candidata = predecir_candidata({
    "nupar_madre": 2,
    "tcnv": 3,
    "peso_nacimiento_g": 135,
    "peso_destete_g": 270,
    "dias_destete": 15,
    "peso_monta_g": 950,
    "ojos": "1",
})
# clase ELITE cuando se cumplen todas las reglas.
```

### Tipos de entrada y salida

Ambas funciones reciben un `TypedDict` y devuelven un `TypedDict` JSON-compatible.
Los campos de entrada son opcionales para permitir registros incompletos; las
cantidades deben ser enteros no negativos y los pesos números positivos.

| Función | Campos de entrada | Clases y campos de salida |
|---|---|---|
| `predecir_hembra` | `partos_acumulados`, `abortos`, `peso_monta_g`, `fecha_ultimo_parto`, `hembra_muerta`, `estado_calidad` | `clase` (`NORMAL`/`DESCARTE`), `motivos`, `estado_calidad`, `fecha_descarte_sugerida`, `peso_monta_en_rango_900_1000` |
| `predecir_candidata` | `nupar_madre`, `tcnv`, `peso_nacimiento_g`, `peso_destete_g`, `dias_destete`, `peso_monta_g`, `ojos`, `estado_calidad` | `clase` (`ELITE`/`NORMAL`), `motivos`, `estado_calidad`, `apoyo_modelo` |

`ojos` acepta `1`/`Negro` o `2`/`Rojo`. Para confirmar `ELITE`, la candidata
debe satisfacer también el destete a los 15 días y el rango de empadre de
900–1000 g del ADR 0004. Si faltan datos, la clase por defecto es `NORMAL` y
`estado_calidad` incluye `REVISAR`; no equivale a confirmar que el animal está
clínicamente sano. Una hembra muerta o una candidata fuera de la etapa no se
clasifican y producen `ValueError`. Valores numéricos inválidos también generan
`ValueError`.

El modelo anticipatorio es opcional: páselo explícitamente como `modelo` a
`predecir_candidata`. Si los cuatro predictores de nacimiento están disponibles,
`apoyo_modelo` contiene la clase y las probabilidades del modelo; si no, vale
`None`. El resultado del modelo es informativo, no calibrado y nunca sustituye
ni modifica la clase dictada por reglas. No se carga un artefacto por defecto:
los modelos entrenados no se versionan.

La regla de descarte por dos abortos sigue marcada `PROPUESTA` en el ADR y en
`estado_calidad`; un solo aborto es observación, no descarte. El historial de
empadres no está estructurado, por lo que la sospecha de infertilidad no se
infiera.

**Limitación del modelo:** las etiquetas y variables de entrenamiento actuales
no incluyen los campos `dias_destete` ni `peso_monta_g` de las reglas completas
del endpoint. Por esto, el Random Forest es solo apoyo exploratorio hasta
alinear las etiquetas del ETL con esos criterios; sus probabilidades no deben
anular las reglas.

Validación de estas funciones:

```powershell
ml\.venv\Scripts\python -m pytest ml\tests\test_prediccion.py -q
```
