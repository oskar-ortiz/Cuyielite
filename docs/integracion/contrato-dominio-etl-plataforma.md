# Contrato de dominio, ETL y plataforma

Estado: **CONTRATO DOCUMENTAL ACTUALIZADO CON LA RESPUESTA DE DIERY (2026-11-10)**. No implementa endpoints, migraciones, importación ni pantallas. Distingue código existente, definiciones comunicadas por Diery y detalles técnicos por revisar. Los tres documentos siguen locales hasta que se publiquen; esta actualización no acredita revisión de Diery sobre archivos que aún no pudo consultar.

Base examinada: `origin/dev` `8496b29`. Fuentes principales: [diccionario de mapeo](../datos/lope-diccionario-mapeo.md), [identidad y conciliación](../datos/lope-identidad-conciliacion.md), [modelo DDL propuesto](../datos/lope-modelo-ddl-propuesto.md), [plan de migración](../datos/lope-plan-migracion-validacion.md), migraciones centrales [0001](../../db/migrations/central/0001_lope_domain.sql)–[0003](../../db/migrations/central/0003_rag_e5_embeddings.sql), DDL SQLite de trabajo, [parser Lope](../../tools/lope_import/), backend de sync, [handoff de Diery](../../ml/handoff/PARA_OSKAR.md) y respuestas comunicadas por Oskar el 2026-11-09/10. Las referencias históricas a D1–D8 no equivalen a la numeración de entregas D0–D7 de este paquete.

**Siguiente entrega del frente de Oskar:** D1, ámbito/versiones de dominio y `publicar_cambios(conn, scope_id, registros)`. El ETL de Diery abre la transacción, escribe el dominio y confirma el lote. La función de plataforma usa esa conexión y publica versiones/historial/contador, sin `commit` propio. El contrato de llamada se detalla en §9; no se construye otro importador.

## 1. Criterio de lectura

- El código y los archivos versionados determinan qué existe hoy.
- La respuesta de Diery mezcla implementaciones reportadas, contratos futuros y ejemplos ilustrativos. No se copian como si ya fueran contratos implementados.
- Las aprobaciones históricas de sincronización (ADR de diseño D1–D8) se conservan. Este documento no las reabre.
- Toda ampliación a animales, partos, pesajes, eventos, correspondencias y publicación requiere acuerdo de Oskar y Diery antes de implementarse.

## 2. Reparto de responsabilidades

| Componente | Entrega | Revisa la integración |
| --- | --- | --- |
| Lectura, normalización, auditoría y conciliación de fuentes | Diery | Oskar |
| Reglas de dominio, umbrales, catálogos y criterios de identidad | Diery con validación de Lope | Oskar |
| Candidatos, manifiesto y revisión de identidad | Diery | Oskar |
| Lógica de promoción del ETL: candidatos, conciliación/vinculación y decisión de qué se promueve | Diery | Oskar |
| Mecanismos de publicación de plataforma: ámbito autorizado, versiones, contador, historial y contrato de integración | Oskar | Diery |
| Orquestador, transacción de promoción, escritura de dominio y confirmación del lote | Diery | Oskar revisa las garantías |
| Interfaz `publicar_cambios(conn, scope_id, registros)` | Oskar implementa; Diery invoca | Ambos |
| Contratos FastAPI, autorización, ámbitos, versiones e historial | Oskar | Diery |
| SQLite, outbox, sync, cursores y cliente Android/Windows | Oskar | Diery |
| Modelos ML, features, evaluación y servicio RAG | Diery | Oskar |
| Contrato HTTP de ML/RAG y su integración FastAPI | Oskar | Diery |
| UI/UX, pruebas de integración, CI y documentación técnica | Oskar | Diery |

La ubicación de una función en `backend/` no cambia por sí sola su responsable. Diery conserva la lógica de vinculación de identidades que se ofreció a construir; la plataforma no la duplica.

## 3. Matriz de compatibilidad

Diery indicó `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias` para las entidades nuevas. La plataforma conserva los identificadores vigentes `galpon|poza`; los nombres físicos `galpones|pozas` no los reemplazan. El mapeo explícito está en el plan incremental; no se publica dominio nuevo a clientes v1 todavía.

