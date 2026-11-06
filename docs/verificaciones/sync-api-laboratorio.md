# API HTTP de sincronización de laboratorio

Los endpoints `GET /sync/context` y `POST /sync/push` permanecen desactivados por
defecto. Para habilitarlos en un entorno aislado de laboratorio se debe configurar
`CUYIELITE_SYNC_LAB_ENABLED=1`; sin esa variable ambos devuelven `404` con
`SYNC_LAB_DISABLED`.

Esta bandera evita exponer accidentalmente la API experimental, pero no constituye
autenticación. No habilitarla en un entorno compartido o de producción. La
autorización de dispositivos y ámbitos requiere una entrega posterior antes de
cualquier despliegue.

El controlador valida la versión del protocolo, limita el lote a 100 operaciones,
rechaza IDs de operación o registros duplicados dentro del mismo lote y devuelve
un error genérico `503` si falla el servicio. Las pruebas de contrato HTTP usan
`TestClient` y sustituyen el servicio por mocks; no abren conexiones ni modifican
bases de datos.

Las pruebas de integración del servicio requieren `TEST_DATABASE_URL` explícita y
una base de pruebas con las migraciones aplicadas. Cada prueba crea un ámbito y
dispositivo UUID propios y elimina solo las filas de ese ámbito; no usa una URL
local fija ni limpia datos de otros ámbitos.

Verificación local sobre PostgreSQL temporal aislado (bootstrap central y
migraciones `0001_lope_domain.sql` y `0002_sync_lab.sql` aplicados):

```powershell
python -m pytest backend/tests/test_sync_controller.py -q
python -m pytest backend/tests/test_sync.py -q
python -m pytest backend -q
```

Resultados registrados: 8 pruebas de contrato HTTP, 12 pruebas de integración del
servicio y 45 pruebas del backend completo aprobadas. El contenedor temporal se
eliminó después de las pruebas; no se usaron datos reales.
