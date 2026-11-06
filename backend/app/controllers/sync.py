"""Controladores de sincronizacion de laboratorio."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Header, Query

from pydantic import BaseModel

from backend.app.schemas.sync import SyncPullResponse, SyncPushRequest, SyncPushResponse
from backend.app.sync_cursor import InvalidSyncCursor
from backend.app.services import sync as service


router = APIRouter(tags=["sync"])


class SyncContextResponse(BaseModel):
    protocol_version: int
    scope_id: str
    device_id: str
    limits: dict


def _extract_token(authorization: str | None) -> str:
    if not authorization:
        return ""
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return ""


@router.get("/sync/context")
def get_context(authorization: str | None = Header(default=None)) -> SyncContextResponse:
    token = _extract_token(authorization)
    try:
        ctx = service.get_context(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    except Exception:
        raise HTTPException(status_code=503, detail="Servicio no disponible")
    return SyncContextResponse(
        protocol_version=ctx["protocol_version"],
        scope_id=ctx["scope_id"],
        device_id=ctx["device_id"],
        limits=ctx["limits"],
    )


@router.post("/sync/push", response_model=SyncPushResponse)
def push(request: SyncPushRequest, authorization: str | None = Header(default=None)) -> SyncPushResponse:
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

    token = _extract_token(authorization)
    operations = [op.model_dump() for op in request.operations]
    try:
        results = service.process_push(
            token=token,
            device_id_body=request.device_id,
            operations=operations,
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Servicio no disponible")
    return SyncPushResponse(protocol_version=request.protocol_version, results=results)


@router.get("/sync/pull", response_model=SyncPullResponse)
def pull(
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(default=None, max_length=4096),
    authorization: str | None = Header(default=None),
) -> SyncPullResponse:
    token = _extract_token(authorization)
    try:
        response = service.pull_changes(token=token, cursor=cursor, limit=limit)
    except HTTPException:
        raise
    except InvalidSyncCursor:
        raise HTTPException(status_code=400, detail="CURSOR_INVALID") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Servicio no disponible") from None
    return SyncPullResponse(**response)
