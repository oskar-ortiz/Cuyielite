# Guion de demostración local

Guion reproducible en Windows PowerShell. No carga datos reales ni imprime
identificadores de animales. Los ejemplos de predicción y generación sintética
usan valores ficticios.

## 0. Preparar el entorno

Desde la raíz del repositorio:

```powershell
py -m venv ml\.venv
ml\.venv\Scripts\python -m pip install -r ml\requirements.txt
py -m venv rag\.venv
rag\.venv\Scripts\python -m pip install -r rag\requirements.txt
```

La función `ml.prediccion` está en el PR #87, que sigue abierto al preparar
este guion. Para la demo debe estar integrado localmente o se debe trabajar
desde esa rama; no se incluye aquí una copia de la implementación.

## 1. Clasificar una reproductora y mostrar motivos

```powershell
@'
import json
from ml.prediccion import predecir_hembra

resultado = predecir_hembra({
    "partos_acumulados": 4,
    "abortos": 0,
    "fecha_ultimo_parto": "2026-01-15",
    "peso_monta_g": 950,
})
print(json.dumps(resultado, ensure_ascii=False, indent=2))
'@ | ml\.venv\Scripts\python -
```

Entrada sintética: cuarta parición, sin abortos registrados y peso ficticio de
empadre. La regla devuelve `DESCARTE` por ciclo completo y puede incluir fecha
sugerida; la clase no proviene del RF.

## 2. Clasificar una candidata

```powershell
@'
import json
from ml.prediccion import predecir_candidata

resultado = predecir_candidata({
    "nupar_madre": 2,
    "tcnv": 3,
    "peso_nacimiento_g": 135,
    "peso_destete_g": 270,
    "dias_destete": 15,
    "peso_monta_g": 950,
    "ojos": "1",
})
print(json.dumps(resultado, ensure_ascii=False, indent=2))
'@ | ml\.venv\Scripts\python -
```

La entrada es ficticia y satisface las reglas de ejemplo. La salida expone
`clase`, `motivos`, `estado_calidad` y `apoyo_modelo`; sin pasar explícitamente
un modelo, `apoyo_modelo` es `null`. Si hay datos faltantes, la implementación
puede devolver `NORMAL` con `REVISAR`.

## 3. Mostrar las métricas RF y su limitación

El informe agrupado por madre está en el PR #90, que todavía no está en `dev`.
Este comando muestra el informe agregado publicado allí, sin abrir CSV ni
artefactos de modelo:

```powershell
git fetch origin feat/ml-validacion-agrupada-madre
git show origin/feat/ml-validacion-agrupada-madre:ml/reports/informe_metricas.md
```

Presentar la validación agrupada (5 pliegues externos, 3 internos), las dos
líneas base y las métricas por clase. A y B tienen etiquetas derivadas de
reglas; A incorpora variables relacionadas con las mismas reglas y refleja
fuga. Las etiquetas no son una calificación independiente de un experto; el
código crudo `MADRE No.` usado como grupo no está reconciliado globalmente.

## 4. Pregunta al RAG con página citada

Requiere que PostgreSQL + pgvector esté disponible, el índice del manual ya
creado y que `RAG_DATABASE_URL` apunte a esa base:

```powershell
$env:RAG_DATABASE_URL = "postgresql://<usuario>:<clave>@localhost:5432/<base>"
$env:LLM_PROVIDER = "none"
rag\.venv\Scripts\python -m rag.ask ask "¿Qué temperatura recomienda el manual para la producción de cuyes?" --top-k 5
```

La salida contiene `respuesta`, `fuentes` y citas con formato `documento,
p. N`. El número de página lo debe devolver el índice; no se fija de antemano.
Con `LLM_PROVIDER=none`, la respuesta es extractiva y no requiere Ollama.

## 5. Pregunta fuera de tema y abstención

Con la misma base e índice:

```powershell
rag\.venv\Scripts\python -m rag.ask ask "¿Cuál es la capital de Francia?" --top-k 5
```

La consulta debe abstenerse si ningún fragmento supera el umbral vigente; el
resultado esperado del informe de evaluación es “No encontré esta información
en los manuales.”, sin fuentes.

## Plan B si fallan Ollama o Docker

- **Ollama no responde:** `rag/src/generate.py` usa respuesta extractiva ante
  fallo del proveedor. También se puede fijar `$env:LLM_PROVIDER = "none"` y
  repetir la consulta. Ollama es opcional; la base de recuperación no.
- **Docker/PostgreSQL local falla:** si hay una base central autorizada y
  accesible, usar su `RAG_DATABASE_URL`. No imprimir ni incluir la URL en
  capturas. Si no hay ninguna base disponible, no afirmar que se ejecutó una
  búsqueda RAG. Mostrar solamente la prueba sintética sin DB siguiente,
  aclarando que verifica el formato de citas y la abstención del generador,
  no la recuperación/indexación:

```powershell
$env:LLM_PROVIDER = "none"
@'
import json
from rag.src.generate import generar
from rag.src.retrieve import SearchResult

fragmento = SearchResult(
    documento_fuente="manual_sintetico.pdf",
    contenido_chunk="Texto ficticio para probar el formato de cita.",
    pagina=9,
    seccion="Prueba sintética",
    similitud=1.0,
)
con_cita = generar("¿Qué indica el texto ficticio?", [fragmento])
sin_resultado = generar("¿Cuál es la capital de Francia?", [])
print(json.dumps(
    {"con_fragmento_sintetico": con_cita, "sin_resultados": sin_resultado},
    ensure_ascii=False,
    indent=2,
))
'@ | rag\.venv\Scripts\python -
```

La cita de este último ejemplo dice `manual_sintetico.pdf, p. 9` y no representa
una página del manual SENA.

## Comprobación de este guion

El 9 de noviembre de 2026 se ejecutaron los dos ejemplos de predicción con
entradas sintéticas contra la implementación del PR #87 cargada en memoria:
hembra `DESCARTE` por `ciclo completo` y candidata `ELITE` con
`apoyo_modelo=null`. También se ejecutó el ejemplo RAG sintético: produjo la
cita `manual_sintetico.pdf, p. 9` y, sin fragmentos, la abstención sin fuentes.
El comando `git show` mostró el informe agrupado del PR #90. No se ejecutó una
consulta real a PostgreSQL/pgvector ni a Ollama; requieren servicios e índice
locales.