| Elemento o decisión | Estado real en el repositorio | Propuesta de Diery | Compatibilidad | Responsable | Acción y dependencia |
| --- | --- | --- | --- | --- | --- |
| Tabla de animales | `cuyes` existe en central y SQLite de trabajo. `codigo_identificacion`, sexo, nacimiento, genealogía, códigos y estado. | Mantener `cuyes`; no crear `animales`. | Compatible. | Oskar / Diery | Ninguna migración nueva para la tabla; revisar nulabilidad ya migrada en `0001`. |
| Chapa reutilizable | `0001` eliminó el UNIQUE de `cuyes.codigo_identificacion` y dejó índice no único. | Chapa VARCHAR reutilizable, conserva ceros; UUID interno. | Compatible y ya implementado. | Diery define identidad; Oskar revisa. | No volver a imponer UNIQUE global. |
| UUID de entidad | Central asigna UUID al aceptar; el cliente conserva UUID en sync. | UUID v4 asignado una vez; no derivar de chapa. | Compatible. | Oskar | Mantener en promoción y sync. |
| Nulabilidad de animal | `0001` dejó `poza_id`, `sexo` y `estado` nullable; nacimiento ya era nullable. | Sexo, nacimiento, códigos y padres pueden faltar. | Compatible con la migración; `codigo_identificacion` sigue `NOT NULL`. | Oskar / Diery | Documentar que una fila sin chapa no se promueve. |
| Ubicación actual vs histórica | `cuyes.poza_id` es ubicación actual; `galpon_origen_id` es origen. | La poza del Excel es contexto histórico; no demuestra ubicación actual. | Compatible. | Diery define evidencia; Oskar modela. | Mantener `poza_id` nullable; no inferir traslado. |
| Partos | `partos` existe; `0001` agregó `numero_parto` y dejó fecha y cantidades nullable. | Una fila de camada = un parto; NUPAR; cantidades nullable. | Compatible. | Diery / Oskar | Validar `vivos + muertos = total` solo con datos presentes. |
| Pesajes | `pesajes` existe; `0001` agregó `etapa`, `parto_id` y `evento_id`. | Gramos `NUMERIC(8,2)`; a lo sumo uno de los dos vínculos, ambos NULL permitido. | Falta el CHECK anunciado por Diery. | Diery migra el CHECK; Oskar integra sync/local. | Coordinar número de migración; §5.3. |
| Eventos | Tabla `eventos` creada en `0001` con tipo, fecha, macho y pozas. | DESTETE, EMPADRE, TRASLADO, DESCARTE, VENTA, MUERTE. | Compatible estructuralmente; catálogo no cerrado. | Diery | Confirmar catálogo y uso de `detalle`. |
| Cría–parto | `parto_crias` existe con `UNIQUE(cuy_id)`. | Registro propio en el delta, con UUID, parto, cría y rol. | Tabla compatible; transporte pendiente. | Diery / Oskar | Ampliar ámbito, versión y sync para `parto_crias`; no embeber `crias` en parto. |
| Correspondencias | `importacion_origenes`, `importacion_lotes` y `importacion_correspondencias` existen en `0001`. | PENDIENTE / AMBIGUO / ACEPTADO / RECHAZADO; un origen puede producir 1:N. | Compatible; `UNIQUE(origen_id, estado)` no basta por sí solo. | Diery revisa; Oskar implementa. | Completar claves de idempotencia y transición de estados. |
| Publicación central | `galpones` y `pozas` tienen `scope_id`, `server_version` y `last_client_edited_at`; historial y recibos en `0002`. | Publicar en la misma transacción de promoción. | Compatible para galpones/pozas; no existe aún para animales/eventos. | Oskar aporta publicación; Diery aporta la promoción. | Extensión de esquema y contrato de integración; no duplicar el pipeline de Diery. |
| Sync actual | Protocolo v1 restringido a `galpon|poza`; cursor firmado, recibos, conflictos y outbox implementados y verificados. | Añadir `cuyes|partos|pesajes|eventos|parto_crias`. | Requiere extensión y compatibilidad de clientes. | Oskar | Mantener `galpon|poza`; diseñar negociación y cursor en D2. |
| Endpoints ML | `ml.prediccion` implementado; no hay rutas HTTP en `backend/`. | `/ml/predict/hembra`, `/ml/predict/candidata`, `/assistant/query`. | Funciones compatibles; rutas propuestas; separar predicción temprana de clasificación completa. | Oskar integra; Diery aporta reglas/modelo/RAG. | Contrato y validaciones en `contrato-servicios-ml-rag.md`. |
| RAG | `rag.src.retrieve.consultar` devuelve `respuesta`, `fuentes`, `modo` y `citas`; sin ruta FastAPI. | HTTP solo `{respuesta, fuentes}`; modo/citas internos. | Adaptación explícita definida por Diery. | Diery / Oskar | Filtrar salida HTTP y probar que no expone campos internos. |
| Auditoría ETL | `tools/lope_import` emite `lope_import_audit/v1` y el comando `adapt` produce propuestas `lope_import_review/v1`, sin rutas locales. | Mantener audit y revisión separados de la publicación. | Parcial: propuestas sin UUID, correspondencias aceptadas ni registros publicables. | Diery | Completar el paso review→`lope_promocion/v1`; ver §§4.3 y 9.7. |
| Promoción ETL | Promotor transaccional sintético en `feat/lope-orquestador-promocion`; todavía no conectado a datos reales. | Diery controla la transacción y llama `publicar_cambios` sobre la conexión abierta. | Contrato ejercitado con datos sintéticos; faltan integración del ETL y revisión de correspondencias. | Diery promueve; Oskar publica. | Completar el manifiesto acordado y mantener ámbito autorizado/respaldo como gates, §9. |
| `R` en DESTINO | El parser no conserva DESTINO; ADR 0004 lo deja pendiente. | `R` = REEMPLAZO, confirmado por Diery. | Diferencia documental. | Oskar actualiza ADR; Diery confirma. | Actualizar ADR 0004 y conservar DESTINO en la auditoría futura. |
| `AB` con cantidad | El ETL ML lo marca `NO_INTERPRETADO_AB_CON_CANTIDAD`. | No interpretar hasta confirmar con Lope; cantidad NULL. | Compatible. | Diery / Lope | Mantener sin inferencia. |
| Ojos 1/2 | Código se conserva; 1=negro, 2=rojo según ADR 0004. | Distinguir 1/2 confirmados de códigos desconocidos. | Compatible; catálogo normalizado pendiente. | Diery / Lope | Conservar código crudo y no clasificar códigos desconocidos. |
| Catálogo color/ojos | No hay catálogo cerrado. | Conservar códigos crudos; no normalizar todavía. | Compatible. | Diery / Lope | Mantener `color_codigo`, `ojos_codigo`, `pelaje_original`. |

## 4. Frontera de contratos

### 4.1 Auditoría de solo lectura

`lope_import_audit/v1` es la salida privada y de solo lectura del CLI. No escribe
en base de datos ni constituye una promoción. El reporte emite `contract`,
`parser_version`, `mapeo_version`, archivos identificados por su SHA-256,
`candidates`, `warnings`, `errors` y `summary.files_unchanged`. No expone rutas
locales. Cada candidato incluye `file_id` y `origin_ref`; los animales llevan
`kind: "animal"` y los bloques reproductivos conservan `type: "litter_block"`
además de `kind: "litter_block"`. Cada parto extraído lleva su propio
`origin_ref` basado en la celda de fecha. Las versiones actuales del código son
parser `0.1.0` y mapeo `0.1.0`.

Ejemplo válido con la forma actual (sin identificadores ficticios ni rutas privadas):

```json
{
  "contract": "lope_import_audit/v1",
  "parser_version": "0.1.0",
  "mapeo_version": "0.1.0",
  "files": [
    {
      "file_id": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "sha256_before": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "sha256_after": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ],
  "candidates": [
    {
      "kind": "animal",
      "animal_no": "C001",
      "sexo": "H",
      "fecha_nacimiento": "2025-03-12",
      "color": "B",
      "ojos": "1",
      "ref": { "sheet": "HOJA-IND-SINTETICA", "cell": "C45" },
      "file_id": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "origin_ref": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef:HOJA-IND-SINTETICA:C45:ANIMAL:cuyes",
      "source": "observado",
      "field_origins": { "T.C.N.V": "observado" },
      "extra_fields": {
        "P45": { "formula": null, "cached": "dato sintético", "source": "observado" }
      }
    },
    {
      "type": "litter_block",
      "kind": "litter_block",
      "poza": "3",
      "macho": "045",
      "hembra": "C001",
      "peso": "980",
      "peso_origin_ref": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef:HOJA-REP-SINTETICA:B12:PESAJE_MADRE:pesajes",
      "color": null,
      "ojos": "2",
      "partos": [
        {
          "parto": 1,
          "fecha": "2026-01-20",
          "tcn": "4+1M",
          "ref": "HOJA-REP-SINTETICA!F12",
          "origin_ref": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef:HOJA-REP-SINTETICA:F12:PARTO:partos",
          "origin": "observado"
        }
      ],
      "row": 12,
      "ref": "HOJA-REP-SINTETICA!A12",
      "file_id": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "origin_ref": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef:HOJA-REP-SINTETICA:A12:BLOQUE_REPRODUCTIVO:candidatos",
      "source": "observado",
      "field_origins": {},
      "reconcilable": false,
      "reconciliation_note": "No se puede reconciliar automaticamente; pendiente de validacion"
    }
  ],
  "warnings": [
    "HOJA-IND-SINTETICA!K77: NO_INTERPRETADO_AB_CON_CANTIDAD",
    "HOJA-REP-SINTETICA-2!B30: codigo coincidente '045' con HOJA-REP-SINTETICA-2!B12 - no fusionar sin validacion"
  ],
  "errors": [],
  "summary": { "files_unchanged": true }
}
```

