# Recorrido funcional con animales sintéticos

El laboratorio usa una base PostgreSQL propia, un perfil Windows separado y el paquete Android `co.ucc.cuyielite.ensayo`. No publica registros en la base del piloto ni usa Excel reales. El backend de ensayo y el del piloto se alternan en el puerto 8000; nunca se deben usar indistintamente desde el mismo perfil/dispositivo lógico.

## Entrar al ensayo preparado en este equipo

1. Abrir **CuyiElite Ensayo** del Escritorio de Windows, no el acceso habitual. Ese acceso utiliza el ejecutable instalado con `--user-data-dir` propio.
2. En el celular abrir **CuyiElite Ensayo**, no CuyiElite ni la variante `.lab`. Tiene nombre de launcher diferenciado y sus propias bases/Keystore.
3. En ambos: **Trabajo → Acceso**. Usuario `ensayo.admin`; contraseña privada en `%LOCALAPPDATA%\CuyiElite\ensayo-funcional\cuentas.json`. La cuenta `ensayo.viewer` sirve para consulta. No son las cuentas del piloto.
4. Abrir **Sincronización** y sincronizar hasta que termine. Volver a **Galpones**.
5. Abrir **ENSAYO · Galpón A → ENS-P01 → Animales**. Aparecen `ENS-MADRE`, `ENS-CANDIDATA` y `ENS-MACHO`. En `ENS-P02` está `ENS-CRIA`.

El dominio tiene un galpón, dos pozas, cuatro animales, cuatro partos de ENS-MADRE, un pesaje inicial de 950 g de ENS-CANDIDATA, un evento y un vínculo cría–parto. Son ejemplos ficticios, no recomendaciones de manejo ni datos del Centro Lope. La fecha del cuarto parto es 2026-11-01 para facilitar un caso verificable de evaluación.

## Demostración guiada, un paso por vez

| Paso | Dónde | Acción / resultado a comprobar |
|---|---|---|
| 1 | Ambos | Acceso como admin, sincronización y mismo galpón/animales |
| 2 | Windows | Ficha ENS-CANDIDATA: registrar un pesaje ficticio de `975.50` g; elegir fecha y etapa según los campos reales del formulario |
| 3 | Windows y luego celular | Sincronizar ambos; comprobar que el pesaje aparece una sola vez en el teléfono |
| 4 | Celular | Desconectar USB; registrar otro pesaje ficticio de `980.25` g y comprobar que queda local/pendiente |
| 5 | Celular y luego Windows | Reconectar, restablecer reverse por serial, sincronizar; comprobar el pesaje y repetir sync sin duplicación |
| 6 | Ficha de animal | Consultar predicción informativa: reglas principales y RF separado; no equivale a evaluación oficial |
| 7 | ENS-MADRE | Revisar historial de cuatro partos y ejecutar evaluación explícita; observar fundamento y fecha sugerida, sin ejecutar descarte |
| 8 | Ambos | Consulta con ensayo.viewer: sin acciones de escritura; conserva datos del mismo ensayo |
| 9 | Ambos | Cerrar/reabrir y comprobar datos y sesión |

Estos pasos son el **guion a ejecutar**, no resultados ya observados. La preparación comprueba login/pull con el backend real; el recorrido se registra según se complete. Conflictos y evidencia declarada/revisada pueden añadirse después, sin modificar manualmente versiones, cursores ni recibos.

## Arranque y retorno al piloto

La configuración y las cuentas de este laboratorio son privadas y locales a este computador. Se dejó un controlador privado en `%LOCALAPPDATA%\CuyiElite\ensayo-funcional\control.py`. Ejecutar desde la raíz del repositorio:

```powershell
# Activar/reanudar el laboratorio (detiene solo el backend propio de este repo):
python "$env:LOCALAPPDATA\CuyiElite\ensayo-funcional\control.py" ensayo

# Consultar el modo registrado y /health:
python "$env:LOCALAPPDATA\CuyiElite\ensayo-funcional\control.py" status

# Al terminar, cerrar las apps de ensayo y volver al piloto habitual:
python "$env:LOCALAPPDATA\CuyiElite\ensayo-funcional\control.py" piloto
```

El controlador valida proceso y directorio antes de detenerlo. Lee la configuración privada del ensayo o el `.env` original según el modo; no reescribe el `.env`, no borra bases ni recalcula identidades. Conserva el laboratorio para repetir el recorrido. No sustituye un instalador portable del backend.

Con teléfono conectado, confirmar primero `adb devices -l` y luego `adb -s SERIAL_DEL_TELEFONO reverse tcp:8000 tcp:8000`. Para volver al piloto, abrir la app/perfil habituales después de restaurar el backend; no reutilizar las cuentas o cursores de Ensayo.

## Variante Android

`assembleDebug -PensayoAppId=true` genera el paquete `.ensayo` con nombre **CuyiElite Ensayo**. `-PlabAppId=true` conserva la variante `.lab`; los flags son excluyentes. Sin flags se mantiene el paquete habitual y su nombre. No cambia la lógica de negocio ni los transportes.

En esta preparación: build JDK 21, SDK local API36, un worker y heap 768 MB, **BUILD SUCCESSFUL**. También se procesó el manifiesto debug sin flags: paquete `co.ucc.cuyielite`, etiqueta `@string/app_name`. Se verificó que app_name y title_activity_main contienen el mismo texto habitual.

APK privado: `%USERPROFILE%\Downloads\CuyiElite-Piloto-20261118\CuyiElite-Ensayo.apk`, SHA-256 `b031f5a7e4ce3d42db9c004d57362259239ce8d63c003e693e21f7531f901877`. No reemplaza el APK `.lab` ya entregado. El teléfono rechazó la instalación ADB con `INSTALL_FAILED_USER_RESTRICTED`; Oskar instaló el archivo manualmente y se confirmó su paquete mediante `pm path`. No se cambiaron restricciones de seguridad.

## Evidencia de preparación

- PostgreSQL aislado preparado con bootstrap y migraciones oficiales. Cuentas nuevas y ámbito sintético propio.
- Galpón/pozas publicados mediante push v1 real; las cinco entidades de dominio, mediante `publicar_cambios` real en transacción.
- Login real y pull HTTP comprobados: v1 devolvió 14 items y v2 11; hay solapamiento de registros, no 25 entidades distintas. El cliente debe aplicar su idempotencia normal.
- El conteo de las siete tablas de dominio del piloto se comparó antes/después y no cambió.
- Artefacto RF configurado con hash autorizado `744349c43b4781dc5acef88e3db9dd6522d7b76c26a3f91e82d578792d6adce9`; no se reentrenó ni se versionó.
- RAG conserva corpus, índice, modelo y umbral; su pertinencia sigue en el frente de Diery.

No se declara todavía observado el intercambio de pesajes en UI ni una evaluación oficial en este nuevo laboratorio. El acceso, registro y sincronización se completarán con intervención manual de Oskar. No hay datos reales, aprobaciones de correspondencias ni autorización de carga institucional en este ensayo.
