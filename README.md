# CuyiElite

Sistema tecnológico de apoyo a la toma de decisiones para optimizar procesos y reducir la mortalidad en la producción de cuyes.
Trabajo de Grado, Universidad Cooperativa de Colombia (UCC), Ingeniería de Software, Pasto.
Validación de campo: Centro Agropecuario Lope (SENA).

## Stack
- Cliente: Ionic + React + Capacitor (Android / Windows)
- Persistencia local: PostgreSQL (administrado con DBeaver)
- Backend: Python FastAPI (Controllers, Services, Repositories)
- Base central: PostgreSQL + pgvector
- IA: Random Forest (scikit-learn) y motor RAG

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
docker compose up -d               # PostgreSQL + pgvector en localhost:5432
pip install -r backend/requirements.txt
pytest backend
```

## Cómo trabajamos
Lee [CONTRIBUTING.md](CONTRIBUTING.md). Resumen: se trabaja en `dev`, con ramas `feat/*` y Pull Request revisado por el otro integrante. `main` no se toca sin acuerdo.

## Equipo
- Oskar Julián Ortiz Ortiz, Ingeniero de Software, Tech Lead / Arquitecto
- Diery Alejandro Valencia Itacual, Ingeniero de Software, Especialista en Datos e IA
- Asesores: Ing. Cristian Camilo Ordoñez Quintero y Mangin Luis Montenegro