Los hashes del ejemplo son sintéticos y tienen formato SHA-256; no corresponden a archivos reales. Los identificadores de origen y las hojas son ficticios.

Implementación actual de `lope_import_audit/v1`:

- El identificador de origen combina huella del archivo, hoja, celda y rol/tipo; una huella o ubicación distinta requiere conciliación, no crea una entidad automáticamente.
- `python -m tools.lope_import adapt <audit.json> --output <review.json>` genera propuestas de dominio pendientes de revisión; no crea correspondencias ni registros publicables.
- Mantener el reporte fuera del repositorio y sin filas reales en Git.

La salida de adaptación se describe en §4.3 y no debe confundirse con `lope_promocion/v1`.

### 4.2 Promoción al dominio

`lope_promocion/v1` sigue siendo una propuesta del envelope del ETL, no una salida implementada del parser ni el argumento literal de `publicar_cambios`. Diery lo transforma en registros de publicación dentro de su orquestador. Debe incluir manifiesto de lote, orígenes estables, correspondencias revisadas y entidades a escribir. Los UUID los asigna central al aceptar y se reutilizan; la plataforma no vuelve a generarlos al publicar.

Ejemplo válido de promoción con una entidad aceptada y una ambigua:

```json
{
  "contract": "lope_promocion/v1",
  "manifiesto": {
    "lote_ref": "lote-sintetico-001",
    "huella_archivo": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "parser_version": "lope-parser-propuesto-1",
    "mapeo_version": "lope-mapeo-propuesto-1",
    "solicitado_por": "revision-humana-sintetica"
  },
  "origenes": [
    {
      "origen_ref": "REG-IND-1:HOJA-IND-SINTETICA:A45:ANIMAL",
      "hoja": "HOJA-IND-SINTETICA",
      "celda": "A45",
      "fila": 45,
      "rol": "ANIMAL",
      "entidad_tipo": "cuyes"
    },
    {
      "origen_ref": "REG-IND-1:HOJA-IND-SINTETICA:A45:PARTO",
      "hoja": "HOJA-IND-SINTETICA",
      "celda": "A45",
      "fila": 45,
      "rol": "PARTO",
      "entidad_tipo": "partos"
    }
  ],
  "correspondencias": [
    {
      "origen_ref": "REG-IND-1:HOJA-IND-SINTETICA:A45:ANIMAL",
      "estado": "ACEPTADO",
      "entidad_id": "11111111-1111-4111-8111-111111111111",
      "motivo": "chapa y fecha compatibles con revision humana",
      "evidencia": "ficha individual y referencia reproductiva revisadas",
      "revisor": "revision-sintetica"
    },
    {
      "origen_ref": "REG-IND-1:HOJA-IND-SINTETICA:A45:PARTO",
      "estado": "AMBIGUO",
      "entidad_id": null,
      "motivo": "fecha de parto ausente",
      "evidencia": "dos bloques compatibles",
      "revisor": null
    }
  ],
  "entidades": [
    {
      "tipo": "cuyes",
      "origen_ref": "REG-IND-1:HOJA-IND-SINTETICA:A45:ANIMAL",
      "datos": {
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
  ]
}
```

Regla de ejemplo: una correspondencia `AMBIGUO` no lleva `entidad_id` aceptado; siempre `null`. El UUID aceptado del ejemplo es sintético y con formato v4; no identifica una entidad real.

### 4.3 Adaptación de auditoría a propuestas revisables

`python -m tools.lope_import adapt <audit.json> --output <review.json>` valida
`lope_import_audit/v1` y produce `lope_import_review/v1`. Es una salida
intermedia, no es entrada de `promote` ni publica datos:

- Para `cuyes`, propone solo código, sexo, fecha ISO, color y ojos que existan en
  la auditoría. La correspondencia, UUID y `poza_id` quedan pendientes.
- Para `partos`, propone la fecha solo si es ISO y conserva el código de la
  madre y el T.C.N. original. `madre_id`, `numero_parto` y los tres conteos
  quedan `null` hasta revisión; nunca interpreta automáticamente `4+1M`.
- El peso reproductivo numérico se propone como `pesajes.etapa = MONTA`, pero
  `cuy_id` y fecha quedan pendientes. No se inventa el vínculo al animal.
- No infiere `eventos` ni `parto_crias`: las fuentes auditadas no bastan para
  crear esos vínculos.

Todas las propuestas tienen estado `PENDIENTE_REVISION`; el reporte incluye
cero correspondencias aceptadas y cero registros de promoción. No contiene
`scope_id`, UUID de dominio, `before` ni `expected_version`. El adaptador
rechaza reportes con errores o con archivos que cambiaron durante la auditoría.

## 5. Diccionario de campos propuestos

### 5.1 Animal (`cuyes`)

| Campo | Tipo | Obligatorio | NULL | Regla |
| --- | --- | --- | --- | --- |
| `id` | UUID | sí en central | no | Asignado por central; nunca derivado de chapa. |
| `codigo_identificacion` | string(50) | sí para promover | no | Chapa de negocio; conserva ceros; reutilizable. |
| `sexo` | `M`/`H` | no | sí | Otro código no se convierte en M/H. |
| `fecha_nacimiento` | fecha civil `YYYY-MM-DD` | no | sí | No es timestamp de sync; no inventar. |
| `color_codigo` | string(20) | no | sí | Código crudo; catálogo pendiente. |
| `ojos_codigo` | string(20) | no | sí | `1`/`2` confirmados; otro código se conserva sin clasificar. |
| `pelaje_original` | string(20) | no | sí | Conserva el valor original si difiere del código. |
| `poza_id` | UUID | no | sí | Ubicación actual; no se deduce del Excel. |
| `galpon_origen_id` | UUID | no | sí | Contexto histórico de origen. |
| `padre_id` / `madre_id` | UUID | no | sí | Solo identidades confirmadas; si no, referencia en revisión. |
| `estado` | string(20) | no | sí | Sin DEFAULT `ACTIVO`; no inferir estado productivo. |
| `categoria_ml` | `ELITE`/`NORMAL`/`DESCARTE` | no | sí | Dueño servidor; no la edita el cliente de campo. |
| `ultimo_peso_g` | decimal string en sync | no | sí | Proyección/derivado; la fuente autoritativa es `pesajes`. |

