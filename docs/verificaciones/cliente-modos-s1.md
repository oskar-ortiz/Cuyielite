# S1: selección de Demostración y Trabajo

Fecha: 2026-11-05. Alcance: cliente Android y Windows, con datos sintéticos y perfiles aislados.

## Comportamiento implementado

- La ruta inicial permite elegir Demostración o Trabajo.
- Demostración conserva la base local existente y sus formularios.
- Trabajo consulta únicamente `trabajo.db` en Windows o `trabajoSQLite.db` en Android. Sus pantallas de galpones y pozas no ofrecen altas ni edición. La base puede estar vacía.
- Las rutas y los repositorios son explícitos por modo; cambiar de modo no copia ni mezcla registros.
- El plugin Electron expone solo `listWorkGalpones` y `listWorkPozasByGalpon`, con parámetros acotados. La ruta física y el SQL permanecen en el proceso principal.
- Android usa la conexión `trabajo` existente de C2. La inicialización de la base demo usa `execute` y `run` sin transacciones automáticas, porque su migración controla `BEGIN` y `COMMIT`; esto corrigió el error observado en una instalación limpia.

## Verificación automatizada

Desde `client/`:

```powershell
npm ci
npm run lint
npm run test:unit
npm run build
npm run test:e2e
npm run build:electron
npx cap sync android
cd android
$env:ANDROID_HOME = 'C:\Android'
.\gradlew.bat assembleDebug
```

Resultados de esta ejecución: lint y builds correctos; 62 pruebas unitarias y 2 pruebas E2E en verde. Las E2E del navegador verifican el selector y el aviso de que Trabajo requiere una app nativa; la lectura SQLite se comprobó en las apps nativas.

## Windows empaquetado

Se generó `win-unpacked` y se lanzó `CuyiElite.exe` con `userData` temporal aislado. Mediante CDP se verificó:

1. La ruta inicial muestra ambos modos.
2. Trabajo recién inicializado muestra estado vacío y no ofrece crear ni editar.
3. En la base de trabajo aislada se insertaron **solo para la prueba** un galpón y una poza sintéticos, con UUID. Al reabrir la app, Trabajo mostró ambos y continuó sin controles de edición.
4. Demostración mostró Galpón Norte y no mostró el galpón sintético de Trabajo.
5. Inspección SQLite de solo lectura: `trabajo.db` con `user_version=2`; base demo independiente con `user_version=1`, cuatro galpones y seis pozas.

La inserción sintética se hizo directamente en el perfil temporal, con la app cerrada. No forma parte del código de producción ni de un importador.

## Android emulado

Se creó un AVD temporal independiente con imagen API 36, se compiló e instaló el APK de depuración y se limpió **solo** el almacenamiento de esa instalación aislada. Mediante el WebView de depuración se verificó:

1. Selector inicial y ruta de Trabajo, que muestra estado vacío.
2. Cambio a Demostración: aparecen Galpón Norte, Sur, Occidente y Este.
3. Cierre forzado y reapertura: Trabajo sigue vacío y Demostración conserva los cuatro galpones.
4. Inspección de copias de ambas bases en modo solo lectura: `trabajoSQLite.db` con `user_version=2`, cero galpones y cero pozas; `cuyieliteSQLite.db` con `user_version=1`, cuatro galpones y seis pozas.

Durante la primera ejecución se detectó un error de transacción al inicializar la base demo desde cero. Se corrigió en el adaptador Android y se repitió la prueba sobre una instalación limpia con resultado correcto. No se usó el AVD personal `Pixel_36`.

## Límite de esta entrega

S1 verifica la separación de bases y la consulta nativa con datos sintéticos. La escritura en Trabajo, el outbox, la autenticación, la sincronización, la ingesta ETL y la integración de datos reales siguen pendientes. El éxito del laboratorio no sustituye las pruebas de integración y producción con los componentes de ambos roles.
