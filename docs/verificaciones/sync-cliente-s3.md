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

El transporte nativo está integrado en este corte: Electron registra `SyncLab`
en el manifest y ejecuta fetch desde el proceso principal con URL/rutas fijas,
sin redirecciones; Android usa `CapacitorHttp` con URL loopback fija y rechaza
respuestas 3xx. El token se conserva en memoria y web no obtiene transporte.
Android permite HTTP a `127.0.0.1` solo en debug; la configuración release niega
tráfico en claro.

Transporte: 6 pruebas enfocadas aprobadas. En esta rama: suite cliente 95 passed,
lint/typecheck/Prettier, `build:migration`, build Electron y `cap sync android`
correctos; `gradlew assembleDebug` terminó en BUILD SUCCESSFUL. `cap sync` de
Electron registró `capacitor-sync-lab` y `capacitor-sqlite-poc`; omitió la
implementación Electron que el plugin comunitario no proporciona.

El paquete Windows unpacked se generó con
`npm --prefix electron run pack -- --dir`; electron-builder completó el empaquetado
x64 y `capacitor-electron vendor` incluyó los plugins locales. No se ejecutó aún
el ciclo contra el backend desde el binario empaquetado.

La E2E nativa con servicio/PostgreSQL temporal (contexto, bind, push, recibo,
reintento y reapertura) sigue pendiente. Pull, cursor y UI de conflictos siguen
en cortes S4 posteriores.

En el corte de envío/recibo se ejecutaron 7 pruebas enfocadas; en el corte de
vinculación, 6 pruebas enfocadas. La E2E nativa de toda la cadena se mantiene
como criterio separado hasta completar pull/conflictos e integración.