### 5.2 Parto (`partos`)

| Campo | Tipo | Obligatorio | NULL | Regla |
| --- | --- | --- | --- | --- |
| `id` | UUID | sí | no | Central. |
| `madre_id` | UUID | sí | no | Hembra identificada. |
| `fecha_parto` | fecha civil | no | sí | No inventar fecha. |
| `numero_parto` | entero ≥0 | no | sí | NUPAR; validar consistencia entre hermanos. |
| `nacidos_vivos` | entero ≥0 | no | sí | Sin DEFAULT 0. |
| `nacidos_muertos` | entero ≥0 | no | sí | Sin DEFAULT 0. |
| `tamano_camada_nacida` | entero ≥0 | no | sí | Validar V+M=T solo si ambos existen. |

Una camada se representa una sola vez; no se multiplica por cada cría.

### 5.3 Pesaje (`pesajes`)

| Campo | Tipo | Obligatorio | NULL | Regla |
| --- | --- | --- | --- | --- |
| `id` | UUID | sí | no | Central. |
| `cuy_id` | UUID | sí | no | Animal medido. |
| `fecha_pesaje` | fecha civil | no | sí | La fecha faltante no se inventa. |
| `peso_gramos` | decimal string en sync; `NUMERIC(8,2)` central | sí cuando el pesaje existe | no | Gramos; sin float en SQLite. |
| `etapa` | string(20) | no en histórico | sí | Valores comunicados: `NACIMIENTO`, `PARTO`, `DESTETE`, `4_SEMANAS`, `MONTA`; no inferir faltantes. |
| `parto_id` | UUID | no | sí | Contexto de parto cuando corresponda. |
| `evento_id` | UUID | no | sí | Contexto de evento cuando corresponda. |

Diery confirma **a lo sumo un vínculo**, no exactamente uno: `CHECK (parto_id IS NULL OR evento_id IS NULL)`. Ambos NULL representan un pesaje aislado; ambos presentes se rechazan. Diery implementará el CHECK en su siguiente migración, cuyo número debe coordinarse. No está aplicado en la base examinada.

Cuando hay vínculo, `PARTO` referencia `parto_id`; `DESTETE`/`MONTA` referencian `evento_id`. La validación comprueba que parto/evento corresponde al animal medido y al ámbito. El CHECK solo garantiza exclusión, no tipo de evento ni pertenencia; el servicio valida estos últimos. Los históricos con etapa desconocida conservan NULL y revisión; no se inventa evento para cumplir una regla.

### 5.4 Evento (`eventos`)

| Campo | Tipo | Obligatorio | NULL | Regla |
| --- | --- | --- | --- | --- |
| `id` | UUID | sí | no | Central. |
| `cuy_id` | UUID | sí | no | Animal del evento. |
| `tipo` | string(30) | sí | no | Catálogo propuesto pendiente de confirmar. |
| `fecha` | fecha civil | no | sí | No inventar. |
| `macho_id` | UUID | no | sí | Solo EMPADRE. |
| `poza_origen_id` / `poza_destino_id` | UUID | no | sí | Solo TRASLADO; no inferir. |
| `detalle` | string(255) | no | sí | Anotación, no relación. |

`MUERTE` como evento no duplica `mortalidad`; la representación autoritativa de muerte sigue siendo `mortalidad`.

### 5.5 Vínculo cría–parto

| Campo | Tipo | Obligatorio | NULL | Regla |
| --- | --- | --- | --- | --- |
| `id` | UUID | sí | no | Identificador propio y estable de la relación en `parto_crias`. |
| `parto_id` | UUID | sí | no | Parto de nacimiento. |
| `cuy_id` | UUID | sí | no | Cría. |
| `rol` | string(30) | sí | no | Por defecto `CRIA`. |

`UNIQUE(cuy_id)` impide un segundo parto de nacimiento para la misma cría. `UNIQUE(parto_id, cuy_id)` evita duplicar la misma cría en la camada.

Diery define su transporte como entidad `parto_crias`, con versión y snapshot propios. No se transporta dentro de `partos` ni mediante `importacion_correspondencias`; las tablas `importacion_*` permanecen centrales.

### 5.6 Correspondencia

| Campo | Tipo | Obligatorio | NULL | Regla |
| --- | --- | --- | --- | --- |
| `origen_id` | UUID | sí | no | Origen estable, no lote. |
| `lote_id` | UUID | sí | no | Ejecución. |
| `entidad_id` | UUID | solo ACEPTADO | sí en otros estados | `AMBIGUO`/`PENDIENTE`/`RECHAZADO` lo dejan `NULL`. |
| `estado` | enum | sí | no | `PENDIENTE`, `AMBIGUO`, `ACEPTADO`, `RECHAZADO`. |
| `motivo` / `evidencia` / `revisor` | string | no | sí | Revisión humana trazable. |
| `parser_version` / `mapeo_version` | string(20) | sí | no | Versiones de la ejecución. |

## 6. Reglas de dominio y casos sintéticos

1. **Chapa reutilizable.** `C001` en 2025 y `C001` en 2026 pueden ser animales distintos. Se conservan ceros (`"045"` no es `45`). No se fusiona por chapa ni por chapa + galpón + fecha sin evidencia revisada.
2. **UUID estable.** Un origen ya aceptado conserva su UUID en reintentos y nuevas versiones del parser. Un archivo modificado no crea otro animal automáticamente.
3. **Camada única.** Cinco crías de una camada de cinco generan un parto, no cinco partos. El total no se suma por hermano.
4. **Una cría, un parto de nacimiento.** `UNIQUE(cuy_id)` en `parto_crias`.
5. **Ubicación.** `poza_id` es actual; la poza del Excel es contexto histórico. La presencia en un registro no demuestra ubicación actual ni estado `ACTIVO`.
6. **Faltantes.** Vacío, `X`, nota o código desconocido no se convierte en cero, fecha inventada ni estado productivo.
7. **`R` = REEMPLAZO.** Confirmado por Diery; el ADR 0004 todavía debe actualizarse. El parser actual no conserva DESTINO.
8. **`AB` con cantidad.** Se conserva como advertencia `NO_INTERPRETADO_AB_CON_CANTIDAD`; no se infieren vivos/muertos ni cantidad.
9. **Ojos.** `1` negro y `2` rojo están confirmados; otros códigos se conservan crudos y no se usan para clasificar.

