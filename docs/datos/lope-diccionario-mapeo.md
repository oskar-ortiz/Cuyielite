# Diccionario y cobertura real del parser — importación Lope

Estado: PROPUESTA para revisión de Oskar y Diery. No aprobado ni implementado.

Fuentes verificadas: `tools/lope_import/readers.py`, `models.py`, `normalize.py`,
`__main__.py`, `reconcile.py`. Pruebas: 19 (6 en `test_basic.py`, 13 en `test_cli.py`).

---

## Parte 1 — Cobertura real del parser (verificada contra código)

Leyenda de estados:
- **HECHO**: leído, conservado en candidato y normalizado por una función nombrada.
- **PROCEDENCIA**: leído y su procedencia (fórmula/cache/literal) se captura, pero el
  valor no se normaliza ni se conserva en el candidato.
- **CONSERVADO RAW**: leído y conservado en el candidato sin normalizar.
- **TEMPORAL**: leído en el dict interno de la fila, pero no se conserva en el candidato
  ni en el informe; se pierde al construir `CandidateAnimal`.
- **PENDIENTE**: no implementado.

### Formato individual (`read_individual_sheet`, `max_cols=22`)

| Encabezado | Estado | Función/campo que lo respalda | Notas |
|---|---|---|---|
| GAL No. | TEMPORAL | `read_individual_sheet` → `record[h]` | En dict de fila; no se extrae en `__main__.audit_file`. |
| POZA No. | TEMPORAL | idem | idem. |
| MACHO No. | TEMPORAL | idem | idem. Referencia genealógica no resuelta. |
| MADRE No. | TEMPORAL | idem | idem. |
| NUPAR | TEMPORAL | idem | Semántica confirmada (número de partos de la hembra), pero no se conserva. |
| PESO PARTO | PROCEDENCIA | `field_origins["PESO PARTO"]` | Procedencia capturada; valor no normalizado ni conservado. Es peso de la madre. |
| T.C.N.V | PROCEDENCIA | `field_origins["T.C.N.V"]` | Procedencia capturada; valor no normalizado ni conservado. |
| T.C.N.M | PROCEDENCIA | `field_origins["T.C.N.M"]` | idem. |
| T.C.N.T | PROCEDENCIA | `field_origins["T.C.N.T"]` | idem. |
| ANIMAL No. | HECHO | `CandidateAnimal.animal_no = to_text(...)` | Preserva texto y ceros. |
| SEXO | HECHO | `CandidateAnimal.sexo = sexo_from_code(...)` | 1→M, 2→H, otro→None. |
| COLOR | HECHO | `CandidateAnimal.color = to_text(...)` | Código original conservado. |
| OJOS | HECHO | `CandidateAnimal.ojos = to_text(...)` | Código original conservado (1/2). |
| FECHA NACIMIENTO | HECHO | `CandidateAnimal.fecha_nacimiento = to_text(...)` | Texto civil, no timestamp. |
| PESO NACIMIENTO | PROCEDENCIA | `field_origins["PESO NACIMIENTO"]` | Procedencia capturada; valor no normalizado ni conservado. |
| FECHA DESTETE | TEMPORAL | `record[h]` | No se conserva. PENDIENTE de evento. |
| PESO DESTETE | TEMPORAL | `record[h]` | No se conserva. PENDIENTE. |
| FECHA PESO 4/SEMANAS | TEMPORAL o CONSERVADO RAW | `record[h]`; si cae en cols 16-22 → `extra_fields` | Capturado en `extra_fields` solo si está en columnas 16-22, sin normalizar. |
| PESO 4/SEMANAS | TEMPORAL o CONSERVADO RAW | idem | idem. |
| JAULA | TEMPORAL | `record[h]` | No se conserva. PENDIENTE. |
| DESTINO | TEMPORAL | `record[h]` | No se conserva. PENDIENTE. |
| Columnas 16-22 (P:V) | CONSERVADO RAW | `extra_fields` (formula/cached/source por coord) | Conservado con procedencia; sin normalizar. |

