# Verificación: diseño y experiencia del frontend (2026-11-16)

## Alcance

Rama `feat/client-diseno-experiencia-piloto`, base `dev` `faf3ab4`.

Pantallas revisadas:

- Inicio y elección Demo/Trabajo.
- Galpones (demo y trabajo).
- Detalle de galpón y pozas.
- Animales.
- Ficha de animal.
- Formularios: galpón, poza, animal, parto, pesaje, evento.
- Sincronización y conflictos.
- Acceso.
- Predicciones.
- Asistente.

## Comprobaciones ejecutadas

- `npm run lint`: sin errores después de la corrección de imports y formato.
- `npm run test:unit`: 43 archivos, 240 pruebas, todas en verde.
- `npm run build`: correcto.
- `npm run build:electron`: correcto.
- `npx cap copy android` + `gradlew assembleDebug`: BUILD SUCCESSFUL.
- `electron-builder --dir`: correcto.
- Revisión visual por código de móvil, tableta y escritorio; claro y oscuro.

## Capturas

- `docs/diseno/capturas/antes-inicio-escritorio.png`
- `docs/diseno/capturas/antes-inicio-movil.png`
- `docs/diseno/capturas/antes-trabajo-movil.png`
- `docs/diseno/capturas/despues-inicio-escritorio.png`
- `docs/diseno/capturas/despues-inicio-movil.png`

## Recorridos nativos

- Windows: pendiente de ejecución manual con perfil aislado sobre `win-unpacked`.
- Android: pendiente de ejecución manual con Pixel_36 y variante `.lab`.

## Límites

- RF, RAG y ETL reales siguen pendientes por entregas de Diery.
- No se simularon resultados de negocio para acreditar la UI.
- Las capturas de implementación son de la app web; la validación nativa final queda documentada como pendiente.