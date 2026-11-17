# Handoff técnico para Oskar

Este handoff describe contratos y estado para integrar ML y RAG. No implementa
rutas HTTP ni cambia `backend/`, `docs/` o el DDL. La rama `origin/dev` ya
contiene las funciones de predicción (`365123a`) y su integración de servicio
(`3831cfd`); el PR #87 ya no es la referencia pendiente de integración.

## Estado de entrega RF — bloqueado para carga

- El SHA-256 observado localmente para
  `ml/models/candidate_random_forest_b.joblib` es
  `744349c43b4781dc5acef88e3db9dd6522d7b76c26a3f91e82d578792d6adce9`.
  El artefacto está ignorado por Git; no se deserializó ni se ejecutó.
- `ml/models/metadata.json` no contiene `artifact_file` ni `model_sha256`.
  `load_verified_model` rechaza el artefacto con `RF_MODEL_SHA256_MISSING`;
  por tanto, el cargador evita usar un modelo cuya identidad no esté registrada.
  No agregarle el hash observado como atajo: todavía no se ha probado qué
  entrenamiento y métricas corresponden a esos bytes.
- Protocolo en metadata: `RepeatedStratifiedKFold`, 5 pliegues × 3 repeticiones,
  con `StratifiedKFold` interno de 3 pliegues y sin agrupación por animal.
  `ml/reports/informe_metricas.md` afirma `StratifiedGroupKFold` y reporta
  cifras distintas en su tabla principal de B. El informe actualizado conserva
  ambos resultados como no reconciliados, no selecciona uno.
- Metadata registra 805 filas elegibles, 805 sin identidad animal utilizable,
  cero duplicados retirados y cero IDs duplicados entre fuentes. Estos ceros
  no prueban ausencia de duplicados cuando no hay identidad utilizable. Las
  versiones registradas son Python 3.14.3 y scikit-learn 1.9.1; faltan las
  versiones exactas de NumPy, pandas y joblib.
- No atribuir métricas al artefacto ni activarlo en el servicio hasta recibir
  evidencia reproducible que vincule checksum del dataset, código, protocolo,
  entorno completo, validación por animal y modelo final. No se debe reentrenar
  con datos reales sin ámbito autorizado y respaldo verificable.

## 1. PredictionService y funciones ML

### Importación y contratos

```python
from ml.prediccion import predecir_candidata, predecir_hembra
```

`ml/prediccion.py` en `dev` define `predecir_hembra(datos: DatosHembra) ->
PrediccionHembra` y `predecir_candidata(datos: DatosCandidata, *,
modelo: ModeloCandidata | None = None) -> PrediccionCandidata`.

| Función | Campos de entrada opcionales | Salida |
|---|---|---|
| `predecir_hembra` | `partos_acumulados`, `abortos`, `peso_monta_g`, `fecha_ultimo_parto`, `hembra_muerta`, `estado_calidad` | `clase` (`NORMAL`/`DESCARTE`), `motivos`, `estado_calidad`, `fecha_descarte_sugerida` (fecha ISO o `null`), `peso_monta_en_rango_900_1000` (boolean o `null`) |
| `predecir_candidata` | `nupar_madre`, `tcnv`, `peso_nacimiento_g`, `peso_destete_g`, `dias_destete`, `peso_monta_g`, `ojos`, `estado_calidad` | `clase` (`ELITE`/`NORMAL`), `motivos`, `estado_calidad`, `apoyo_modelo` (objeto o `null`) |

Las cantidades son enteros no negativos; los pesos son números positivos.
`ojos` acepta `1`/`Negro` o `2`/`Rojo`. Para confirmar `ELITE`, las reglas
también exigen destete a los 15 días y empadre entre 900 y 1000 g. Si faltan
datos, la función devuelve `NORMAL` con `REVISAR`; eso no acredita salud
clínica. Una hembra muerta, una candidata que no sea hembra o valores inválidos
producen `ValueError`.

Ejemplo de uso local:

```python
hembra = predecir_hembra({
    "partos_acumulados": 4,
    "abortos": 0,
    "fecha_ultimo_parto": "2026-01-15",
})

candidata = predecir_candidata({
    "nupar_madre": 2,
    "tcnv": 3,
    "peso_nacimiento_g": 135,
    "peso_destete_g": 270,
    "dias_destete": 15,
    "peso_monta_g": 950,
    "ojos": "1",
})
```

### Carga opcional del Random Forest

```python
from ml.model.artifact import load_verified_model

modelo = load_verified_model()
resultado = predecir_candidata(payload, modelo=modelo)
```

