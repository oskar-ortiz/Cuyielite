# Handoff a Diery: pertinencia RAG pendiente (plataforma 2026-11-17)

Estado: **calidad RAG NO resuelta**. La plataforma quedó comprobada; la pertinencia de dos respuestas depende del pipeline y del criterio de Diery. No se cambiaron umbrales, contratos ni generación extractiva.

## Configación y commit revisados

- Código: `origin/dev` `e1725c6` (PR #166 fusionado, incluye `get_embedder()` compartido).
- Modelo: `intfloat/multilingual-e5-base`, 768 dimensiones, prefijos `query: ` / `passage: `, normalización L2.
- Corpus: `produccion_cuyes.pdf`, SHA-256 `c33392cb1422bfe50b0f44ccfcc2917888b4aa9b0329830d2b13db3a289a91ea`, 76 fragmentos en `cuyielite_rag`.
- Umbral vigente: `RAG_MIN_SIMILARITY` por defecto `0.807566308073` (sin cambios).
- `top_k = 5`, `LLM_PROVIDER=none` (extractivo).
- Usuario: sesión de piloto con el ámbito Centro Lope registrado solo en el handoff privado, rol admin. No influye en ranking.

## Reproducción

Con el backend del piloto en marcha:

```powershell
python -m tools.piloto.servidor start
```

```python
# script: %TEMP%\opencode\rag_plataforma.py (fuera de Git)
# hace POST /auth/login y cuatro POST /assistant/query con las preguntas exactas
```

```text
GET  /health -> {"status":"ok"}
POST /assistant/query {"pregunta": "...", "top_k": 5}
Authorization: Bearer <access_token del piloto>
```

## Caso 1 — duración de la gestación

- **Pregunta exacta:** `¿Cuál es la duración de la gestación de los cuyes?`
- **top_k:** 5.
- **Resultado HTTP:** 200, DTO `{respuesta, fuentes}`.
- **Fuentes devueltas:** `produccion_cuyes.pdf, p. 28`, `p. 85`, `p. 26`, `p. 80`, `p. 25`.
- **Texto extractivo mostrado:** comienza con «de aluminio galvanizado flexible, de calibre 40…» (p. 28, identificación individual).
- **Qué contiene el PDF:** página física 26, apartado «Gestación y parto»: **«La gestación dura entre 63 y 70 días.»** Verificado con `pymupdf` sobre el PDF privado: el fragmento indexado de la p. 26 contiene esa frase exacta.
- **Resultado esperado:** que la respuesta presentada incluya «63 a 70 días» y cite `p. 26`, o que se comunique claramente que solo se encontró información relacionada. No se debe inventar otra cifra.
- **Observación de plataforma:** la p. 26 aparece como tercera fuente; el problema está en el orden de similitud o en la presentación extractiva, no en la autenticación ni en el transporte.

## Caso 2 — vitamina C

- **Pregunta exacta:** `¿Por qué los cuyes necesitan vitamina C en su alimentación?`
- **top_k:** 5.
- **Resultado HTTP:** 200, DTO `{respuesta, fuentes}`.
- **Fuentes devueltas:** `p. 31`, `p. 28`, `p. 85`, `p. 32`, `p. 12`.
- **Texto extractivo mostrado:** describe digestión monogástrica y cecotrofia; no explica la necesidad de vitamina C.
- **Qué contiene el PDF:** p. 32, tabla de requerimientos nutricionales con fila «Vitamina C 200 mg» para gestación, lactancia y crecimiento; p. 42 indica suplementar con vitaminas adicionales ricas en vitamina C.
- **Resultado esperado:** citar `p. 32` (y/o `p. 42`) y comunicar que el manual da requerimientos/suplementación, **sin inventar una explicación fisiológica que el texto no afirme**. Si se decide que el manual no responde al «por qué», la UI debe abstener o declarar esa limitación.
- **Observación:** la p. 32 aparece como cuarta fuente. Igual que en el caso 1, hay información en el corpus pero no llega al texto presentado.

## Caso 3 — fuera de corpus (comprobado correcto)

- **Pregunta exacta:** `¿Cómo configuro una impresora Wi-Fi?`
- **Resultado:** 200, `respuesta: "No encontré esta información en los manuales."`, `fuentes: []`.
- No requiere cambio de Diery; se conserva como referencia de abstención.

## Criterio para volver a verificar

Cuando Diery entregue un cambio, repetir los tres casos con el mismo commit base de corpus y `top_k=5`, sin reindexar salvo que el cambio lo requiera. Se considera resuelto solo si:

1. Las respuestas de los casos 1 y 2 incluyen el contenido verificado del PDF con su página correcta, o abstienen/adecuan el mensaje conforme al contrato.
2. La abstención del caso 3 se mantiene.
3. La evaluación entregada (`rag/eval/evaluate_validation.py`) se ejecuta con los mismos parámetros y no muestra regresión en las 17 preguntas válidas, 10 fuera de corpus y 3 en dominio sin respuesta.

No se acepta como cierre un HTTP 200 con fuentes reales pero texto no pertinente.

