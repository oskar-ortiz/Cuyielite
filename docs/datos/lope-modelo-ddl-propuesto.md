# Modelo DDL propuesto — importación Lope

Estado: PROPUESTA para revisión. NO EJECUTADA. No modificar DDL histórico 001-005.

## Parte del modelo vigente (002_nucleo.sql)

Tablas existentes: galpones, pozas, cuyes, partos, pesajes, mortalidad.
No crear tabla animales que duplique cuyes. `animal_id` mapea a `cuyes.id`.
`ANIMAL No.` es un código de negocio separado.

Columnas existentes relevantes:
- `galpones.ubicacion VARCHAR(255)` ya es NULLABLE.
- `cuyes.poza_id UUID NOT NULL REFERENCES pozas(id)` (ubicación actual).
- `cuyes.codigo_identificacion VARCHAR(50) NOT NULL UNIQUE`.
- `cuyes.fecha_nacimiento DATE` ya es NULLABLE.
- `cuyes.sexo VARCHAR(1) NOT NULL CHECK (sexo IN ('M','H'))`.
- `cuyes.estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'`.
- `partos.fecha_parto DATE NOT NULL`.
- `partos.tamano_camada_nacida INTEGER NOT NULL`.
- `partos.nacidos_vivos INTEGER NOT NULL DEFAULT 0`.
- `partos.nacidos_muertos INTEGER NOT NULL DEFAULT 0`.
- `pesajes.fecha_pesaje DATE NOT NULL`.
- `pesajes.peso_gramos NUMERIC(8,2) NOT NULL`.

## Propuesta coherente

### Identidad y relaciones de animales

Galpón de origen ≠ ubicación actual:
- `cuyes.poza_id` (existente, NOT NULL) = ubicación actual.
- `cuyes.galpon_origen_id UUID NULL REFERENCES galpones(id)` (nuevo) = galpón de origen histórico.
- `cuyes.padre_id UUID NULL REFERENCES cuyes(id)` (nuevo).
- `cuyes.madre_id UUID NULL REFERENCES cuyes(id)` (nuevo).

### Pelaje, ojos y códigos originales
- `cuyes.color_codigo VARCHAR(20) NULL` (nuevo).
- `cuyes.ojos_codigo VARCHAR(20) NULL` (nuevo).
- `cuyes.pelaje_original VARCHAR(20) NULL` (nuevo, conserva código original).

### Partos y cantidades
- `partos` ya existe con madre_id, fecha_parto, tamano_camada_nacida, nacidos_vivos, nacidos_muertos.
- `partos.numero_parto INTEGER NULL` (nuevo, NUPAR).
- Cantidades: proponer NULL sin DEFAULT para tamano_camada_nacida, nacidos_vivos, nacidos_muertos.
  Los DEFAULT 0 actuales inventan ceros para datos desconocidos. Sumas solo cuando los
  componentes sean conocidos.
- NO se agrega `peso_madre_g` a partos. El peso de la madre al parto se almacena
  como pesaje autoritativo (ver abajo).

### Pesajes individuales (representación autoritativa de pesos)
- `pesajes` ya existe con cuy_id, fecha_pesaje, peso_gramos.
- `pesajes.etapa VARCHAR(20) NULL` (nuevo: NACIMIENTO, PARTO, DESTETE, 4_SEMANAS, MONTA, etc.).
- `pesajes.parto_id UUID NULL REFERENCES partos(id)` (nuevo, FK estructurada: peso tomado en contexto de un parto, p.ej. peso de la madre al parir).
- `pesajes.evento_id UUID NULL REFERENCES eventos(id)` (nuevo, FK estructurada: peso tomado en contexto de un evento, p.ej. destete o empadre).
- Un pesaje se vincula a lo sumo a un `parto_id` o a un `evento_id` (no ambos). Si ninguno, es pesaje aislado.
- `pesajes.contexto` como texto libre se ELIMINA de la propuesta: la relación se demuestra por FK, no por texto.

### Eventos (destete, empadre, traslado, etc.)
- Tabla nueva `eventos`:
  - `id UUID PK`
  - `cuy_id UUID NOT NULL FK cuyes(id)`
  - `tipo VARCHAR(30) NOT NULL` (DESTETE, EMPADRE, TRASLADO, DESCARTE, VENTA, MUERTE)
  - `fecha DATE NULL` (pendiente de digitalizar)
  - `macho_id UUID NULL FK cuyes(id)` (para empadre: macho asociado)
  - `poza_origen_id UUID NULL FK pozas(id)` (para traslados)
  - `poza_destino_id UUID NULL FK pozas(id)` (para traslados)
  - `detalle VARCHAR(255)` (anotación, no relación)
  - `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ`

