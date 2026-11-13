# Plan incremental de cliente, sincronización y UI

Estado: **PLAN DOCUMENTAL ACTUALIZADO CON DIERY (2026-11-10)**. No implementa migraciones, endpoints ni pantallas. Incorpora su respuesta y conserva como propuestas los mecanismos aún no construidos. D1 es el siguiente corte del frente de Oskar; D1B integra el orquestador de Diery sin duplicarlo.

Base examinada: `origin/dev` `8496b29`. Fuentes: [schemas de sync](../../backend/app/schemas/sync.py), [servicio de sync](../../backend/app/services/sync.py), migraciones centrales [0001](../../db/migrations/central/0001_lope_domain.sql)–[0003](../../db/migrations/central/0003_rag_e5_embeddings.sql), [esquema SQLite de trabajo](../../client/src/data/work.schema.ts), [esquema de sync local](../../client/src/data/work.sync.schema.ts), [aplicación de pull](../../client/src/data/work.sync.pull.apply.ts), evidencias [S4](../verificaciones/sync-s4.md), [S5](../verificaciones/sync-ui-s5.md), [E2E nativo](../verificaciones/sync-e2e-lab-nativo.md) y [registro en Trabajo](../verificaciones/registro-trabajo-galpones-pozas.md). D0–D7 en este documento son entregas de integración, no las antiguas decisiones D1–D8 de sincronización.

## 1. Estado actual verificable

| Capa | Estado |
| --- | --- |
| Central | `galpones` y `pozas` tienen `scope_id`, `server_version` y `last_client_edited_at` (`0002`). `sync_changes` y `sync_receipts` existen. |
| Dominio central | `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias` existen con campos ampliados en `0001`. No tienen `scope_id` ni `server_version`. |
| Backend sync | Protocolo v1 con `entity` restringido a `galpon|poza`; push/pull, recibos, cursor firmado y conflictos implementados. |
| SQLite de trabajo | Esquema de dominio v2: ya contiene `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`. La sincronización v3 (`user_version=3`) restringe `sync_record_state` y `sync_outbox` a `galpon|poza`. |
| Cliente | Outbox, aplicación transaccional de páginas y coordinador existen para galpones/pozas. La UI de Trabajo crea y edita solo galpones/pozas. |
| Migraciones | Centrales `0001`, `0002`, `0003`; al revisar esta base, `0004` es el siguiente número libre y `user_version=4` el siguiente local. No son reservas definitivas: deben comprobarse al implementar porque Diery también trabaja con migraciones. No editar migraciones aplicadas ni recalcular checksums históricos. |

### Matriz de compatibilidad de la ampliación

| Elemento | Estado real | Propuesta | Compatibilidad | Acción |
| --- | --- | --- | --- | --- |
| Entidades de sync | `galpon|poza` | Añadir `cuyes`, `partos`, `pesajes`, `eventos`, `parto_crias` indicados por Diery | Requiere extensión | Mantener los dos identificadores vigentes |
| Ámbito y versión | Solo galpones/pozas | Extender a dominio | Requiere migración disponible (`0004` al revisar) | Aprobar backfill |
| Recibos y cursor | Implementados para v1 | Conservar semántica y ampliar validación | Requiere compatibilidad de protocolo | No confundir recibos de dispositivo con lote ETL |
| SQLite de trabajo | Dominio v2 + sync v3 | Sync v4 | Requiere migración | Rebuild de tablas de sync |
| Aplicación local | Transaccional galpon/poza | Extender por entidad | Compatible con rediseño | Ordenar dependencias |
| Clientes antiguos | Validación estricta v1 | Protocolo v2 | Diferencia | Decidir negociación/resync |
| UI de dominio | Solo galpones/pozas | Árbol y ficha de animal | Propuesta | Validar con Oskar/usuarios |
| Conflictos | Pantalla existente | Reutilizar y enlazar registro | Compatible | Añadir entidades |

## 2. Mapeo explícito de entidades

Diery indicó usar los nombres de tabla para las entidades nuevas y transportar la relación cría–parto por separado. Para conservar compatibilidad, los dos identificadores existentes siguen en singular:

| Identificador wire | Tabla | Estado |
| --- | --- | --- |
| `galpon` | `galpones` | Existente, no renombrar |
| `poza` | `pozas` | Existente, no renombrar |
| `cuyes` | `cuyes` | Extensión indicada por Diery |
| `partos` | `partos` | Extensión indicada por Diery |
| `pesajes` | `pesajes` | Extensión indicada por Diery |
| `eventos` | `eventos` | Extensión indicada por Diery |
| `parto_crias` | `parto_crias` | Entidad independiente, UUID y versión propios |

