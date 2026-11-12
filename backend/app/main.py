"""Punto de entrada de la API de CuyiElite."""

from fastapi import FastAPI

from backend.app.controllers.assistant import router as assistant_router
from backend.app.controllers.galpones import router as galpones_router
from backend.app.controllers.health import router as health_router
from backend.app.controllers.ml import router as ml_router
from backend.app.controllers.sync import router as sync_router
from backend.app.controllers.sync_v2 import router as sync_v2_router

app = FastAPI(title="CuyiElite API")
app.include_router(health_router)
app.include_router(galpones_router)
app.include_router(sync_router)
app.include_router(sync_v2_router)
app.include_router(ml_router)
app.include_router(assistant_router)
