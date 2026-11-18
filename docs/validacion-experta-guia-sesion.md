# Guía de sesión ciega de validación experta

## Estado

- **Documento de trabajo.** No sustituye `ml/validacion_experta/README.md`, no modifica reglas, modelo ni etiquetas y no autoriza el uso de datos reales.
- **Decisiones pendientes antes de ejecutar:** tamaño de muestra, experto(s)/instructor(es), facilitador, autorización de datos y fecha. Mientras falten, la sesión no se ejecuta.
- **No confundir con D11:** esta sesión valida la clasificación de candidatas; no es la designación del revisor técnico de correspondencias de datos.

## Roles

| Rol | Persona o entidad | Estado |
|---|---|---|
| Experto/instructor que clasifica | **POR DEFINIR** | Debe conocer el criterio acordado y no ver predicciones ni reglas aplicadas |
| Facilitador | **POR DEFINIR** | Prepara el CSV ciego, controla el tiempo y no responde preguntas de clasificación |
| Evaluador | **POR DEFINIR** | Ejecuta `ml.validacion_experta.evaluate` en un entorno autorizado |
| Testigo o apoyo | Opcional; **POR DEFINIR** | Verifica que no se filtren predicciones, reglas o métricas |
| Autorización de datos | **POR DEFINIR** | Debe existir antes de usar registros reales |

- Se requiere al menos un experto. Si hay más de uno, cada experto completa una copia independiente del mismo CSV; el evaluador actual se ejecuta una vez por archivo y no combina etiquetas. La comparación entre expertos queda **POR DEFINIR** y no se reporta como si el evaluador la calculara.
- Si el experto es la misma persona que definió las reglas del ADR 0004, se debe declarar: el resultado mide **consistencia con ese criterio**, no una validación clínica independiente.

## Tamaño de muestra

- **n total: POR DEFINIR.**
- No se fija aquí un número (20, 30, 100 u otro). El equipo debe acordarlo antes de la sesión y justificarlo; no se promete potencia estadística sin ese cálculo.
- El marco muestral, la forma de selección y el tratamiento de filas incompletas también están **POR DEFINIR**.
- Reglas mínimas:
  - Seleccionar registros de candidatas, no de reproductoras.
  - No seleccionar por clase predicha, por probabilidad del modelo ni por facilidad del caso.
  - No duplicar registros entre lotes.
  - Documentar cuántos registros se entregaron, cuántos se completaron y cuántos se excluyeron.
- Si no hay `n` acordado, la sesión no se ejecuta.

## Cegamiento

El experto recibe **solo** estas columnas, en el orden exacto de la plantilla:

| Columna | Contenido visible |
|---|---|
| `id_anonimo` | Identificador aleatorio; no debe permitir reconstruir el animal |
| `nupar_madre` | Número de parto de la madre |
| `tcnv` | Nacidos vivos |
| `peso_nacimiento_g` | Peso al nacimiento en gramos |
| `peso_destete_g` | Peso al destete en gramos |
| `dias_destete` | Días al destete |
| `peso_monta_g` | Peso al empadre en gramos |
| `ojos` | `1`/`Negro` o `2`/`Rojo` |
| `clasificacion_experta` | Vacía para que el experto escriba `ELITE` o `NORMAL` |

- No se entregan `clase`, `apoyo_modelo`, `motivos`, `estado_calidad`, probabilidades, reglas aplicadas ni métricas.
- El archivo entregado no incluye la tabla de correspondencias entre `id_anonimo` y el animal. Esa tabla la conserva el responsable autorizado fuera de Git.
- Las filas se barajan; no se agrupan por clase, por archivo ni por resultado del modelo.
- El facilitador no confirma ni corrige clasificaciones durante la sesión.

## Criterio de clasificación

