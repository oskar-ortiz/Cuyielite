# Piloto local persistente (Centro Lope)

Estado: **OPERATIVO EN ESTA MÁQUINA**. No autoriza una carga real de datos del Centro Lope ni una promoción.

## 1. Qué se aprovisionó

| Recurso | Detalle |
|---|---|
| Base de la aplicación | `cuyielite`, contenedor `cuyielite-db-1`, imagen `pgvector/pgvector:pg16`, volumen persistente `pgdata` |
| Puerto de la base | `5434` (variable `DB_PORT`). El puerto 5432 ya está ocupado por el PostgreSQL nativo de Windows y el 5433 por `cuyielite-s3-test`; ninguno de los dos se tocó |
| Base del corpus RAG | `cuyielite_rag`, misma instancia, bootstrap y migraciones propios; separada de los registros productivos |
| Esquema | bootstrap `db/ddl/central/*.sql` + migraciones `0001`-`0009` (las 9 aplicadas, incluida `0005_pesajes_check.sql`) |
| Ámbito | Un solo `sync_scopes` llamado **Centro Lope** para ambos galpones. El UUID se entrega en el archivo privado de credenciales, no se versiona |
| Cuentas de la app | `lope.admin` (admin) y `lope.viewer` (viewer), contraseñas aleatorias |
| Acceso técnico del ETL | Rol PostgreSQL `cuyielite_etl`, separado de las cuentas personales; contraseña aleatoria |
| API | FastAPI en `http://127.0.0.1:8000`, `CUYIELITE_AUTH_MODE=pilot` |

Los datos y dispositivos habituales de Windows y Android no se modificaron: no se cambiaron `scope_id`, `device_id`, cursores ni recibos.

## 2. Credenciales

Todo está en un único archivo privado, fuera de Git y con ACL restringida al usuario actual:

```
%LOCALAPPDATA%\CuyiElite\piloto-local\credenciales\cuentas-piloto.json
```

Contiene el UUID del ámbito, las contraseñas de `lope.admin` y `lope.viewer`, y la URL del rol técnico del ETL. El archivo `.env` de la raíz (también fuera de Git) tiene las claves JWT y de cursores; su copia privada está en:

```
%LOCALAPPDATA%\CuyiElite\piloto-local\credenciales\piloto-local.env
```

Oskar debe leer esos dos archivos en esta máquina. **No** están en el PR, en los logs ni en la documentación versionada.

Cambiar una contraseña con el mecanismo existente:

```powershell
python -m backend.app.auth_cli set-password --username lope.admin
```

El comando pide la nueva contraseña por consola; incrementa `auth_version` y revoca las sesiones anteriores del usuario. Para deshabilitar una cuenta: `python -m backend.app.auth_cli set-status --username lope.viewer --status disabled`.

El rol técnico del ETL no usa cuentas de la app. Sus privilegios se renovan con:

```powershell
python -m tools.piloto.aprovisionar `
  --credentials-file "$env:LOCALAPPDATA\CuyiElite\piloto-local\credenciales\cuentas-piloto.json"
