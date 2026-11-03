# CuyiElite

Sistema tecnológico de apoyo a la toma de decisiones para optimizar procesos y reducir la mortalidad en la producción de cuyes.
Trabajo de Grado, Universidad Cooperativa de Colombia (UCC), Ingeniería de Software, Pasto.
Validación de campo: Centro Agropecuario Lope (SENA).

## Stack
- Cliente: Ionic + React (Android con Capacitor; Windows con la plataforma Electron)
- Persistencia local: SQLite (Android / Windows)
- Backend: Python FastAPI (Controllers, Services, Repositories)
- Base central: PostgreSQL + pgvector
- IA: Random Forest (scikit-learn) y motor RAG

La elección de SQLite local y PostgreSQL + pgvector central está registrada en
[docs/decisiones/0002-persistencia-local-sqlite.md](docs/decisiones/0002-persistencia-local-sqlite.md).
El DDL del esquema local en SQLite queda pendiente de diseño con Diery.

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
```bash
git clone <url-del-repo>
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
