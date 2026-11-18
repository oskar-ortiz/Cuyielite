# Manifiesto de regeneración local RAG

- Fecha: 2026-11-18.
- Fuente: `db/raw_Lope/produccion_cuyes.pdf` (local, no versionado).
- SHA-256 del PDF: `c33392cb1422bfe50b0f44ccfcc2917888b4aa9b0329830d2b13db3a289a91ea`.
- Páginas del PDF: 86; páginas con texto extraído: 74 (PDF 12–85).
- Fragmentos: 76 antes y 76 después de normalizar; objetivo de 400 tokens,
  solapamiento de 0.15.
- Extractor: commit `09d7e248aac42287ab9d2021b04445719b7596a3`.
- Modelo: `intfloat/multilingual-e5-base`, 768 dimensiones.
- Umbral: `0.807566308073`, conservado sin recalibrar.

## Mapa explícito de normalización

| Carácter extraído | Sustitución |
|---|---|
| `ö` (U+00F6) | `fi` |
| `ø` (U+00F8) | `fl` |
| U+F001 | `fi` |
| U+F002 | `fl` |
| `ﬁ` (U+FB01) | `fi` |
| `ﬂ` (U+FB02) | `fl` |

Antes, 43/76 fragmentos contenían las cuatro lecturas erróneas observadas
(`ö`, `ø`, U+F001 y U+F002): 102 ocurrencias. Al incluir la ligadura `ﬁ`
(27 ocurrencias), 55/76 fragmentos tenían caracteres cubiertos por el mapa,
129 ocurrencias en total. Después, 0/76 fragmentos conservan esos caracteres
o las ligaduras normalizadas. El número de fragmentos no cambió.

## Archivos generados localmente

El comando escribe únicamente en `rag/.cache/local-corpus/`, ignorado por Git.
No se guardan aquí ni se versionan los fragmentos o los embeddings.

| Archivo local | SHA-256 |
|---|---|
| `fragments.json` | `bd1acac99bbd6c4af588d847ca9abe3c6c2b2aa51dfa9d960994f897b21b680f` |
| `embeddings.npy` | `d5fef42582abbe015cf3bc1a1781aba68a773b7e5ed69e207c61a2806bad44a4` |

Comando reproducible desde la raíz del repositorio:

```powershell
.\.venv\Scripts\python.exe -m rag.scripts.regenerate_local_corpus
```

La generación local se ejecutó sin conexión ni escritura a PostgreSQL.

## Regeneración del índice del piloto

**Sí, el piloto debe regenerar tanto los fragmentos como sus embeddings**, porque
el texto extraído cambió. La carga no se ejecutó en esta tarea y la coordina
Oskar. Cuando autorice y configure `RAG_DATABASE_URL` para la base del piloto,
el comando del indexador es:

```powershell
.\.venv\Scripts\python.exe -m rag.ask index
```
