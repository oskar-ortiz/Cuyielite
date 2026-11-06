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

El transporte HTTP, la aplicación de recibos, pull, cursor y la UI de conflictos
quedan fuera de esta unidad y requieren verificaciones posteriores.
