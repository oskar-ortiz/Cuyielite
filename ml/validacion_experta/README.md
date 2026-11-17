# Validación experta ciega

Este procedimiento compara la clasificación por reglas y el apoyo del Random
Forest frente a una clasificación independiente de un experto. No modifica
reglas, modelo ni etiquetas.

## Protocolo

1. El responsable autorizado selecciona un conjunto de registros y sustituye
   cualquier identificador por un `id_anonimo` aleatorio, sin una tabla de
   correspondencias en el archivo entregado al experto.
2. Entrega al experto únicamente `id_anonimo` y los campos de entrada de
   `plantilla.csv`. No comparte predicciones, reglas aplicadas ni métricas.
3. El experto registra `clasificacion_experta` (`ELITE` o `NORMAL`) con el
   criterio acordado por el equipo. Antes de ejecutar, retira las filas sin
   decisión; el evaluador rechaza filas incompletas.
4. Antes de calcular métricas, confirma que los registros son comparables y que
   la versión de reglas y el hash del modelo están autorizados. El evaluador
   carga el Random Forest solo si su hash coincide con `metadata.json`.
5. Ejecuta el evaluador en un entorno autorizado. Guarda únicamente el reporte
   agregado; no publica el CSV, filas, IDs, pesos ni resultados individuales.

## Campos visibles para el experto

`nupar_madre`, `tcnv`, `peso_nacimiento_g`, `peso_destete_g`, `dias_destete` y
`peso_monta_g` son numéricos; `ojos` acepta `1`/`Negro` o `2`/`Rojo`. La columna
`clasificacion_experta` es la decisión ciega del experto. El CSV no debe incluir
columnas de reglas o del modelo.

## Ejecución

Usa Python del entorno del proyecto y rutas fuera de Git para el archivo
completado y el reporte:

```powershell
$env:CUYIELITE_RF_MODEL_PATH = "RUTA_AUTORIZADA\candidate_random_forest_b.joblib"
$env:CUYIELITE_RF_METADATA_PATH = "RUTA_AUTORIZADA\metadata.json"
.\.venv\Scripts\python.exe -m ml.validacion_experta.evaluate `
  "RUTA_AUTORIZADA\validacion_experta.csv" `
  --output "RUTA_AUTORIZADA\acuerdo_agregado.json"
```

El reporte contiene exactitud, kappa de Cohen, precisión/recall/F1 por clase y
matrices de confusión para reglas-experto y RF-experto. No se debe ejecutar con
datos reales hasta contar con autorización, respaldo verificable y revisión
humana aprobada.