Este mapeo sustituye las alternativas anteriores `cuy`/`cuye`/`animal`; todavía no está implementado. No derivar nombres mediante singularización automática ni aceptar alias ambiguos. `importacion_*` queda central, fuera de sync. `alertas` necesita un contrato propio posterior; no está incluida implícitamente por agregar `categoria_ml` a cuyes.

## 3. Campos sincronizables y campos del servidor

El sobre `SyncRecord` mantiene `id`, `version`, `created_at`, `updated_at`, `deleted_at`, `last_client_edited_at` y `data`. Los timestamps técnicos no se editan desde el cliente.

| Entidad | `data` sincronizable | Campos del servidor / derivados |
| --- | --- | --- |
| `cuyes` | `codigo_identificacion`, `sexo`, `fecha_nacimiento`, `color_codigo`, `ojos_codigo`, `pelaje_original`, `poza_id`, `galpon_origen_id`, `padre_id`, `madre_id`, `estado` | `categoria_ml`, `ultimo_peso_g`; cualquier proyección de peso. No confundir `synced_at` local con dato del dominio |
| `partos` | `madre_id`, `fecha_parto`, `numero_parto`, `nacidos_vivos`, `nacidos_muertos`, `tamano_camada_nacida` | `server_version` y timestamps técnicos |
| `pesajes` | `cuy_id`, `fecha_pesaje`, `peso_gramos` (string decimal en wire), `etapa`, `parto_id`, `evento_id` | `server_version` y timestamps técnicos |
| `eventos` | `cuy_id`, `tipo`, `fecha`, `macho_id`, `poza_origen_id`, `poza_destino_id`, `detalle` | `server_version` y timestamps técnicos |
| `parto_crias` | `parto_id`, `cuy_id`, `rol` | UUID propio; correcciones de vínculo requieren validación, no sobrescritura silenciosa |

Reglas:

- `categoria_ml` es recomendación/resultado del servidor; el cliente no la sobrescribe.
- `ultimo_peso_g` es una proyección; la fuente autoritativa es `pesajes`.
- Los pesos viajan como string decimal para preservar `NUMERIC(8,2)`.
- Una relación con UUID no descargado no se inventa: staging durable según §5; errores de contrato reales sí rechazan la página.
- `deleted_at` se transporta como tombstone; no se elimina físicamente.

## 4. Ámbito, versiones, recibos y cursor

Ejemplo de página v2 del backend implementado. El pull v2 entrega las cinco entidades de dominio desde su propio cursor; `galpon|poza` siguen en v1. El cliente que consume este contrato todavía está pendiente.

```json
{
  "protocol_version": 2,
  "scope_id": "55555555-5555-4555-8555-555555555555",
  "items": [
    {
      "seq": "101",
      "entity": "cuyes",
      "record": {
        "id": "11111111-1111-4111-8111-111111111111",
        "version": "1",
        "created_at": "2026-11-10T10:00:00Z",
        "updated_at": "2026-11-10T10:00:00Z",
        "deleted_at": null,
        "last_client_edited_at": null,
        "data": {
          "codigo_identificacion": "C001",
          "sexo": "H",
          "fecha_nacimiento": "2025-03-12",
          "color_codigo": "B",
          "ojos_codigo": "1",
          "pelaje_original": null,
          "poza_id": null,
          "galpon_origen_id": null,
          "padre_id": null,
          "madre_id": null,
          "estado": null
        }
      }
    },
    {
      "seq": "102",
      "entity": "partos",
      "record": {
        "id": "22222222-2222-4222-8222-222222222222",
        "version": "1",
        "created_at": "2026-11-10T10:00:01Z",
        "updated_at": "2026-11-10T10:00:01Z",
        "deleted_at": null,
        "last_client_edited_at": null,
        "data": {
          "madre_id": "11111111-1111-4111-8111-111111111111",
          "fecha_parto": "2026-01-20",
          "numero_parto": 4,
          "nacidos_vivos": 4,
          "nacidos_muertos": 1,
          "tamano_camada_nacida": 5
        }
      }
    },
    {
      "seq": "103",
      "entity": "pesajes",
      "record": {
        "id": "33333333-3333-4333-8333-333333333333",
        "version": "1",
        "created_at": "2026-11-10T10:00:02Z",
        "updated_at": "2026-11-10T10:00:02Z",
        "deleted_at": null,
        "last_client_edited_at": null,
        "data": {
          "cuy_id": "11111111-1111-4111-8111-111111111111",
          "fecha_pesaje": "2026-01-20",
          "peso_gramos": "995.00",
          "etapa": "PARTO",
          "parto_id": "22222222-2222-4222-8222-222222222222",
          "evento_id": null
        }
      }
    },
    {
      "seq": "104",
      "entity": "eventos",
      "record": {
        "id": "44444444-4444-4444-8444-444444444444",
        "version": "1",
        "created_at": "2026-11-10T10:00:03Z",
        "updated_at": "2026-11-10T10:00:03Z",
        "deleted_at": null,
        "last_client_edited_at": null,
        "data": {
          "cuy_id": "11111111-1111-4111-8111-111111111111",
          "tipo": "DESTETE",
          "fecha": "2026-02-04",
          "macho_id": null,
          "poza_origen_id": null,
          "poza_destino_id": null,
          "detalle": null
        }
      }
    }
  ],
  "next_cursor": "cursor-ilustrativo-no-verificable-sin-firmante",
  "has_more": false
}
```

