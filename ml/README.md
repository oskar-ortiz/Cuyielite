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

Un T.C.N. reproductivo entero se toma como total (confirmado); los compuestos,
incluidos `4+1M`, `5M`, `AB` y `X`, son `AMBIGUO` y no producen métricas de
vivos o mortalidad. La semántica de NUPAR y la dirección del código R siguen
sin interpretar. Las columnas atómicas TCNV/TCNM/TCNT se procesan aparte.
`tcn_promedio` del contrato no se asigna a vivos o total: queda POR CONFIRMAR.
`etiqueta` siempre queda vacía.

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
