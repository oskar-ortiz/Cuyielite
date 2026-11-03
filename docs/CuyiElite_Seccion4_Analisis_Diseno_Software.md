# 4. ANÁLISIS Y DISEÑO DE SOFTWARE

## 4.1 Análisis de Software

El análisis de software se estructura como un ítem independiente por cada objetivo específico definido en el numeral 1.6.2, estableciendo qué requiere el sistema para cumplirlo y con qué componente, instrumento o mecanismo ya definido en este documento se satisface dicho requerimiento.

**Ítem 1 — Analizar los procesos actuales de registro y control técnico en los galpones de cuyes en el Centro Lope (SENA) para la detección de cuellos de botella en la recolección de datos.**

El análisis de este objetivo no requiere desarrollo de software, sino instrumentos de indagación aplicados directamente sobre el proceso productivo actual. Se identificó que el Centro Lope gestiona el seguimiento de sus 4 galpones mediante registros en papel y hojas de cálculo fragmentadas, lo cual impide un análisis oportuno de los datos y constituye el principal cuello de botella detectado. Este análisis se ejecuta mediante los instrumentos cualitativos definidos en el numeral 3.2.1 del documento de Metodología y Diseño de la Investigación: entrevistas semiestructuradas a instructores zootecnistas, observación directa y participativa en los galpones, y revisión documental de proyectos antecedentes (como el SAIPC Dashboard de la Universidad CESMAG). El resultado de este análisis constituye la línea base operativa frente a la cual se compararán los indicadores productivos en el objetivo 3.

**Ítem 2 — Desarrollar el sistema tecnológico CuyiElite, basado en una arquitectura de software y un modelo de datos que permitan la gestión de información productiva, el almacenamiento local y la sincronización con la nube, incorporando los componentes necesarios para la gestión y análisis de la producción.**

Este objetivo se traduce directamente en los requisitos funcionales y no funcionales que sustentan el diseño arquitectónico completo del sistema, ya especificado en el documento de Arquitectura y Stack Tecnológico Oficial:

- El **almacenamiento local** se resuelve mediante SQLite en Android y Windows (ADR 0002), condición necesaria para que el productor registre información aun sin conexión en el galpón. El DDL del esquema SQLite queda pendiente de diseño con Diery.
- La **sincronización con la nube** se resuelve mediante el mecanismo de sincronización delta asíncrona con resolución de conflictos Last Write Wins (LWW), documentado en el numeral 7 (Diagrama de Secuencia) del documento de arquitectura.
- La **gestión y análisis de la producción** se resuelve mediante el modelo de datos (DER, numeral 4) que registra galpones, pozas, cuyes, partos, pesajes, mortalidad y alertas, y mediante los dos componentes de inteligencia artificial: el módulo de clasificación Random Forest (numeral 8) que identifica hembras élite/normal/descarte, y el motor RAG (numeral 9) que responde consultas sobre los manuales zootécnicos del SENA.
- La **arquitectura de software** en su conjunto queda representada en los diagramas C4 Nivel 2 y Nivel 3 (numerales 2 y 3 del documento de arquitectura), y en el diagrama UML de contexto (Nivel 1) que se presenta a continuación en este numeral.

**Ítem 3 — Validar la usabilidad y funcionalidad del sistema mediante pruebas con productores reales del Centro Lope, comparando los indicadores productivos frente a la línea base.**

El análisis de este objetivo requiere, por un lado, un instrumento de medición de usabilidad, y por otro, un procedimiento de comparación de indicadores productivos. Ambos quedan resueltos así:

- La **validación de usabilidad** se ejecuta mediante la escala System Usability Scale (SUS), aplicada a la muestra piloto de tres unidades de producción (numeral 3.4.2), conforme al procedimiento detallado en el numeral 4.3 de esta sección.
- La **comparación de indicadores productivos frente a la línea base** retoma directamente los hallazgos del Ítem 1 (línea base operativa) y los contrasta contra las variables de estudio definidas en el numeral 3.6 del documento de Metodología de Investigación (tasa de mortalidad de camada, precisión de clasificación, tiempo de registro, entre otras), bajo el diseño no experimental de campo descrito en el numeral 3.1.3.

### Diagrama UML de Contexto

El siguiente diagrama representa el sistema CuyiElite como una unidad indivisible ("caja negra") frente a sus actores y sistemas externos, constituyendo el nivel más alto de abstracción de la arquitectura (antecede al C4 Nivel 2 presentado en el numeral 2 del documento de arquitectura).

