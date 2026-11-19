# Paquete de entrega — Ensayo Windows y celular

Actualizado: **19/11/2026**. Presentación prevista: **20/11/2026**. Estado: Ensayo funcional comprobado, separado de la aplicación principal. El aval del proyecto está confirmado por Oskar; la prueba de aceptación de Luis/SENA y la carga real se realizarán después.

## Usar mañana

1. [Arranque y recorrido de Ensayo](ensayo-funcional-aislado.md): Docker, **Iniciar Ensayo Local**, USB y app **CuyiElite Ensayo → Trabajo** en ambos equipos.
2. [Guion con explicación de cada pantalla](guion-demostracion.md).
3. [Plan de aceptación](plan-aceptacion.md), [observaciones](observaciones.md) y [conformidad/aval](conformidad.md). No prellenar resultados de una sesión que aún no ocurre.
4. [Evidencia real Windows/teléfono](../verificaciones/ensayo-funcional-windows-celular.md) y [matriz de pendientes actualizada](matriz-pendientes.md).

**Versión del código de Ensayo:** PR #191, commit `0e76da1`, integrado en `dev`. Ejecutable Windows propio y APK `.ensayo` actualizado; rutas y hashes vigentes en [Artefactos](ensayo-funcional-aislado.md#artefactos). La app principal conserva su instalación y sus datos; no usarla contra el backend de Ensayo.

El RAG está conectado y comprobado con respuesta/fuentes y abstención en ambas plataformas. Eso no cierra su pertinencia global: B8 y las limitaciones documentadas siguen con Diery. El RF reconciliado está integrado como apoyo; falta la validación experta, no una nueva entrega obligatoria del mismo binario.

**Decisión de Oskar, 19/11/2026:** B8 se aplaza para una mejora futura y no bloquea la presentación del Ensayo. Se conserva su evidencia como limitación conocida; no se marca corregido ni se promete pertinencia global o calidad de producción.

## Referencia histórica de la candidata del 18/11

Las secciones siguientes conservan la identificación de `candidata-ac81eef-20261118` y sus ensayos anteriores. **Sus rutas, APK `.lab` y pasos de emulador no son las instrucciones de la presentación actual.** Para mañana prevalecen los enlaces anteriores y los artefactos de Ensayo.

## 1. Qué incluye esta candidata