- La sesión es para crías hembra candidatas. La plantilla solo admite `ELITE` o `NORMAL`; `DESCARTE` no es una salida válida en este archivo.
- Si el equipo adopta el ADR 0004 como criterio de referencia, el experto debe recibir ese criterio antes de clasificar:
  - `ELITE`: NUPAR de la madre 2 o 3; TCNV 3 o 4; peso al nacer ≥135 g; peso al destete ≥2× el peso al nacer a los 15 días; ojos negros; peso al empadre 900–1000 g (ideal 950 g).
  - `NORMAL`: no cumple todos los criterios de `ELITE`.
- Si el experto aplica un criterio propio, debe quedar declarado antes de la sesión. No se cambia el criterio a mitad de la sesión.
- Si un registro no es una candidata, está incompleto o el experto no puede decidir, se deja la celda vacía. Esa fila se retira antes de ejecutar el evaluador; no se imputa ni se fuerza una clase.
- El evaluador solo acepta `ELITE` o `NORMAL` en mayúsculas y rechaza filas incompletas, IDs vacíos o repetidos y campos numéricos inválidos.

## Antes de la sesión

1. **Autorización:** confirmar que el uso de los registros está autorizado y que no se publicarán datos reales, IDs, pesos ni resultados individuales en Git.
2. **Marco muestral:** definir el `n`, la selección y el lote; dejar registro agregado fuera de Git.
3. **Anonimización:** sustituir identificadores por `id_anonimo` aleatorios; no incluir la tabla de correspondencias en el archivo del experto.
4. **Plantilla:** usar la cabecera exacta de `ml/validacion_experta/plantilla.csv`; no añadir columnas.
5. **Limpieza:** retirar filas incompletas antes de entregar; no imputar valores.
6. **Barajado:** mezclar el orden de las filas y conservar el orden fuera de Git si hace falta para auditoría.
7. **Modelo y reglas:** confirmar la versión de reglas y el hash del modelo en `metadata.json`; no cargar un modelo no verificado.
8. **Ensayo:** probar el evaluador con datos sintéticos y la plantilla vacía; no usar el ensayo para reportar resultados reales.
9. **Materiales:** CSV ciego, guía impresa, temporizador, hoja de incidencias y canal autorizado para devolver el archivo.

## Durante la sesión

| Momento | Actividad |
|---|---|
| 0–10 min | Bienvenida, propósito, consentimiento y reglas de cegamiento |
| 10–20 min | Explicar los campos y el criterio; aclarar que no hay respuestas correctas ni feedback |
| 20–70 min | Clasificación individual; el experto llena `clasificacion_experta` o deja vacío si no puede decidir |
| 70–85 min | Revisión de completitud; el facilitador no corrige clases, solo detecta celdas vacías o valores inválidos |
| 85–90 min | Cierre, recogida del CSV y registro de incidencias; no comentar predicciones ni métricas |

**Guion breve del facilitador:**

- «Usted verá solo datos anonimizados de candidatas. No verá la predicción del sistema ni las reglas aplicadas.»
- «Clasifique cada registro como `ELITE` o `NORMAL` según el criterio acordado. Si no puede decidir, deje la celda vacía; no adivine.»
- «No hay devolución ni discusión de resultados durante la sesión.»
- «Al terminar, entregue el archivo; el análisis se hace después y solo se reporta agregado.»

## Después de la sesión

1. Verificar que el CSV conserva la cabecera exacta y que no tiene IDs repetidos.
2. Retirar las filas sin `clasificacion_experta`; informar cuántas se retiraron.
3. Confirmar que el modelo y las reglas son las versiones autorizadas.
4. Ejecutar el evaluador con rutas fuera de Git:

```powershell
$env:CUYIELITE_RF_MODEL_PATH = "RUTA_AUTORIZADA\candidate_random_forest_b.joblib"
$env:CUYIELITE_RF_METADATA_PATH = "RUTA_AUTORIZADA\metadata.json"
.\.venv\Scripts\python.exe -m ml.validacion_experta.evaluate `
  "RUTA_AUTORIZADA\validacion_experta.csv" `
  --output "RUTA_AUTORIZADA\acuerdo_agregado.json"
```