**[Diagrama UML de Contexto disponible en Miro](https://miro.com/app/board/uXjVHhVmYTY=/?moveToWidget=3458764685309374857)**

El diagrama muestra tres actores/sistemas externos interactuando con CuyiElite:

- **Técnico de Campo:** registra datos productivos en campo bajo condición offline-first, y recibe de vuelta alertas y clasificaciones automáticas de las reproductoras.
- **Administrador / Investigador SENA:** consulta reportes e interactúa con el asistente en lenguaje natural, recibiendo indicadores productivos y respuestas contextualizadas.
- **Manuales Zootécnicos SENA:** sistema externo de tipo documental que alimenta, mediante indexación, la base de conocimiento del motor RAG.

---

## 4.2 Diseño de Software

### 4.2.1 Arquitectura de Software

Este subtítulo mapea cada objetivo específico del numeral 1.6.2 con el componente arquitectónico que lo materializa en el diseño del sistema, evidenciando trazabilidad completa entre los objetivos de la investigación y las decisiones de diseño de software.

| Objetivo específico | Componente(s) arquitectónico(s) que lo materializa | Referencia |
|---|---|---|
| **1.** Analizar los procesos actuales de registro y control técnico | No requiere componente de software; se resuelve mediante instrumentos de diagnóstico (entrevistas, observación) cuyo resultado alimenta el diseño de las Historias de Usuario de la Fase 1 del ciclo XP | Numeral 3.2.1 (Investigación) y numeral 1.4 (Metodología XP, Fase 1) |
| **2.** Desarrollar el sistema tecnológico CuyiElite (arquitectura, modelo de datos, almacenamiento local, sincronización, componentes de gestión y análisis) | Diagrama C4 Nivel 2 (contenedores), C4 Nivel 3 (componentes del backend), DER, DDL PostgreSQL central y esquema SQLite local (pendiente de diseño), diagrama de secuencia de sincronización LWW, módulo ML Random Forest, motor RAG, esquemas Pydantic v2 y endpoints FastAPI | Numerales 2 a 10 del documento de Arquitectura y Stack Tecnológico Oficial y ADR 0002 |
| **3.** Validar la usabilidad y funcionalidad del sistema | Instrumento SUS aplicado sobre la interfaz cliente (Ionic + React), y comparación de las variables de estudio (numeral 3.6) frente a la línea base del Ítem 1 | Numeral 4.3 de esta sección y numeral 3.4 (Investigación) |

La arquitectura de software, en consecuencia, no es un artefacto aislado: cada uno de sus componentes existe porque responde directamente a un objetivo específico formulado en el planteamiento del problema (numeral 1.6.2), y su validación (objetivo 3) cierra el ciclo demostrando si dicha arquitectura efectivamente optimiza el registro, la conversión alimenticia y la reducción de la mortalidad, conforme al objetivo general del proyecto (numeral 1.6.1).

---

## 4.3 Validación de Usabilidad

La validación de usabilidad del sistema CuyiElite se realiza mediante la aplicación del instrumento **System Usability Scale (SUS)** a los técnicos de campo de la muestra piloto (numeral 3.4.2), posterior a un período de uso guiado del prototipo en condiciones reales de producción en el Centro Agropecuario Lope.

**Procedimiento de validación:**

1. **Capacitación inicial breve:** se realiza una inducción de no más de 15 minutos sobre el uso de la aplicación, evitando sesgar la medición con un entrenamiento excesivo que no reflejaría el uso real en campo.
2. **Período de uso supervisado:** los técnicos registran datos reales (pesajes, partos, mortalidad) durante un período definido, permitiendo que la interacción con la interfaz sea auténtica y no simulada.
3. **Aplicación del cuestionario SUS:** compuesto por 10 ítems estandarizados con escala de Likert de 5 puntos, alternando afirmaciones positivas y negativas para reducir sesgo de aquiescencia.
4. **Cálculo del puntaje:** se normaliza el puntaje de cada participante a una escala de 0 a 100, y se calcula el promedio del grupo piloto (n=3, numeral 3.4.2).
5. **Interpretación:** un puntaje SUS ≥ 68 se considera por encima del promedio de la industria (referencia estándar de Brooke, 1996), lo cual constituye el umbral mínimo de aceptación de usabilidad para efectos de este Trabajo de Grado.

**Limitación declarada:** dado el tamaño reducido de la muestra piloto (numeral 3.4.3), el resultado del SUS se interpreta como una validación indicativa de usabilidad bajo las condiciones específicas del Centro Lope, no como una generalización estadísticamente representativa a toda la población cuyícola de Nariño.

---

*Sección elaborada como parte del Trabajo de Grado CuyiElite, Universidad Cooperativa de Colombia (UCC), Facultad de Ingeniería, Programa de Ingeniería de Software. Autores: Oskar Julián Ortiz Ortiz y Diery Alejandro Valencia Itacual. Asesores: Ing. Cristian Camilo Ordoñez Quintero y Mangin Luis Montenegro.*
