# Contrato de servicios ML y RAG

Estado: **DOCUMENTO ACTUALIZADO CON DIERY (2026-11-10)**. Las funciones ML y el pipeline RAG existen; sus rutas FastAPI todavía no. Diery precisó la semántica de predicción y el DTO RAG. Autorización, persistencia idempotente y detalles HTTP señalados siguen siendo diseño de plataforma para D5, no código implementado.

Base examinada: `origin/dev` `8496b29`. Fuentes: [predicción ML](../../ml/prediccion.py), [handoff de Diery](../../ml/handoff/PARA_OSKAR.md), [reglas](../../ml/rules/), [metadatos](../../ml/models/metadata.json), [recuperación RAG](../../rag/src/retrieve.py), [generación RAG](../../rag/src/generate.py), [README RAG](../../rag/README.md), [ADR 0004](../decisiones/0004-criterio-elite-normal-descarte.md), [ADR 0005](../decisiones/0005-modelo-embeddings-rag.md) y [ADR 0006](../decisiones/0006-llm-generacion-rag.md).

El handoff conserva una referencia histórica al PR #87 pendiente. La función se verificó en esta base; esa frase no demuestra que siga ausente. No se atribuye una revisión de estos documentos todavía locales a Diery.

## 1. Contratos definidos y trabajo de plataforma

| Tema | Definición recibida de Diery | Pendiente de Oskar |
| --- | --- | --- |
| Reproductora | `/ml/predict/hembra`: NORMAL/DESCARTE, motivos, calidad, fecha sugerida y peso de monta en rango | Endpoint, autorización y acceso al animal |
| Candidata | `/ml/predict/candidata`: ELITE/NORMAL de reglas, motivos, calidad y apoyo opcional del RF | Adaptador HTTP sin cambiar reglas |
| Faltantes | NORMAL + calidad con REVISAR; no acredita salud ni criterios completos | Preservar faltantes y resolver persistencia de resultados incompletos |
| RF | Exploratorio, probabilidades no calibradas; nunca cambia clase ni motivos de reglas | Carga opcional, errores internos y trazabilidad del artefacto |
| RAG | HTTP solo `{respuesta, fuentes}`; `modo`/`citas` internos | Adaptación, validación, acceso y errores |
| Persistencia ML | Diery solicita `cuyes.categoria_ml` y alerta para DESCARTE | Transacción, publicación, idempotencia y política de calidad |
| Alertas | Código sugerido DESCARTE_REPRODUCTORA, MEDIA, atendida=false | Confirmar código, deduplicación y lectura/sync; no viajan automáticamente con cuyes |

No se añaden `modo_clasificacion`, `clase_confirmada`, rutas alternativas ni una clase principal tomada del RF. Nacimiento y clasificación completa se distinguen por información disponible, calidad y apoyo del modelo, respetando las funciones entregadas.

## 2. Convenciones de integración propuestas

- **Identidad/ámbito:** reutilizar autenticación de laboratorio; ámbito derivado de identidad, nunca del body. Producción/rotación no están definidas. Animal inexistente o fuera de ámbito responde 404 sin revelar registros ajenos.
- **Fuente de datos:** el servidor carga el animal autorizado. Los ejemplos con variables reflejan el handoff; congelar en D5a cuáles puede aportar el cliente, cuáles son centrales y cómo detectar versiones obsoletas. No persistir como resultado central una simulación con valores no verificados.
- **Procedencia:** la calcula el servidor, no se acepta una declaración del cliente como evidencia. Un campo HTTP adicional de procedencia sería una extensión pendiente, no salida actual de las funciones.
- **Faltantes:** no convertir NULL en cero abortos, supervivencia o fecha. Pesos en gramos; validar finitud, positividad y precisión al adaptar el decimal de dominio al número ML. Fechas civiles `YYYY-MM-DD`.
- **Aplicabilidad:** validar sexo/estado del registro real antes de inferir. `predecir_candidata` fija internamente sexo hembra, por lo que no demuestra el sexo del animal. `predecir_hembra` usa falso si falta `hembra_muerta`; no heredar ese default para datos desconocidos.
- **Calidad:** conservar el valor devuelto, incluidas etiquetas combinadas con REVISAR. NORMAL con revisión no es diagnóstico ni confirmación de aptitud. No inventar CONFIRMADO si la función devuelve otra calidad.
- **Offline:** Android/Windows muestran datos locales pero no ejecutan ML/RAG. Mostrar indisponibilidad y conservar entradas para reintento.

