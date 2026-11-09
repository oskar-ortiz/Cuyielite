# AGENTS.md

Guía común para agentes IA en este repositorio.

## Contexto

CuyiElite: sistema de apoyo a la toma de decisiones para optimizar procesos y reducir la mortalidad en la producción de cuyes.
Trabajo de Grado, Universidad Cooperativa de Colombia (UCC), Ingeniería de Software, Pasto.
Validación de campo: Centro Agropecuario Lope (SENA).

Fuente: `README.md`.

## Stack

- Cliente: Ionic + React + Capacitor (Android / Windows).
- Persistencia local: PostgreSQL (administrada con DBeaver).
- Backend: Python FastAPI (Controllers, Services, Repositories).
- Base central: PostgreSQL + pgvector.
- IA: Random Forest (scikit-learn) y motor RAG.

Fuente: `README.md`, `docs/decisiones/0001-stack-ionic-postgres-local.md`.

## Estructura

```
client/   Ionic + React
backend/  FastAPI
ml/       Entrenamiento y evaluación del Random Forest
rag/      Indexación de manuales y embeddings
db/       Scripts DDL y datos sintéticos
docs/     Arquitectura, secciones del Trabajo de Grado y decisiones
```

Fuente: `README.md`.

## Ramas

| Rama | Uso |
|---|---|
| `main` | Versión estable. No se toca salvo acuerdo de ambos integrantes (release o entrega). |
| `dev` | Rama de integración y rama por defecto. |
| `feat/*`, `fix/*`, `docs/*`, `chore/*` | Ramas cortas, una por historia de usuario o tarea. |

Flujo:
1. `git switch dev && git pull`
2. `git switch -c feat/nombre-corto`
3. Commits pequeños y claros.
4. Subir la rama y abrir un Pull Request hacia `dev`.
5. El otro integrante revisa y aprueba; luego se hace merge y se borra la rama.

Pasar a `main`: solo con acuerdo de ambos, PR de `dev` a `main`, pruebas en verde y tag de versión si aplica.

Fuente: `CONTRIBUTING.md`, `README.md`.

## Commits

Formato: `tipo(ámbito): descripción`.
Tipos habituales: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

Fuente: `CONTRIBUTING.md`.

## Reglas

- Nunca subir `.env`, credenciales, modelos `.pkl` ni datos reales del Centro Lope (Ley 1581 de 2012).
- Usar datos sintéticos en `db/seeds`.
- Todo cambio de arquitectura o de stack se documenta en `docs/decisiones/`.
- Pair programming: quien no escribe se agrega con `Co-authored-by:` en el commit.

Fuente: `CONTRIBUTING.md`, `db/README.md`.

## Comandos

```bash
sh scripts/setup.sh                    # activa el bloqueo de push a main
cp .env.example .env                   # completar valores
docker compose up -d                   # PostgreSQL + pgvector en localhost:5432
pip install -r backend/requirements.txt
pytest backend
```

`docker-compose.yml`: imagen `pgvector/pgvector:pg16`, puerto `5432`, base `cuyielite`, usuario `cuyielite`, contraseña desde `${DB_PASSWORD}`.

`backend/requirements.txt`: `fastapi`, `pydantic>=2`, `uvicorn`, `pytest`.

Fuente: `README.md`, `docker-compose.yml`, `backend/requirements.txt`.

## Hook local

`scripts/setup.sh` ejecuta `git config core.hooksPath .githooks` y `chmod +x .githooks/pre-push`.
`.githooks/pre-push` bloquea el push directo a `main` salvo `ALLOW_MAIN=1`.

Fuente: `scripts/setup.sh`, `.githooks/pre-push`.

## CI

- `backend.yml`: en PR a `dev`/`main` con cambios en `backend/**` o `db/**`; en push a `dev`. Python 3.12. Pasos: `pip install -r backend/requirements.txt`, `pytest backend`.
- `client.yml`: en PR a `dev`/`main` con cambios en `client/**`. Node 20. Verifica `client/package.json`; si existe, corre `npm ci`, `npm run lint --if-present`, `npm run build`.

Fuente: `.github/workflows/`.

## TODO: completar

- Convenciones internas de `backend/` (estructura Controllers/Services/Repositories).
- Convenciones de `client/` una vez creado el proyecto Ionic.
- `db/`: DDL PostgreSQL central/local, control delta y seeds solo sintéticos; convenciones en [skills/db/SKILL.md](skills/db/SKILL.md).
- Estrategia de pruebas del cliente y de los modelos.