5. Guardar solo el reporte agregado y el acta de sesión. No publicar el CSV, la tabla de correspondencias, IDs, pesos ni etiquetas por fila.
6. Reportar `n`, exactitud, kappa de Cohen, precisión/recall/F1 por clase y matrices de confusión para reglas-experto y RF-experto.
7. No cambiar reglas, modelo, umbral ni etiquetas a partir de esta sesión. Cualquier cambio se propone y se revisa por separado.

## Interpretación

- El reporte es descriptivo. No demuestra validez clínica, representatividad de la población ni superioridad del RF.
- No se fija un umbral de kappa o exactitud para «aprobar» el modelo. Si el equipo quiere uno, debe acordarlo antes de ver los resultados.
- Si el experto es el autor de las reglas, el acuerdo mide consistencia con su criterio; no es una validación independiente.
- Si el `n` es pequeño o las clases están desbalanceadas, la precisión por clase y kappa pueden ser inestables; se reporta esa limitación.
- Las filas vacías no son errores del experto: son casos sin decisión y se excluyen del cálculo, informando cuántas fueron.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El experto ve predicciones o reglas | CSV solo con campos de entrada; testigo opcional; no abrir la app ni el modelo durante la sesión |
| Se filtra la identidad | `id_anonimo` aleatorio; correspondencias fuera del archivo y de Git |
| Selección sesgada | Marco muestral definido antes; no seleccionar por predicción ni por facilidad |
| El experto copia las reglas | Declarar el criterio; si es el ADR 0004, reportar que se mide consistencia, no independencia |
| Fatiga o prisa | Sesión de 90 min como referencia; pausas y `n` acordado |
| Varios expertos con etiquetas combinadas | Un archivo por experto; no combinar sin una regla explícita |
| Filas incompletas | Dejar vacío, retirar antes de evaluar y reportar el conteo |
| Publicación accidental | CSV y correspondencias fuera de Git; solo reporte agregado |
| Modelo no autorizado | Verificar `metadata.json` y `CUYIELITE_RF_MODEL_PATH` antes de ejecutar |
| Datos reales sin autorización | No iniciar la sesión hasta tener la autorización registrada |

## Lista de verificación

**Antes**
- [ ] `n` definido y justificado.
- [ ] Experto(s)/instructor(es) designados; rol y conflicto de interés declarados.
- [ ] Facilitador y evaluador designados.
- [ ] Autorización de uso de datos registrada.
- [ ] CSV con cabecera exacta y sin columnas extra.
- [ ] IDs anónimos, únicos y sin correspondencia en el archivo.
- [ ] Filas barajadas y sin datos incompletos.
- [ ] Reglas y hash del modelo autorizados.
- [ ] Ensayo con datos sintéticos completado.

**Durante**
- [ ] No se muestran predicciones, reglas ni métricas.
- [ ] El experto clasifica sin ayuda del facilitador.
- [ ] Las celdas sin decisión quedan vacías.
- [ ] Se registran incidencias sin datos personales.

**Después**
- [ ] CSV completo y con IDs únicos.
- [ ] Filas vacías retiradas y contadas.
- [ ] Evaluador ejecutado con el modelo verificado.
- [ ] Reporte agregado guardado fuera de Git.
- [ ] No se publicaron filas, IDs, pesos ni etiquetas individuales.
- [ ] No se modificaron reglas, modelo, umbral ni etiquetas.

## Pendientes explícitos

- **Tamaño de muestra: POR DEFINIR.**
- **Experto(s)/instructor(es): POR DEFINIR.**
- **Facilitador y evaluador: POR DEFINIR.**
- **Marco muestral y fecha: POR DEFINIR.**
- **Autorización de datos: POR DEFINIR.**
- **Umbral de aceptación del acuerdo: POR DEFINIR; si se usa, fijarlo antes de ver resultados.**
- **Comparación entre varios expertos: POR DEFINIR; el evaluador actual no la calcula.**