Los UUID del ejemplo son sintéticos y tienen formato v4; no identifican entidades reales. El cursor es un valor ilustrativo: no puede validarse sin el firmante del servidor y no demuestra un cursor emitido. La validación sintáctica del JSON no equivale a validación del contrato.

La relación viaja como un ítem `parto_crias` con su propio `record.id` y versión; `data` contiene `parto_id`, `cuy_id` y `rol=CRIA`. No se agrega `crias` al snapshot de parto. El ejemplo anterior no incluye relaciones cría–parto porque solo ilustra una madre y su pesaje, no una cría identificada.

La extensión reutiliza el mecanismo existente:

- `sync_scopes.last_sequence` bloqueado `FOR UPDATE` antes de escribir.
- `sync_changes` inmutable con `(scope_id, sequence)` y snapshot completo.
- `sync_receipts` por `(scope_id, device_id, operation_id)` con `request_hash` y respuesta original.
- Cursor firmado por ámbito; página y cursor locales se aplican en una transacción.
- `server_version` decimal positivo por registro; se transporta como string.
- Registro nuevo: versión 1 y snapshot publicado. Corrección efectiva de uno existente: incremento de versión y nuevo cambio de historial en la misma transacción. Reintento o no-op: sin incremento ni publicación duplicada.

Cambios de esquema propuestos (no ejecutados):

1. Agregar ámbito, versión y metadatos técnicos necesarios a `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`, verificando qué timestamps ya existen. No asumir que todas las tablas tienen los mismos campos; el sobre completo necesita un mapeo explícito por tabla.
2. Agregar índices por `scope_id` y unicidad `(scope_id, id)` en las entidades sincronizables.
3. Extender la validación de `entity` en backend y `sync_changes` para los nuevos nombres.
4. No copiar `synced_at` como sustituto de versión ni de recibo.

Los registros existentes requieren una carga inicial revisada: no se asigna `server_version=1` con un DEFAULT ni se declara sincronizado el inventario sin publicar historial.

El DEFAULT 0 vigente representa no publicado. La primera publicación asigna 1 explícitamente, junto con historial/contador. Diery escribe dominio y abre/cierra la transacción; Oskar publica usando esa conexión. D1 no activa entidades nuevas en un servicio v1 que las rechazaría: pruebas aisladas primero, negociación compatible en D2 antes de enlazar promoción real.

## 5. Dependencias, referencias entre páginas y staging local

Orden de publicación y aplicación propuesto:

1. Galpón.
2. Poza.
3. Cuy (con `poza_id` y genealogía resueltas o NULL).
4. Parto.
5. Evento (puede ser referenciado por un pesaje).
6. `parto_crias`, como registro independiente.
7. Pesaje (puede referenciar `parto_id` y `evento_id`).

El orden anterior corrige el error de aplicar pesajes antes de eventos. El servidor debe publicar padres antes que hijos nuevos; el cliente no depende solo de ese orden.

### Problema de las referencias entre páginas

Abortar y reintentar la misma página indefinidamente no funciona si la FK llega en una página posterior. Se propone un **staging local durable** (implementado en D3 como `sync_inbox`):

| Tabla propuesta | Columnas | Uso |
| --- | --- | --- |
| `sync_inbox` | Identidad dataset/ámbito, secuencia, entidad, id, versión, payload, referencias faltantes, estado y recepción | Campos mínimos propuestos; el DDL definitivo se diseña en D3. |
| Clave y orden | Entidad/id dentro del dataset y ámbito vinculados; control de versión/secuencia | D3 debe definir retención y reemplazo por versión más reciente sin perder conflictos. |
| Estados | `staged`, `applied`, `incomplete` | `staged` espera dependencias; `incomplete` requiere decisión o nueva página; `applied` se elimina o compacta. |

Flujo propuesto:

