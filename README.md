# CuyiElite

Sistema tecnológico de apoyo a la toma de decisiones para optimizar procesos y reducir la mortalidad en la producción de cuyes.
Trabajo de Grado, Universidad Cooperativa de Colombia (UCC), Ingeniería de Software, Pasto.
Validación de campo: Centro Agropecuario Lope (SENA).

## Estado y demostración local

Actualizado el **19/11/2026**. El **Ensayo funcional** está preparado y comprobado
en Windows y teléfono Android: acceso admin/consulta, inventario, registro local,
sincronización bidireccional, pesajes sin enlace, reglas/RF separados,
categorías/alertas y asistente documental. La aplicación principal conserva su
instalación y datos; el ensayo tiene perfil Windows, paquete Android y base propios.

En el equipo de Oskar, con Docker y el teléfono autorizado por USB:

1. Ejecutar **Iniciar Ensayo Local.cmd** del Escritorio.
2. Abrir **CuyiElite Ensayo → Entrar a trabajo** en ambos dispositivos.
3. Iniciar sesión con la cuenta privada de Ensayo si hace falta y sincronizar.
4. Entrar a **Galpón Norte → P-01 → Animales**.
5. Si se desconecta el USB, ejecutar **Reconectar celular Ensayo.cmd** y reintentar.

Estos accesos y servicios son locales a ese computador; no son un despliegue en
la nube. No usar la aplicación principal contra el backend mientras sirve Ensayo.
Las contraseñas, artefactos RF, APK, ejecutables y respaldos no se publican en Git.

- [Guion: botones, valores y qué explicar](docs/entrega/guion-demostracion.md).
- [Inicio, aislamiento, artefactos y recuperación](docs/entrega/ensayo-funcional-aislado.md).
- [Evidencia real Windows/teléfono](docs/verificaciones/ensayo-funcional-windows-celular.md).
- [Paquete de entrega y aceptación posterior](docs/entrega/README.md).

**Límites del cierre:** aval del proyecto y responsable de dominio confirmados por
Oskar; prueba de aceptación Luis/SENA y carga real posteriores. El RF es apoyo
exploratorio, no una categoría oficial. El RAG funciona con respuesta/fuentes y
abstención, pero conserva límites de pertinencia. **B8 queda aplazado por decisión
de Oskar para una mejora futura; no bloquea mostrar el Ensayo y no se declara
resuelto.** No se afirma aceptación de campo ni una versión de producción.

## Stack
- Cliente: Ionic + React (Android con Capacitor; Windows con la plataforma Electron)
- Persistencia local: SQLite (Android / Windows)
- Backend: Python FastAPI (Controllers, Services, Repositories)
- Base central: PostgreSQL + pgvector
- IA: Random Forest (scikit-learn) y motor RAG

La elección de SQLite local y PostgreSQL + pgvector central está registrada en
[docs/decisiones/0002-persistencia-local-sqlite.md](docs/decisiones/0002-persistencia-local-sqlite.md).
El esquema SQLite efectivo y sus migraciones están implementados en
[client/src/data/work.schema.ts](client/src/data/work.schema.ts); la paridad
central/local se documenta en
[docs/verificaciones/piloto-paridad-documentacion.md](docs/verificaciones/piloto-paridad-documentacion.md).

El empaquetado del cliente Windows está en
[docs/decisiones/0003-cliente-windows-electron.md](docs/decisiones/0003-cliente-windows-electron.md):
Capacitor cubre Android y Windows se entrega con la plataforma adicional
`@capawesome/capacitor-electron` sobre Electron.

## Estructura
```
client/   Ionic + React
backend/  FastAPI
ml/       Entrenamiento y evaluación del Random Forest
rag/      Indexación de manuales y embeddings
db/       Scripts DDL y datos sintéticos
docs/     Arquitectura, secciones del Trabajo de Grado y decisiones
```

## Primeros pasos

Preparación de un entorno de desarrollo nuevo. **No ejecutar estos pasos para
reinicializar el piloto o el Ensayo ya preparados**; para usarlos seguir las guías
anteriores, que conservan las bases y puertos existentes.

```bash
git clone https://github.com/oskar-ortiz/Cuyielite.git cuyielite
cd cuyielite
sh scripts/setup.sh                # activa el bloqueo de push a main
cp .env.example .env               # completar valores
docker compose up -d               # PostgreSQL + pgvector central en localhost:5432
pip install -r backend/requirements.txt
pytest backend
```

Cliente Windows (Electron):
```bash
cd client
npm install
npm run build:electron                        # bundle sin el plugin legacy
npx cap sync @capawesome/capacitor-electron
cd electron && npm install && npm run build && npm start
```

## Cómo trabajamos
Lee [CONTRIBUTING.md](CONTRIBUTING.md). Resumen: se trabaja en `dev`, con ramas `feat/*` y Pull Request revisado por el otro integrante. `main` no se toca sin acuerdo.

## Equipo
- Oskar Julián Ortiz Ortiz, Ingeniero de Software, Tech Lead / Arquitecto
- Diery Alejandro Valencia Itacual, Ingeniero de Software, Especialista en Datos e IA
- Asesores: Ing. Cristian Camilo Ordoñez Quintero y Mangin Luis Montenegro