Si sexo o supervivencia son desconocidos, la plataforma informa datos insuficientes y no invoca una función que suponga hembra viva. La forma HTTP se congela en D5a. Esto no cambia NORMAL+REVISAR para variables predictivas faltantes de un animal cuya aplicabilidad sí se confirmó.

## 3. POST /ml/predict/hembra

Entrada ilustrativa del handoff con UUID sintético. Cero y false son datos explícitos, no defaults:

```json
{
  "cuy_id": "77777777-7777-4777-8777-777777777777",
  "partos_acumulados": 4,
  "abortos": 0,
  "fecha_ultimo_parto": "2026-01-15",
  "peso_monta_g": 950,
  "hembra_muerta": false
}
```

El backend autoriza el UUID, valida reproductora hembra viva y no permite que el body contradiga evidencia central de muerte/sexo. Cantidades enteras no negativas, pesos positivos finitos y fechas válidas o NULL. No añadir abortos=0 por omisión.

La función devuelve `clase`, `motivos`, `estado_calidad`, `fecha_descarte_sugerida` y `peso_monta_en_rango_900_1000`. La API puede asociar el UUID solicitado, pero cualquier envelope adicional se define en D5a. Ejemplo sintético de **resultado de función** con faltantes, no evidencia de una ejecución:

```json
{
  "clase": "NORMAL",
  "motivos": ["clase por defecto NORMAL; datos insuficientes"],
  "estado_calidad": "REVISAR",
  "fecha_descarte_sugerida": null,
  "peso_monta_en_rango_900_1000": null
}
```

Los motivos y las etiquetas reales proceden de las reglas de Diery. No duplicar reglas/umbrales en el controller. La fecha sugerida no agenda ni ejecuta un descarte. Animal muerto/no aplicable o valores inválidos son errores de dominio del cliente, no una predicción HTTP exitosa NO_APLICA.

## 4. POST /ml/predict/candidata

Una sola ruta integra `predecir_candidata(datos, modelo=opcional)`. Las reglas usan nacimiento y también destete/monta para confirmar ELITE; el RF puede estimar temprano con cuatro variables de nacimiento. La estimación siempre queda dentro de `apoyo_modelo`.

Entrada sintética completa:

```json
{
  "cuy_id": "88888888-8888-4888-8888-888888888888",
  "nupar_madre": 2,
  "tcnv": 3,
  "peso_nacimiento_g": 135,
  "peso_destete_g": 270,
  "dias_destete": 15,
  "peso_monta_g": 950,
  "ojos": "1"
}
```

Entrada sintética al nacimiento, usando la misma ruta:

```json
{
  "cuy_id": "88888888-8888-4888-8888-888888888888",
  "nupar_madre": 2,
  "tcnv": 3,
  "peso_nacimiento_g": 135,
  "ojos": "1"
}
```

Validar UUID/ámbito, animal hembra aplicable, cantidades enteras ≥0, pesos finitos >0 y ojos `1`/`Negro` o `2`/`Rojo`. Un código desconocido se conserva en dominio, pero no se normaliza silenciosamente para inferir. No aceptar booleanos como números.

Ejemplo sintético de **resultado de función** con faltantes de destete/monta y RF opcional que estima ELITE:

```json
{
  "clase": "NORMAL",
  "motivos": ["dato faltante: dias_destete", "dato faltante: peso_monta_g"],
  "estado_calidad": "REVISAR",
  "apoyo_modelo": {
    "clase": "ELITE",
    "probabilidades": { "ELITE": 0.72, "NORMAL": 0.28 }
  }
}
```