1. La página se valida y se aplica en una transacción junto con su cursor.
2. Los registros con dependencias resueltas se aplican; los no resueltos se insertan en `sync_inbox`.
3. La transacción confirma aplicación + staging + cursor. El cursor avanza aunque queden registros en staging.
4. Después de cada página y al reabrir, se intenta aplicar el staging. Si una dependencia llegó, se aplica y se elimina de `sync_inbox`.
5. Si al terminar el ciclo quedan registros `staged`, se reintentan en el siguiente ciclo; no se bloquea el cursor ni la UI.
6. `has_more=false` solo cierra la ventana actual de descarga; no prueba que una dependencia nunca vaya a llegar. Mantener el dato durable y reintentable. Marcar `incomplete` exige una condición explícita (por ejemplo, revisión o evidencia de referencia inválida), no solo acabar una página/ciclo. La política final se congela en D3.

Antes de aplicar staging se compara otra vez versión/secuencia, tombstones y cabeza local: un snapshot antiguo no puede reemplazar uno nuevo ni una edición pendiente. La UI distingue cursor **recibido** de registros **aplicados** y dependencias pendientes; no anuncia todos los datos disponibles mientras falten relaciones. No purgar payload pendiente por tiempo ni inventar padres para vaciar la cola.

No se desactivan las FK. No se crean animales, partos o eventos ficticios para satisfacer una referencia.

### Escenarios

- **Referencia en página posterior:** el hijo se guarda en `sync_inbox`, el cursor avanza y el hijo se aplica cuando llega el padre. No hay pérdida ni bloqueo permanente.
- **Corte de conexión:** si la página no se confirmó, se reintenta desde el mismo cursor. Si se confirmó, aplicación/staging/cursor ya están en disco; la siguiente sesión continúa.
- **Reapertura:** `sync_inbox` persiste; al abrir o sincronizar se reconcilia antes de continuar.
- **Animal existente que recibe una relación genealógica nueva:** la actualización se aplica si el padre/madre ya existe; si no, se guarda el cambio en `sync_inbox` y el animal conserva su relación anterior hasta resolverlo. No se inventa el padre.
- **`parto_crias` duplicado:** `UNIQUE(cuy_id)` rechaza una segunda vinculación; se registra conflicto, no se sobrescribe.
- **Pesaje con parto/evento ausente:** se guarda en staging hasta que llegue la referencia; si nunca llega, queda incompleto.

## 6. Clientes antiguos y evolución del protocolo

El cliente actual valida estrictamente `entity` y rechazaría una página con entidades nuevas. Opciones:

| Opción | Comportamiento | Riesgo |
| --- | --- | --- |
| A. Mantener protocolo 1 y actualizar todos los clientes | Menos código de negociación. | Un cliente viejo falla o pierde datos; no es incremental. |
| B. Protocolo 2 + capacidades | El cliente declara entidades soportadas; el servidor responde solo esas. | Si el cliente avanza el cursor global, omite cambios no soportados; al actualizar necesita resincronización. |
| C. Protocolo 2 + resincronización completa al actualizar | v1 sigue con galpones/pozas; v2 recibe todas las entidades desde un cursor nuevo o desde cero. | Costo de descarga inicial; requiere ventana de actualización. |

**Propuesta:** protocolo 2 con `supported_entities` en contexto y una resincronización explícita al habilitar animales. No prometer que un cursor v1 sirve para v2 sin decidir el tratamiento de secuencias omitidas. La decisión final requiere acuerdo con Oskar.

## 7. Migración SQLite v3 → v4

La migración debe conservar bases existentes, outbox, conflictos y cursor. No se modifica el checksum histórico de C2 ni se edita `0001_work_schema`.

Pasos propuestos:

1. Abrir la base y validar `user_version=3`, familia `cuyielite-work`, checksum de C2 y checksum de sync v3.
2. Crear tablas nuevas `sync_record_state_v4`, `sync_outbox_v4` y `sync_inbox` (staging propuesto) con CHECK de entidad ampliado y las mismas columnas/índices que correspondan.
3. Copiar filas existentes; conservar `local_seq`, `operation_id`, estados, `frozen_request`, recibos y cabezas.
4. Eliminar/renombrar las tablas viejas y crear los índices (`sync_outbox_one_prepared`, `sync_outbox_record`).
5. Actualizar `meta.sync_schema_checksum`, `meta.sync_migration_id='0003_work_domain_sync'` (nombre propuesto) y `PRAGMA user_version=4` dentro de la transacción.
6. Verificar `foreign_key_check`, columnas e índices; rollback completo ante error.
7. Probar reapertura, outbox pendiente, conflicto, cursor y staging preservados; referencia en página posterior, corte y reconciliación.