- Cliente Ionic + React, Electron y Capacitor sobre `origin/dev` `ac81eef` (PR #186, #187 y #188 integrados). Último cambio de código del cliente: `50cb59e`.
- Backend FastAPI con migraciones centrales `0001`–`0009`.
- Índice RAG actualizado de PR #186: 76 fragmentos, `top_k=5`, `RAG_MIN_SIMILARITY=0.807566308073`, `intfloat/multilingual-e5-base`. **No se reindexó en esta entrega.**
- Piloto local con PostgreSQL/pgvector, autenticación admin/viewer, sincronización, RF como apoyo y reglas zootécnicas como bloque principal.
- Documentación de verificación y el ensayo representativo de esta sesión.

No incluye: datos reales del Centro Lope, credenciales, modelos `.pkl`, Excel/PDF privados, respaldos con información identificable ni binarios versionados.

## 2. Cómo arrancarla

**Actualización posterior:** el [instalador Windows y APK para el celular](instalar-piloto.md) ya están preparados y el instalador se comprobó sobre la instalación existente. La guía enlazada contiene los archivos actuales, hashes y límites. El antiguo Setup del 12/11 sigue sin representar la candidata.

Guía operativa completa: [guia-usuario.md](guia-usuario.md). Resumen:

1. Windows: requisitos y backend local en `docs/operacion/piloto-local.md`.
2. `python -m tools.piloto.servidor start` → verificar `/health` 200 en `http://127.0.0.1:8000`.
3. Abrir el ejecutable empaquetado con el perfil aislado o el acceso directo separado.
4. Android: `adb reverse tcp:8000 tcp:8000` para el emulador; **no equivale a conectividad de un teléfono físico**.
5. Elegir Demo (datos de prueba) o Trabajo (base del piloto). Credenciales privadas: canal de Oskar; **no se copian en este paquete**.

## 3. Artefactos y versiones

| Artefacto | Ruta local | Identificación | SHA-256 | Firma |
|---|---|---|---|---|
| Windows empaquetado (verificado) | `client/electron/dist/win-unpacked/CuyiElite.exe` | `0.0.0` (Electron 45.2.1), `candidata-ac81eef-20261118`, 21:56 del 2026-11-18, 249.793.536 bytes, debug/desempaquetado | `05799d0dec2d91ce18a81a6f0a23718ca8563b80ee7e4e2c88d000b8f0db2c5a` | **Sin firmar**: `no code signing certificate configured, signing is skipped` |
| Android aislado (`.lab`, instalado y verificado) | `client/android/app/build/outputs/apk/debug/app-debug.apk` | `1.0` / `versionCode 1`, debug, JDK 21, `-PlabAppId=true`, 14.260.229 bytes | `ef41d9d628c16c02013ee8a24a9bd3bcb8cd4e25f7389eb7b3a8d1b5916ec1d3` | Debug; no es release de producción |
| Instalador NSIS (comprobado posteriormente) | `client/electron/dist/instaladores-piloto/CuyiElite Setup 0.0.0.exe` | Windows x64, per-user, 121.691.665 bytes; generado desde el paquete anterior mediante `--prepackaged` | `79d7c194edb4b0d6838344677c1562cd66d20b060d555974910f683a3809f164` | Sin firma comercial |

El acceso directo habitual apunta a `%LOCALAPPDATA%\Programs\cuyielite-electron\CuyiElite.exe`: **la instalación ya se actualizó** y se contrastaron binario y `app.asar` con el paquete verificado, conservando las bases. El acceso separado `CuyiElite Candidata ac81eef.lnk`, creado en la entrega inicial, sigue apuntando al paquete del repositorio; para uso habitual se utiliza **CuyiElite** del Escritorio o menú Inicio.

No se subió ningún binario al repositorio ni a una release pública.

## 4. Guías y evidencia

- [Guía breve de usuario](guia-usuario.md).
- [Guion de demostración](guion-demostracion.md), basado en `docs/verificaciones/entrega-plataforma-oskar.md`.
- [Plan de prueba de aceptación](plan-aceptacion.md).
- [Formato de observaciones](observaciones.md).
- [Registro de decisiones y conformidad](conformidad.md).
- [Matriz final de pendientes](matriz-pendientes.md); la fuente canónica sigue siendo `docs/verificaciones/matriz-carga-real-lope.md`.
- Ensayo real de esta candidata: `docs/verificaciones/ensayo-candidata-luis-sena.md`.
- Evidencia previa equivalente: `rag-comprobacion-ui.md`, `rag-actualizacion-piloto.md`, `rf-visualizacion-nativa.md`, `cierre-integracion-laboratorio.md`, `acceso-piloto-integracion.md`.

## 5. Limitaciones y requisitos del entorno

- Pertinencia RAG de gestación y vitamina C: pendiente con Diery. HTTP 200 y fuentes reales **no** acreditan corrección.
- Validación zootécnica, correspondencias y autorización de carga real: pendientes con Luis/SENA.
- Los cuatro documentos Lope tienen aprobación técnica de Oskar **con reservas**; no se presenta como pendiente ni como aprobación institucional.
- Baja memoria del emulador y ANR aislados son riesgos del entorno; no se forzaron ANR ni se debilitaron guardas.
- Sin conexión, la operación local y la outbox se conservan; la sincronización requiere backend y `adb reverse` en emulador.
- La app habitual (`co.ucc.cuyielite`), sus bases, Keystore, cursores, recibos y ámbitos permanecen intactos; solo se usó la variante `.lab`.
