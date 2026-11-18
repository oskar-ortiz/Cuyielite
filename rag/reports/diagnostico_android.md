# Diagnóstico RAG — consultas Android y corpus de 76 fragmentos

## Alcance y método

- Corpus: `db/raw_Lope/produccion_cuyes.pdf`, páginas PDF 12–86 (se excluyen 1–11). Página impresa = PDF − 1.
- El índice PostgreSQL no estaba accesible en este entorno: `RAG_DATABASE_URL` sin definir y el puerto 5434 cerrado. Para no reindexar ni escribir en la base, se reconstruyó el mismo corpus con `extract_pages` + `chunk_pages`: **76 fragmentos**, y se ejecutó el recuperador en memoria con `E5Embedder` y los prefijos `query:` / `passage:`.
- La reconstrucción reproduce exactamente las métricas del informe versionado: hit@1=0.8235, hit@3=0.8824, hit@5=0.9412, MRR=0.8578 y 0/17 abstenciones válidas. Esto valida la comparación; no se modificó el índice ni el umbral.
- No se modificó `rag/src/extract.py`, no se reindexó y no se cambió `0.807566308073`.

## Presencia de los términos

| Consulta | Apariciones | Páginas PDF | Evidencia |
|---|---:|---|---|
| `gestación` | 4 | 26, 32, 71 | p. 26: «La gestación dura entre 63 y 70 días»; p. 32: tabla nutricional con columna «Gestación»; p. 71: «Gestacion 68 días» |
| `vitamina C` | 2 | 32, 42 | p. 32: tabla «Vitamina C 200»; p. 42: «vitaminas adicionales, ricas en vitamina C» |

Ambas consultas tienen material en el corpus. No son consultas fuera de corpus.

## Top-3 de las dos consultas

Se reportan solo los scores, sin fragmentos completos. El umbral es `0.807566308073`.

| Consulta | Versión | Top-1 | Top-2 | Top-3 | ¿Superan el umbral? |
|---|---|---:|---:|---:|---|
| `gestación` | original | 0.843254685402 | 0.836925804615 | 0.835437476635 | sí, los tres |
| `gestación` | ligaduras corregidas | 0.843254685402 | 0.835460424423 | 0.835437476635 | sí, los tres |
| `vitamina C` | original | 0.821071505547 | 0.819586753845 | 0.818508386612 | sí, los tres |
| `vitamina C` | ligaduras corregidas | 0.819586753845 | 0.819099426270 | 0.816786348820 | sí, los tres |

Ninguna consulta se abstiene por umbral. La dificultad es de ranking: en `gestación`, las páginas que responden (26, 32, 71) no aparecen en el top-3; en `vitamina C`, el top-3 incluye la página 42, pero no la página 32, que es la esperada por B2.

## Ruta de la app frente al conjunto de evaluación

| Dimensión | App / CLI | Evaluación | ¿Discrepancia? |
|---|---|---|---|
| Prefijo de embedding | `query: ` y `passage: ` en `rag/src/embed.py:42-46` | el mismo embedder | No |
| Modelo | `intfloat/multilingual-e5-base` por defecto (`rag/src/embed.py:10`); la app usa `get_embedder()` (`rag/src/retrieve.py:125`) | `E5Embedder()` (`rag/eval/evaluate_validation.py:435`) | No por defecto; sí si `RAG_EMBEDDING_MODEL` difiere entre procesos |
| Normalización | `AssistantRequest` recorta espacios (`backend/app/schemas/ml.py:112-116`); no hay minúsculas ni eliminación de acentos | usa la pregunta del YAML sin recorte adicional | Menor: solo espacios exteriores |
| Umbral | `DEFAULT_MIN_SIMILARITY` y `RAG_MIN_SIMILARITY` (`rag/src/retrieve.py:17,126`) | el mismo valor por `RAG_MIN_SIMILARITY` (`rag/eval/evaluate_validation.py:430`) | No por defecto; sí si el entorno difiere |
| Top-k | app: 5 por defecto (`backend/app/schemas/ml.py:108`), selector 3/5/10 (`client/src/pages/AsistenteTrabajo.tsx:68`) | fijo 20 (`rag/eval/evaluate_validation.py:265`) | Sí: con 3 cambia hit@5 y MRR; con 5/10/20 no cambió en este conjunto |
| Métrica | devuelve fragmentos y citas deduplicadas por página (`rag/src/retrieve.py:101-103`) | evalúa páginas únicas después de hasta 20 fragmentos (`rag/eval/evaluate_validation.py:131-135,230-231`) | Sí: `top_k` significa fragmentos en la app y páginas únicas en la evaluación |
| Generación | `consultar` llama a `generar` y puede abstenerse por LLM o por extractivo (`rag/src/retrieve.py:132-139`; `rag/src/generate.py:108-129`) | no genera respuesta; solo mide recuperación y abstención por umbral | Sí: la app puede decir «No encontré…» aunque la evaluación cuente un acierto |
| Entrada de evaluación | `python -m rag.ask evaluate` ejecuta `rag.eval.evaluate` (`rag/ask.py:57-59`), que calibra con `preguntas.yaml` | la validación independiente se ejecuta con `rag.eval.evaluate_validation` | Sí: el comando `ask evaluate` no evalúa `preguntas_validacion.yaml` |
| Android | `CapacitorHttp` llama a `/assistant/query` (`client/src/data/ml.transport.ts:101`) y el backend delega en `rag.src.retrieve.consultar` (`backend/app/services/ml.py:228`) | mismo recuperador en el servidor | No hay recuperador distinto en Android; el diagnóstico es del backend |

