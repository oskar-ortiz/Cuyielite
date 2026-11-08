# Reglas explicables de clasificación

`criterios.py` registra los umbrales, su fuente y si están `CONFIRMADO` o son
`PROPUESTA`. `clasificar.py` implementa la clasificación por etapa:

- Candidatas: `ELITE` o `NORMAL`, con revisión de datos faltantes y exclusión
  de machos o animales con destino Muerte.
- Reproductoras: `NORMAL` o `DESCARTE`, incluye ciclo completo, abortos,
  fecha sugerida de salida cuando existe la fecha del último parto y el
  indicador informativo de peso de monta.
- Ambas reglas devuelven motivos sin incorporar identificadores de origen.
- `fecha_descarte_sugerida` queda vacía si no hay `fecha_ultimo_parto`. Su
  cálculo requiere agregar `fecha_ultimo_parto` al ETL; queda como cambio para
  un PR aparte y no se modifica en este trabajo.

## Pendientes

- Infertilidad tras dos empadres consecutivos sin preñez: no se implementa
  porque el historial de empadres no está estructurado.
- Bajo peso o anomalías en las crías de una madre: no se implementa porque el
  cruce madre-cría sigue `NO_CONFIRMADO`.
- El umbral de descarte por dos abortos es `PROPUESTA`, pendiente de confirmar
  la interpretación del criterio de problema repetido.

## Ejecutar

Desde la raíz del repositorio, con el entorno ML instalado:

```powershell
ml\.venv\Scripts\python -m pytest ml/tests -q
ml\.venv\Scripts\python -m ml.rules.report
```

El reporte lee `ml/data/features_crias.csv` y
`ml/data/features_reproductoras.csv` y escribe CSV etiquetados en `ml/data/` y
un reporte agregado en `ml/reports/generados/clasificacion_agregada.json`. El
JSON no incluye filas, chapas ni procedencia individual. La carpeta
`ml/reports/` permanece disponible para futuros informes de métricas del modelo.