El esquema de dominio v2 ya tiene esas tablas; no recrearlas desde cero. Además de la capa sync, comparar el CHECK de pesajes anunciado por Diery y los metadatos necesarios del sobre: si exige reconstruir una tabla SQLite, hacerlo mediante migración conservadora con copia, verificación y rollback. No afirmar que solo cambia sync hasta comprobar compatibilidad física.

## 8. Aplicación local transaccional

Para cada página:

1. Validar protocolo, ámbito, página y límite.
2. Por entidad: validar llaves, tipos, pesos decimales, referencias y versión.
3. Si hay cabeza local pendiente para el registro, conservar la edición local, guardar el snapshot central y marcar conflicto si la versión difiere; no sobrescribir.
4. Aplicar los registros con dependencias resueltas en orden de dependencia.
5. Insertar en `sync_inbox` los registros con dependencias ausentes; no abortar la página por una referencia que puede llegar después.
6. Reconciliar `sync_inbox` al final de la página y al reabrir; aplicar y eliminar los que ya tienen dependencias.
7. Actualizar `sync_record_state` con `server_version`, `server_snapshot` y `local_head_operation_id` sin pisar una cabeza posterior.
8. Avanzar cursor en la misma transacción que aplicación, staging y estado.
9. En error, rollback de página, staging y cursor; reintentar desde el mismo punto.

El cursor progresa cuando el registro quedó aplicado **o** durablemente staged. No se declara éxito si falló la escritura de staging. No se reintenta indefinidamente la misma página por una FK posterior.

No crear operaciones de outbox por recibir datos del servidor. No borrar conflictos al aplicar una página.

## 9. Mapa propuesto de UI

Rutas de Trabajo (propuesta; no implementadas):

```text
/trabajo/galpones
/trabajo/galpones/:galponId
/trabajo/galpones/:galponId/pozas/:pozaId
/trabajo/galpones/:galponId/pozas/:pozaId/animales
/trabajo/animales/:animalId
/trabajo/animales/:animalId/editar
/trabajo/animales/:animalId/partos
/trabajo/animales/:animalId/pesajes
/trabajo/animales/:animalId/eventos
/trabajo/animales/:animalId/predicciones
/trabajo/asistente
```

La demo conserva sus rutas y su base; no comparte entradas de escritura ni predicciones con Trabajo.

Ficha del animal:

- **General:** chapa, sexo, nacimiento, ubicación actual, origen histórico, estado, códigos crudos, calidad del dato.
- **Genealogía:** padre, madre y vínculo cría–parto; referencias no resueltas marcadas como pendientes.
- **Partos:** camada, fecha, NUPAR, vivos/muertos/total; no repetir el total por cría.
- **Pesajes:** etapa, fecha, gramos, vínculo; mostrar procedencia.
- **Eventos:** tipo, fecha, macho/pozas cuando aplique; distinguir evento de `mortalidad`.
- **Predicciones:** recomendación, motivos, calidad, fuente, versión del modelo y fecha; botón explícito para registrar una acción de descarte, nunca automático.
- **Asistente:** sección identificable, pregunta, respuesta y fuentes; online/offline como estado de conexión. `modo`/`citas` son internos, no se esperan en el DTO HTTP.

Estados obligatorios: carga, vacío, error, datos incompletos, sin conexión, sin permiso, conflicto y servicio ML/RAG no disponible. Textos en español, componentes Ionic existentes, navegación accesible y layout responsive Android/Windows. La sincronización y conflictos reutilizan las pantallas actuales; los conflictos deben enlazar al registro afectado.

## 10. Entregas propuestas y criterios de término

