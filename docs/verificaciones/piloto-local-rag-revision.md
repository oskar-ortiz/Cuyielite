# Evidencia: piloto local, RAG real y revisión ETL (2026-11-16)

Estado: **piloto local operativo**, **RAG extractivo real indexado y comprobado**, **auditoría ETL generada con decisiones pendientes**. RF y promoción real siguen pendientes. Rama `feat/piloto-local-rag-revision-etl` desde `dev` `4c8294f` (PR #156 fusionado).

## 1. Entradas y huellas

Los originales permanecen en `%TEMP%`. La copia de trabajo y `hashes.txt` están en `%LOCALAPPDATA%\CuyiElite\piloto-local\entradas`. Ninguna entra a Git.

| Archivo | SHA-256 (prefijo) |
|---|---|
| `produccion_cuyes.pdf` | `c33392cb1422…` (coincide con el valor entregado) |
| `REG IND GALPON 1 2026.xlsx` | `41cbd65b976c…` |
| `REG IND GALPON 2 2025-2026.xlsx` | `cc3f4e076f34…` |
| `REGISTRO REPRODUCTIVO GALPON 1.xlsx` | `af4a35a9c7bc…` |
| `REGISTRO REPRODUCTIVO GALPON 2 VIEJO.xlsx` | `1e6add8b7a67…` |
| `candidate_random_forest_b.joblib` | `744349c43b47…` (no cargado: artefacto no reconciliado) |
| `metadata.json` | `0d60ba11604d…` (metadata, no modelo) |

## 2. Piloto local y cuentas

- Base `cuyielite` en `cuyielite-db-1` (`pgvector/pgvector:pg16`), volumen persistente `pgdata`, puerto **5434**. El puerto 5432 pertenece al PostgreSQL nativo de Windows y el 5433 a `cuyielite-s3-test`; ninguno se tocó.
- Bootstrap + migraciones `0001`–`0009` aplicados en la base de la aplicación y en la base del corpus.
- Ámbito único **Centro Lope** para ambos galpones; UUID entregado solo en el archivo privado de credenciales.
- Cuentas `lope.admin` (admin) y `lope.viewer` (viewer) con contraseñas aleatorias; rotadas correctamente con `backend.app.auth_cli`.
- Rol técnico `cuyielite_etl`: `SELECT/INSERT/UPDATE` sobre dominio e importación; sin acceso a `app_users`, `auth_sessions` ni `auth_audit`, y sin `DELETE`. Comprobado con `has_table_privilege` y con una consulta rechazada.
- Control: `scripts\piloto-local.ps1 start|stop|status|backup|restore-check`. La API corre con el intérprete de `rag/.venv` porque importa el pipeline en el mismo proceso.

Verificación de acceso (sin secretos en la salida):

```text
lope.admin: login, /auth/me y refresh OK (rol admin)
lope.viewer: login, /auth/me y refresh OK (rol viewer)
viewer: escritura rechazada con 403 ROL_SIN_ESCRITURA (sin persistencia)
sin token: 401 OK
```

La rotación de refresh revoca el access token anterior: las comprobaciones usan el token vigente devuelto por `/auth/refresh`.

## 3. RAG real

- Entorno: `rag/.venv` con `backend/requirements.txt` + `rag/requirements.txt`.
- Modelo: `intfloat/multilingual-e5-base` (768 dimensiones), descargado en `rag/.cache` (no versionado).
- Corpus: `produccion_cuyes.pdf`, SENA / Centro Internacional de Producción Limpia – Lope, 2018, ISBN 978-958-15-0336-0, 86 páginas, CC BY-NC-SA 4.0 (página física 3). Registrado en `corpus_catalogo` de `cuyielite_rag`.
- Base del corpus: `cuyielite_rag`, separada de los registros productivos.
- Indexación: **76 fragmentos**, todos de `produccion_cuyes.pdf`, `vector_dims=768`. Una segunda indexación dejó **76 fragmentos**: sin duplicados.
- Modo extractivo con `LLM_PROVIDER=none`: respuesta con el texto del manual y citas `[documento, p. N]`; Ollama no se invocó.

Comprobación independiente (`tools/piloto/verificar_rag.py`, preguntas nuevas, umbral sin ajustar):

```text
5 preguntas dentro del corpus: fuentes con documento y página correctos
3 preguntas fuera del corpus: abstención con fuentes=[]
```

Controles adicionales: `POST /assistant/query` sin token devuelve 401; con `RAG_DATABASE_URL` apuntando a una base inexistente el adaptador devuelve `RagNoDisponible` (`RAG_NO_DISPONIBLE`), distinto de una respuesta inventada.

**Límite**: es comprobación técnica de recuperación y citas, no revisión zootécnica del contenido.

### Defectos corregidos en el cliente

1. La pantalla del asistente pedía un *token de laboratorio* aunque el endpoint valida el JWT del piloto. Ahora `AsistenteTrabajo.tsx` usa `ensureAccessToken()` cuando `AUTH_MODE === 'pilot'` y oculta ese campo; el modo laboratorio conserva su token manual. Regresión: `AsistenteTrabajo.pilot.test.tsx` (2 pruebas).
2. El plugin Electron y el transporte Android tenían plazos de 10 s y 30 s, insuficientes para la primera inferencia con embeddings. El asistente usa ahora 120 s; el resto de rutas conserva su plazo.

### Recorrido en la app

- **Windows / Electron (variante de trabajo)**: verificado. Con la sesión de `lope.admin` en un perfil aislado (`--user-data-dir` propio), la pantalla del asistente muestra «La consulta usa la sesión activa del piloto», ya no pide token manual, y al preguntar por el año de importación muestra la respuesta del manual y la cita `produccion_cuyes.pdf, p. 12`. La instalación habitual (`%APPDATA%\CuyiElite`) no se tocó.
- **Android**: el paquete aislado `co.ucc.cuyielite.lab` se compiló con JDK 21 y `-PlabAppId=true`, se instaló en Pixel_36 y abrió el modo trabajo sin tocar el paquete habitual `co.ucc.cuyielite`. La automatización de la consulta en pantalla quedó **bloqueada por recursos del emulador**: el guard de `scripts/start-pixel.ps1` rechazó el arranque por falta de margen de memoria en el primer intento, y durante la sesión apareció un ANR de «System UI isn't responding» además de pérdida de caracteres al introducir credenciales con `adb input text`. No se cerraron aplicaciones ajenas ni se borraron datos para forzar la prueba. El mismo cambio de pantalla quedó cubierto por pruebas unitarias y verificado en Windows.

## 4. Auditoría de los Excel reales

- `parser_version=0.1.0`, `mapeo_version=0.1.0`, `sha256_before == sha256_after` en los cuatro archivos (`files_unchanged: true`).
- Un archivo por manifiesto: se generaron 4 juegos de `auditoria-*.json`, `revision-*.json` y `decisiones-pendientes-*.json`, más `indice-revision.json`, en `%LOCALAPPDATA%\CuyiElite\piloto-local\reportes`.
- Propuestas: 853 + 1403 + 486 + 686 = **3428**, todas `PENDIENTE`, sin revisor ni aceptaciones.

| Archivo | Propuestas | Celdas con error |
|---|---|---|
| REG IND GALPON 1 2026 | 853 | 0 |
| REG IND GALPON 2 2025-2026 | 1403 | 0 |
| REGISTRO REPRODUCTIVO GALPON 1 | 486 | 11 |
| REGISTRO REPRODUCTIVO GALPON 2 VIEJO | 686 | 10 |

Los errores `#VALUE!` están en columnas O/P/Q, fuera del recorrido de 12 columnas del parser. Antes de la corrección no aparecían en ningún reporte: ahora `auditoria.celdas_error` y `revision.celdas_error` listan documento, hoja, celda y valor, con advertencia explícita de **no convertir en cero ni usar como conteo**. Regresión sintética: `tools/lope_import/tests/test_error_cells.py`.

Lo que el revisor debe decidir, y sigue pendiente:

- Correspondencia de cada candidato con un animal, madre, parto o pesaje real.
- Las celdas `#VALUE!` listadas: corregir la fuente o descartar la celda, nunca asumir cero.
- `peso`/Monta: no implica procedencia revisada.
- AB: no autoriza inferir una cantidad confirmada de abortos.
- Duplicados y referencias ambiguas marcados en `warnings` y en `reconciliation_note`.

Para regenerar: `python -m tools.lope_import.preparar_revision --entradas ... --reportes ...`. Para promover, el revisor edita las decisiones y ejecuta `decisions build-manifest` y `promote --commit` con el `scope_id` autorizado.

## 5. Respaldo y recuperación

```text
Respaldo: %LOCALAPPDATA%\CuyiElite\piloto-local\respaldos\cuyielite-piloto-*.dump (pg_dump -Fc)
Restauración comprobada en cuyielite_pilot_restaurado: cuyes=0; ambitos=Centro Lope; migraciones=8
```

La restauración usa `CREATE DATABASE ... TEMPLATE` sobre una base aislada; nunca sobre la principal.

## 6. RF y promoción real: pendientes

- RF: **no disponible**. Diery debe entregar artefacto, metadata e informe de métricas reconciliados y la trazabilidad de las 805 filas. No se reentrenó, no se eligieron métricas y no se cargó el `.joblib` recibido.
- Promoción real: pendiente de las decisiones del revisor técnico designado, del `scope_id` autorizado y del dry-run con conteos. No se marcó ninguna correspondencia como aceptada para desbloquear una prueba.

## 7. Pruebas ejecutadas

```text
python -m pytest tools/lope_import/tests -q          55 passed
python -m pytest tools/db_migrate/tests -q           27 passed
npx vitest run --maxWorkers=1                        44 archivos, 243 pruebas
npm run build:electron / npm run build               OK
npx cap copy android + assembleDebug -PlabAppId=true BUILD SUCCESSFUL (JDK 21)
```

No se repitieron suites completas de backend sin cambios que lo justificaran.