El ejemplo no acredita métricas del modelo real. La clase principal sigue siendo la de reglas. La UI muestra «requiere revisión» y apoyo exploratorio no calibrado. El objeto actual de apoyo solo contiene clase/probabilidades; no añadir versión/hash como si ya existieran.

Sin artefacto o sin las variables requeridas por el RF, `apoyo_modelo=null`; esto no impide responder con reglas. Validar salida del modelo: forma, clases, finitud, rango y suma. Artefacto y datos de entrenamiento fuera de Git. El servidor registra la versión/hash del modelo; exponerlos en HTTP, si se requiere, es una extensión por acordar.

## 5. POST /assistant/query

Diery confirma el DTO HTTP congelado de Arquitectura §10: **solo respuesta y fuentes**. Modo/citas permanecen internos a `consultar()`. El adaptador selecciona los dos campos; no serializa toda la salida.

Request ilustrativo; límites de pregunta/top_k se congelan en D5a:

```json
{
  "pregunta": "Que temperatura se recomienda para un galpon de cuyes",
  "top_k": 5
}
```

Response HTTP:

```json
{
  "respuesta": "Ejemplo sintetico: el manual ficticio describe condiciones de alojamiento.",
  "fuentes": ["manual-sintetico-cuyes.pdf, p. 12"]
}
```

Respuesta y fuente ficticias, sin evidencia de recuperación real. Preservar la estructura de fuentes del DTO acordado y contrastarla con el pipeline al implementar; no inventar referencias.

- Abstención por falta de evidencia: HTTP 200, texto de abstención y fuentes que entregue el pipeline; no añadir modo.
- Respaldo extractivo si falla el generador: conservar respuesta/fuentes válidas y registrar modo internamente.
- Recuperación, base o embeddings no disponibles: error de servicio, no respuesta simulada sin evidencia.
- Offline: asistente no disponible, pregunta conservada para reintento.

La UI consume texto/fuentes. Si necesita abstención tipada, requiere una futura extensión del DTO; no deducirla buscando palabras en respuesta.

## 6. Errores de validación frente a fallo del servicio

Propuesta HTTP para D5a:

| Caso | Respuesta | Garantía |
| --- | --- | --- |
| Token ausente/inválido, permiso insuficiente | 401/403 según auth existente | Sin inferencia/escritura |
| Animal inexistente/fuera de ámbito | 404 | Sin revelar registros ajenos |
| Tipo, rango, sexo/estado no aplicable o entrada inválida | 422 con código/campos | No convertir inválidos en NORMAL |
| Variables predictivas faltantes, animal aplicable | 200, NORMAL + REVISAR según función | Sin inventar ceros ni salud |
| Ausencia de RF opcional | 200, reglas y apoyo null | Ausencia prevista no es fallo |
| Fallo inesperado/modelo con salida inválida | 5xx controlado; 503 para indisponibilidad temporal | No culpar al usuario con 422 |
| RAG sin evidencia suficiente | 200, abstención en DTO de dos campos | Sin fuentes inventadas |

`ml.prediccion` usa ValueError tanto para entrada inválida como para clases/probabilidades inválidas del modelo. **No convertir cualquier ValueError en 4xx.** Validar entradas antes de inferir y distinguir la fase del fallo o acordar excepciones tipadas; no comparar mensajes. HTTP no expone rutas, secretos ni traceback.

El envelope de error y el comportamiento ante fallo RF durante inferencia se congelan en D5a. Ausencia de artefacto ya está definida; un artefacto defectuoso no es lo mismo. No escribir una recomendación exitosa a partir de una ejecución fallida.

## 7. Persistencia solicitada y condiciones de habilitación

Diery solicita persistir la **clase de reglas** en `cuyes.categoria_ml` y crear alerta para reproductora con DESCARTE: tipo propuesto `DESCARTE_REPRODUCTORA`, severidad MEDIA, atendida=false. No está implementado.

