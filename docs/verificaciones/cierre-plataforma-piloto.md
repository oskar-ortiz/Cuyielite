# Cierre del frente de plataforma del piloto (2026-11-17)

Base: `origin/dev` `e1725c6` (PR #166 fusionado). Rama `fix/plataforma-rag-rf-cierre`. Estado: **plataforma cerrada en lo verificable; calidad RAG, aprobación documental y carga real siguen pendientes con responsables concretos**. La visualización nativa del RF quedó cubierta después en los PR #168 y #169; los responsables y requisitos actualizados están en `docs/verificaciones/matriz-carga-real-lope.md`.

## Matriz final de criterios

| Criterio | Estado | Evidencia / responsable |
|---|---|---|
| RAG: pregunta exacta, sesión/ámbito, DTO sin alterar | **APROBADO** | Cuatro `POST /assistant/query` consecutivos con la misma pregunta inicial y una intercalada; DTO `{respuesta, fuentes}` en todos; `/auth/me` devuelve `scope_id Centro Lope`, rol admin; 401 sin token y con token inválido |
| RAG: sin resultados mezclados ni respuestas tardías | **APROBADO (código + HTTP)** | `AsistenteTrabajo.tsx` usa `requestRef` y `busy`, limpia resultado/error al enviar; la pregunta se captura en el cierre de la petición; no se observó mezcla en las cuatro consultas |
| RAG: estados carga/error/indisponibilidad/reintento/abstención | **APROBADO (UI Windows y HTTP)** | `Busy` → «Consultando…», `assistantErrorMessage` por 401/422/503/red, botón se rehabilita; impresora Wi-Fi → abstención con `fuentes: []` |
| RAG: #166 activo y embedder reutilizado | **APROBADO** | Tras reiniciar el backend y vaciar el log, cuatro consultas produjeron **una sola carga** de `SentenceTransformer`; `pytest rag`: 39 passed, 1 skipped |
| RAG: estabilidad del backend y plazos nativos | **APROBADO con límite** | Cuatro consultas consecutivas sin 503; Android `readTimeout=120000` para `/assistant/query`, Electron `AbortSignal.timeout(120000)`. Baja memoria sigue siendo riesgo del entorno, no defecto de código demostrado |
| RAG: pertinencia de gestación y vitamina C | **BLOQUEADO — Diery** | Handoff reproducible en `docs/integracion/handoff-diery-pertinencia-rag.md`: commit, configuración, pregunta exacta, `top_k=5`, fuentes/páginas, contenido verificado del PDF y criterio de re-verificación |
| RF: hash antes de deserializar y loader real | **APROBADO** | SHA-256 `744349c4…d578792d6adce9` coincide con metadata; sin configuración → `None`; hash modificado → `RF_MODEL_SHA256_MISMATCH` sin `joblib.load`; 32 pruebas de cargador/endpoints en verde |
| RF: endpoints sobre laboratorio aislado | **APROBADO** | Base `cuyielite_rf_lab`, dos animales publicados por D1; `ELITE/CONFIRMADO` con apoyo; `NORMAL/REVISAR` sin apoyo; `DESCARTE` por cuarto parto; viewer 200; sin token 401 |
| RF: visualización Windows/Android | **COMPLETADO después de este snapshot** (PR #168 y #169) | Cinco casos observados en UI real en ambas plataformas; detalle y capturas en `docs/verificaciones/rf-visualizacion-nativa.md` |
| Documentación Lope v1.0-propuesta | **REVISADO, aprobación pendiente — Oskar** | Hashes y commit en `docs/verificaciones/revision-entrega-diery-final.md`; borrador no enviado; acuerdos de diseño conservados |
| Carga real | **PREPARADA, no ejecutada** | 3.428 decisiones `PENDIENTE`, hashes intactos, 11/10 celdas `#VALUE!` visibles, ámbito y rol ETL existentes, respaldo/restauración comprobados; faltan revisor, aceptaciones, dry-run revisado y autorización |
| Android: sesión, sync, RAG y viewer | **APROBADO (PR #165)** | Recorrido observado; no repetido sin cambios que lo justifiquen |
| Android: cifrado tras reapertura | **NO VERIFICADO** | La reapertura observada no acredita por sí sola una nueva revisión del cifrado; RF nativo ya quedó cubierto en `docs/verificaciones/rf-visualizacion-nativa.md` |
| Backend caído / recuperación sin pérdida de outbox | **PROCEDIMIENTO LISTO** | `tools/piloto/servidor.py status/start` + `adb reverse`; guion en `docs/operacion/piloto-local.md` §9 |

## Acciones manuales pendientes (una por vez)

Las acciones manuales del bloque RF que figuraban aquí se ejecutaron y corroboraron en los PR #168 y #169; el detalle está en `docs/verificaciones/rf-visualizacion-nativa.md`. Como comprobación de conexión sigue siendo válido:

1. `python -m tools.piloto.servidor status`; si `/health` no responde, `python -m tools.piloto.servidor start`.
2. `adb reverse --list`; si falta, `adb reverse tcp:8000 tcp:8000`.

Los pendientes humanos actualizados están en `docs/verificaciones/matriz-carga-real-lope.md`.

## Insumos para el informe / tesis

- La integración HTTP del RAG y la estabilidad del embedder están verificadas; la **pertinencia** de dos respuestas no está resuelta y no debe presentarse como logro cerrado.
- El RF real se integró en backend con trazabilidad de hash y límites científicos explícitos; su visualización nativa quedó comprobada en ambas plataformas, con el detalle en `docs/verificaciones/rf-visualizacion-nativa.md`.
- La carga real no se ejecutó: el bloqueo es humano y documental, no técnico.
- Los acuerdos de diseño están revisados; la aprobación documental no ha sido emitida por Oskar sobre la versión con hashes registrada.

## Versiones

`origin/dev` `e1725c6`; corpus `c33392cb…a289a91ea` (76 fragmentos, 768 dims); artefacto RF `744349c4…d578792d6adce9`; migraciones 0001–0009 aplicadas; ámbito Centro Lope identificado solo en el handoff privado.