## 7. Errores de validación y revisión humana

| Caso | Resultado propuesto | ¿Revisión humana? |
| --- | --- | --- |
| Falta `codigo_identificacion` | Error `CHAPA_REQUERIDA`; no se crea animal. | No |
| `sexo` distinto de M/H | Se conserva `NULL` y advertencia `SEXO_NO_RECONOCIDO`; no se asigna por defecto. | Sí, si afecta clasificación |
| Código de ojos desconocido | Se conserva crudo; advertencia `OJOS_NO_CATALOGADO`. | Sí, catálogo pendiente |
| Fecha inválida o futura imposible | Error `FECHA_INVALIDA`; no se inventa fecha. | Sí |
| Peso no numérico, negativo o no finito | Error `PESO_INVALIDO`; no se guarda pesaje. | No |
| Segunda vinculación de una cría a otro parto | Rechazo por `UNIQUE(cuy_id)`. | Sí, si hay evidencia de error de origen |
| Cantidades de parto inconsistentes | Advertencia `CANTIDADES_INCONSISTENTES`; no se corrige. | Sí |
| `AB` con cantidad | Advertencia `NO_INTERPRETADO_AB_CON_CANTIDAD`; cantidad `NULL`. | Sí, Lope |
| Chapa repetida sin fecha ni padres | Correspondencia `AMBIGUO`, `entidad_id=null`. | Sí |
| Dos o más candidatos compatibles | `AMBIGUO` con evidencia de refs. | Sí |
| Padre/madre sin ficha completa | Referencia conservada; no se crea animal ficticio. | Sí |
| Origen ya aceptado con contenido distinto | No duplicar; comparar y revisar. | Sí |
| Archivo modificado o fila desplazada | Revisión antes de crear entidades. | Sí |
| Entidad referenciada inexistente o eliminada | Rechazo `RELACION_INVALIDA`; no se publica. | Sí |

Los códigos son propuestos; el contrato de errores HTTP se define en la implementación.

## 8. Inconsistencias y propuestas

### 8.1 Sexo y fecha de pesaje obligatorios frente a NULL

- Estado real: `0001` dejó `cuyes.sexo` y `pesajes.fecha_pesaje` nullable; `pesajes.peso_gramos` sigue `NOT NULL`.
- Propuesta: aceptar NULL en sexo y fecha; exigir `peso_gramos` cuando exista un pesaje. Si un consumidor (ML, reglas) requiere sexo o fecha, debe rechazar el cálculo con un estado `REVISAR`, no rellenar valores.
- Afecta: promoción, sync, endpoints ML y validaciones de formularios.

### 8.2 Peso de un bloque reproductivo

- El encabezado del bloque y su procedencia determinan la etapa. Un peso de monta no es un peso de parto.
- Propuesta: `PESO` del bloque reproductivo → pesaje `etapa=MONTA` ligado al evento `EMPADRE`; `PESO PARTO` del formato individual → pesaje `etapa=PARTO` ligado al parto de la madre.
- No asignar el peso de la madre a las crías ni convertir un peso de monta en peso de parto.
- Afecta: parser, promoción, endpoints ML de candidata (peso de monta).

### 8.3 Datos desconocidos de ML

- Diery confirma `NORMAL` + `estado_calidad` con `REVISAR` cuando faltan datos; no acredita salud ni una clasificación completa. No se propone `clase=null` ni una clase autoritativa tomada del RF.
- No asumir cero abortos ni supervivencia por ausencia. La función actual usa `hembra_muerta=False` si falta: la integración debe validar sexo/estado del animal antes de invocarla y distinguir dato desconocido de falso. Una muerte confirmada o un animal no hembra son errores de dominio 4xx, no una predicción HTTP exitosa `NO_APLICA`.
- Afecta: validación de request, reglas y respuesta.

### 8.4 Vínculo de pesajes

- El esquema examinado permite ambos vínculos; falta el CHECK anunciado por Diery.
- La regla coordinada es la de §5.3: a lo sumo uno, ambos NULL permitido. `PARTO` usa parto; `DESTETE`/`MONTA` usan evento cuando existe vínculo. El tipo de evento y su animal se validan aparte.
- Afecta: promoción, validaciones y contrato de sync.

## 9. Frontera de promoción y publicación

### 9.1 Componentes y responsabilidad

Definición comunicada por Diery: **su herramienta es el único orquestador**. Abre la transacción, controla lote/correspondencias, escribe el dominio y confirma o revierte. Oskar implementa la primitiva interna:

```python
publicar_cambios(conn, scope_id, registros)
```

`conn` ya tiene una transacción activa, con autocommit deshabilitado. La función no abre otra conexión, no inicia una transacción independiente, no hace `commit`/`rollback` ni cierra la conexión. Propaga el error para que el orquestador revierta todo. No vuelve a escribir los campos de negocio ni decide identidades; actualiza metadatos de publicación y escribe historial/contador. El resultado devuelto es provisional hasta el COMMIT exterior.

Estado de implementación: la primitiva está en `dev`; el promotor transaccional de Lope está en `feat/lope-orquestador-promocion` (`601e124cae517b44b25b1dcd5639628a238117d0`). `tools/lope_import/promote.py` cubre `cuyes`, `partos`, `pesajes`, `eventos` y `parto_crias`, pero la integración de producción sigue siendo responsabilidad del orquestador de Diery. La auditoría ahora emite `lope_import_audit/v1`, versiones `0.1.0` y referencias de origen deterministas; todavía no se transforma directamente en entidades aceptadas ni en registros de publicación. La descarga de estas entidades quedó habilitada en D2 (`feat/d2-pull-dominio`): `GET /sync/pull` acepta las cinco además de `galpon|poza`, conserva snapshots y cursor firmado por ámbito. El push v1 no cambia.

El ámbito se autoriza en la entrada confiable del orquestador; no basta recibir un UUID en el JSON. La función exige un ámbito existente, comprueba la pertenencia de filas y referencias y no mueve registros entre ámbitos. La numeración de la migración de ámbito/versiones se coordina con el CHECK de pesajes de Diery.

### 9.2 Una transacción, ocho pasos

Se conserva la transacción única del plan de migración. La siguiente descomposición fija responsables y garantías, sin implementar otro flujo de promoción:

