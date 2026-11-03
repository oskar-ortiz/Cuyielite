# 3. METODOLOGÍA Y DISEÑO DE LA INVESTIGACIÓN

## 3.1 Tipo, Enfoque y Diseño de la Investigación

### 3.1.1 Tipo de Investigación

El presente Trabajo de Grado se enmarca dentro de la **investigación aplicada de carácter tecnológico**, en tanto su propósito no es la generación de conocimiento teórico per se, sino la solución de un problema práctico y concreto —la elevada mortalidad y la ineficiencia en la toma de decisiones reproductivas en la producción cuyícola— mediante el diseño, desarrollo y validación de un artefacto tecnológico (el sistema CuyiElite).

### 3.1.2 Enfoque de la Investigación

Se adopta un **enfoque mixto (cualitativo-cuantitativo)**, justificado de la siguiente manera:

- **Componente cualitativo:** orientado a caracterizar la experiencia de usuario, los flujos operativos del galpón y el nivel de aceptación de la herramienta digital por parte de los técnicos de campo, mediante técnicas de indagación no numérica (entrevistas, observación participativa).
- **Componente cuantitativo:** orientado a medir variables zootécnicas objetivas (tasas de mortalidad, pesos, conversión alimenticia, tamaño de camada) y métricas de rendimiento del software (latencia, tasa de éxito de sincronización delta, precisión del modelo predictivo), susceptibles de tratamiento estadístico.

La integración de ambos componentes permite no solo determinar *si* el sistema funciona técnicamente, sino *cómo* es apropiado por su usuario final en condiciones reales de producción rural.

### 3.1.3 Diseño de la Investigación

El diseño corresponde a una investigación **no experimental, de campo y de corte transversal con seguimiento longitudinal acotado**:

- **No experimental:** no se manipulan deliberadamente las variables zootécnicas de los animales; estas se observan y registran en su ambiente natural de producción.
- **De campo:** la recolección de información y la validación del prototipo se realizan directamente en las instalaciones del Centro Agropecuario Lope del SENA, y no en un entorno simulado o de laboratorio.
- **Transversal con seguimiento longitudinal acotado:** si bien la caracterización inicial y la evaluación de usabilidad se realizan en puntos específicos del tiempo (naturaleza transversal), el registro de variables productivas (partos, pesajes, mortalidad) se efectúa de manera continua durante el periodo de validación del prototipo, permitiendo observar tendencias, aunque sin la extensión temporal de un estudio longitudinal completo.

---

## 3.2 Técnicas e Instrumentos de Recolección de Información

### 3.2.1 Instrumentos Cualitativos

1. **Entrevistas semiestructuradas:** dirigidas a los instructores zootecnistas y personal técnico del Centro Agropecuario Lope (SENA), orientadas a diagnosticar las limitaciones del registro en papel, formalizar los requerimientos funcionales y validar las reglas de negocio del sistema.
2. **Observación directa y participativa:** visitas técnicas a los galpones de producción para mapear la dinámica de trabajo diaria (pesaje, destete, empadre y control sanitario) y caracterizar las restricciones físicas y climáticas del entorno rural que justifican el diseño offline-first.
3. **Revisión documental sistemática:** análisis de literatura científica, parámetros zootécnicos normativos y proyectos antecedentes, empleado para estructurar la base de conocimientos que alimenta el motor RAG y para definir las variables predictoras del modelo de clasificación.

### 3.2.2 Instrumentos Cuantitativos

4. **Instrumentos de medición automatizada del software:**
   - Registros de logs (`logs`) generados por el `SyncWorker`, empleados para calcular la tasa de éxito de sincronización delta y la latencia promedio de sincronización bajo distintas condiciones de conectividad.
   - Matriz de confusión y métricas de precisión, exhaustividad (*recall*) y puntaje F1 (`scikit-learn.metrics`), empleadas para evaluar el desempeño del modelo Random Forest frente a la clasificación experta realizada por el personal zootecnista del SENA (criterio de referencia o *ground truth*).
   - Escala de usabilidad **System Usability Scale (SUS)**, aplicada a los técnicos de campo posterior al uso del prototipo, para obtener una medida cuantitativa estandarizada de la percepción de usabilidad de la aplicación móvil.

### 3.2.3 Validez y Confiabilidad de los Instrumentos

La validez de contenido del guion de entrevista y del formulario de caracterización de requisitos se garantiza mediante **juicio de expertos**, constituido por los asesores del proyecto (Ing. Cristian Camilo Ordoñez Quintero y Mangin Luis Montenegro). La confiabilidad de los instrumentos de medición automatizada se garantiza mediante la repetibilidad de las pruebas: cada métrica de rendimiento del software (latencia, tasa de sincronización) se calcula sobre múltiples ejecuciones bajo condiciones de conectividad controladas, reportando medidas de tendencia central y dispersión en lugar de mediciones puntuales aisladas.

---

## 3.3 Fases de la Investigación Aplicada al Ciclo de Desarrollo XP

