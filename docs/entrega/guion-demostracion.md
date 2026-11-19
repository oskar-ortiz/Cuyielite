# Guion de demostración — candidata `candidata-ac81eef-20261118`

Basado en `docs/verificaciones/entrega-plataforma-oskar.md` §3. No se crea un guion contradictorio. Duración estimada realista: **25–30 minutos**, con pausas para preguntas.

## Preparación previa (5 min, antes de la sesión)

1. Backend del piloto activo: `python -m tools.piloto.servidor status` y `/health` 200.
2. Windows: ejecutable verificado `dist\win-unpacked\CuyiElite.exe` y perfil aislado; acceso directo `CuyiElite Candidata ac81eef.lnk`.
3. Android: Pixel_36 ya abierto, `adb reverse tcp:8000 tcp:8000`, app `.lab` instalada. No crear otro AVD.
4. Credenciales privadas disponibles para Oskar; **no** en pantalla ni en este paquete.
5. Confirmar qué casos ya están cubiertos por evidencia para no repetirlos.

## Secuencia de pantallas

| # | Pantalla / acción | Caso sintético | Qué explicar al instructor | Min |
|---|---|---|---|---|
| 1 | Elegir modo | Demo vs Trabajo | Bases separadas; Demo no toca la base del piloto | 2 |
| 2 | Galpones en Demo | Galpón Norte → pozas `P-101/P-102/P-103` | Consulta local y estructura galpón → poza → animal | 2 |
| 3 | Acceso | Admin y viewer | Roles; viewer solo consulta; sesión con ámbito y dispositivo | 3 |
| 4 | Registro local | Alta/edición de un galpón o poza sintética en Demo | Persistencia local y permisos; nunca dato real | 3 |
| 5 | Sincronización | `context → pull → push`; repetir | Outbox, idempotencia, sin duplicación | 4 |
| 6 | Revisar conflictos | Conflicto sintético | Resolución por acción autorizada; sin merge automático | 3 |
| 7 | Predicciones | Reglas principales; RF presente y ausente | Reglas deciden; RF es apoyo; sin modelo no se inventa apoyo | 4 |
| 8 | Evaluaciones y alertas | Cuarto parto; dos abortos; evidencia declarada/revisada | Provisional vs oficial; sin descarte automático | 3 |
| 9 | Asistente | Pregunta con fuentes y pregunta fuera de corpus | Fuentes visibles y abstención; **pertinencia pendiente** | 3 |
| 10 | Cerrar y reabrir | Sesión y datos | Continuidad según comportamiento vigente | 2 |

## Plan alternativo

- **Sin red/backend**: mostrar solo Demo, registro local y outbox pendiente; no simular sincronización. Usar la matriz de evidencia y logs.
- **Sin memoria en el emulador**: no forzar arranque ni ANR; usar el ejecutable Windows y la evidencia Android ya registrada.
- **Si falta el modelo RF**: mostrar «Sin apoyo del modelo»; no es un fallo.
- **Si el asistente no responde**: comprobar `/health` y `adb reverse`; no inventar respuesta ni usar HTTP para simular la pantalla.

## Qué NO presentar como validado

- Pertinencia de las respuestas de gestación y vitamina C.
- Aceptación institucional, aprobación de correspondencias ni autorización de carga real.
- El instalador NSIS (no regenerado) ni firma/distribución certificada del ejecutable.
- El acceso directo habitual (apunta a una versión anterior).
- Resultados de evaluaciones de dominio que no hayan sido revisados por Luis/SENA.
- El APK debug como “release de producción”.