1. **Diery:** validar operador/ámbito e iniciar la transacción en una conexión.
2. **Diery:** bloquear `sync_scopes` del ámbito antes de modificar dominio y coordinar lote/orígenes; verificar reintento de lote ya confirmado antes de escribir.
3. **Diery:** verificar correspondencias ACEPTADO, relaciones y versiones; capturar el estado anterior bajo bloqueo y escribir únicamente cambios efectivos de dominio, conservando UUID.
4. **Oskar, en la llamada:** validar registros, estado anterior/versiones y filas finales sobre la misma conexión; rechazar ámbito o referencias incompatibles.
5. **Oskar:** asignar versión 1 a primeras publicaciones revisadas, incrementar solo correcciones efectivas y construir snapshots finales con metadatos técnicos consistentes.
6. **Oskar:** insertar historial y avanzar `sync_scopes.last_sequence` por cada cambio efectivo, bajo el mismo bloqueo; devolver versiones/secuencias sin confirmar.
7. **Diery:** registrar resultado del lote y correspondencias en la misma transacción.
8. **Diery:** COMMIT único; cualquier error en pasos anteriores implica ROLLBACK total, incluidos dominio, versiones, historial, contador y lote.

Todos los escritores del ámbito deben respetar el mismo orden de bloqueo. D1 prueba el contrato con un orquestador sintético de pruebas, no con una segunda herramienta ETL productiva.

### 9.3 Evidencia de cambio antes de escribir

Leer solo la fila después del paso 3 no permite detectar no-op, pérdida de actualizaciones o cambios de una versión anterior. Se propone concretar `registros` con esta información interna, que Diery captura **antes** de escribir y conserva durante la transacción:

| Campo propuesto | Garantía |
| --- | --- |
| `entity`, `id` | Identificador de contrato permitido y UUID ya resuelto; una entrada final por entidad/id en la llamada. |
| `expected_version` | Versión leída bajo bloqueo antes de editar; NULL para nuevo. Una fila histórica no publicada necesita tratamiento explícito, no confundirse con nueva. |
| `before` | Snapshot anterior de campos publicables o NULL para inserción; contrastable con último historial cuando exista. |
| `after` | Estado final normalizado; debe coincidir con la fila escrita por el orquestador. La función no publica un payload distinto del dominio. |

Esta forma es una propuesta de interfaz a congelar en D1, no una salida actual del ETL. Una alternativa equivalente debe conservar las mismas garantías. NULL no equivale a cero; fechas civiles se comparan como fechas y pesos como decimal canónico. El campo `updated_at` técnico no convierte por sí solo un no-op en cambio de negocio.

El orquestador evita UPDATE si no cambia el contenido efectivo; no debe refrescar fechas antes de decidir el no-op. El publicador tampoco cambia metadatos ni historial en ese caso. Los reintentos de lote se reconocen en el ETL antes de repetir escrituras; la comparación after/after no sustituye idempotencia durable.

### 9.4 Versiones y publicación

- **Registro nuevo:** Diery inserta dominio; Oskar asigna explícitamente `server_version = 1` y publica el snapshot en la misma transacción. El DEFAULT 0 actual de galpones/pozas significa no publicado; no es la versión inicial visible ni se transmite al cliente.
- **Corrección efectiva de un registro existente:** se incrementa la versión (`actual + 1`), se actualiza la entidad y se inserta un nuevo cambio inmutable en el historial, todo en la misma transacción.
- **Reintento de la misma operación o lote:** no incrementa versión, no inserta otro cambio ni otro recibo; devuelve el resultado original.
- **No-op:** si el contenido efectivo no cambia, no incrementa versión, no actualiza la entidad, no inserta historial ni contador; devuelve el estado existente.
- **Registro existente sin versión:** requiere carga inicial/publicación revisada; no se asigna `1` con un DEFAULT.

### 9.5 Garantías

- **Ámbito:** derivado de identidad confiable; no del JSON.
- **Atomicidad:** dominio, versiones, contador, historial y estado del lote en la misma transacción. Cualquier fallo revierte todo.
- **Idempotencia:** huella + versiones de parser/mapeo + origen estable + correspondencia. No alcanza con `UNIQUE(origen_id, estado)`.
- **Reintentos:** reutilizan UUID y correspondencia; no crean entidades ni publicaciones nuevas.
- **Concurrencia:** bloqueo del ámbito; una sola promoción efectiva por lote/origen.
- **Correcciones:** un archivo modificado exige revisión; no duplica animales. Un origen idéntico reutiliza la entidad aceptada.
- **1:N:** una fila de origen puede producir animal, parto y pesajes; `origen_rol` y `entidad_tipo` distinguen cada relación.
- **Trazabilidad:** lote, huella, hoja/celda/fila, rol, revisor, versiones y entidad aceptada.
- **Separación:** la condición `ACEPTADO` aplica a entidades promovidas por ETL. No debe excluir de sync los registros válidos creados desde la app.

### 9.6 Recibos

La promoción no es una operación de un dispositivo de campo. No se reutiliza `sync_receipts` salvo que se apruebe una identidad de escritor y su semántica. La idempotencia del ETL se apoya en `importacion_lotes`, orígenes y correspondencias.

### 9.7 Promotor sintético disponible y límites de integración

En `feat/lope-orquestador-promocion`, el CLI `python -m tools.lope_import promote`
consume un JSON con la forma `{"records": [...]}`. Cada elemento contiene
`correspondencia_id`, `entity`, `id`, `expected_version`, `before` y `after`.
`batch_id` y `scope_id` se pasan como argumentos CLI; `scope_id` no se acepta
dentro del registro. La correspondencia debe existir en la base con estado
`ACEPTADO`, y los registros deben cubrir exactamente las correspondencias
aceptadas del lote.

El parser emite `lope_import_audit/v1`, `parser_version`, `mapeo_version`,
referencias por huella/hoja/celda/rol y candidatos crudos. El comando `adapt`
los convierte en `lope_import_review/v1`, con propuestas no publicables y
pendientes de revisión. No emite UUID de dominio ni correspondencias aceptadas;
las referencias de candidatos tampoco son aún las filas finales de
`importacion_origenes`. El promotor no interpreta esos candidatos. La prueba
sintética crea el lote y seis correspondencias aceptadas
(`parser_version=mapeo_version="synthetic"`), con dos cuyes y una fila de cada
entidad restante, y luego invoca `publicar_con_d1`. El mapeo de propuestas a
`lope_promocion/v1`, la creación/revisión de correspondencias y la integración
con el orquestador de Diery siguen pendientes; las versiones sintéticas no son
versiones de producción.

La llamada de publicación ocurre dentro de la transacción de `promote_batch`:

```python
with conn.transaction(force_rollback=dry_run):
    # Escribir filas de dominio y validar correspondencias aceptadas.
    publication_results = publicador(conn, authorized_scope_id, publication_records)
```