| Entrega | Alcance | Depende de | Criterio de término |
| --- | --- | --- | --- |
| D0. Contratos | Este paquete documental y decisiones pendientes | - | Oskar y Diery aprueban o ajustan contratos. |
| D1. Publicación de plataforma | Migración coordinada de ámbito/versiones; `publicar_cambios(conn, scope_id, registros)` sin commit propio, con estado anterior y versión esperada. Orquestador sintético solo en pruebas. | D0 y numeración coordinada con Diery | Atomicidad exterior, rollback, no-op, concurrencia, versiones y v1 protegido; §10.1. |
| D1B. Integración del orquestador ETL | Diery implementa/conecta su promoción; Oskar aporta adaptador. Envelope `lope_promocion/v1`, lote/origen e idempotencia durable. | D1 y contrato de llamada congelado | Un lote sintético confirma/revierte completo; reintento no publica dos veces. La promoción real espera transporte compatible. |
| D2. Sync v2 backend | Ampliar schemas/controllers/services y validaciones a nuevas entidades | D1 | Push/pull de animales, partos, pesajes, eventos y vínculo; dos dispositivos; conflictos y cursor. **Backend y cliente v2 implementados: push/pull de dominio con cursor independiente y aplicación local D3, verificados en pruebas, integración HTTP y Windows nativo. Android nativo parcial por memoria; D7 pendiente.** |
| D3. SQLite v4 y aplicación local | Migración v3→v4, outbox/record_state ampliados, `sync_inbox` y aplicación transaccional | D2 | Base existente conservada; outbox/conflictos/cursor/staging intactos; referencia en página posterior no bloquea. **Implementado y verificado en pruebas, builds y ejecución nativa Windows/Electron y Android; falta la UI D4.** |
| D4. Cliente de dominio y UI | Repositorios, formularios y fichas de animal/parto/pesaje/evento | D3 | Crear/editar offline, outbox, no-op, dependencias, reapertura y demo aislada. **Implementado y verificado en pruebas/builds; ejecución nativa pendiente (ver [d4-trabajo-dominio](../verificaciones/d4-trabajo-dominio.md)).** |
| D5a. Contratos/adaptadores ML/RAG | Schemas, validaciones, envelope de errores y adaptadores con datos sintéticos; sin acceso a animales reales | D0 | Contratos de `contrato-servicios-ml-rag.md`; pruebas unitarias; sin defaults inventados. **Implementado y verificado con funciones ML reales y dobles RAG.** |
| D5b. Endpoints ML/RAG integrados | Rutas con ámbito/acceso; persistencia solo con política e idempotencia resueltas | D1, D5a y publicación compatible cuando haya escrituras | Validación real del animal, reglas/RF separados, RAG de dos campos, errores y pruebas de integración. **Implementado para consulta; persistencia de categoría/alertas pendiente por política.** |
| D6. UI de predicciones y asistente | Ficha, motivos, fuentes, calidad y offline; alertas requieren lectura/sync explícito | D4, D5b | Recomendación distinguida de acción; fuentes visibles; sin inferencia local ni alertas implícitas. |
| D7. E2E y CI | Dos dispositivos, importación sintética, sync y UI | D1–D6 | Matriz de aceptación ejecutada; datos sintéticos; limpieza. |

Orden recomendado: D0 → D1 → D1B → D2 → D3 → D4. D5a puede empezar desde D0 en paralelo; D5b requiere D1 y D5a, y D2 si consume datos sincronizados. D6 requiere D4 y D5b. No empezar D4 antes de congelar el contrato de entidades y relaciones.

### 10.1 D1: alcance concreto para el siguiente encargo

**Objetivo:** que un llamador autorizado publique cambios de dominio dentro de su propia transacción. ETL, limpieza, conciliación, entrenamiento, RAG y pantallas permanecen fuera de este corte.

1. Revisar una vez las migraciones disponibles y la entrega del CHECK de pesajes de Diery. Asignar número libre sin editar SQL/checksums ya aplicados. Registrar qué migración es suya y cuál corresponde a plataforma.
2. Migrar ámbito/versión y metadatos necesarios del sobre en las cinco tablas nuevas, conservando UUID, FK, NULL, decimales e históricos. Una fila sin ámbito/publicación no recibe ámbito por inferencia ni se expone como v1; preparar backfill explícito, revisado y separado de carga real.
3. Implementar la primitiva y validaciones de §9 del [contrato de dominio](contrato-dominio-etl-plataforma.md): conexión/transacción prestadas, ámbito existente/autorizado, mismo bloqueo que los escritores sync, before/after y versión esperada, referencias del mismo ámbito, lista sin duplicados de entidad/id.
4. Asignar versión e insertar snapshot/contador solo por cambio efectivo. Primer publicado=1; corrección=+1; no-op sin UPDATE ni historial. El ETL escribe campos de negocio; la primitiva no genera UUID ni confirma el lote.
5. Probar con datos sintéticos y PostgreSQL nuevo temporal. La prueba abre la transacción como lo hará Diery, escribe dominio, llama a la primitiva y confirma o revierte. No implementar un segundo pipeline ETL como arnés productivo.
6. Documentar firma, precondiciones, errores, resultado provisional, responsabilidades y evidencia reproducible. Ejecutar suite afectada, regresión de backend/migraciones y checks del repo una vez sobre el resultado final; repetir solo ante cambios/fallos.

Pruebas de aceptación mínimas:

