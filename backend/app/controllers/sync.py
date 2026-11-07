"""Controladores de sincronización del laboratorio."""

import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from backend.app.schemas.sync import SyncPushRequest, SyncPushResponse
from backend.app.services import sync as service

router = APIRouter(tags=["sync"])


class SyncContextResponse(BaseModel):
    protocol_version: int
    scope_id: str
    device_id: str
    limits: dict


def _require_lab_enabled() -> None:
    if os.environ.get("CUYIELITE_SYNC_LAB_ENABLED") != "1":
        raise HTTPException(status_code=404, detail="SYNC_LAB_DISABLED")


def _extract_token(authorization: str | None) -> str:
    if not authorization:
        return ""
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        return ""
    return token.strip()


@router.get("/sync/context")
def get_context(authorization: str | None = Header(default=None)) -> SyncContextResponse:
    _require_lab_enabled()
    token = _extract_token(authorization)
    try:
        ctx = service.get_context(token)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Servicio no disponible") from exc
    return SyncContextResponse(
        protocol_version=ctx["protocol_version"],
        scope_id=ctx["scope_id"],
        device_id=ctx["device_id"],
        limits=ctx["limits"],
    )


@router.post("/sync/push", response_model=SyncPushResponse)
def push(
    request: SyncPushRequest,
    authorization: str | None = Header(default=None),
) -> SyncPushResponse:
    _require_lab_enabled()
    if request.protocol_version != 1:
        raise HTTPException(status_code=400, detail="PROTOCOL_UNSUPPORTED")
    if len(request.operations) > 100:
        raise HTTPException(status_code=413, detail="BATCH_TOO_LARGE")
    op_ids = [str(op.operation_id) for op in request.operations]
    if len(set(op_ids)) != len(op_ids):
        raise HTTPException(status_code=422, detail="duplicate operation_id")
    keys = [(op.entity, str(op.record_id)) for op in request.operations]
    if len(set(keys)) != len(keys):
        raise HTTPException(status_code=422, detail="duplicate record in batch")

    operations = [op.model_dump() for op in request.operations]
    try:
        results = service.process_push(
            token=_extract_token(authorization),
            device_id_body=request.device_id,
            operations=operations,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Servicio no disponible") from exc
    return SyncPushResponse(protocol_version=request.protocol_version, results=results)
