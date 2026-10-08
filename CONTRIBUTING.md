# Guía de trabajo del equipo

## Ramas
| Rama | Uso |
|---|---|
| `main` | Versión estable. **No se toca** salvo que ambos integrantes lo hayan acordado (release o entrega). |
| `dev` | Rama de integración y rama por defecto. Aquí llega todo el trabajo. |
| `feat/*`, `fix/*`, `docs/*` | Ramas cortas, una por historia de usuario. |

## Flujo diario
1. `git switch dev && git pull`
2. `git switch -c feat/nombre-corto`
3. Commits pequeños y claros, por ejemplo: `feat(sync): agrega push de delta`.
4. Subir la rama y abrir un Pull Request **hacia `dev`**.
5. El otro integrante revisa y aprueba; después se hace merge y se borra la rama.

## Pasar a `main`
Solo con acuerdo de ambos: PR de `dev` a `main`, con pruebas en verde y, si aplica, un tag de versión.
En el plan gratuito GitHub no puede bloquear esto, por eso lo protegen el hook local (`scripts/setup.sh`) y este acuerdo.

## Reglas
- Nunca subir `.env`, credenciales, modelos `.pkl` ni datos reales del Centro Lope (Ley 1581 de 2012).
- Usar datos sintéticos en `db/seeds`.
- Todo cambio de arquitectura o de stack queda documentado en `docs/decisiones/`.
- Pair programming: quien no escribe se agrega con `Co-authored-by:` en el commit.
