# API HTTP de sincronización de laboratorio

Los endpoints `GET /sync/context` y `POST /sync/push` permanecen desactivados por
defecto. Para habilitarlos en un entorno aislado de laboratorio se debe configurar
`CUYIELITE_SYNC_LAB_ENABLED=1`; sin esa variable ambos devuelven `404` con
`SYNC_LAB_DISABLED`.

La bandera evita exponer accidentalmente la API experimental. Las rutas requieren
además un `Authorization: Bearer` válido y previamente provisionado en
`sync_devices`; el servidor compara el SHA-256 del token y deriva de él el ámbito
y dispositivo. No acepta un `scope_id` del cliente ni crea ámbitos o dispositivos
automáticamente. El `device_id` del cuerpo de push se admite solo si coincide con
el dispositivo autenticado. Tokens ausentes, desconocidos o ambiguos se rechazan.

El cliente debe mantener el token solo en memoria y nunca incluirlo en Git, logs o
informes. Esta autenticación de laboratorio no habilita uso compartido ni
producción: antes de esos escenarios deben revisarse aprovisionamiento,
rotación/revocación y controles operativos de credenciales.

El controlador valida la versión del protocolo, limita el lote a 100 operaciones,
rechaza IDs de operación o registros duplicados dentro del mismo lote y devuelve
un error genérico `503` si falla el servicio. Las pruebas de contrato HTTP usan
`TestClient` y sustituyen el servicio por mocks; no abren conexiones ni modifican
bases de datos.

Las pruebas de integración del servicio requieren `TEST_DATABASE_URL` explícita y
una base de pruebas con las migraciones aplicadas. Cada prueba crea un ámbito y
dispositivo UUID propios, registra solo el hash de un token sintético y elimina
solo las filas de ese ámbito; no usa una URL local fija ni limpia datos de otros
ámbitos.

Verificación local sobre PostgreSQL temporal aislado (bootstrap central y
migraciones `0001_lope_domain.sql` y `0002_sync_lab.sql` aplicados):

```powershell
python -m pytest backend/tests/test_sync_controller.py -q
python -m pytest backend/tests/test_sync.py -q
python -m pytest backend -q
```

Verificación de autenticación en PostgreSQL temporal aislado, con bootstrap y
migraciones `0001_lope_domain.sql` y `0002_sync_lab.sql`:

- Contrato HTTP + integración de sync: **26 passed**.
- Backend completo: **51 passed**.
- Casos nuevos: token ausente/desconocido, `device_id` del cuerpo ajeno al token y
  token ambiguo registrado en más de un ámbito (rechazo cerrado).
- El contenedor y la base `cuyielite_test` temporales se eliminaron al terminar.
- No se usaron datos reales ni tokens de usuarios; el fixture registra un token
  aleatorio sintético y solo persiste su hash.
