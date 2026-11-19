# Ensayo de reindexación RAG en una restauración aislada

Fecha: 2026-11-18 (America/Bogota). Código: `origin/dev` `a4c6c65`, con #182, #183 y #184 integrados. **Índice activo del piloto sin cambios.**

## Método y alcance

Se respaldó `cuyielite_rag` con `pg_dump -Fc` dentro del contenedor y se copió el archivo binario a almacenamiento privado. Se comprobó la cabecera `PGDMP` y se restauró con `pg_restore --exit-on-error` en una base nueva: `cuyielite_rag_reindex_e4ddae13b5`. La restauración contiene 9 migraciones y 76 filas de embeddings; el hash de la instantánea (id, fuente, texto, página, sección, hash y vector) coincide con el origen.

Respaldo: 409.358 bytes; SHA-256 `727a347419c615be9a97c6f0712c054d630c3a57c89448be6df17d58757dbcb7`. Archivo privado bajo `%LOCALAPPDATA%\CuyiElite\piloto-local\respaldos\`; no se versiona.

Se usó el PDF autorizado por su ruta privada y se verificó SHA-256 `c33392cb1422bfe50b0f44ccfcc2917888b4aa9b0329830d2b13db3a289a91ea`. El extractor acotado produce 74 páginas con texto (físicas 12–85) y 76 fragmentos. No se modificaron PDF, modelo, preguntas ni umbral.

Modelo: `intfloat/multilingual-e5-base`, 768 dimensiones, CPU, un hilo; caché local y modo offline. Se calcularon los pasajes y se reutilizaron sus vectores mediante un adaptador en memoria para dry-run, aplicación y replay. Las consultas usaron E5 real; se cachearon los vectores de pregunta para comparar el mismo vector antes/después. No se cargaron pesos por petición ni se ejecutó un servidor adicional.

Se llamó a `index_chunks` real con `replace_document=True`, primero con `dry_run=True` y después sin él, únicamente sobre la restauración. Se consultó PostgreSQL mediante `retrieve` y se ensambló texto mediante `build_response` extractivo. **No son pruebas HTTP ni de UI Android/Windows.** El CLI se conserva como procedimiento operativo; esta corrida utilizó la API Python para evitar recalcular los mismos pasajes tres veces.

## Artefactos y diferencia binaria

- `fragments.json`: SHA-256 `bd1acac99bbd6c4af588d847ca9abe3c6c2b2aa51dfa9d960994f897b21b680f`, idéntico al handoff de Diery. Ese hash incluye el salto de línea final CRLF de Windows; el mismo JSON con LF da `39f7f41f171027929a6f179b74d531a1cbfd398e3cc8590e36fd18eb9c16142c`. Se comprobó el archivo escrito, no se atribuyó la diferencia al contenido.
- Embeddings locales: SHA-256 `1301927cb27a8caa22bbeddab11f95948dafcd6b8c8cfacb73702646ddb1a19b`, distinto de la referencia `d5fef425…bad44a4`. El proceso se detuvo antes de escribir al detectar la diferencia.
- Investigación: forma 76×768 y normas entre 0,99999994 y 1,00000012. Para los 21 fragmentos cuyo texto coincide con el índice previo, diferencia máxima por componente de `6,5632e-9` y similitud coseno mínima de aproximadamente `0,99999994`.

La comparación es compatible con diferencias numéricas de ejecución, pero **no prueba igualdad binaria con el artefacto de Diery ni explica definitivamente su causa**. Se registró un manifiesto local distinto y se continuó exclusivamente como ensayo aislado. No se sustituye el hash de referencia de Diery ni se acepta automáticamente esta variante para actualizar el piloto.

## Reemplazo transaccional

| Comprobación | Resultado |
|---|---|
| Restauración frente al origen | Misma instantánea de 76 filas |
| Dry-run | Misma instantánea de filas/textos/hashes/vectores tras rollback |
| Aplicación aislada | 55 hashes antiguos retirados, 55 nuevos; 76 finales |
| Conjunto final | Exactamente los hashes esperados del extractor actual |
| Replay | Misma instantánea final; sin filas duplicadas |
| Otras fuentes | Comparación sin cambios; el respaldo solo contenía este manual, por lo que aquí no hay otra fuente real que ejercitar. La prueba con otra fuente sintética está en #182 |
| Índice activo del piloto | Misma huella antes y después: `d00aa311e9fa38401d00f48db1d75ffeec96879595848896084021f3f17db73e` |

El dry-run puede consumir números de secuencia, conforme al comportamiento documentado; la comparación acredita filas, no una restauración de secuencias.

## Recuperación antes y después

`top_k=5` fragmentos y umbral `0.807566308073`. Páginas físicas del PDF, en orden de recuperación:

| Pregunta exacta | Antes | Después |
|---|---|---|
| `Cuál es la duración de la gestación de los cuyes?` | 28, 80, 85, 26, 12 | 28, 25, 26, 85, 80 |
| `¿Cuál es la duración de la gestación de los cuyes?` | 28, 85, 26, 80, 25 | 28, 85, 26, 25, 80 |
| `¿Por qué los cuyes necesitan vitamina C en su alimentación?` | 31, 28, 85, 32, 12 | 31, 28, 85, 32, 12 |
| `¿Cómo configuro una impresora Wi-Fi?` | Sin resultados sobre el umbral | Sin resultados sobre el umbral |

Las listas reproducen las del informe de Diery para las preguntas completas. El extractivo de gestación sigue empezando por identificación individual de la página 28; la información de duración aparece en otras fuentes. Vitamina C empieza por digestión/cecotrofia de la página 31 y contiene información nutricional de la 32, pero esto no acredita una explicación del «por qué». La impresora devuelve «No encontré información en los manuales.» y fuentes vacías. Las respuestas completas y puntuaciones se conservaron en el reporte privado; no se copian fragmentos del corpus a Git.

## Validación 17/10/3 en PostgreSQL

Se ejecutó `run_config_app_evaluation` sobre las preguntas versionadas con los mismos vectores de consulta, top_k y umbral antes/después. Sin diagnósticos de cortes adicionales ni recalibración:

| Métrica | Antes | Después |
|---|---:|---:|
| hit@1 | 0,8235 | 0,8235 |
| hit@3 | 0,8824 | 0,8824 |
| hit@5 | 0,9412 | 0,9412 |
| MRR | 0,8578 | 0,8676 |
| Abstención válidas | 0/17 | 0/17 |
| Abstención fuera de corpus | 7/10 | 7/10 |
| Abstención en dominio sin respuesta | 0/3 | 0/3 |

No hay regresión en estas métricas agregadas, pero persisten las respuestas no pertinentes y las limitaciones del conjunto. No se cambia ninguna etiqueta ni se presenta este ensayo como validación experta.

## Conservación y siguiente decisión

Se conservaron respaldo, artefactos, versiones del entorno y reporte privado de la corrida. Se eliminó la base aislada al cerrar el ensayo, tras volver a comprobar la huella del índice activo; también se retiraron el archivo de conexión con el DSN y los scripts temporales. No se modificaron bases de animales, corpus activo, metadatos `corpus_catalogo`, servicios, perfiles ni dispositivos. No se ejecutaron suites o builds de aplicación nuevos; esta entrega registra una ejecución real del pipeline y solo cambia documentación.

Antes de actualizar el piloto corresponde revisar con Diery la variante numérica del artefacto y la pertinencia pendiente. Si se acuerda aplicar la mejora de extracción manteniendo esas limitaciones, utilizar el [procedimiento de reemplazo](../operacion/reindexacion-rag-documento.md), su respaldo y destino autorizados, y después verificar HTTP y pantallas. Esta evidencia **no autoriza ni ejecuta la actualización del piloto** ni una promoción de datos de animales.