### Vínculo cría → parto de nacimiento
- Tabla nueva `parto_crias` (relación estructurada, no un origen_rol suelto):
  - `id UUID PK`
  - `parto_id UUID NOT NULL FK partos(id)`
  - `cuy_id UUID NOT NULL FK cuyes(id)`
  - `rol VARCHAR(30) NOT NULL DEFAULT 'CRIA'`
  - `created_at TIMESTAMPTZ`
  - UNIQUE(parto_id, cuy_id)
- UNIQUE(cuy_id): cada animal se vincula a un único parto de nacimiento.
- `importacion_correspondencias` con origen_rol no representa por sí sola esta relación.

### Datos de empadre
- Se representan como evento tipo EMPADRE con fecha, macho_id y poza asociados.
- Peso de monta se almacena como pesaje con etapa MONTA y evento_id apuntando al evento EMPADRE.
- La referencia estructurada al macho (macho_id) y al contexto de ubicación (poza_origen_id/poza_destino_id)
  se incluyen en la tabla eventos.

### Mortalidad vs eventos tipo MUERTE
- `mortalidad` (tabla existente) es la representación autoritativa de muerte (fecha_deceso, causa_presunta).
- Evento tipo MUERTE es una anotación de revisión; no duplica mortalidad.
- Si se confirma, mortalidad se crea a partir del evento revisado, no al revés.

### Origen estable independiente del lote

Tabla nueva `importacion_origenes`:
- `id UUID PK`
- `huella_archivo VARCHAR(64) NOT NULL`
- `origen_hoja VARCHAR(100) NOT NULL`
- `origen_celda VARCHAR(20) NOT NULL`
- `origen_fila INTEGER NOT NULL`
- `origen_rol VARCHAR(30) NOT NULL` (ANIMAL, PARTO, PESAJE_MADRE, PESAJE_CRIA, EVENTO, etc.)
- `entidad_tipo VARCHAR(30) NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- UNIQUE(huella_archivo, origen_hoja, origen_celda, origen_fila, origen_rol, entidad_tipo)

Identidad estable:
- `origen estable` = huella_archivo + hoja + fila/celda + rol + tipo. No cambia con versiones.
- `ejecución/versiones` = parser_version + mapeo_version. Pueden cambiar.
- `correspondencia revisada` = importacion_correspondencias con origen_id, estado, entidad_id.
- Un cambio de versión reutiliza la correspondencia ACEPTADA si el origen estable coincide;
  si el origen cambió (archivo modificado), exige conciliación antes de crear entidades.
- Un Excel modificado no autoriza duplicar animales automáticamente.

Coordinación concurrente:
- UNIQUE(origen_id, estado) en importacion_correspondencias impide dos aceptaciones simultáneas
  del mismo origen. La segunda ejecución obtiene conflicto y reutiliza o revisa.
- La transacción bloquea el ámbito/contador antes de verificar correspondencias.

### Área de preparación/revisión

Tabla nueva `importacion_correspondencias`:
- `id UUID PK`
- `origen_id UUID NOT NULL FK importacion_origenes(id)` (origen estable, no lote)
- `lote_id UUID NOT NULL FK importacion_lotes(id)` (ejecución)
- `entidad_id UUID` (UUID de la entidad aceptada, si aplica)
- `estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'` (PENDIENTE, ACEPTADO, RECHAZADO, AMBIGUO)
- `motivo VARCHAR(255)` (razón de aceptación/exclusión)
- `evidencia VARCHAR(500)` (evidencia de revisión)
- `revisor VARCHAR(100)` (responsable de revisión)
- `accepted_at TIMESTAMPTZ NULL`
- `rejected_at TIMESTAMPTZ NULL`
- `parser_version VARCHAR(20) NOT NULL`
- `mapeo_version VARCHAR(20) NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- UNIQUE(origen_id, estado)
- Relación 1:N: una fila de origen puede originar animal, parto y pesajes (vía origen_rol).

### Manifiesto idempotente

Tabla nueva `importacion_lotes`:
- `id UUID PK`
- `huella_archivo VARCHAR(64) NOT NULL`
- `parser_version VARCHAR(20) NOT NULL`
- `mapeo_version VARCHAR(20) NOT NULL`
- `estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'` (PENDIENTE, APLICADO, FALLIDO)
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `aplicado_at TIMESTAMPTZ NULL`
- UNIQUE(huella_archivo, parser_version, mapeo_version)

