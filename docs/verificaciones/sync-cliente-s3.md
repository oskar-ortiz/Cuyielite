# Preparación local del outbox de sincronización

`work.sync.client.ts` prepara operaciones queued y congela un cuerpo para push. La
prueba usa SQLite en memoria y no realiza solicitudes HTTP ni modifica bases reales.

Una operación sucesora solo se prepara cuando su predecesora está `accepted`; una
poza solo cuando el alta del galpón padre está `accepted`. Para updates se congela
la versión central disponible; acciones fuera del contrato push v1 permanecen
queued.

Verificación ejecutada desde `client/`:

```powershell
npm run test:unit -- src/data/work.sync.client.test.ts
npm run lint
npm run build
npm run build:electron
```

Resultados: 3 pruebas enfocadas aprobadas; lint, typecheck E2E, Prettier y builds
web/Electron correctos. Vite muestra su advertencia existente de bundles mayores a
500 kB.

El envío del cuerpo congelado y la aplicación transaccional de recibos se
incorporan en un corte posterior: `sendPrepared` valida correspondencia y
protocolo, conserva la operación `prepared` ante fallo de transporte/recibo y
solo actualiza versión central cuando el servidor acepta. Esta capa recibe una
función de envío inyectada; no abre HTTP desde el renderer.

La identidad local se vincula al `scope_id` devuelto por el contexto autenticado.
`bindContext` comprueba versión del protocolo y coincidencia del dispositivo;
solo asigna el ámbito si todavía está vacío, deja como no-op una vinculación
idéntica y rechaza cambios de scope/dispositivo. `dataset_id` y `device_id` se
conservan y la vinculación sobrevive al cierre/reapertura.

La vinculación se cubre con 6 pruebas enfocadas; la suite unitaria del cliente
quedó en 89 pruebas aprobadas en esta rama.

La integración nativa del transporte, pull, cursor y la UI de conflictos siguen
en cortes posteriores y requieren verificaciones específicas.

En el corte de envío/recibo se ejecutaron 7 pruebas enfocadas y 83 pruebas
unitarias del cliente; lint, typecheck E2E, Prettier y build web/Electron quedaron
verificados en su respectiva rama de trabajo. La E2E nativa de toda la cadena se
mantiene como criterio separado hasta completar transporte e integración.
