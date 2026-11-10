# Medición de sincronización y SUS

Utilidades locales para resumir registros de sincronización y respuestas del
System Usability Scale (SUS). No requieren base de datos ni servicios externos.
Use identificadores seudónimos para las respuestas y no versiona los CSV.

## Requisitos

Desde la raíz del repositorio:

```powershell
ml\.venv\Scripts\python -m pip install -r ml\requirements.txt
```

## Métricas de sincronización

Formato CSV UTF-8/UTF-8 con BOM, una fila por intento y encabezados exactos:

```csv
id,inicio,fin,exito
sync-001,2026-11-09T08:00:00Z,2026-11-09T08:00:00.250Z,true
sync-002,2026-11-09T08:01:00-05:00,2026-11-09T08:01:00.500-05:00,0
```

- `id`: identificador no vacío del intento; no se incluye en el resumen.
- `inicio`, `fin`: timestamps ISO 8601 con zona horaria (`Z` u offset).
- `exito`: `1`/`0`, `true`/`false` o `si`/`sí`/`no` (sin distinguir
  mayúsculas).
- Los encabezados deben contener exactamente esos cuatro campos y el archivo
  debe tener al menos una fila válida.

Ejecutar:

```powershell
ml\.venv\Scripts\python -m ml.medicion.sync_metrics sincronizaciones.csv
```

La tasa se expresa en porcentaje sobre todos los intentos. La latencia se
calcula para **todos** los intentos (también los fallidos) como `fin - inicio`,
en milisegundos. `mean`, `p50` y `p95` se calculan sobre esos valores; los
percentiles usan interpolación lineal con posición `(n - 1) × p`. No se
admiten duraciones negativas, timestamps sin zona ni campos vacíos.

## Puntaje SUS

Formato CSV UTF-8/UTF-8 con BOM, una respuesta por usuario y encabezados
exactos: `usuario_id,item1,item2,item3,item4,item5,item6,item7,item8,item9,item10`.
Cada respuesta debe ser un entero entre 1 y 5. Ejemplo:

```csv
usuario_id,item1,item2,item3,item4,item5,item6,item7,item8,item9,item10
persona-01,1,5,3,2,4,1,5,3,2,4
persona-02,5,1,5,1,5,1,5,1,5,1
```

Ejecutar:

```powershell
ml\.venv\Scripts\python -m ml.medicion.sus_metrics respuestas_sus.csv
```

Para cada usuario se calcula la suma de `respuesta - 1` en ítems impares y
`5 - respuesta` en ítems pares, multiplicada por 2,5. El resumen devuelve el
puntaje 0–100 por usuario y el promedio aritmético de esos puntajes. Se exige
un identificador no vacío y único por archivo para evitar mezclar mediciones.

## Pruebas sintéticas

```powershell
ml\.venv\Scripts\python -m pytest ml\tests\test_medicion.py -q
```