El lote identifica la ejecución y se vincula al origen/correspondencia; no constituye la identidad estable.

### Política única de estado histórico
- PostgreSQL: sin DEFAULT en cuyes.estado; DROP NOT NULL; sin CHECK.
- SQLite: estado TEXT nullable, sin DEFAULT, sin CHECK.
- Ambos motores: no ACTIVO por defecto. Sin catálogo restrictivo.

## Incompatibilidades con el esquema actual

1. UNIQUE de `cuyes.codigo_identificacion` frente a chapas reutilizadas.
2. `cuyes.poza_id NOT NULL` frente a registros históricos sin ubicación actual.
3. Fechas obligatorias (`partos.fecha_parto NOT NULL`, `pesajes.fecha_pesaje NOT NULL`) frente a datos pendientes.
4. `cuyes.sexo NOT NULL CHECK` frente a sexo desconocido.
5. `cuyes.estado NOT NULL DEFAULT 'ACTIVO'` frente a registros históricos.
6. Cantidades de parto NOT NULL + DEFAULT 0 frente a datos desconocidos.
7. `cuyes.codigo_identificacion` preserva ceros: ya es VARCHAR, OK.
8. Campos y relaciones que todavía no existen: galpon_origen_id, padre_id, madre_id,
   color_codigo, ojos_codigo, pelaje_original, numero_parto, etapa, parto_id, evento_id,
   macho_id en eventos, eventos, parto_crias, importacion_origenes,
   importacion_correspondencias, importacion_lotes.

## Tabla de correspondencia PostgreSQL / SQLite

| Concepto | PostgreSQL | SQLite trabajo | Diferencias |
|---|---|---|---|
| Galpón | galpones (UUID, TIMESTAMPTZ) | galpones (TEXT, TEXT) | Tipo de fecha; UUID como texto |
| Poza | pozas (UUID, INTEGER, TIMESTAMPTZ) | pozas (TEXT, INTEGER, TEXT) | Tipo de fecha |
| Cuye | cuyes (UUID, VARCHAR, DATE, NUMERIC, TIMESTAMPTZ) | cuyes (TEXT, TEXT, TEXT, TEXT, TEXT) | Pesos como TEXT (decimal string) para preservar precisión |
| Parto | partos (UUID, DATE, INTEGER, TIMESTAMPTZ) | partos (TEXT, TEXT, INTEGER, TEXT) | Cantidades nullable; fecha como texto |
| Pesaje | pesajes (UUID, DATE, NUMERIC, TIMESTAMPTZ) | pesajes (TEXT, TEXT, TEXT, TEXT) | Pesos como TEXT |
| Evento | eventos (UUID, VARCHAR, DATE, TIMESTAMPTZ) | eventos (TEXT, TEXT, TEXT, TEXT) | Tipo de fecha; macho_id incluido |
| Cría-Parto | parto_crias (UUID, UUID, UUID, VARCHAR) | parto_crias (TEXT, TEXT, TEXT, TEXT) | Relación estructurada |
| Origen | importacion_origenes (UUID, VARCHAR, INTEGER) | No aplica (solo central) | Solo en central |
| Correspondencia | importacion_correspondencias (UUID, VARCHAR, INTEGER) | No aplica (solo central) | Solo en central |
| Lote | importacion_lotes (UUID, VARCHAR, TIMESTAMPTZ) | No aplica (solo central) | Solo en central |

## Precisión de pesos entre central y SQLite

- Central: `NUMERIC(8,2)` (exacto, base 10).
- SQLite: se almacenan como TEXT con la representación decimal (ej. "995.00").
  No se usa REAL (float64) para evitar pérdida de precisión en conversiones.
- Conversión: central NUMERIC → string decimal → SQLite TEXT. Al leer, parsear a Decimal.
- El contrato sync debe transportar pesos como string decimal (como las versiones BIGINT).

## Restricciones

- No agregues restricciones de dominio que Lope no confirmó; las presentadas aquí son
  para aprobación de Oskar y Diery.
- No elimines restricciones existentes durante esta entrega (solo se proponen).
- No ejecutes DDL ni migraciones.


## Caso sintético: segunda asignación de parto (debe rechazarse)

- Animal C001 ya vinculado a parto P1 (parto_crias tiene (P1, C001)).
- Intento de vincular C001 a parto P2.
- Resultado: rechazado por UNIQUE(cuy_id). El animal conserva su vinculación original.
- Un parto puede tener muchas crías; una cría solo un parto de nacimiento.