Configurar `CUYIELITE_RF_MODEL_PATH` para seleccionar un artefacto y, si
corresponde, `CUYIELITE_RF_METADATA_PATH` para seleccionar metadata. Sin ruta de
modelo, el cargador devuelve `None`; con ruta configurada, valida SHA-256 antes
de deserializar y falla explícitamente si falta metadata o el hash no coincide.
Con la metadata actualmente entregada, el servicio no debe cargar el artefacto.
Cuando se disponga de una entrega reconciliada, el archivo puede generarse con
`python -m ml.model.train` en el entorno autorizado y fuera de Git. Si se carga,
`apoyo_modelo` es apoyo exploratorio, no sustituye ni altera la clase de reglas;
el modelo B usa predictores de nacimiento y no acredita requisitos posteriores
de destete y empadre.

### Ejemplos HTTP propuestos

Los siguientes contratos ilustran el mapeo del payload a las funciones; no
afirman que las rutas estén implementadas. El identificador de persistencia
`cuy_id` pertenece al servicio/API, no a los `TypedDict` de las funciones.

`POST /ml/predict/hembra`:

```json
{
  "cuy_id": "UUID-de-la-hembra",
  "partos_acumulados": 4,
  "abortos": 0,
  "fecha_ultimo_parto": "2026-01-15",
  "peso_monta_g": 950
}
```

Respuesta de ejemplo:

```json
{
  "cuy_id": "UUID-de-la-hembra",
  "clase": "DESCARTE",
  "motivos": ["ciclo completo"],
  "estado_calidad": "CONFIRMADO",
  "fecha_descarte_sugerida": "2026-02-04",
  "peso_monta_en_rango_900_1000": true
}
```

`POST /ml/predict/candidata`:

```json
{
  "cuy_id": "UUID-de-la-cria",
  "nupar_madre": 2,
  "tcnv": 3,
  "peso_nacimiento_g": 135,
  "peso_destete_g": 270,
  "dias_destete": 15,
  "peso_monta_g": 950,
  "ojos": "1"
}
```

Respuesta de ejemplo sin artefacto ML:

```json
{
  "cuy_id": "UUID-de-la-cria",
  "clase": "ELITE",
  "motivos": ["cumple todos los criterios ELITE"],
  "estado_calidad": "CONFIRMADO",
  "apoyo_modelo": null
}
```

La API debe convertir los errores de validación a respuestas HTTP de cliente
coherentes; el código de estado y el envelope de error no quedan definidos por
`ml.prediccion.py`.

## 2. Alerta por DESCARTE

`db/ddl/central/003_alertas.sql` define `alertas` con estos campos:

| Campo | Tratamiento según DDL |
|---|---|
| `cuy_id` | Obligatorio; UUID del cuy asociado. |
| `tipo_alerta` | Obligatorio (`VARCHAR(50)`); el DDL no fija el valor enumerado. Acordar un código, por ejemplo `DESCARTE_REPRODUCTORA`. |
| `severidad` | Opcional; por defecto `MEDIA`. |
| `atendida` | Opcional; por defecto `false`. |
| `id`, `created_at`, `updated_at` | Tienen valores predeterminados en el DDL. |
| `synced_at`, `deleted_at` | Opcionales para control de sincronización/borrado lógico. |

La tabla no tiene columnas para `motivos`, clase del modelo ni probabilidades.
No se deben insertar esos valores en una columna inventada; decidir si bastan
los campos actuales o si se requiere una decisión de esquema posterior. La
escritura automática de la alerta queda fuera de este PR.

## 3. `POST /assistant/query` y RAG

El pipeline local se importa así:

```python
from rag.src.retrieve import consultar

resultado = consultar(pregunta, top_k=5)
```

El request de la sección 10 de `docs/CuyiElite_Arquitectura_Tecnica.md`
contiene `pregunta` (3–500 caracteres) y `top_k` (1–20, predeterminado 5).
El response documentado es `{"respuesta": "...", "fuentes": [...]}`. La
implementación actual de `consultar` también entrega `modo` y `citas`; acordar
si el endpoint expone esos campos adicionales o filtra la respuesta al DTO de
la sección 10. Las fuentes se expresan como `documento, p. N`.

Configuración:

- `RAG_DATABASE_URL`: PostgreSQL central con pgvector y esquema aplicado.
- `RAG_EMBEDDING_MODEL`: opcional; modelo E5, por defecto
  `intfloat/multilingual-e5-base` (768 dimensiones).