```

Ese rol puede leer/insertar/actualizar las tablas del dominio y de importación, pero **no** puede leer `app_users`, `auth_sessions` ni `auth_audit`, y no tiene `DELETE`. Comprobado con `has_table_privilege` y con una consulta rechazada por `InsufficientPrivilege`.

## 3. Arrancar, detener y consultar el estado

Un único punto de control, con tres acciones:

```powershell
.\scripts\piloto-local.ps1 start          # base + API
.\scripts\piloto-local.ps1 status         # base, health y cuentas
.\scripts\piloto-local.ps1 stop           # API + base; el volumen pgdata se conserva
```

`start` usa `tools/piloto/servidor.py`, que lanza la API como proceso separado (DETACHED_PROCESS) y registra su PID bajo `%LOCALAPPDATA%\CuyiElite\piloto-local\estado`. Los logs quedan en `%LOCALAPPDATA%\CuyiElite\piloto-local\logs`.

## 4. Respaldo y recuperación

```powershell
.\scripts\piloto-local.ps1 backup         # pg_dump -Fc en %LOCALAPPDATA%\CuyiElite\piloto-local\respaldos
.\scripts\piloto-local.ps1 restore-check  # CREATE DATABASE ... TEMPLATE cuyielite
```

`restore-check` **nunca** restaura sobre la base principal: crea `cuyielite_pilot_restaurado`, comprueba conteos, ámbitos y migraciones, y deja esa base aislada para su revisión. Comprobado en la entrega anterior: `cuyes=0; ambitos=Centro Lope; migraciones=8`. Esa base es una instantánea previa a `0005` y se conserva como evidencia; las bases activas `cuyielite` y `cuyielite_rag` tienen 9 migraciones.

## 5. RAG del piloto

- Entorno: `rag/.venv` con `backend/requirements.txt` + `rag/requirements.txt`. La API se ejecuta con ese intérprete para poder importar `rag.src.retrieve` en el mismo proceso.
- Modelo: `intfloat/multilingual-e5-base`, 768 dimensiones, descargado en `rag/.cache/` (no versionado).
- Corpus: `produccion_cuyes.pdf`, SENA / Centro Internacional de Producción Limpia – Lope, 2018, ISBN 978-958-15-0336-0, 86 páginas físicas, licencia CC BY-NC-SA 4.0 en la página 3, SHA-256 `c33392cb1422bfe50b0f44ccfcc2917888b4aa9b0329830d2b13db3a289a91ea`. La procedencia está registrada en la tabla `corpus_catalogo` de `cuyielite_rag`.
- Modo: extractivo (`LLM_PROVIDER=none`). Ollama no se invoca.
- Base: `cuyielite_rag`, separada de `cuyielite`.
- Comprobado: 76 fragmentos, 768 dimensiones, reindexación sin duplicados, 5 preguntas con cita correcta y 3 abstenciones, y respuesta visible en la pantalla del asistente de Windows/Electron con la sesión del piloto. En Android el paquete aislado `.lab` compila y arranca, pero la consulta en pantalla quedó bloqueada por recursos del emulador (ver evidencia).

## 6. Auditoría de los Excel reales

Los originales siguen en `%TEMP%` y una copia de trabajo, con `hashes.txt`, en:

```
%LOCALAPPDATA%\CuyiElite\piloto-local\entradas
```

Los reportes privados están en `%LOCALAPPDATA%\CuyiElite\piloto-local\reportes`. Para regenerarlos:

```powershell
python -m tools.lope_import.preparar_revision `
  --entradas "$env:LOCALAPPDATA\CuyiElite\piloto-local\entradas" `
  --reportes "$env:LOCALAPPDATA\CuyiElite\piloto-local\reportes"
```

Por archivo se generan `auditoria-*.json`, `revision-*.json` y `decisiones-pendientes-*.json`, más un `indice-revision.json` con conteos y huellas. El `lote_id` es estable por huella de archivo (`uuid5`) para que un reintento no cambie la identidad del lote.

Todas las decisiones quedan `PENDIENTE`, sin revisor ni aceptaciones. La promoción requiere decisiones humanas del revisor técnico designado; no se usa a Oskar, Diery ni la cuenta `admin` como revisor por defecto.

## 7. Preflight de Android

`scripts/start-pixel.ps1` exige `RAM disponible >= 2560 MB` (parámetro `-AvdRamMb`) **y** margen de commit de al menos 4 GB antes de arrancar Pixel_36. Si solo hay margen de commit, el emulador arranca pero System UI entra en ANR y la app queda en pantalla negra: eso ocurrió con 239–654 MB de RAM disponible. El rechazo no cierra aplicaciones ni cambia el archivo de paginación. Estado observado el 2026-11-17: **bloqueado**, sin recorrido Android verificado; detalle en `docs/verificaciones/android-rag-preflight.md`.

## 8. Límites

- No se hicieron cargas reales ni promociones; las tablas de dominio del piloto están vacías.
- RF sigue **no disponible**: Diery debe entregar el paquete reconciliado (artefacto, metadata e informe de métricas coincidentes y trazabilidad de las 805 filas). No se reentrenó ni se eligió un modelo sustituto.
- La evaluación oficial sigue siendo una acción explícita y autorizada; importar o revisar evidencia no evalúa animales.