El publicador predeterminado convierte los registros a `RegistroPublicacion` y
llama `publicar_cambios(conn, scope_id, registros)`. El CLI hace rollback por
defecto; `--commit` solo se debe usar contra la base desechable de pruebas en
esta fase.

Prueba reproducible en PowerShell (PostgreSQL 16 con pgvector; el usuario debe
poder crear y eliminar bases temporales):

```powershell
& .\.venv\Scripts\python.exe -m pip install -r tools\lope_import\requirements.txt pytest
$env:TEST_DATABASE_URL = 'postgresql://<usuario>:<contraseña>@127.0.0.1:5432/cuyielite_test'
& .\.venv\Scripts\python.exe -m pytest -q tools\lope_import\tests
```

La prueba crea y elimina una base `cuyielite_lope_promote_<uuid>`; no lee los
Excel privados. La prueba de auditoría construye su propio libro sintético. La
carga real sigue bloqueada hasta completar la integración del orquestador,
autorizar el ámbito y registrar el respaldo.
### 9.7 Propuesta de manifiesto para revisar con Diery

**Estado: ejemplo y clave acordados por Diery (2026-11-16).** Este acuerdo no
conecta el ETL ni autoriza una carga real. Antes de conectarla, se debe validar
con un fixture sintético que el orquestador escribe dominio, correspondencias,
publicación e idempotencia dentro de la misma transacción.

El manifiesto separa cuatro identidades:

- `scope_id`: ámbito que el orquestador resuelve desde su configuración
  autorizada. El valor del manifiesto no sustituye la autorización ni se confía
  sin validación.
- `idempotency_key`: la tupla ya respaldada por `UNIQUE(huella_archivo,
  parser_version, mapeo_version)` en `importacion_lotes`. El `lote_id` es el UUID
  persistido al crear el lote y se recupera al reintentar esa misma tupla.
- Origen estable: huella, hoja, celda, fila, rol y tipo de entidad. `origen_id`
  se resuelve por esa clave única y se reutiliza; no depende de las versiones.
- Identidad de dominio: `entity` + UUID `id`. Un UUID aceptado se conserva entre
  reintentos y versiones; una chapa no es un ID estable.

Solo las correspondencias `ACEPTADO` entran en `registros`. Una correspondencia
ambigua o pendiente no crea ni publica una entidad. Para cada registro,
`after` y `before` deben contener exactamente los campos publicables de la
entidad, incluidos los valores `null`; no incluyen `id`, `scope_id` ni columnas
técnicas. `before=null` y `expected_version=null` son obligatorios para una
primera publicación. Para una corrección, `before` debe ser el snapshot vigente
y `expected_version` la versión leída bajo bloqueo. El orquestador inserta o
actualiza primero el dominio y luego llama a `publicar_cambios` con esa misma
conexión y transacción.

Ejemplo enteramente sintético (UUID, huella y evidencia no corresponden a
datos reales). Muestra una corrección revisada de una cuy ya publicada y nuevas
filas relacionadas en las cinco entidades:

```json
{
  "contract_version": "lope_promocion/v1",
  "batch": {
    "lote_id": "00000000-0000-4000-8000-000000000002",
    "idempotency_key": {
      "huella_archivo": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "parser_version": "p1.0.0",
      "mapeo_version": "m1.0.0"
    }
  },
  "scope": {
    "scope_id": "00000000-0000-4000-8000-000000000001",
    "config_alias": "LOPE-G1-SINTETICO"
  },
  "correspondencias_aceptadas": [
    {
      "origen_id": "00000000-0000-4000-8000-000000000801",
      "origen": {
        "hoja": "Individual",
        "celda": "A2",
        "fila": 2,
        "rol": "ANIMAL",
        "entidad_tipo": "cuyes"
      },
      "estado": "ACEPTADO",
      "entidad_id": "00000000-0000-4000-8000-000000000101",
      "revisor": "revisor-sintetico",
      "evidencia": "Corrección revisada; se reutiliza la cuy ya existente."
    },
    {
      "origen_id": "00000000-0000-4000-8000-000000000802",
      "origen": {
        "hoja": "Individual",
        "celda": "A3",
        "fila": 3,
        "rol": "ANIMAL",
        "entidad_tipo": "cuyes"
      },
      "estado": "ACEPTADO",
      "entidad_id": "00000000-0000-4000-8000-000000000102",
      "revisor": "revisor-sintetico",
      "evidencia": "Ficha sintética revisada; identidad nueva."
    },
    {
      "origen_id": "00000000-0000-4000-8000-000000000803",
      "origen": {
        "hoja": "Reproductivo",
        "celda": "E4",
        "fila": 4,
        "rol": "PARTO_01",
        "entidad_tipo": "partos"
      },
      "estado": "ACEPTADO",
      "entidad_id": "00000000-0000-4000-8000-000000000201",
      "revisor": "revisor-sintetico",
      "evidencia": "Fecha y camada sintéticas revisadas."
    },
    {
      "origen_id": "00000000-0000-4000-8000-000000000804",
      "origen": {
        "hoja": "Reproductivo",
        "celda": "B2",
        "fila": 2,
        "rol": "EMPADRE",
        "entidad_tipo": "eventos"
      },
      "estado": "ACEPTADO",
      "entidad_id": "00000000-0000-4000-8000-000000000301",
      "revisor": "revisor-sintetico",
      "evidencia": "Evento sintético; macho no resuelto, se conserva NULL."
    },
    {
      "origen_id": "00000000-0000-4000-8000-000000000805",
      "origen": {
        "hoja": "Reproductivo",
        "celda": "B2",
        "fila": 2,
        "rol": "PESAJE_MONTA",
        "entidad_tipo": "pesajes"
      },
      "estado": "ACEPTADO",
      "entidad_id": "00000000-0000-4000-8000-000000000401",
      "revisor": "revisor-sintetico",
      "evidencia": "Peso de monta sintético expresado en gramos."
    },
    {
      "origen_id": "00000000-0000-4000-8000-000000000806",
      "origen": {
        "hoja": "Individual",
        "celda": "A3",
        "fila": 3,
        "rol": "CRIA_DE_PARTO",
        "entidad_tipo": "parto_crias"
      },
      "estado": "ACEPTADO",
      "entidad_id": "00000000-0000-4000-8000-000000000501",
      "revisor": "revisor-sintetico",
      "evidencia": "Vínculo sintético madre-camada revisado."
    }
  ],
  "registros": [
    {
      "entity": "cuyes",
      "id": "00000000-0000-4000-8000-000000000101",
      "expected_version": 1,
      "before": {
        "poza_id": null,
        "galpon_origen_id": "00000000-0000-4000-8000-000000000010",
        "codigo_identificacion": "H-007",
        "sexo": "H",
        "fecha_nacimiento": "2025-02-01",
        "color_codigo": "B",
        "ojos_codigo": "1",
        "pelaje_original": "B",
        "padre_id": null,
        "madre_id": null,
        "categoria_ml": null,
        "ultimo_peso_g": 940.0,
        "estado": "ACTIVO",
        "deleted_at": null
      },
      "after": {
        "poza_id": null,
        "galpon_origen_id": "00000000-0000-4000-8000-000000000010",
        "codigo_identificacion": "H-007",
        "sexo": "H",
        "fecha_nacimiento": "2025-02-01",
        "color_codigo": "B",
        "ojos_codigo": "1",
        "pelaje_original": "B",
        "padre_id": null,
        "madre_id": null,
        "categoria_ml": null,
        "ultimo_peso_g": 950.0,
        "estado": "ACTIVO",
        "deleted_at": null
      }
    },
    {
      "entity": "cuyes",
      "id": "00000000-0000-4000-8000-000000000102",
      "expected_version": null,
      "before": null,
      "after": {
        "poza_id": null,
        "galpon_origen_id": "00000000-0000-4000-8000-000000000010",
        "codigo_identificacion": "C-2026-001",
        "sexo": "H",
        "fecha_nacimiento": "2026-01-20",
        "color_codigo": null,
        "ojos_codigo": null,
        "pelaje_original": null,
        "padre_id": null,
        "madre_id": "00000000-0000-4000-8000-000000000101",
        "categoria_ml": null,
        "ultimo_peso_g": null,
        "estado": null,
        "deleted_at": null
      }
    },
    {
      "entity": "partos",
      "id": "00000000-0000-4000-8000-000000000201",
      "expected_version": null,
      "before": null,
      "after": {
        "madre_id": "00000000-0000-4000-8000-000000000101",
        "fecha_parto": "2026-01-20",
        "numero_parto": 4,
        "nacidos_vivos": 1,
        "nacidos_muertos": 0,
        "tamano_camada_nacida": 1,
        "deleted_at": null
      }
    },
    {
      "entity": "eventos",
      "id": "00000000-0000-4000-8000-000000000301",
      "expected_version": null,
      "before": null,
      "after": {
        "cuy_id": "00000000-0000-4000-8000-000000000101",
        "tipo": "EMPADRE",
        "fecha": "2026-01-05",
        "macho_id": null,
        "poza_origen_id": null,
        "poza_destino_id": null,
        "detalle": null,
        "deleted_at": null
      }
    },
    {
      "entity": "pesajes",
      "id": "00000000-0000-4000-8000-000000000401",
      "expected_version": null,
      "before": null,
      "after": {
        "cuy_id": "00000000-0000-4000-8000-000000000101",
        "fecha_pesaje": "2026-01-05",
        "peso_gramos": 950.0,
        "etapa": "MONTA",
        "parto_id": null,
        "evento_id": "00000000-0000-4000-8000-000000000301",
        "deleted_at": null
      }
    },
    {
      "entity": "parto_crias",
      "id": "00000000-0000-4000-8000-000000000501",
      "expected_version": null,
      "before": null,
      "after": {
        "parto_id": "00000000-0000-4000-8000-000000000201",
        "cuy_id": "00000000-0000-4000-8000-000000000102",
        "rol": "CRIA"
      }
    }
  ]
}
```