## Ligaduras

- **43 de 76 fragmentos** contienen al menos un carácter mal leído por ligadura: `ö` (88), `ø` (9), U+F001 (4) y U+F002 (1): **102 ocurrencias**. Si se cuenta también la ligadura Unicode `ﬁ` (27), son **55 de 76**.
- Correspondencia usada en memoria: `ö`→`fi`, `ø`→`fl`, U+F001→`fi`, U+F002→`fl`, `ﬁ`→`fi`.
- Corrección aplicada solo al texto en memoria; no se modificó `extract.py` ni se reindexó.

| Métrica (17 válidas) | Original | Corregida | Cambio |
|---|---:|---:|---:|
| hit@1 | 0.8235 | 0.8235 | 0 |
| hit@3 | 0.8824 | 0.8824 | 0 |
| hit@5 | 0.9412 | 0.9412 | 0 |
| MRR | 0.8578 | 0.8676 | +0.0098 |
| Abstención | 0/17 | 0/17 | 0 |

La corrección cambia el orden de `vitamina C` (el top-1 pasa de la página 71 a la 42) y mantiene el top-1 de `gestación` en la página 65; todos los scores siguen por encima del umbral. No hace aparecer las páginas 26/32/71 en el top-3 de `gestación` ni la página 32 en el top-3 de `vitamina C`. Las ligaduras afectan la calidad del texto y el MRR, pero no son la causa principal de estas dos consultas.

### Propuesta de parche (no aplicada)

En `rag/src/extract.py`, normalizar el texto de cada página antes de construir los fragmentos:

```python
LIGATURE_FIXES = str.maketrans({
    "\u00f6": "fi",  # ö
    "\u00f8": "fl",  # ø
    "\uf001": "fi",
    "\uf002": "fl",
    "\ufb01": "fi",  # ﬁ
})
texto = texto.translate(LIGATURE_FIXES)
```

No se aplicó el parche, no se modificó `extract.py` y no se reindexó; la comprobación se hizo con una copia del texto en memoria.

## Conclusión

La limitación no es el umbral: las dos consultas superan `0.807566308073` en sus tres primeros resultados y las 17 preguntas válidas no se abstienen; el problema es de recuperación/ranking, porque las páginas que responden sí están en el corpus (`gestación`: 26, 32, 71; `vitamina C`: 32, 42) pero no encabezan el top-3. Corregir las ligaduras sube el MRR de 0.8578 a 0.8676 y cambia el orden de `vitamina C`, pero no cambia hit@1/3/5 ni las abstenciones, así que es una mejora necesaria de texto, no el arreglo de estas dos consultas. La discrepancia de ruta es secundaria: app y evaluación comparten recuperador, modelo y umbral, pero difieren en top-k, en la unidad de conteo (fragmentos frente a páginas únicas) y en la generación; comparar la respuesta de la app con hit@k de la evaluación sin igualar esos parámetros no es válido.

## Para Oskar

Caso reproducible de diferencia de `top_k`:

- Consulta: A3 (ciclo estral y temperatura rectal), del conjunto de 17 válidas.
- Observado: con `top_k=3`, la página esperada 71 queda fuera del top-3; hit@5=0.8824 y MRR=0.8431.
- Esperado: la evaluación usa `top_k=20`; A3 espera la página 71 en posición 4 y obtiene hit@5=0.9412 y MRR=0.8578.
- Archivos: `client/src/pages/AsistenteTrabajo.tsx:68` (envía el selector 3/5/10), `backend/app/schemas/ml.py:108` (5 por defecto), `rag/eval/evaluate_validation.py:265` (20) y `rag/src/retrieve.py:79` (`LIMIT`).
- No es un fallo del recuperador: es un parámetro distinto. Para comparar, usar el mismo `top_k` y la misma métrica de páginas.

Caso reproducible de entorno:

- Si el backend arranca con `RAG_MIN_SIMILARITY=0.9` y la evaluación se ejecuta con el valor por defecto `0.807566308073`, la app puede abstenerse y la evaluación no. Archivos: `rag/src/retrieve.py:126` y `rag/eval/evaluate_validation.py:430`.
- Si `RAG_EMBEDDING_MODEL` difiere entre el proceso del backend y el de evaluación, los vectores no son comparables aunque el código sea el mismo. Archivos: `rag/src/embed.py:24,68` y `rag/eval/evaluate_validation.py:435`.

## Candidatas a pregunta de validación

No se edita `rag/eval/preguntas_validacion.yaml` en esta tarea.

- `gestación`: el corpus contiene material en las páginas 26, 32 y 71. Estado: **pendiente de verificar si tiene respuesta suficiente**; hay términos y datos, pero falta redactar una pregunta concreta y confirmar que la respuesta sea completa.
- `vitamina C`: el corpus contiene material en las páginas 32 y 42. Estado: **pendiente de verificar si tiene respuesta suficiente**; además se solapa con B2, que ya espera la página 32, así que no debe añadirse sin decidir si sustituye o complementa a B2.

## Límites

- No se accedió a PostgreSQL porque no estaba disponible en este entorno; la comprobación se hizo sobre el mismo corpus reconstruido y reprodujo las métricas versionadas.
- No se recalibró el umbral ni se reindexó.
- No se ejecutó la app Android ni el backend; la comparación de rutas es de código y la recuperación es la misma función `retrieve`.
