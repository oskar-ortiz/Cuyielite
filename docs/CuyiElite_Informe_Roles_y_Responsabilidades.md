# Informe de Roles y Responsabilidades — CuyiElite

Trabajo de Grado, Universidad Cooperativa de Colombia (UCC), Ingeniería de Software, Pasto.
Metodología de desarrollo: Extreme Programming (XP).

---

## 1. Resumen de asignación

| Rol XP | Rol adoptado en el proyecto | Responsable |
|---|---|---|
| Customer | Cliente / Usuario Validador | Ing. Cristian Camilo Ordoñez Quintero, Mangin Luis Montenegro (asesores) y personal técnico del Centro Agropecuario Lope (SENA) |
| Programmer | **Ingeniero de Software — Tech Lead / Arquitecto** | **Oskar Julián Ortiz Ortiz** |
| Programmer | **Ingeniero de Software — Especialista en Datos e IA** | **Diery Alejandro Valencia Itacual** |
| Tracker / Coach | Líder Técnico (rol compartido y rotativo) | Oskar y Diery, alternando por iteración |

## 2. Criterio de la asignación

- **Oskar, Tech Lead / Arquitecto:** concentra las decisiones que atraviesan todo el sistema (arquitectura, sincronización offline-first, backend, stack). Es el rol con más visión de sistema completo y el que más peso técnico muestra ante el jurado.
- **Diery, Especialista en Datos e IA:** concentra los dos componentes que sustentan el aporte de apoyo a la toma de decisiones (modelo de datos, Random Forest y motor RAG).
- Ninguno es jefe del otro: cada uno lidera su frente y revisa el del otro, y ambos ejercen de Coach por turnos. Así los dos pueden defender cualquier parte del sistema en la sustentación.

---

## 3. Oskar Julián Ortiz Ortiz — Ingeniero de Software, Tech Lead / Arquitecto

### 3.1 Responsabilidades principales
1. **Arquitectura del sistema:** mantener los diagramas C4 (Nivel 2 y 3), el diagrama UML de contexto y el DER; decidir y documentar cambios de stack (Ionic + React con Capacitor y SQLite local en Android y Windows, conforme a la ADR 0002).
2. **Sincronización offline-first:** diseñar e implementar el `SyncWorker`, la detección de conectividad, el empaquetado del delta (`updated_at > synced_at`) y la resolución de conflictos Last Write Wins en marcas UTC.
3. **Backend FastAPI:** capas Controllers, Services, Repositories y Schemas; endpoints de sincronización (`/sync/push`, `/sync/pull`), autenticación y esquemas Pydantic v2.
4. **Cliente Ionic + React:** estructura de la aplicación, pantallas de registro en campo (galpones, pozas, cuyes, partos, pesajes, mortalidad) y empaquetado con Capacitor para Android y Windows.
5. **Calidad de ingeniería:** definir estándares de codificación (PEP 8, ESLint/Prettier), configurar el repositorio Git, la integración continua y las pruebas con `pytest`.

### 3.2 Entregables
- Arquitectura documentada y diagramas actualizados en cada iteración.
- Módulo de sincronización delta funcionando entre la instancia local y la central.
- API REST documentada y con pruebas unitarias sobre Services y Repositories.
- Aplicación cliente funcional con registro offline.

### 3.3 Prácticas XP que lidera
Diseño simple, refactorización, integración continua, estándares de codificación.

### 3.4 Objetivo específico al que más aporta
**Objetivo 2** (arquitectura, almacenamiento local y sincronización con la nube).

---

## 4. Diery Alejandro Valencia Itacual — Ingeniero de Software, Especialista en Datos e IA

### 4.1 Responsabilidades principales
1. **Modelo de datos:** diseñar y mantener el esquema relacional (DDL de PostgreSQL central y del esquema SQLite local, este último pendiente de diseño), los campos de control delta y los índices; validar la integridad con los datos reales del Centro Lope.
2. **Modelo de clasificación:** construir el dataset a partir de TCN, partos acumulados, pesos y mortalidad; entrenar el Random Forest Classifier (scikit-learn); evaluarlo con matriz de confusión, precisión, recall y F1 frente al criterio experto zootécnico.
3. **Servicio de predicción:** implementar `PredictionService` y el endpoint `/ml/predict/hembra`, con la regla de generar alerta automática para hembras en categoría Descarte.
4. **Motor RAG:** extraer y segmentar los manuales del SENA, generar embeddings, almacenarlos en `embeddings_sena` con pgvector y construir el flujo de consulta con citación de fuente.
5. **Instrumentos de medición:** consolidar los logs de sincronización, calcular las métricas del modelo y procesar los resultados del cuestionario SUS.

