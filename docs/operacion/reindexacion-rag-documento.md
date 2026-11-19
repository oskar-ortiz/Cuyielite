# Reindexación transaccional de un documento RAG

Estado actual: mecanismo comprobado y [actualización del índice del piloto ejecutada el 2026-11-18](../verificaciones/rag-actualizacion-piloto.md), con respaldo restaurado, dry-run, reemplazo y replay verificados. La pertinencia continúa pendiente con Diery; el recorrido de pantallas de esta actualización queda separado.

El [ensayo previo sobre una restauración de la base RAG](../verificaciones/rag-reindexacion-aislada.md) comprobó dry-run, reemplazo y replay con el extractor de #183 sin modificar entonces el índice activo. Documenta la variante numérica local de embeddings utilizada posteriormente y las limitaciones de pertinencia que permanecen.

## Comportamiento

`rag.ask index` conserva la indexación incremental existente. Cuando cambia el texto, el hash cambia: ejecutar solo ese comando puede conservar fragmentos obsoletos.

`--replace-document` recibe la extracción **completa** de un documento. Calcula todos los embeddings antes de escribir y, en una transacción, actualiza/inserta el conjunto nuevo y retira los hashes antiguos únicamente de esa fuente. Un bloqueo transaccional por fuente coordina los escritores incrementales y de reemplazo que usan esta función. Los fragmentos sin cambios mantienen su identidad; las demás fuentes no se alteran. Los lectores ven el estado anterior hasta el commit y el conjunto nuevo después.

El identificador es `pdf_path.name`: conserva el mismo nombre para reemplazar una fuente existente. Renombrar el PDF crea otra fuente. No uses el nombre de otro documento para sustituirlo. El modelo de embeddings y sus dimensiones deben coincidir con los del índice; este procedimiento no migra de modelo.

Se rechazan extracciones vacías, texto vacío, páginas no positivas, hashes duplicados y vectores de dimensión distinta de 768, no finitos o cero. Estas validaciones no prueban que una extracción no vacía esté completa: el operador debe revisar páginas, conteos y procedencia antes de aplicar.

`--dry-run` ejecuta la misma escritura y eliminación pero revierte las filas mediante la transacción/savepoint. Puede consumir valores de la secuencia de IDs de PostgreSQL; no supone restaurar esos números. La API de Python no confirma la transacción exterior del llamador. Si falla la inserción o la retirada, se revierte todo el reemplazo.

## Antes de tocar el piloto

1. Coordinar la versión final del extractor con Diery, incluidas las sustituciones de caracteres y el caso de preguntas completas con `top_k=5`. No usar la normalización pendiente como prueba de pertinencia resuelta.
2. Registrar commit, hash del PDF, modelo, dimensiones, umbral y base destino sin secretos. Configurar `RAG_DATABASE_URL` para la base **RAG**, no la base de animales. El CLI no carga `.env` por sí solo; usar el entorno autorizado.
3. Generar un respaldo binario de esa base y restaurarlo en una base aislada. El comando de respaldo habitual puede cubrir solo `cuyielite`: un respaldo de animales o una copia con `TEMPLATE` no sustituye el dump restaurable de `cuyielite_rag`. Usar el procedimiento aprobado de `pg_dump -Fc` dentro del contenedor y copia binaria; evitar redirección `>` de PowerShell 5.1.
4. Sobre la restauración aislada, guardar conteos y hashes del documento y de las otras fuentes. Revisar la extracción completa, incluidas las páginas conocidas. Los 76 fragmentos históricos son una referencia, no una condición que justifique ignorar un cambio legítimo de fragmentación.

## Ensayo y aplicación

Con el entorno apuntando primero a la restauración aislada y el PDF privado disponible:

```powershell
rag\.venv\Scripts\python.exe -m rag.ask index --pdf "RUTA_PRIVADA\produccion_cuyes.pdf" --replace-document --dry-run
```

El resultado debe indicar `ROLLBACK`; comprobar que las filas y hashes anteriores siguen intactos. Una vez revisados respaldo, procedencia y extracción, el mismo comando sin `--dry-run` aplica el conjunto completo al destino autorizado:

```powershell
rag\.venv\Scripts\python.exe -m rag.ask index --pdf "RUTA_PRIVADA\produccion_cuyes.pdf" --replace-document
```

El resultado `COMMIT` indica persistencia de filas, no que la calidad de respuestas esté validada. Verificar que solo quedan los hashes nuevos de la fuente; comparar otras fuentes y repetir para demostrar idempotencia. Registrar también procedencia/versiones en el catálogo o registro operativo vigente: el indexador no actualiza `corpus_catalogo` automáticamente.

Evaluar las mismas preguntas completas antes/después con `top_k=5` y el mismo umbral. Después comprobar backend y pantallas Android/Windows. No ajustar el umbral para favorecer los ejemplos.

Si falla antes del commit, la transacción conserva el índice previo. Si la operación terminó pero la evaluación posterior requiere revertirla, recuperar desde el respaldo **en un entorno aislado**, verificarlo y coordinar la restauración; no restaurar a ciegas sobre la base activa.

## Evidencia de esta entrega — 2026-11-18

Pruebas con PostgreSQL/pgvector real en base temporal única, tabla temporal y vectores sintéticos de 768 dimensiones. Sin E5, PDF ni escrituras en el corpus del piloto:

- Retirada del texto anterior, conservación de fragmentos sin cambios y de otra fuente, y replay sin duplicados.
- Dry-run con rollback y posterior aplicación efectiva.
- Fallo inducido durante la retirada, después de insertar: sin filas nuevas persistidas y con el índice previo intacto.
- Control de transacción prestada y bloqueo por documento.
- Rechazo previo de extracción vacía/duplicada y vectores inválidos; propagación de flags del CLI.

Resultado: `python -m pytest rag/tests -q` con `RAG_TEST_DATABASE_URL` temporal: **58 passed**. La base `cuyielite_rag_test_reindex_e394318230` se eliminó al terminar. `git diff --check` sin errores. La corrección de ligaduras de Diery no se modificó en este encargo.
