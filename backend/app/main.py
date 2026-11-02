"""Punto de entrada de la API de CuyiElite."""

from fastapi import FastAPI

from backend.app.controllers.health import router as health_router

app = FastAPI(title="CuyiElite API")
app.include_router(health_router)
