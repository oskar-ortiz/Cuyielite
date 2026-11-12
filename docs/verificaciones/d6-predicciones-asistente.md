# D6: predicciones y asistente en Trabajo

Estado: **implementado y verificado en pruebas y build web**. La verificación en ejecución nativa Windows/Android queda **pendiente**: el entorno no completó el build/recorrido por presión de memoria.

Rama: `feat/client-predicciones-asistente-d6`, apilada sobre `feat/backend-ml-rag-d5b` (D5b aún no está en `dev`; ver PR de consolidación #123).

## Predicciones

- Ruta `/trabajo/animales/:animalId/predicciones`, accesible desde la ficha del animal.
- Aplicabilidad local por sexo `H` y estado `ACTIVO`; el servidor vuelve a comprobar sexo y supervivencia.
- Dos formularios: reproductora (partos, abortos, fecha, peso de monta) y candidata (NUPAR, TCNV, pesos, días, ojos).
- Campos vacíos se omiten: NULL no se convierte en cero ni en fecha.
- Resultado: clase de reglas, motivos, calidad, fecha sugerida informativa, rango de peso. `REVISAR` se muestra como datos insuficientes; no confirma salud.
- `apoyo_modelo` se muestra en bloque separado; si es `null`, se informa ausencia sin inventar probabilidades ni tratarlo como error.
- No modifica estado, `categoria_ml` ni alertas.
- Animal local no publicado: 404 se explica como pendiente de publicación; no se presenta una predicción central como evaluación de cambios locales.

## Asistente

- Ruta `/trabajo/asistente`, con token, pregunta, `top_k`, respuesta y fuentes.
- Consume solo `{respuesta, fuentes}`; renderiza texto plano (React escapa HTML) y no genera citas.
- La pregunta permanece ante error; 401/503/422 y red tienen mensajes distintos; no simula éxito.
- Token solo en memoria (estado del componente), sin persistencia.

## Transporte

- Android: `CapacitorHttp` contra loopback fijo, redirecciones deshabilitadas.
- Electron: métodos nuevos y acotados del plugin `SyncLab` (`predictHembra`, `predictCandidata`, `assistantQuery`) con rutas fijas; el renderer no elige URL ni método.
- Respuestas tardías se descartan con un contador de petición; no hay envíos duplicados mientras `busy`.

## Pruebas

```
npx vitest run src/pages/PrediccionesAnimal.test.tsx src/pages/AsistenteTrabajo.test.tsx
→ 6 passed
npx tsc --noEmit → 0
```

- Predicciones: REVISAR + apoyo `null`, explicación de 404 local, no consulta sin token, mapeo de errores 401/503/red.
- Asistente: respuesta y fuentes, HTML no ejecutado, mapeo de errores, no envío sin token.

La suite completa, el build y el lint que D6 dejó pendientes se ejecutaron en D7 con workers limitados: 36 archivos/188 pruebas, build OK y lint OK. La ejecución nativa de la app sigue pendiente (detalle en `integracion-plataforma-d7.md`).

## Límites

- **Ejecución nativa pendiente** (Windows empaquetado y Android): exige backend D5b en ejecución, token de laboratorio y animal sintético publicado; no completada por el entorno.
- RAG real no ejecutado; los casos usan dobles.
- Sin persistencia de predicciones/alertas ni cambios de estado productivo.
- La rama depende de D5b: primero #123 a `dev`, luego este PR.