### 4.2 Entregables
- Esquema de base de datos versionado (scripts DDL).
- Modelo Random Forest entrenado, con informe de métricas.
- Asistente RAG funcionando sobre el corpus del SENA.
- Tablas y análisis de resultados para el capítulo de resultados.

### 4.3 Prácticas XP que lidera
Testing First sobre el modelo y los servicios de datos, cliente en sitio (coordinación del criterio experto con el SENA).

### 4.4 Objetivo específico al que más aporta
**Objetivo 2** (componentes de gestión y análisis de la producción) y **Objetivo 3** (comparación de indicadores frente a la línea base).

---

## 5. Responsabilidades compartidas

| Actividad | Oskar | Diery |
|---|---|---|
| **Objetivo 1:** entrevistas, observación y línea base en el Centro Lope | Participa | Participa |
| Planning Game y escritura de historias de usuario | Co-responsable | Co-responsable |
| Pair programming en LWW y pipeline de embeddings | Sí | Sí |
| Revisión cruzada de código (cada uno revisa el frente del otro) | Revisa datos e IA | Revisa arquitectura y backend |
| **Objetivo 3:** pruebas con productores, aplicación del SUS | Co-responsable | Co-responsable |
| Redacción del documento del Trabajo de Grado | Secciones de arquitectura y diseño | Secciones de datos, IA y resultados |
| Preparación de la sustentación | Ambos preparan todo el sistema, no solo su frente | |

## 6. Rol de Coach rotativo

- Se alterna **por iteración** (por ejemplo, Oskar en las iteraciones impares y Diery en las pares).
- Quien está de Coach: convoca el Planning Game, verifica que cada historia tenga prueba, hace seguimiento del tablero y recoge la retroalimentación del Centro Lope.
- Al cierre de cada iteración, el Coach saliente deja registrado qué se cumplió y qué pasa a la siguiente.

## 7. Cliente / Usuario Validador

- **Asesores (Ing. Cristian Camilo Ordoñez Quintero y Mangin Luis Montenegro):** validan el diseño, los instrumentos (juicio de expertos) y las decisiones de stack; reciben los avances por iteración.
- **Personal técnico del Centro Lope (SENA):** prioriza historias de usuario, prueba el sistema en campo y aporta el criterio zootécnico experto que sirve de referencia para evaluar el modelo.

---

## 8. Responsabilidades por fase del ciclo

| Fase | Oskar | Diery |
|---|---|---|
| **1. Diagnóstico y requisitos** | Requisitos no funcionales (conectividad, rendimiento), historias de la capa técnica | Requisitos de datos, variables zootécnicas y reglas de negocio con los instructores |
| **2. Diseño y modelamiento** | Arquitectura, API, algoritmo LWW | Modelo de datos, diseño del pipeline ML y RAG |
| **3. Construcción e integración** | Backend, sincronización y cliente Ionic + React | Entrenamiento del modelo, servicio de predicción y motor RAG |
| **4. Validación en campo** | Pruebas de sincronización y latencia, estabilidad del despliegue | Métricas del modelo frente al criterio experto, análisis del SUS |

## 9. Reglas para evitar silos de conocimiento

1. **Propiedad colectiva del código:** cualquiera puede modificar cualquier módulo si lo necesita, con revisión del otro.
2. **Documentar decisiones:** todo cambio de arquitectura o de modelo queda escrito (como se hizo con el cambio de stack).
3. **Demostración cruzada:** al cierre de cada iteración, cada uno explica al otro su avance, de modo que ambos puedan sustentar el sistema completo.
4. **Base local definida (ADR 0002):** la validación con el asesor se realizó y la base local es **SQLite** en Android y Windows, con **PostgreSQL + pgvector** central. Queda pendiente el diseño del DDL SQLite y su mapeo con el esquema central (Diery), que condiciona el trabajo de sincronización de Oskar.

---

*Documento elaborado como parte del Trabajo de Grado CuyiElite. Autores: Oskar Julián Ortiz Ortiz y Diery Alejandro Valencia Itacual. Asesores: Ing. Cristian Camilo Ordoñez Quintero y Mangin Luis Montenegro.*