### Formato reproductivo (`read_reproductive_blocks`, `max_cols=12`)

| Campo | Estado | Función/campo que lo respalda | Notas |
|---|---|---|---|
| Poza (bloque) | CONSERVADO RAW | `block["poza"]` → `candidate["poza"]` | Texto "Poza: N". |
| Macho (bloque) | CONSERVADO RAW | `block["macho"]` → `candidate["macho"]` | Texto "Macho: ...". |
| Hembra | CONSERVADO RAW | `block["hembra"]` → `candidate["hembra"]` | Patrón letras+dígitos. |
| Peso (monta) | CONSERVADO RAW | `block["peso"]` → `candidate["peso"]` | Sin normalizar (no se usa `to_decimal`). |
| Color | CONSERVADO RAW | `block["color"]` → `candidate["color"]` | Sin normalizar. |
| Ojos | CONSERVADO RAW | `block["ojos"]` → `candidate["ojos"]` | Sin normalizar. |
| Parto 1..N (fecha) | CONSERVADO RAW | `block["partos"][j]["fecha"]` | Sin normalizar. |
| T.C.N. (por parto) | CONSERVADO RAW | `block["partos"][j]["tcn"]` | Texto preservado ("6M", "1+2M"). |

`reconcile_litters` agrupa por poza, detecta códigos de hembra coincidentes y marca
`reconcilable: False`. No fusiona.

`models.CandidateLitter` existe pero no se instancia en `__main__.py`.

## Parte 2 — Mapeo concreto (destino, tipo, unidad, nulabilidad)

Cada campo apunta a tabla/columna o relación concreta, o queda en preparación/revisión.

### Formato individual

