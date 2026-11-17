# Recursos de marca

La huella es el mismo `paw-outline` de Ionicons que utiliza la interfaz, sobre el azul principal `#1d4ed8`. No representa una marca nueva ni una ilustración original. Ionicons se distribuye bajo licencia MIT; su licencia está incluida en la dependencia `ionicons`.

Fuentes: `brand.svg` (vector) y `brand.png` (render de 512 px). Los recursos generados están versionados y no requieren generación durante el arranque de la app ni durante CI.

Para regenerarlos desde la raíz del repositorio, con las dependencias Electron ya instaladas y Python con Pillow:

```powershell
client/electron/node_modules/.bin/electron.cmd scripts/render-brand.cjs
python scripts/brand-assets.py
```

El renderizador usa Electron sin ventana interactiva y espera su primer frame. El compilador produce ICO multirresolución para Windows, PNG para navegador/Android y vectores Android con margen para la máscara adaptativa. Después se deben reconstruir y comprobar los paquetes nativos. No se incorporan fuentes remotas ni dependencias de ejecución adicionales.
