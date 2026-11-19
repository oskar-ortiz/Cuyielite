# Actualización del índice RAG del piloto

Fecha: 2026-11-18 (America/Bogota). Base de código: `a0bd811`, con #182–#185 integrados. Actualización autorizada por Oskar después del ensayo aislado. Alcance: índice de `produccion_cuyes.pdf` en `cuyielite_rag`; sin promoción de registros del dominio.

## Respaldo, aplicación y procedencia

Se verificaron de nuevo el PDF y la extracción contra el artefacto del [ensayo aislado](rag-reindexacion-aislada.md). PDF SHA-256 `c33392cb1422bfe50b0f44ccfcc2917888b4aa9b0329830d2b13db3a289a91ea`; texto de 76 fragmentos SHA-256 `bd1acac99bbd6c4af588d847ca9abe3c6c2b2aa51dfa9d960994f897b21b680f`.

Se generó un respaldo nuevo mediante `pg_dump -Fc` dentro del contenedor y copia binaria: 409.358 bytes, SHA-256 `ad63682b02b00e6693d0f3912b78a478c275f397d81fd70db515ea42210b44cb`. Se restauró con `pg_restore` en una base temporal y se comprobó igualdad de instantánea y 9 migraciones antes de aplicar al piloto. La base temporal se eliminó.

Se reutilizaron los vectores E5 reales calculados en el ensayo: `intfloat/multilingual-e5-base`, 768 dimensiones, artefacto local SHA-256 `1301927cb27a8caa22bbeddab11f95948dafcd6b8c8cfacb73702646ddb1a19b`. Su diferencia binaria y comparación numérica con la referencia están documentadas en el ensayo; no se presenta como el mismo binario de Diery. Un adaptador comprobó la igualdad exacta del conjunto de textos antes de entregar esos vectores al indexador real.

El dry-run sobre el destino activo conservó filas y catálogo. Se aplicó `index_chunks(..., replace_document=True)` dentro de una transacción exterior que añadió también una nota de procedencia en `corpus_catalogo`, conservando los datos de autoría y licencia existentes. No se modificó el indexador ni se recalcularon pasajes en cada replay.

| Control | Resultado |
|---|---|
| Fragmentos iniciales/finales | 76 / 76 |
| Hashes antiguos sustituidos | 55 |
| Replay | Misma instantánea, sin duplicados |
| Otras fuentes | Sin cambios; el índice solo contenía esta fuente |
| Instantánea anterior | `d00aa311e9fa38401d00f48db1d75ffeec96879595848896084021f3f17db73e` |
| Instantánea final | `c43fc14978677050c74adcb9ae2627df17be86d5532ea556cbea48fbba5538e3` |

Los respaldos, vectores y reportes completos permanecen fuera de Git bajo `%LOCALAPPDATA%\CuyiElite\piloto-local\`. Registro privado: `reportes/actualizacion-rag-20261118-195441-2857ca/`. No se versionan credenciales, PDF ni resultados privados completos.

## Comprobación HTTP real

API del piloto en `127.0.0.1:8000`, sesión de consulta obtenida por login normal y cerrada al terminar. Cuatro peticiones consecutivas a `POST /assistant/query`, `top_k=5`, umbral conservado `0.807566308073`, E5 base y generación extractiva. DTO exacto `{respuesta, fuentes}` en los cuatro casos. Sin token: **401**. Logout: **200**.

| Pregunta exacta | HTTP | Páginas físicas devueltas, en orden |
|---|---|---|
| `Cuál es la duración de la gestación de los cuyes?` | 200 | 28, 25, 26, 85, 80 |
| `¿Cuál es la duración de la gestación de los cuyes?` | 200 | 28, 85, 26, 25, 80 |
| `¿Por qué los cuyes necesitan vitamina C en su alimentación?` | 200 | 31, 28, 85, 32, 12 |
| `¿Cómo configuro una impresora Wi-Fi?` | 200 | Ninguna; abstención |

Primera petición: 25,08 s con carga inicial de E5. Siguientes: 0,29 / 0,24 / 0,21 s. Son observaciones puntuales, no un ensayo de rendimiento. Las fuentes corresponden al manual. El DTO no expone puntuaciones; no se atribuyen puntuaciones a estas peticiones HTTP.

## Límites y siguiente comprobación

**Actualización y transporte HTTP comprobados; pertinencia todavía pendiente.** Gestación sigue comenzando con fragmentos de otros temas y vitamina C no constituye una explicación experta del porqué. No se ajustó el umbral ni se declara que las citas prueben una respuesta correcta. La evaluación 17/10/3 y sus límites permanecen en el ensayo anterior.

Windows y Android **no se recorrieron en esta actualización**. Pixel estaba cerrado; Oskar solicitó continuar la comprobación mediante OpenCode, primero Windows y después Android, con ayuda manual si es necesaria. No se reutiliza HTTP como evidencia de pantalla. No hay cambios del cliente que obliguen por sí mismos a reconstruirlo.

No hubo cambios de código ni suites/builds nuevos. La verificación consistió en respaldo restaurado, aserciones del indexador real y llamadas HTTP al piloto. El backend quedó disponible para el recorrido. No se promovieron animales reales ni se alteraron ámbitos, cursores o recibos de dispositivos.
