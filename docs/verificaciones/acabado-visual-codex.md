# Acabado visual con Codex — 2026-11-16

## Resultado

Refinamiento del sistema compartido de #149, conservando Ionic React e identidad existente. No es una declaración de validación integral de todas las pantallas.

## Correcciones

- Defecto reproducido: Ionic dark.system activaba fondo oscuro mientras tokens propios permanecían claros. Se alinearon tokens con prefers-color-scheme y las variables de body. La variante explícita por clase se conserva.
- Padding lateral seguro y ancho de contenedores coherente; controles de retorno con área mínima, botones y chips con texto multilínea.
- Tarjetas de elección con acciones alineadas; jerarquía de título fija en rem, contexto legible sin mayúsculas espaciadas.
- Cifras tabulares, ajuste de identificadores y comparaciones largas; hover restringido a puntero fino. Feedback de opacidad 120 ms con alternativa sin transición para movimiento reducido.

## Evidencia ejecutada

| Entorno | Resultado observado |
|---|---|
| Web 390 px oscuro | Reproducido tema mixto; tras corregir, tarjetas y texto coherentes, sin overflow horizontal medido |
| Web 1440 px claro | Inicio con dos opciones y acciones alineadas |
| Web 360 px oscuro | Acceso legible, formulario y acción dentro del desplazamiento |
| Web 768 px claro | Nuevo galpón, campos y foco visibles, sin overflow horizontal medido |
| Windows win-unpacked | Perfil temporal: inicio oscuro, Demo con 4 galpones, formulario real, guardar registro sintético y retorno al listado con el nuevo registro |
| Android | APK lab compilado; ejecución bloqueada antes del arranque por reserva de memoria de Windows |

Captura nativa: ../diseno/capturas/acabado-windows-demo-oscuro.png. No representa captura web ni mockup.

## Comprobaciones

- Lint (eslint, typecheck e2e y Prettier TS/TSX): correcto.
- Vitest: 43 archivos / 240 pruebas aprobadas.
- Build web y Electron: correctos; advertencias existentes de bundle e import dinámico permanecen.
- cap sync Electron y electron-builder --dir: correctos; advertencia existente del plugin sqlite comunitario; Demo usa plugin propio y funcionó.
- JDK21, assembleDebug -PlabAppId=true --no-daemon --max-workers=1: BUILD SUCCESSFUL.
- Detector Impeccable sobre los dos CSS modificados: [] (no equivale a certificación de accesibilidad).

## Límites y continuidad

Pixel_36 no estaba abierto. Intento de arranque normal sin snapshot falló antes de ADB: unable to map backing store for guest RAM / Insufficient RAM free for launching emulator. Log midió 27312 MB comprometidos, límite 29893 MB y reserva requerida 2560 MB, sin margen suficiente. No se instaló el APK, no se borraron datos ni se creó otro AVD. No se reintentó sin cambio de condiciones.

Quedan por ejecutar Android con este APK y la matriz nativa completa de ficha/evaluaciones/conflictos, temas, teclado y roles del rediseño. Las pruebas históricas no se presentan como nuevas. RF/RAG/ETL reales siguen fuera de alcance. No se modificaron backend, contratos ni esquemas.
