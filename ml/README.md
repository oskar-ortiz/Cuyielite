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