| Encabezado | Significado | Destino propuesto | Tipo lógico | Unidad | Nulabilidad | Conv. PG | Conv. SQLite | Validación |
|---|---|---|---|---|---|---|---|---|
| GAL No. | Galpón de origen | cuyes.galpon_origen_id (FK) | UUID | — | NULL permitido | UUID | TEXT | FK a galpones; pendiente de correspondencia |
| POZA No. | Poza del registro histórico | contexto histórico (origen); cuyes.poza_id actual solo con evidencia | UUID | — | NULL permitido | UUID | TEXT | No demuestra ubicación actual; conservar como contexto histórico |
| MACHO No. | Padre | cuyes.padre_id (FK) o revisión | UUID | — | NULL permitido | UUID | TEXT | Resolver identidad; conservar referencia si no se confirma |
| MADRE No. | Madre | cuyes.madre_id (FK) o revisión | UUID | — | NULL permitido | UUID | TEXT | idem |
| NUPAR | Número de partos de la hembra | partos.numero_parto | INTEGER | — | NULL permitido | INTEGER | INTEGER | Validar consistencia entre hermanos/archivos |
| PESO PARTO | Peso de la madre al parir | pesajes (etapa=PARTO, parto_id) | NUMERIC(8,2) | gramos | NULL permitido | NUMERIC(8,2) | TEXT decimal | No asignar a cría |
| T.C.N.V | Nacidos vivos | partos.nacidos_vivos | INTEGER | — | NULL permitido (sin DEFAULT 0) | INTEGER | INTEGER | Sumas solo si conocido |
| T.C.N.M | Nacidos muertos | partos.nacidos_muertos | INTEGER | — | NULL permitido (sin DEFAULT 0) | INTEGER | INTEGER | idem |
| T.C.N.T | Total camada | partos.tamano_camada_nacida | INTEGER | — | NULL permitido (sin DEFAULT) | INTEGER | INTEGER | Validar V+M=T si ambos conocidos |
| ANIMAL No. | Código de negocio | cuyes.codigo_identificacion | VARCHAR(50) | — | NOT NULL | VARCHAR(50) | TEXT | Preservar texto y ceros; unicidad pendiente |
| SEXO | Sexo | cuyes.sexo | VARCHAR(1) | — | NULL permitido (sujeto a aprobación) | VARCHAR(1) CHECK | TEXT CHECK | 1→M, 2→H; otro→NULL |
| COLOR | Pelaje | cuyes.color_codigo + cuyes.pelaje_original | VARCHAR(20) | — | NULL permitido | VARCHAR(20) | TEXT | Conservar código original |
| OJOS | Ojos | cuyes.ojos_codigo | VARCHAR(20) | — | NULL permitido | VARCHAR(20) | TEXT | 1=negros, 2=rojos; conservar código |
| FECHA NACIMIENTO | Fecha de nacimiento | cuyes.fecha_nacimiento | DATE | fecha civil | NULL permitido | DATE | TEXT ISO | No es timestamp de sync |
| PESO NACIMIENTO | Peso al nacer | pesajes (etapa=NACIMIENTO) | NUMERIC(8,2) | gramos | NULL permitido | NUMERIC(8,2) | TEXT decimal | Vincular al animal |
| FECHA DESTETE | Fecha de destete | eventos (tipo=DESTETE).fecha | DATE | fecha civil | NULL permitido | DATE | TEXT ISO | Diferenciar fecha calculada de observada |
| PESO DESTETE | Peso al destete | pesajes (etapa=DESTETE, evento_id) | NUMERIC(8,2) | gramos | NULL permitido | NUMERIC(8,2) | TEXT decimal | Vincular al evento |
| FECHA PESO 4/SEMANAS | Fecha de pesaje seguimiento | pesajes.fecha_pesaje (etapa=4_SEMANAS) | DATE | fecha civil | NULL permitido | DATE | TEXT ISO | Conservar fecha efectiva |
| PESO 4/SEMANAS | Peso seguimiento | pesajes.peso_gramos (etapa=4_SEMANAS) | NUMERIC(8,2) | gramos | NULL permitido | NUMERIC(8,2) | TEXT decimal | Conservar procedencia |
| JAULA | Ubicación histórica | eventos (tipo=TRASLADO).poza_destino_id o revisión | UUID | — | NULL permitido | UUID | TEXT | No inferir traslado sin catálogo |
| DESTINO | Destino histórico | eventos (tipo=VENTA/DESCARTE/MUERTE) o revisión | VARCHAR | — | NULL permitido | VARCHAR | TEXT | No confundir con deleted_at |
| Columnas 16-22 (P:V) | Datos adicionales | extra_fields (conservado raw) | Varios | — | — | — | — | Procedencia capturada; sin normalizar |

### Formato reproductivo

| Encabezado | Significado | Destino propuesto | Tipo lógico | Unidad | Nulabilidad | Conv. PG | Conv. SQLite | Validación |
|---|---|---|---|---|---|---|---|---|
| Poza (bloque) | Poza reproductiva | pozas (referencia de contexto) | UUID | — | NOT NULL en bloque | UUID | TEXT | Galpón + poza identifican ubicación |
| Macho (bloque) | Padre del bloque | cuyes (referencia genealógica) | UUID | — | NULL permitido | UUID | TEXT | Resolver identidad |
| Hembra | Código de hembra | cuyes.codigo_identificacion | VARCHAR(50) | — | NOT NULL en bloque | VARCHAR(50) | TEXT | Patrón letras+dígitos |
| Peso (monta) | Peso de la hembra en monta | pesajes (etapa=MONTA) | NUMERIC(8,2) | gramos | NULL permitido | NUMERIC(8,2) | TEXT decimal | No sustituir peso del animal |
| Color | Pelaje | cuyes.color_codigo | VARCHAR(20) | — | NULL permitido | VARCHAR(20) | TEXT | Conservar código |
| Ojos | Ojos | cuyes.ojos_codigo | VARCHAR(20) | — | NULL permitido | VARCHAR(20) | TEXT | Conservar código |
| Parto 1..N (fecha) | Fecha de parto | partos.fecha_parto | DATE | fecha civil | NULL permitido | DATE | TEXT ISO | Despivotar eventos; reconciliar con individual |
| T.C.N. (por parto) | Nacidos vivos/muertos/total | partos.nacidos_vivos/muertos/tamano_camada | INTEGER | — | NULL permitido | INTEGER | INTEGER | Una camada, no una por cría |

