"""Endpoints de evaluación persistente, evidencia revisable y alertas.

La clase siempre se calcula en el servidor. El cliente no envía clase, motivos ni
pruebas de revisión: solo declaraciones y versiones leídas.
"""

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException

from backend.app.controllers.auth import require_identity, require_scope
from backend.app.schemas.evaluation import (
    AlertView,
    CandidateEvaluationRequest,
    EvaluationContextResponse,
    EvaluationRequest,
    EvaluationResponse,
    EvidenceRequest,
    EvidenceReviewRequest,
    EvidenceView,
)
from backend.app.services import auth as auth_service
from backend.app.services import evaluation as service
from backend.app.services import ml as ml_service

router = APIRouter(tags=["evaluaciones"])


def _write_identity(authorization: str | None):
    """Escritura solo para admin en modo piloto; laboratorio conserva su token."""
    if auth_service.auth_mode() == "pilot":
        identity = require_identity(authorization)
        if identity.role != "admin":
            raise HTTPException(status_code=403, detail="ROL_SIN_ESCRITURA")
        return identity.scope_id, identity.user_id
    return require_scope(authorization), None


def _translate(error: Exception) -> HTTPException:
    if isinstance(error, service.EvaluationError):
        return HTTPException(
            status_code=error.status, detail={"code": error.codigo, "message": error.mensaje}
        )
    if isinstance(error, ml_service.MlError):
        status = (
            422
            if isinstance(error, (ml_service.MlNoAplica, ml_service.MlDatosInsuficientes))
            else 503
        )
        return HTTPException(
            status_code=status, detail={"code": error.codigo, "message": error.mensaje}
        )
    return HTTPException(
        status_code=503, detail={"code": "EVALUACION_FALLIDA", "message": "Fallo interno"}
    )


@router.get("/evaluaciones/reproductoras/{cuy_id}", response_model=EvaluationContextResponse)
def read_context(
    cuy_id: UUID, authorization: str | None = Header(default=None)
) -> EvaluationContextResponse:
    scope_id = require_scope(authorization)
    try:
        payload = service.context(scope_id, cuy_id)
    except service.EvaluationError as error:
        raise _translate(error) from None
    return EvaluationContextResponse(**payload)


@router.post("/evaluaciones/reproductoras/{cuy_id}", response_model=EvaluationResponse)
def evaluate_reproductora(
    cuy_id: UUID,
    request: EvaluationRequest,
    authorization: str | None = Header(default=None),
) -> EvaluationResponse:
    scope_id, actor = _write_identity(authorization)
    try:
        payload = service.evaluate_reproductora(
            scope_id,
            cuy_id,
            abortos=request.abortos,
            peso_monta_g=request.peso_monta_g,
            base_version=request.base_version,
            base_partos_version=request.base_partos_version,
            actor=actor,
        )
    except (service.EvaluationError, ml_service.MlError) as error:
        raise _translate(error) from None
    return EvaluationResponse(**payload)


@router.post("/evaluaciones/candidatas/{cuy_id}", response_model=EvaluationResponse)
def evaluate_candidata(
    cuy_id: UUID,
    request: CandidateEvaluationRequest,
    authorization: str | None = Header(default=None),
) -> EvaluationResponse:
    scope_id, actor = _write_identity(authorization)
    try:
        payload = service.evaluate_candidata(
            scope_id, cuy_id, base_version=request.base_version, actor=actor
        )
    except (service.EvaluationError, ml_service.MlError) as error:
        raise _translate(error) from None
    return EvaluationResponse(**payload)


@router.get("/evaluaciones/{cuy_id}/evidencias", response_model=list[EvidenceView])
def list_evidence(
    cuy_id: UUID, authorization: str | None = Header(default=None)
) -> list[EvidenceView]:
    scope_id = require_scope(authorization)
    try:
        payload = service.context(scope_id, cuy_id)
    except service.EvaluationError as error:
        raise _translate(error) from None
    return [EvidenceView(**item) for item in payload["evidencias"]]


@router.post("/evaluaciones/{cuy_id}/evidencias", response_model=EvidenceView)
def declare_evidence(
    cuy_id: UUID,
    request: EvidenceRequest,
    authorization: str | None = Header(default=None),
) -> EvidenceView:
    scope_id, actor = _write_identity(authorization)
    try:
        payload = service.declare_evidence(
            scope_id,
            cuy_id,
            campo=request.campo,
            valor=request.valor,
            actor=actor,
            origen=request.origen,
            archivo_huella=request.archivo_huella,
            hoja=request.hoja,
            fila=request.fila,
            celda=request.celda,
            parser_version=request.parser_version,
            mapeo_version=request.mapeo_version,
        )
    except service.EvaluationError as error:
        raise _translate(error) from None
    return EvidenceView(**payload)


@router.post("/evaluaciones/{cuy_id}/evidencias/revision", response_model=EvidenceView)
def review_evidence(
    cuy_id: UUID,
    request: EvidenceReviewRequest,
    authorization: str | None = Header(default=None),
) -> EvidenceView:
    scope_id, reviewer = _write_identity(authorization)
    try:
        payload = service.review_evidence(
            scope_id,
            cuy_id,
            campo=request.campo,
            decision=request.decision,
            reviewer=reviewer,
            nota=request.nota,
        )
    except service.EvaluationError as error:
        raise _translate(error) from None
    return EvidenceView(**payload)


__all__ = ["router", "AlertView"]
