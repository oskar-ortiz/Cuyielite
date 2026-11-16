"""Endpoints de evaluación persistente de reproductoras.

La evaluación se calcula en el servidor con reglas y datos centrales. El cliente
no envía ni la clase ni los motivos: solo los datos que el esquema central todavía
no tiene (abortos declarados) y las versiones que leyó, para detectar obsolescencia.
"""

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from backend.app.controllers.auth import require_identity, require_scope
from backend.app.schemas.evaluation import (
    EvaluationContextResponse,
    EvaluationRequest,
    EvaluationResponse,
)
from backend.app.services import auth as auth_service
from backend.app.services import evaluation as service
from backend.app.services import ml as ml_service

router = APIRouter(tags=["evaluaciones"])


def _write_scope(authorization: str | None) -> UUID:
    """Lectura para cualquier rol; escritura solo para admin en modo piloto."""
    if auth_service.auth_mode() == "pilot":
        identity = require_identity(authorization)
        if identity.role != "admin":
            raise HTTPException(status_code=403, detail="ROL_SIN_ESCRITURA")
        return identity.scope_id
    return require_scope(authorization)


def _translate(error: Exception) -> HTTPException:
    if isinstance(error, service.EvaluationError):
        return HTTPException(
            status_code=error.status,
            detail={"code": error.codigo, "message": error.mensaje},
        )
    if isinstance(error, ml_service.MlError):
        status = 422 if isinstance(error, (ml_service.MlNoAplica, ml_service.MlDatosInsuficientes)) else 503
        return HTTPException(status_code=status, detail={"code": error.codigo, "message": error.mensaje})
    return HTTPException(status_code=503, detail={"code": "EVALUACION_FALLIDA", "message": "Fallo interno"})


@router.get(
    "/evaluaciones/reproductoras/{cuy_id}",
    response_model=EvaluationContextResponse,
)
def read_context(cuy_id: UUID, authorization: str | None = Header(default=None)) -> EvaluationContextResponse:
    scope_id = require_scope(authorization)
    try:
        payload = service.context(scope_id, cuy_id)
    except service.EvaluationError as error:
        raise _translate(error) from None
    return EvaluationContextResponse(**payload)


@router.post(
    "/evaluaciones/reproductoras/{cuy_id}",
    response_model=EvaluationResponse,
)
def evaluate(
    cuy_id: UUID,
    request: EvaluationRequest,
    authorization: str | None = Header(default=None),
) -> EvaluationResponse:
    scope_id = _write_scope(authorization)
    try:
        payload = service.evaluate_and_persist(
            scope_id,
            cuy_id,
            abortos=request.abortos,
            peso_monta_g=request.peso_monta_g,
            base_version=request.base_version,
            base_partos_version=request.base_partos_version,
        )
    except (service.EvaluationError, ml_service.MlError) as error:
        raise _translate(error) from None
    return EvaluationResponse(**payload)