## Vínculo cría ↔ parto de nacimiento

- No existe FK directa cría→parto en el modelo actual.
- Se modela en `importacion_correspondencias` con `origen_rol = 'CRIA_DE_PARTO'`.
- Una tabla futura `parto_crias` puede formalizarlo. Mientras tanto, la correspondencia revisada conserva la relación.
- No se declara completo con una columna genérica de detalle.

## Datos de empadre

- Se representan como evento tipo EMPADRE con fecha, poza y macho asociado.
- Peso de monta se almacena como pesaje con etapa MONTA y evento_id apuntando al evento EMPADRE.
- No se crea tabla separada de empadres hasta confirmación de Lope/Oskar.

## Mortalidad vs eventos tipo MUERTE

- `mortalidad` (tabla existente) es la representación autoritativa de muerte (fecha_deceso, causa_presunta).
- Evento tipo MUERTE es una anotación de revisión; no duplica mortalidad.
- Si se confirma, mortalidad se crea a partir del evento revisado, no al revés.

## Reglas confirmadas por Centro Lope

- Chapa reutilizable; identificador interno es UUID.
- Chapa + galpón + fecha de nacimiento sirve para buscar coincidencias, no es UNIQUE.
- Reproductores proceden del registro individual.
- Dos galpones reproductivos (1, 2), pozas 1-40 por galpón. Ubicaciones estables.
- Todos los pesos en gramos.
- PESO PARTO corresponde a la madre. El PESO de la cría corresponde a esa cría.
- Fecha vacía = pendiente de digitalizar. Conservar NULL. No inventar fechas.
- NUPAR = número de partos que lleva la hembra.
- T.C.N.V = nacidos vivos; T.C.N.M = nacidos muertos; T.C.N.T = total camada.
- Sexo: 1=macho, 2=hembra.
- Ojos: 1=negros, 2=rojos.
- Pelaje: B=blanco, R=rojo, B+Y=bayo. Conservar código original.
- Leyenda: M=muere, D=descarte, V=vendido, R=reemplazo, SP=sin placa, L=levante, E=engorde.
- 146 fue error de transcripción, no código de dominio.

## Fechas de negocio vs timestamps técnicos

- FECHA NACIMIENTO, FECHA DESTETE, fechas de parto son fechas civiles de negocio.
- created_at, updated_at, synced_at son timestamps técnicos de sincronización.
- Un valor cacheado de fórmula no demuestra que el dato se midió.
- Un campo con procedencia "formula (calculado)" no es medición observada.

## Valores desconocidos

- Vacío, X, notas o códigos desconocidos NO se convierten en cero, fecha o mortalidad.
- T.C.N. con texto (ej. "6M", "1+2M") se conserva como texto, no se parsea.
- Sexo distinto de 1/2 queda pendiente (None), nunca se asigna por defecto.
- Fechas vacías se conservan NULL.
- Cantidades desconocidas se conservan NULL (sin DEFAULT 0).

## Ampliaciones del parser necesarias (trabajo posterior, no implementadas)

- Extraer y normalizar GAL No., POZA No., MACHO No., MADRE No., NUPAR en `CandidateAnimal`.
- Extraer y normalizar PESO PARTO, T.C.N.V/M/T, PESO NACIMIENTO (hoy solo procedencia).
- Extraer FECHA DESTETE, PESO DESTETE, FECHA/PESO 4 SEMANAS, JAULA, DESTINO.
- Usar `to_decimal`/`to_int` para pesos y cantidades (hoy no se usan en `__main__`).
- Instanciar `CandidateLitter` en lugar de dict suelto.
- Normalizar `ojos` y `color` a códigos de catálogo (pendiente de Lope/Diery).
- Implementar despivot de Parto 1..N en eventos individuales.
- Implementar reconciliación de correspondencias individual↔reproductivo.