# RF real en plataforma: verificación y pendiente nativo (2026-11-17)

Estado: **backend verificado; visualización nativa Windows/Android pendiente de intervención manual**. No se cambió el modelo, las reglas ni el cargador de Diery.

## Artefacto y entorno

- Artefacto privado: `candidate_random_forest_b.joblib`, SHA-256 `744349c43b4781dc5acef88e3db9dd6522d7b76c26a3f91e82d578792d6adce9`; coincide con `ml/models/metadata.json`. No versionado.
- Cargador: `ml/model/artifact.py::load_verified_model` verifica hash con `hmac.compare_digest` antes de `joblib.load`. `backend/app/services/ml.py::load_candidate_model` lo invoca.
- Entorno de verificación: `rag/.venv` con Python 3.13.7, scikit-learn 1.9.1, pandas 3.1.1, openpyxl 3.1.5. El artefacto se deserializó y expone clases `ELITE`, `NORMAL`.
- Comprobación de comportamiento: sin `CUYIELITE_RF_MODEL_PATH` devuelve `None`; con hash modificado lanza `RF_MODEL_SHA256_MISMATCH` sin deserializar.
- Pruebas: `pytest ml/tests/test_artifact.py ml/tests/test_prediccion.py backend/tests/test_ml_adapters.py backend/tests/test_ml_endpoints.py -q` → **32 passed**.

## Laboratorio aislado

Base `cuyielite_rf_lab`, ámbito propio, dos animales sintéticos publicados con D1 (`publicar_cambios`, versión 1, secuencias 1 y 2). No se insertaron datos en el dominio persistente de Centro Lope. Backend aislado en `127.0.0.1:8001`.

| Caso | Resultado observado |
|---|---|
| Login admin y viewer | 200 |
| Candidata completa (destete 15 d, 950 g) | `ELITE` / `CONFIRMADO`; `apoyo_modelo` con `ELITE` y `NORMAL`, probabilidades en `[0,1]` que suman 1.0 |
| Candidata con faltantes | `NORMAL` / `REVISAR`; `apoyo_modelo: null` |
| Hembra con cuarto parto | `DESCARTE`, motivo `ciclo completo` |
| Viewer consulta | 200, sin escritura de dominio |
| Sin token | 401 |

Las reglas determinan la clase principal; el RF solo aparece en `apoyo_modelo`. No se publicó una probabilidad como categoría oficial.

## Límites científicos (verificados en la entrega de Diery)

2.256 filas leídas, 805 usadas, 275 grupos por código de madre; sin deduplicación entre archivos ni identidad global del animal; el RF no excluye automáticamente las 18 identidades en conflicto del ETL; las etiquetas derivan de reglas, no de validación experta independiente. No se reclama precisión clínica ni aprobación experta.

## Pendiente nativo — instrucción para Oskar (una acción por vez)

El laboratorio ya está preparado: backend aislado en `8001`, fixture sintética publicada, APK `co.ucc.cuyielite.lab` instalado en `emulator-5554` y `adb reverse 8000→8000` activo. Para ver el RF en la app se necesita que el cliente apunte al backend de laboratorio; eso exige un build con `VITE_API_BASE_URL=http://127.0.0.1:8001`, y en esta sesión la RAM disponible bajó a 485 MB, por lo que **no se rebuild ni se forzó el emulador**.

Si Oskar libera memoria y autoriza el build, el procedimiento es:

```powershell
cd client
$env:VITE_API_BASE_URL='http://127.0.0.1:8001'
npm run build:electron
npx cap copy android
```

Después, **una acción por vez**, corroborando cada resultado con captura o log antes de continuar:

1. Abrir la variante `.lab` en Windows con perfil aislado; iniciar sesión con la cuenta de laboratorio; entrar a un animal sintético y abrir Predicciones.
2. En Android, abrir `co.ucc.cuyielite.lab`, entrar a Trabajo → Acceso e iniciar sesión con la cuenta de laboratorio.
3. En cada plataforma, consultar una candidata y confirmar visualmente que la clase y los motivos están en el bloque principal y que el RF aparece en un bloque separado como apoyo exploratorio.
4. Confirmar que con datos faltantes se muestra `NORMAL + REVISAR` sin categoría definitiva y sin probabilidades inventadas.

Hasta que esas observaciones existan, la visualización nativa de RF queda **NO VERIFICADA**; los endpoints y el cargador sí quedan verificados.