En cada correspondencia real se persiste el `lote_id` y las versiones del
parser/mapeo conforme al esquema de soporte; se omiten en el JSON repetido para
mantener una única fuente. El orden de `registros` no es una estrategia de
escritura: el orquestador debe resolver dependencias, escribir las filas y
verificar que cada `after` coincide exactamente con la fila final antes de
llamar al publicador. La columna `scope_id` se escribe en dominio desde el
ámbito autorizado, no se añade a `after`.

**Acuerdo de Diery:** la clave existente de lote no incluye `scope_id`; se
mantiene la tupla huella + versiones de parser y mapeo. Un reintento debe usar
el ámbito original. Si la misma tupla llega con otro ámbito, el orquestador
debe rechazarla, no reutilizar el lote silenciosamente. Habilitar el mismo
archivo y versiones en ámbitos distintos requeriría una decisión y migración
posteriores para incluir el ámbito en la clave única.

## 10. Coordinación pendiente, sin reabrir lo respondido

**Definido por la respuesta:** orquestador de Diery y conexión compartida, publicación sin commit propio, cría–parto como entidad, pesos con a lo sumo un vínculo, reglas ML autoritativas/RF opcional y RAG HTTP de dos campos. Estas definiciones reemplazan alternativas anteriores; no acreditan implementación.

D1 implementó en laboratorio la primitiva y la migración `0004_publicacion_dominio.sql`, sin publicar filas históricas sin ámbito ni activar nuevas entidades en sync v1. Diery confirmó que su CHECK de pesajes usará `0005_*` y es independiente: utiliza columnas presentes desde `0001`. La migración `0005_*` todavía no se ha publicado; no se atribuye su CHECK a D1.

El contrato `lope_promocion/v1` acordado no es aún el JSON de entrada del CLI; completar ese adaptador y fijar las versiones reales de parser/mapeo pertenece a D1B. El promotor y las pruebas sintéticas no reemplazan la revisión humana de correspondencias. Catálogos incompletos y `AB` con cantidad continúan en su frente de datos; conservar crudos/NULL mientras tanto. Actualizar ADR 0004 con `R = REEMPLAZO` en el corte documental correspondiente, sin volver a preguntar su significado ya comunicado.

La publicación de entidades nuevas no se activa sobre un servicio v1 que las rechaza: D1 se prueba aislado; D2 habilita el transporte compatible antes de conectar la promoción real.

## 11. Criterios de aceptación de esta fase documental

- La matriz distingue hechos, propuestas y aprobaciones históricas.
- Los ejemplos JSON son válidos y no usan UUID ficticios.
- `AMBIGUO` nunca lleva `entidad_id` aceptado.
- `parser_version` y `mapeo_version` no se presentan como salida actual del CLI.
- La promoción no duplica el servicio de identidad ni el pipeline de promoción de Diery.
- La condición ACEPTADO no se aplica a registros creados desde la app.
- El orquestador y el publicador no confirman por separado; la evidencia previa evita detectar cambios con una fila ya sobrescrita.
- Se distinguen la migración D1 ejecutada en laboratorio y el CHECK anunciado de pesajes, aún sin publicar.