**Nota metodológica importante:** las fases descritas a continuación no constituyen una secuencia lineal única de tipo cascada, sino un **macro-ciclo que se repite en cada iteración de desarrollo** conforme a la metodología Extreme Programming (XP) detallada en el numeral de Metodología de Desarrollo de Software de este documento. En cada iteración se recorren las cuatro fases —a escala reducida y sobre un alcance funcional acotado—, permitiendo el refinamiento progresivo de los requisitos, el modelo de datos y los algoritmos de inteligencia artificial conforme avanza la validación en campo. La retroalimentación obtenida en la Fase 4 de una iteración constituye, a su vez, insumo directo para la Fase 1 de la iteración siguiente (rol de "cliente en sitio").

- **Fase 1 — Diagnóstico y Levantamiento de Requisitos (Exploración y Planning Game):** levantamiento de información en el Centro Lope, caracterización de la línea base operativa y traducción de necesidades en Historias de Usuario. Se formalizan Requisitos Funcionales (RF) y No Funcionales (RNF), enfatizando la restricción de conectividad intermitente como requisito no funcional crítico del sistema.
- **Fase 2 — Diseño Arquitectónico y Modelamiento de Datos (Diseño Simple):** especificación de la arquitectura cliente-servidor offline-first. Se modela el esquema relacional en PostgreSQL central y el esquema local en SQLite para el cliente (conforme a la ADR 0002, que sustituye la elección anterior de PostgreSQL local), la estructura de la API RESTful en FastAPI con arquitectura en capas, y el algoritmo de resolución de conflictos Last Write Wins (LWW). El DDL del esquema SQLite y su mapeo con el esquema central quedan pendientes de diseño con Diery.
- **Fase 3 — Construcción e Integración Tecnológica (Sprints de Desarrollo XP):** desarrollo de la aplicación multiplataforma con **Ionic + React**, empaquetada mediante Capacitor para su distribución en Android y Windows Desktop, el panel web administrativo y los servicios centralizados en Python (FastAPI). Integración de la cola de sincronización delta (`SyncWorker`) contra la base local SQLite del dispositivo, el motor de clasificación de hembras reproductoras (`PredictionService`/Random Forest) y la búsqueda vectorial (`pgvector`) para el módulo RAG sobre la base central.
- **Fase 4 — Validación Estructural y Pruebas en Campo (Aceptación del Cliente):** despliegue en entorno de pruebas controlado dentro del Centro Lope. Ejecución de pruebas unitarias (`pytest`), validación de usabilidad offline-online mediante el instrumento SUS, y verificación de la precisión del motor analítico frente al criterio experto zootécnico (RF-31). Los hallazgos de esta fase retroalimentan directamente el backlog de historias de usuario de la siguiente iteración.

Para el detalle completo de las prácticas técnicas de XP (Pair Programming, TDD, Integración Continua, roles del equipo), remitirse al numeral de Metodología de Desarrollo de Software de este documento.

---

## 3.4 Población y Muestra

### 3.4.1 Población

La población objetivo está constituida por las unidades de producción cuyícola del departamento de Nariño, tomando como centro de referencia técnico y experimental los galpones del Centro Agropecuario Lope del SENA en Pasto.

### 3.4.2 Muestra

Se aplica un **muestreo no probabilístico por conveniencia**, justificado por la disponibilidad de infraestructura técnica y la viabilidad operativa de realizar pruebas de campo controladas. La muestra piloto para la validación del prototipo está conformada por **tres (3) unidades de producción/operadores**, seleccionadas bajo los siguientes criterios:

- Representatividad en escalas de manejo (producción de pequeña y mediana escala).
- Diversidad en el nivel de alfabetización digital de los operadores, con el fin de evaluar la usabilidad del sistema bajo distintos grados de familiaridad tecnológica.
- Disponibilidad de un dispositivo móvil compatible (Android) para la instalación del prototipo.

### 3.4.3 Limitación de Validez Externa

Dado el carácter no probabilístico de la muestra y su concentración en un único centro experimental, los resultados obtenidos poseen **validez interna robusta para las condiciones evaluadas**, pero su generalización a otras unidades productivas del departamento debe interpretarse con cautela. La ampliación de la muestra a un espectro más amplio de productores, con condiciones de infraestructura y conectividad diversas, se plantea como línea de trabajo futuro posterior a la sustentación de este Trabajo de Grado.

---

## 3.5 Consideraciones Éticas

El desarrollo de la investigación observa los siguientes principios éticos:

- **Consentimiento informado:** los técnicos y operadores que participan en las pruebas de campo son informados previamente sobre el propósito del estudio, el uso de la información recolectada y su participación voluntaria, mediante un formato de consentimiento suscrito antes del inicio de la fase de validación.
- **Tratamiento de datos personales y productivos:** los datos productivos registrados (asociados a las unidades de producción participantes) se administran conforme a los principios de la **Ley 1581 de 2012 (Régimen General de Protección de Datos Personales — Habeas Data)**, garantizando confidencialidad, finalidad restringida al propósito académico e investigativo, y anonimización de la información en la presentación de resultados agregados.
- **Uso responsable de la información institucional:** los manuales zootécnicos del SENA empleados como corpus del motor RAG se utilizan exclusivamente con fines de indexación interna para consulta del propio sistema, respetando su carácter de material institucional del SENA.

