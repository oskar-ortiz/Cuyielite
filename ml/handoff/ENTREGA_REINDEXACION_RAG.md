# Entrega a Oskar: reindexación RAG segura

Fecha: 2026-11-18. Para el seguimiento del extractor acotado en #183 y del
reemplazo transaccional incorporado por #182.

## Alcance y estado

Esta entrega describe el procedimiento; **no se ejecutó ni se escribió en
ninguna base de datos**. No apunta al piloto ni autoriza su actualización.
Primero se debe restaurar un respaldo de la base RAG en una base aislada y
hacer allí el ensayo y, si se autoriza, la aplicación.

El extractor acotado solo aplica el perfil de ligaduras del manual registrado
cuando el SHA-256 del PDF coincide. El código de referencia es el commit
`be1995fd877b6980b3dbad036b65eb5b6379d38e` de `feat/rag-extractor-acotado`.
No cambia el modelo, el umbral ni las preguntas.

## Procedencia y manifiesto

El manifiesto versionado es
[`rag/reports/manifiesto_extraccion.md`](../../rag/reports/manifiesto_extraccion.md).
Registra el PDF, las páginas, el extractor, el modelo, el mapa acotado y los
hashes de los artefactos locales. Valores de esta reconstrucción:

| Elemento | Valor |
|---|---|
| PDF | `db/raw_Lope/produccion_cuyes.pdf` |
| SHA-256 del PDF | `c33392cb1422bfe50b0f44ccfcc2917888b4aa9b0329830d2b13db3a289a91ea` |
| Fragmentos | 76; páginas de texto 12–85 |
| SHA-256 de `rag/.cache/local-corpus/fragments.json` | `bd1acac99bbd6c4af588d847ca9abe3c6c2b2aa51dfa9d960994f897b21b680f` |
| SHA-256 de `rag/.cache/local-corpus/embeddings.npy` | `d5fef42582abbe015cf3bc1a1781aba68a773b7e5ed69e207c61a2806bad44a4` |
| Embeddings | `intfloat/multilingual-e5-base`, 768 dimensiones |
| Umbral de consulta | `0.807566308073`, sin recalibrar |

`rag.ask index` extrae y fragmenta el PDF y calcula los embeddings para el
índice; no importa los `.npy` locales. Los hashes anteriores identifican la
reconstrucción local de referencia, no un archivo que el indexador cargue desde
disco.

## Verificación local, sin base de datos

Desde la raíz del repositorio, con el PDF autorizado disponible:

```powershell
rag\.venv\Scripts\python.exe -m rag.scripts.regenerate_local_corpus
Get-FileHash "db\raw_Lope\produccion_cuyes.pdf" -Algorithm SHA256
Get-FileHash "rag\.cache\local-corpus\fragments.json" -Algorithm SHA256
Get-FileHash "rag\.cache\local-corpus\embeddings.npy" -Algorithm SHA256
```

El primer comando solo escribe en `rag/.cache/local-corpus/`. Confirmar el SHA
del PDF y los hashes de ambos artefactos contra la tabla y el manifiesto antes
de conectar cualquier base. El script debe terminar con 76 fragmentos y cero
glifos mapeados restantes. Si cambia un hash o el conteo, detenerse e investigar;
no continuar con el reemplazo bajo esta referencia.

## Ensayo y aplicación en una restauración aislada

Antes de ejecutar el CLI:

1. Verificar el commit del extractor, el SHA-256 del PDF y los artefactos
   locales anteriores.
2. Crear un respaldo binario restaurable de la base RAG autorizada y restaurarlo
   con un nombre distinto en un servidor/base aislados. No usar `cuyielite`, la
   base del piloto ni la base de animales.
3. Registrar en esa restauración el conteo y los hashes de la fuente
   `produccion_cuyes.pdf` y de las otras fuentes. Confirmar que el entorno
   apunta a la restauración aislada; no guardar el DSN ni credenciales aquí.
4. Revisar el conjunto completo de páginas y la procedencia. El reemplazo
   elimina los hashes antiguos de esa fuente; no se debe inferir completitud
   solo por el conteo.

En PowerShell, sustituir el marcador por el DSN **de la restauración aislada**.
El CLI no carga `.env` por sí solo:

```powershell
$env:RAG_DATABASE_URL = "<DSN de la restauración aislada de la base RAG>"
$env:RAG_EMBEDDING_MODEL = "intfloat/multilingual-e5-base"
rag\.venv\Scripts\python.exe -m rag.ask index --pdf "RUTA_PRIVADA\produccion_cuyes.pdf" --replace-document --dry-run
```

El resultado esperado del ensayo es `ROLLBACK (dry-run, sin cambios
persistidos)`. Volver a consultar la restauración y confirmar que las filas,
conteos y hashes previos permanecen intactos, que las otras fuentes no cambiaron
y que el registro no revela una extracción vacía o incompleta.

Solo después de revisar el respaldo, el ensayo y la extracción, el operador
autorizado puede aplicar el reemplazo **a esa misma restauración aislada**. El
comando es el mismo, sin `--dry-run`:

```powershell
rag\.venv\Scripts\python.exe -m rag.ask index --pdf "RUTA_PRIVADA\produccion_cuyes.pdf" --replace-document
```

El resultado esperado es `COMMIT`. Después, verificar que para esa fuente solo
queden los hashes nuevos, comparar páginas y conteos con los artefactos
revisados, y confirmar que las demás fuentes no cambiaron. Repetir el reemplazo
en la restauración para comprobar idempotencia. Registrar el commit, los hashes,
el modelo, las dimensiones y la base aislada en el registro operativo vigente;
el indexador no actualiza automáticamente `corpus_catalogo`.

Por último, ejecutar las consultas completas con `top_k=5` y el mismo umbral
sin recalibrar, y revisar resultados y abstención conforme a
[`rag/reports/evaluacion_validacion.md`](../../rag/reports/evaluacion_validacion.md).
Un `COMMIT` confirma persistencia, no pertinencia. Este procedimiento no ordena
ni autoriza aplicar el cambio al piloto.