- `RAG_MIN_SIMILARITY`: umbral semántico, por defecto `0.807566308073`.
- `LLM_PROVIDER`: `none` por defecto o `ollama`.
- `OLLAMA_URL`: por defecto `http://localhost:11434`.
- `OLLAMA_MODEL`: por defecto `qwen2.5:7b-instruct`.
- `LLM_TIMEOUT_S`: por defecto `60`.
- `LLM_TEMPERATURE`: por defecto `0.1`.

Con `LLM_PROVIDER=ollama`, la generación usa `/api/chat` con `stream=false`.
Si no hay fragmentos sobre el umbral, se abstiene sin llamar a Ollama. Si el
proveedor se desactiva o falla, usa la respuesta extractiva con citas. Los
índices de cita que no correspondan a fragmentos recuperados se eliminan. La
salida RAG no se envía a APIs externas.

## 4. Textos de SQLite que requieren actualización documental

No se editaron estos documentos. En `dev` se encontraron las siguientes
afirmaciones obsoletas o parcialmente obsoletas:

| Archivo y línea | Texto actual |
|---|---|
| `README.md:16` | “El DDL del esquema local en SQLite queda pendiente de diseño con Diery.” |
| `docs/CuyiElite_Arquitectura_Tecnica.md:55` | “Pendiente de diseño con Diery (no decidido en esta actualización):”, seguido por el punto de esquema/DDL SQLite. |
| `docs/CuyiElite_Arquitectura_Tecnica.md:188` | “El DDL de SQLite y su mapeo con el esquema central quedan pendientes de diseño con Diery (ADR 0002, numeral 0).” |
| `docs/CuyiElite_Arquitectura_Tecnica.md:239` | Afirma que la implementación física SQLite y su mapeo central están “pendiente[s] de diseño con Diery”. |
| `docs/CuyiElite_Arquitectura_Tecnica.md:460` | “El DDL de SQLite queda pendiente de diseño con Diery.” |
| `docs/CuyiElite_Arquitectura_Tecnica.md:484` | “... el DDL de SQLite queda pendiente de diseño con Diery.” |
| `docs/CuyiElite_Seccion3_Metodologia_Investigacion.md:54` | “El DDL del esquema SQLite y su mapeo con el esquema central quedan pendientes de diseño con Diery.” |
| `docs/CuyiElite_Seccion4_Analisis_Diseno_Software.md:15` | “El DDL del esquema SQLite queda pendiente de diseño con Diery.” |

Texto de reemplazo propuesto, ajustando la frase al contexto:

> El DDL local de SQLite está disponible en `db/ddl/local/001_sqlite.sql`.
> La base central continúa en PostgreSQL + pgvector. El mapeo de campos y la
> equivalencia funcional entre ambos esquemas deben describirse según las
> verificaciones vigentes; no presentar el DDL local como aún no diseñado.

`AGENTS.md` no contiene la frase “DDL SQLite pendiente”, pero sí dos datos
locales obsoletos: línea 16, “Persistencia local: PostgreSQL (administrada con
DBeaver)”; línea 107, “DDL PostgreSQL central/local”. Propuesta: cambiar la
primera por “Persistencia local: SQLite (Android/Windows)” y la segunda por
“DDL PostgreSQL central y SQLite local; control delta y seeds solo sintéticos”.
No se modificó `AGENTS.md`.

## 5. Decisiones pendientes con Oskar

1. **Autoridad de clasificación de candidatas:** el Informe de Roles asigna el
   entrenamiento/evaluación del Random Forest al servicio de clasificación
   (`docs/CuyiElite_Informe_Roles_y_Responsabilidades.md:52`); el contrato de
   `ml/prediccion.py` deja las reglas como autoridad y el RF como apoyo
   opcional. Confirmar qué versión se defenderá. La línea citada no explicita
   la clase candidata; precisar esa afirmación en la revisión.
2. **ADR 0004:** pendiente la revisión y aceptación final de Oskar, aunque el
   instructor validó las reglas. En particular, el descarte por dos abortos
   sigue identificado como propuesta.
3. **ADR 0005:** aceptada por Diery y pendiente de revisión de Oskar.
4. **CI:** confirmar workflows y checks requeridos para ML y RAG antes de
   integrar.

## Referencias consultadas

- `ml/prediccion.py` (firmas `predecir_hembra` y `predecir_candidata`) y
  `ml/README.md` (ejemplos, tipos y límites), presentes en `dev`.
- `db/ddl/central/003_alertas.sql`.
- `rag/src/retrieve.py`, `rag/src/generate.py` y el contrato de la sección 10
  de `docs/CuyiElite_Arquitectura_Tecnica.md`.
- `rag/README.md` y ADR 0006 para configuración y respaldo extractivo.
