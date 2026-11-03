"""Controladores de galpones y pozas."""

from uuid import UUID

import psycopg

from fastapi import APIRouter, HTTPException, Query

from backend.app.schemas.galpones import GalponResponse, GalponesListResponse
from backend.app.schemas.pozas import PozaResponse, PozasListResponse
from backend.app.services import galpones as service

router = APIRouter(tags=["galpones"])


@router.get("/galpones", response_model=GalponesListResponse)
def list_galpones(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> GalponesListResponse:
    try:
        items = service.list_galpones(limit, offset)
    except (RuntimeError, psycopg.OperationalError):
        raise HTTPException(status_code=503, detail="Servicio no disponible")
    return GalponesListResponse(
        items=[GalponResponse(**i) for i in items],
        limit=limit,
        offset=offset,
    )


@router.get("/galpones/{galpon_id}/pozas", response_model=PozasListResponse)
def list_pozas(
    galpon_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> PozasListResponse:
    try:
        items = service.list_pozas_by_galpon(galpon_id, limit, offset)
    except ValueError:
        raise HTTPException(status_code=404, detail="Galpón no encontrado")
    except (RuntimeError, psycopg.OperationalError):
        raise HTTPException(status_code=503, detail="Servicio no disponible")
    return PozasListResponse(
        items=[PozaResponse(**i) for i in items],
        limit=limit,
        offset=offset,
    )