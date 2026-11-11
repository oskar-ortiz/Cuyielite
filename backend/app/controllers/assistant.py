"""Endpoint del asistente RAG autorizado por ámbito (D5b)."""

from fastapi import APIRouter, Header, HTTPException

from backend.app.controllers.auth import require_scope
from backend.app.schemas.ml import AssistantRequest, AssistantResponse
from backend.app.services import ml as rag_service

router = APIRouter(tags=["assistant"])


@router.post("/assistant/query", response_model=AssistantResponse)
def assistant_query(
    request: AssistantRequest,
    authorization: str | None = Header(default=None),
) -> AssistantResponse:
    require_scope(authorization)
    try:
        result = rag_service.consultar_asistente(request.pregunta, request.top_k)
    except rag_service.MlError as error:
        status = 503
        raise HTTPException(status_code=status, detail={"code": error.codigo, "message": error.mensaje}) from None
    return AssistantResponse(**result)