1. Es recomendación, no descarte ejecutado ni cambio automático de estado productivo.
2. `categoria_ml` es del servidor. Cambio efectivo incrementa versión y se publica en la misma transacción; no-op no genera delta. RF no escribe categoría.
3. `alertas` no tiene columnas para motivos/probabilidades: solo respuesta HTTP, sin inventar columnas. La categoría aislada tampoco conserva calidad/procedencia.
4. Pendiente para NORMAL+REVISAR: se propone responder sin reemplazar silenciosamente una categoría confirmada ni crear alerta. Congelar con Diery en D5a antes de habilitar esa escritura.
5. La API que escriba necesita idempotencia durable: misma clave/input/versiones devuelve el resultado original sin reinferir ni duplicar alertas; misma clave con otro contenido se rechaza. Almacenamiento/esquema pendiente; no reutilizar recibos de sync sin definir semántica.
6. Definir además deduplicación de alertas ante solicitudes distintas que repiten DESCARTE del mismo episodio. Idempotencia de un request no cubre ese caso. No activar alertas automáticas sin esa regla.
7. Ejecutar inferencia costosa fuera del bloqueo de publicación; al guardar, comprobar versiones de los datos usados. Si cambiaron, no persistir predicción obsoleta: reintentar o informar conflicto según contrato D5.
8. Categoría, alerta y registro idempotente confirman o revierten juntos. Reutilizar las primitivas D1; fallo antes del COMMIT revierte publicación/escritura.

**Visibilidad local:** ámbito/versión de cuyes permite transportar categoria_ml en su snapshot. No publica filas de alertas, motivos ni probabilidades. Alertas requieren contrato de consulta o sync propio, autorización, migración local si aplica y UI. Esa entrega debe planificarse explícitamente; no es un efecto automático de Entrega E.

## 8. Responsables y secuencia

| Actividad | Diery | Oskar |
| --- | --- | --- |
| Reglas, motivos, calidad y RF | Define, evalúa, entrega | Adapta sin duplicar |
| RAG, corpus, embeddings y evaluación | Define, entrega | Expone DTO y protege acceso |
| HTTP, autorización, ámbito y datos centrales | Revisa semántica | Implementa |
| Persistencia/versiones/publicación | Acuerda política | Implementa transacción |
| Pruebas | Aporta casos de dominio | Contratos, aislamiento, regresión |

- **D5a:** schemas/adaptadores sintéticos; concretar inputs, errores, procedencia y persistencia/idempotencia. No entrenar ni cambiar reglas/modelos.
- **D5b:** endpoints después de D1 (ámbito/acceso a cuyes), D5a y publicación compatible. Sin acceso real antes de resolver autorización/política.
- **D6:** predicciones en ficha del animal y sección Asistente; distinguir recomendación/acción, faltantes/RF y offline. Alertas solo cuando su lectura/sync esté implementada.

## 9. Pendientes concretos

- Variables HTTP centrales o del cliente y procedencia/versiones verificables.
- Sexo/supervivencia desconocidos, errores HTTP y fallo interno del modelo.
- Persistencia NORMAL+REVISAR, código de alerta, identidad de episodio y almacenamiento idempotente.
- Consulta/sync de alertas, sin bloquear D1 por esta ampliación futura.
- Metadatos de modelo expuestos si se requieren, como extensión explícita.

Ya definidos: dos rutas ML, reglas autoritativas, RF opcional no calibrado, NORMAL+REVISAR ante faltantes y RAG HTTP de dos campos. No repetir preguntas sobre clase nula, RF obligatorio o cuatro campos RAG.

## 10. Verificación prevista

Pruebas de ámbito, sexo real frente al supuesto interno, muerte/estado desconocido, NULL frente a cero, inválidos, ausencia de RF, fallo de modelo distinto de 4xx, calidad preservada, DTO RAG exacto, reintento sin duplicados y rollback de escritura/publicación. Los ejemplos de este documento son sintácticos y sintéticos; no acreditan endpoints ejecutados.