---

## 3.6 Variables de Estudio

| Tipo de variable | Variable | Indicador / unidad de medida |
|---|---|---|
| Independiente | Implementación del sistema CuyiElite | Presencia/ausencia del sistema en la unidad de producción (variable categórica de intervención) |
| Dependiente (zootécnica) | Tasa de mortalidad de camada | Porcentaje de mortalidad respecto al Tamaño de Camada Nacida (TCN) |
| Dependiente (zootécnica) | Precisión en la categorización de hembras reproductoras | Porcentaje de coincidencia entre la clasificación del modelo Random Forest y el criterio experto zootécnico |
| Dependiente (operativa) | Tiempo de registro de datos en campo | Segundos promedio por registro (comparado con el registro tradicional en papel) |
| Dependiente (técnica) | Tasa de éxito de sincronización delta | Porcentaje de operaciones de sincronización completadas exitosamente sobre el total de intentos |
| Dependiente (técnica) | Latencia de sincronización | Milisegundos promedio entre la detección de conectividad y la confirmación de sincronización (`ack`) |
| Dependiente (percepción) | Usabilidad percibida | Puntaje obtenido mediante la escala System Usability Scale (SUS), rango 0–100 |

---

## 3.7 Procedimiento General de la Investigación

El desarrollo del proyecto sigue la siguiente secuencia macro, la cual enmarca —sin sustituir— el ciclo iterativo XP descrito en el numeral 3.3:

1. **Diagnóstico inicial:** aplicación de entrevistas y observación participativa en el Centro Lope para caracterizar la línea base operativa y las limitaciones del registro tradicional.
2. **Diseño del sistema:** definición de la arquitectura, el modelo de datos y los algoritmos de inteligencia artificial, en ciclos iterativos de refinamiento (numerales 3.3 y siguientes).
3. **Desarrollo incremental:** construcción del sistema por entregas funcionales pequeñas, validadas progresivamente.
4. **Validación en campo:** despliegue controlado en la muestra piloto, recolección de las variables definidas en el numeral 3.6 y aplicación del instrumento SUS.
5. **Análisis de resultados:** procesamiento estadístico de las variables cuantitativas y análisis temático de la información cualitativa recolectada, presentado en el capítulo de Resultados del presente documento.
6. **Conclusiones y líneas futuras:** síntesis de hallazgos y formulación de recomendaciones, incluyendo la limitación de validez externa señalada en el numeral 3.4.3.

---

## 3.8 Herramientas de Apoyo a la Investigación

Esta sección se limita a las herramientas empleadas específicamente para la **recolección, control y validación de datos de investigación**. Para el detalle completo del stack tecnológico del sistema CuyiElite (Ionic + React, Capacitor, FastAPI, SQLite local en Android y Windows, PostgreSQL + pgvector central, entre otros), remitirse al numeral de Arquitectura y Stack Tecnológico Oficial de este documento, incluyendo el numeral 0 y la ADR 0002, donde se detalla la actualización de stack (migración de React Native/Expo a Ionic + React, y definición de SQLite como base local tras la validación con el asesor).

| Herramienta | Propósito investigativo |
|---|---|
| Git y repositorio remoto (GitHub) | Trazabilidad de cambios sobre el sistema durante las iteraciones de validación, permitiendo asociar hallazgos de campo con versiones específicas del software |
| `pytest` | Instrumento de validación técnica de la confiabilidad del sistema antes de cada despliegue en campo |
| `scikit-learn.metrics` | Cálculo de las métricas de precisión del modelo predictivo frente al criterio experto (numeral 3.2.2) |
| Formularios de consentimiento informado y encuesta SUS | Recolección de datos de percepción de usabilidad (numerales 3.2.2 y 3.5) |

> **Nota de actualización del stack (ADR 0002):** el cliente migró de React Native/Expo a **Ionic + React** (empaquetado mediante Capacitor). La persistencia local se definió como **SQLite en Android y Windows**, manteniendo **PostgreSQL + pgvector** como base central. La recomendación inicial de usar PostgreSQL local se evaluó con el asesor y quedó sustituida por la ADR 0002; el numeral 0 del documento de Arquitectura y Stack Tecnológico Oficial conserva ese registro como historial. Queda pendiente el diseño del DDL SQLite y su mapeo con el esquema central (Diery), que condiciona el diseño de la persistencia offline-first y los instrumentos de medición de la tasa de sincronización delta (numeral 3.2.2).

---

*Sección elaborada como parte del Trabajo de Grado CuyiElite, Universidad Cooperativa de Colombia (UCC), Facultad de Ingeniería, Programa de Ingeniería de Software. Autores: Oskar Julián Ortiz Ortiz y Diery Alejandro Valencia Itacual. Asesores: Ing. Cristian Camilo Ordoñez Quintero y Mangin Luis Montenegro.*
