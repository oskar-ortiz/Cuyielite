"""Endpoints ML autorizados por ámbito (D5b)."""

from fastapi import APIRouter, Header, HTTPException

from backend.app.controllers.auth import require_scope
from backend.app.repositories import animals as animals_repo
from backend.app.schemas.ml import (
    CandidataRequest,
    CandidataResponse,
    HembraRequest,
    HembraResponse,
)
from backend.app.services import ml as ml_service

router = APIRouter(tags=["ml"])


def _animal_or_404(scope_id, animal_id):
    animal = animals_repo.get_animal_for_scope(scope_id, animal_id)
    if animal is None:
        raise HTTPException(status_code=404, detail="ANIMAL_NO_ENCONTRADO")
    return animal


def _translate(error: Exception) -> HTTPException:
    if isinstance(error, (ml_service.MlNoAplica, ml_service.MlDatosInsuficientes)):
        return HTTPException(status_code=422, detail={"code": error.codigo, "message": error.mensaje})
    if isinstance(error, ml_service.MlError):
        return HTTPException(status_code=503, detail={"code": error.codigo, "message": error.mensaje})
    return HTTPException(status_code=503, detail={"code": "ML_FALLO_INTERNO", "message": "Fallo interno"})


@router.post("/ml/predict/hembra", response_model=HembraResponse)
def predict_hembra(
    request: HembraRequest,
    authorization: str | None = Header(default=None),
) -> HembraResponse:
    scope_id = require_scope(authorization)
    animal = _animal_or_404(scope_id, request.cuy_id)
    datos = request.model_dump(exclude={"cuy_id"})
    try:
        result = ml_service.predecir_hembra_para(animal, datos)
    except ml_service.MlError as error:
        raise _translate(error) from None
    return ml_service.to_hembra_response(request.cuy_id, result)


@router.post("/ml/predict/candidata", response_model=CandidataResponse)
def predict_candidata(
    request: CandidataRequest,
    authorization: str | None = Header(default=None),
) -> CandidataResponse:
    scope_id = require_scope(authorization)
    animal = _animal_or_404(scope_id, request.cuy_id)
    datos = request.model_dump(exclude={"cuy_id"})
    try:
        result = ml_service.predecir_candidata_para(animal, datos)
    except ml_service.MlError as error:
        raise _translate(error) from None
    return ml_service.to_candidata_response(request.cuy_id, result)
