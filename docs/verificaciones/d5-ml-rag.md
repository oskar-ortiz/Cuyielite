# D5: endpoints ML y asistente RAG

Estado: **D5a y D5b implementados y verificados con dobles y funciones ML reales**. La persistencia de predicciones/categoría/alerta sigue **pendiente de política** y no forma parte de esta entrega.

Rama: `feat/backend-ml-rag-d5`, desde `dev` con D4 integrado.

## Endpoints

| Ruta | Auth | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| `POST /ml/predict/hembra` | Bearer de laboratorio | `cuy_id`, `partos_acumulados`, `abortos`, `fecha_ultimo_parto`, `peso_monta_g`, `hembra_muerta` | `cuy_id`, `clase`, `motivos`, `estado_calidad`, `fecha_descarte_sugerida`, `peso_monta_en_rango_900_1000` |
| `POST /ml/predict/candidata` | Bearer de laboratorio | `cuy_id`, `nupar_madre`, `tcnv`, `peso_nacimiento_g`, `peso_destete_g`, `dias_destete`, `peso_monta_g`, `ojos` | `cuy_id`, `clase`, `motivos`, `estado_calidad`, `apoyo_modelo` |
| `POST /assistant/query` | Bearer de laboratorio | `pregunta` (3–500), `top_k` (1–20) | `respuesta`, `fuentes` |

- El ámbito sale del token (`sync_devices`); nunca del cuerpo.
- El servidor consulta `cuyes.sexo` y `cuyes.estado` por `id + scope_id`. Un animal inexistente o de otro ámbito responde el mismo `404 ANIMAL_NO_ENCONTRADO`.
- No se aceptan campos extra; los booleanos no valen como números; pesos deben ser positivos; `ojos` solo `1/Negro` o `2/Rojo`.
- `NULL` se conserva como ausencia: no se convierte en cero abortos, hembra viva ni fecha conocida.
- `hembra_muerta` solo puede ser `false`/ausente; declarar `true` contradice el registro central y responde `422`.

## Datos y aplicabilidad

Variables del cuerpo: las que el modelo recibe y que no tienen columna central equivalente (`partos_acumulados`, `abortos`, `nupar_madre`, `tcnv`, pesos, días, ojos). No se derivan fórmulas zootécnicas ni se interpreta ausencia de filas como cero.

Del servidor: identidad/ámbito, existencia, sexo, estado y borrado lógico.

Supervivencia: `estado='ACTIVO'` → viva; `MUERTO/MUERTA/FALLECIDO/FALLECIDA` → muerta; cualquier otro valor o `NULL` → desconocida. Desconocida responde `422 DATOS_INSUFICIENTES` y no invoca la función.

Clase principal: siempre la de reglas. `apoyo_modelo` es opcional; sin artefacto configurado (`CUYIELITE_RF_MODEL_PATH`) es `null`; un artefacto configurado pero ausente/defectuoso es fallo interno, no ausencia.

## Errores

| Situación | HTTP |
| --- | --- |
| Token ausente/inválido | 401 |
| Animal inexistente o ajeno | 404 `ANIMAL_NO_ENCONTRADO` |
| Entrada inválida (tipo, rango, ojos, extra) | 422 de Pydantic |
| Sexo/estado desconocido | 422 `DATOS_INSUFICIENTES` |
| Sexo no hembra o hembra muerta | 422 `NO_APLICA` |
| Modelo/RAG no disponible | 503 `ML_NO_DISPONIBLE` / `RAG_NO_DISPONIBLE` |
| Salida inválida o fallo interno | 503 `ML_FALLO_INTERNO` |

No se convierte un `ValueError` interno en 422. La validación de entrada ocurre en los schemas.

## RAG

El adaptador `consultar_asistente` llama a `rag.src.retrieve.consultar` de forma perezosa y devuelve exclusivamente `{respuesta, fuentes}`; descarta `modo` y `citas`. Conserva abstención (`fuentes: []`) y valida tipos. Sin `RAG_DATABASE_URL` o embeddings, responde indisponible; no simula respuestas.

## Verificación

```powershell
python -m pytest backend/tests/test_ml_adapters.py backend/tests/test_ml_endpoints.py -q
# 17 passed

python -m pytest backend tools/db_migrate/tests -q   # con PostgreSQL temporal aislado
# 124 passed (antes de añadir test_ml_adapters; ver nota)
```

- Funciones ML reales: `test_real_rule_functions_are_used_by_the_adapter` invoca `predecir_hembra` y `predecir_candidata` entregadas por Diery (sin doble) y comprueba clase/motivos/apoyo nulo.
- Endpoints: dobles de autenticación, animal y modelo; cubren 401, 404 indistinguible, sexo/estado desconocido, no aplicable, contradicción de muerte, NULL, extra/bool/ojos inválidos, calidad preservada, salida inválida, indisponibilidad y DTO RAG exacto con abstención.
- RAG real **no ejecutado**: requiere `RAG_DATABASE_URL`, embeddings E5 y datos indexados; no están configurados en este entorno. La evidencia RAG es con respuestas controladas.
- Sin escrituras: los endpoints solo leen `cuyes` y llaman funciones puras; no actualizan `categoria_ml`, estados ni alertas.

## Pendientes

- Persistencia de `categoria_ml`, alertas y código/identidad de episodio: sin política aprobada de calidad, idempotencia y deduplicación. No se implementó.
- Exposición de versión/hash del modelo RF: no forma parte del objeto actual.
- Ejecución del pipeline RAG real y del artefacto RF real en este entorno.
- Autorización de producción/rotación sigue siendo de laboratorio.