| Caso | Resultado requerido |
| --- | --- |
| Primera publicación | Versión 1 y snapshot correcto; contador avanza por cambios efectivos |
| Corrección con versión esperada | Versión +1, historial inmutable y fila final coincidente |
| No-op | Sin cambio de versión, fechas técnicas, contador ni historial |
| Versión anterior o before/after inconsistente | Error y rollback exterior; no ocultar actualización perdida |
| Ámbito/relación incorrectos | Rechazo sin publicación parcial |
| Fallo a mitad o después de publicar, antes del COMMIT | Rollback revierte dominio, metadatos, historial, contador y lote sintético |
| Conexión prestada | La función no abre/cierra conexión ni confirma; el llamador conserva control |
| Concurrencia | Contador serializado, sin publicaciones duplicadas ni cambios parcialmente visibles |
| Reintento de lote sintético | El orquestador reconoce lote confirmado antes de reescribir; no usa recibos de dispositivo como atajo |
| Históricos y v1 | Migración conserva datos; no publica nuevas entidades al servicio v1 sin compatibilidad D2 |

La idempotencia completa de la herramienta de Diery se demuestra conjuntamente en D1B. D1 prueba su frontera con un llamador sintético; no declara el ETL real integrado ni importa archivos Lope.

**Estado D1 (2026-11-10, rama `feat/d1-publicacion-dominio`):** primitiva implementada y verificada con 16 pruebas sobre PostgreSQL temporal. Diery confirmó `0004_publicacion_dominio.sql` para D1 y `0005_*` para su CHECK independiente de pesajes; ese CHECK aún no está publicado. La primitiva **no tiene llamador operativo**: solo la invocan pruebas y un orquestador sintético; la conexión real la aportará el ETL de Diery en D1B, después de resolver compatibilidad de descarga en D2.

**Efecto sobre clientes v1 mientras D1 exista sin D2:** `pull_changes` no filtra entidades desconocidas. Si la historia contiene `entity='cuyes'`, el servicio devuelve el ítem y calcula `next_cursor`, pero `SyncPullItem.entity` solo admitía `galpon|poza` y `/sync/pull` respondía `500` antes de entregar cursor. No se avanza el cursor filtrando entidades: hacerlo perdería cambios para la descarga futura.

**Estado D2 (2026-11-10, rama `feat/d2-pull-dominio`):** resuelto el límite anterior. `SyncPullItem.entity` acepta `galpon`, `poza`, `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`; `GET /sync/pull` entrega los snapshots publicados por D1 con su `seq` y `record.version`, sin transformarlos. El ámbito sigue derivándose del Bearer token y el cursor firmado solo avanza sobre lo entregado. El push v1 no cambia y la aplicación en SQLite sigue en D3. La frontera de plataforma se verifica con una promoción sintética en `backend/tests/test_integracion_d1_d2.py` (base temporal propia, rollback y rechazo de push de dominio); el orquestador real de Diery no está en este checkout. Evidencia, contrato de llamada y límites en [d2-pull-dominio](../verificaciones/d2-pull-dominio.md).

**Estado D2 v2 push backend (2026-11-12, rama `feat/sync-domain-push-v2`):** protocolo v2 explícito con `GET /sync/v2/context`, `POST /sync/v2/push` y `GET /sync/v2/pull`. Escritura de `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias` con el UUID del cliente, allowlist estricta, referencias por ámbito y publicación con `publicar_cambios` en la misma conexión/transacción (before del snapshot, after releído). Recibo por `operation_id`, conflicto de versión y resultados parciales por lote. El cursor v2 es independiente del v1, empieza en la secuencia inicial y entrega solo entidades de dominio; v1 conserva `galpon|poza` y su comportamiento. Verificado con 61 pruebas afectadas sobre PostgreSQL temporal. El cliente v2, la verificación nativa del push y el recorrido nativo de D7 siguen pendientes. Evidencia en [sync-domain-push-v2-backend](../verificaciones/sync-domain-push-v2-backend.md).

**Estado D2 v2 cliente (2026-11-12, rama `feat/client-sync-domain-v2`):** el cliente negocia v1/v2, enruta `galpon|poza` por v1 y las cinco entidades de dominio por v2, y mantiene un cursor v2 independiente en SQLite (`sync_context.cursor_v2`, migración v4→v5 conservadora). Reutiliza la outbox y el runner/inbox de D3; el cuerpo v2 se congela sin campos del servidor y las dependencias rechazadas se reintentan con una operación nueva para evitar el recibo almacenado. La integración HTTP con backend y PostgreSQL temporales confirmó pushes v1/v2, pull v2 de un registro central, actualización y conflicto con estado local preservado. Verificado con 198 pruebas, lint, builds web/Electron y `assembleDebug`. **Recorrido nativo 2026-11-12/13:** Windows empaquetado completo (8 cambios, 8 recibos, cursores v1/v2, reapertura y Demo); Android aislado completó pull, persistencia, reapertura y Demo, y su push quedó confirmado en SQLite/PostgreSQL, pero la UI no cerró. El reintento Android-only del 2026-11-13 se bloqueó con ~15 MB libres, `System UI isn't responding` y `lowmemorykiller`; no se reprodujo un defecto de código. Android no se marca completo y D7 nativo sigue pendiente. Evidencia en [sync-domain-push-v2-cliente](../verificaciones/sync-domain-push-v2-cliente.md).

