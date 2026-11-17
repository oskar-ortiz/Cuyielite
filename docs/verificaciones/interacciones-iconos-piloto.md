# Interacciones e iconografía del piloto

Fecha: 2026-11-16. Continuación del acabado de #150.

## Cambios

- Asistente integrado con PageIntro, SectionCard e InlineNotice: pregunta, respuesta y fuentes con jerarquía común. Iconos Ionicons de envío y libro; fuentes largas ajustables, texto plano conservado. La consulta en curso mantiene su bloqueo.
- Guardar incorpora un icono compartido y conserva texto, indicador de actividad y bloqueo. Tamaños y espaciado de iconos uniformes.
- Comparación de conflictos accesible mediante tabulación: región etiquetada y foco visible, sin cambiar decisiones o política de resolución.
- Se elimina el segundo contorno del selector: Ionic gestiona el borde y la etiqueta flotante. Los iconos de chips heredan su color semántico. Las tarjetas Ionic existentes comparten superficie, radio y tipografía con el sistema visual.
- Prueba de recuperación del asistente: servicio 503 anunciado como alerta, pregunta conservada y acción disponible para reintentar. Se corrigió el setup de esa suite para que el mock no se devuelva como función de limpieza de beforeEach.

## Arranque de Pixel

Usar desde la raíz del repositorio:

```powershell
powershell -NoProfile -File scripts/start-pixel.ps1
```

El script localiza un SDK instalado, verifica que Pixel_36 exista, reutiliza una instancia conectada y evita abrir otra sobre una instancia offline. Comprueba un margen de 4 GiB de memoria comprometida antes de lanzar. Arranca en ventana, con dos núcleos, 2560 MB, GPU host y sin cargar/guardar snapshots. No borra userdata, no instala paquetes, no cambia usuarios ni modifica el archivo de paginación. Informa memoria efectiva y timeout; boot_completed no acredita el funcionamiento de la aplicación.

Cerrar aplicaciones con trabajo guardado antes de iniciar. No mantener compilaciones, pruebas y emulador simultáneamente en este equipo de 8 GB. El script no cierra aplicaciones ajenas ni promete impedir cualquier ANR.

### Diagnóstico realizado

Los experimentos de 1536/2048 MB con -lowram consiguieron arrancar, pero provocaron bloqueos de System UI y system_server. Se descartaron como configuración final. Con autorización de Oskar se cerraron OpenCode, sus procesos auxiliares y Android Studio. Un arranque estable registrado tuvo 2138 MB físicos disponibles y 8561 MB de margen de memoria comprometida antes de reservar 2560 MB para el invitado. Android informó MemTotal 2532300 kB.

La variante aislada co.ucc.cuyielite.lab se instaló; la aplicación habitual no se reinstaló. Se comprobó desde la UI inicio, Demo, formulario con teclado, desplazamiento hasta Guardar y retorno al listado con Galpon_visual_Android. Después se abrió Trabajo y el asistente. Tema oscuro aplicado mediante la configuración Android y restaurado a su valor original (no).

Capturas nativas del recorrido:

- ../diseno/capturas/android-listado-claro.png
- ../diseno/capturas/android-formulario-teclado.png
- ../diseno/capturas/android-guardado-demo.png

## Límites

Los fallos durante los experimentos se distinguen del arranque final. No se califican como defectos de CuyiElite ni se elimina evidencia para forzar un resultado. La captura de ventana de la herramienta de escritorio produjo imágenes negras en parte del recorrido; las capturas Android se obtuvieron con adb exec-out screencap, y los toques/teclado con adb input.

No se ejecutan RF/RAG reales, ETL real ni validación con usuarios del Centro Lope. Las verificaciones históricas de evaluación, roles y sync no se presentan como nuevas en esta entrega.

## Paquetes y recursos de marca

Se sustituyeron los recursos de marca de arranque/icono por la misma huella que ya usa CuyiElite: iconos Android adaptativos y clasicos, splash Android, ICO de Windows con 7 resoluciones (16-256 px), splash Electron, favicon 64 px e icono web 512 px. El manifiesto antes apuntaba a archivos inexistentes. La fuente SVG y su compilacion determinista se documentan en client/resources/README.md; no se agrega dependencia en runtime.

## Checks sobre el codigo final

- Lint: eslint, tipos e2e y Prettier correctos.
- Suite cliente: 43 archivos, 241 pruebas aprobadas.
- Build web/Electron, copia Capacitor, tsc Electron y electron-builder --dir: correctos.
- assembleDebug con JDK 21: correctos tanto paquete .lab como habitual.
- XML nativos parseados; manifest y tamaños de PNG/ICO verificados.
- Detector Impeccable sobre CSS y componentes afectados: sin hallazgos mecanicos. No equivale a certificacion de accesibilidad.
- Persisten las advertencias previas de bundle grande, import dinamico inefectivo y plugin comunitario Electron omitido; la app usa los adaptadores propios.

## Recorrido con paquetes finales

- Android .lab: asistente en claro y oscuro, selector con un solo borde, error por falta de token visible con icono y texto. Tema restaurado a no. Capturas android-asistente-claro.png y android-asistente-oscuro-error.png.
- Aplicacion Android habitual: actualizacion install -r correcta. Los hashes SHA-256 de cuyieliteSQLite.db, pocSQLite.db y trabajoSQLite.db fueron iguales antes/despues de instalar, antes de abrir la app. Se abrio Elegir modo. Icono de marca observado en el lanzador (android-icono-cuyielite.png). No hubo ANR ni crash registrados en ese arranque; no se extrapola a los experimentos previos ni a todos los equipos.
- Windows empaquetado, perfil temporal: inicio, Trabajo vacio de solo consulta, asistente, selector, error sin token y pregunta conservada. El arbol de accesibilidad identifico el mensaje como alerta. Captura windows-asistente-final.png.
- Hallazgo final: los dialogos de selectores mostraban CANCEL/OK. Se fijaron Cancelar/Aceptar en todos los IonSelect de las pantallas de producto; 15 pruebas dirigidas de las pantallas afectadas y lint pasaron despues del ajuste.

La app habitual Android y su identidad se conservan. La variante .lab y su registro sintetico fueron eliminados. Pixel se apaga normalmente antes de ejecutar Windows. OpenCode/Android Studio se cerraron con permiso expreso de Oskar; no se borraron sus archivos.

El selector localizado se comprobo en el Windows empaquetado: arbol accesible y captura muestran CANCELAR / ACEPTAR (windows-selector-espanol.png). Los APK finales se dejan fuera de la carpeta que Gradle limpia: client/android/app/build/outputs/piloto/CuyiElite-regular.apk y CuyiElite-lab.apk. Sus identificadores son co.ucc.cuyielite y co.ucc.cuyielite.lab, comprobados con aapt. No se genero instalador NSIS: Windows se entrega como win-unpacked.

La actualizacion final de la app habitual, incluyendo los textos de selectores, volvio a conservar exactamente los hashes de sus tres bases. Se comprobo el dialogo CANCELAR / ACEPTAR en Android (android-selector-espanol.png). El buffer de eventos am_anr y el buffer crash estaban vacios al cerrar ese recorrido. El APK publicado localmente en outputs/piloto coincide por SHA-256 con el instalado. Pixel queda abierto con la app habitual; Windows de laboratorio quedo cerrado y su perfil temporal eliminado.