**Estado D3 (2026-11-11, rama `feat/sync-d3-sqlite-apply`):** migración v3→v4 conservadora con `previous_sync_checksum`, recreación de `sync_record_state`/`sync_outbox` con CHECK ampliado y `sync_inbox` durable. La aplicación local ordena por dependencia, mantiene staging y cursor en la misma transacción, es idempotente al repetir página, conserva outbox/conflicto local y revierte todo ante fallo. El validador acepta timestamps con `Z` u offset (snapshots reales de D1/D2 usan `+00:00`). Verificado con 173 pruebas unitarias, lint, build web/Electron, builds nativos (APK debug y paquete NSIS) y ejecución nativa con datos sintéticos en Electron y en emulador Android: 25 comprobaciones de datos en ambos entornos. Evidencia y límites en [d3-sqlite-apply](../verificaciones/d3-sqlite-apply.md). La UI y los formularios de dominio siguen en D4.

**Estado D4 (2026-11-11, rama `feat/d4-trabajo-dominio`):** listado de animales por poza, ficha con genealogía, partos, pesajes y eventos, y formularios de alta/edición para las cuatro entidades. Repositorio único con transacción negocio + outbox, vínculos `parto_crias` en la transacción del parto, no-op sin operación, NULL conservado y lectura offline. Adaptadores Android (SQLite) y Electron (plugin `SqlitePoc`). Verificado con 182 pruebas unitarias, lint, build web/Electron y APK debug; la ejecución nativa de la UI queda pendiente. Evidencia y límites en [d4-trabajo-dominio](../verificaciones/d4-trabajo-dominio.md). No hay borrado ni revisión de conflictos de dominio en la UI.

**Estado D5 (2026-11-11, rama `feat/backend-ml-rag-d5`):** endpoints `POST /ml/predict/hembra`, `POST /ml/predict/candidata` y `POST /assistant/query` con autenticación de laboratorio y ámbito desde el token. El servidor valida existencia, sexo y supervivencia del animal; la clase principal es la de reglas, el RF es opcional y RAG devuelve solo `{respuesta, fuentes}`. Sin escrituras de `categoria_ml` ni alertas. Verificado con funciones ML reales y dobles HTTP/RAG; la persistencia y el pipeline RAG real quedan pendientes de política/entorno. Evidencia en [d5-ml-rag](../verificaciones/d5-ml-rag.md).

## 11. Riesgos y decisiones abiertas

1. Congelar la forma interna before/after/versión esperada y el backfill de históricos sin ámbito; la propiedad del orquestador ya la definió Diery.
2. Numeración central coordinada: D1 `0004`; CHECK de pesajes de Diery `0005_*`. El `4` local sigue siendo una propuesta, no una reserva.
3. Cliente v2: Windows nativo completo; Android completó pull, persistencia y push confirmado en bases, pero no cerró la UI por memoria. Falta el recorrido Android completo y la revisión de conflictos de dominio en UI.
4. Retención/versiones y compactación de `sync_inbox`, y tratamiento de dependencias incompletas; fin de ventana no equivale a ausencia definitiva. El DDL v4 ya existe; queda la política de retención y la UI de diagnóstico (D4).
5. Envelope ETL e idempotencia durable del lote/origen en D1B.
6. Persistencia de categoria_ml incompleta, alerta/código/deduplicación y contrato de lectura/sync de alertas.
7. Inputs/procedencia y errores HTTP ML; datos de modelo inválidos no son errores 4xx del usuario.
8. Autorización de producción, rotación, respaldo y piloto posterior.

No quedan abiertas como antes: variantes del nombre animal, cría–parto embebida, segundo orquestador, exactamente un vínculo de pesaje, RF obligatorio, clase principal del RF ni RAG de cuatro campos. Las definiciones recibidas no se confunden con implementación.

## 12. Criterios de aceptación de la fase documental

- No se modifica ninguna migración aplicada ni checksum.
- `0004` central y `4` local se identifican como números disponibles al revisar, no como reservas definitivas; deben comprobarse al implementar.
- El plan conserva la outbox, los recibos y el cursor existentes.
- La UI propuesta reutiliza las pantallas de sync/conflictos y separa Demo/Trabajo.
- Los UUID y hashes de ejemplo tienen formato válido pero son sintéticos; los cursores se marcan como ilustrativos.
- La validación sintáctica de JSON se distingue de la validación del contrato.
- Las decisiones abiertas no se presentan como aprobadas.
