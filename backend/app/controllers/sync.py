"""Controladores de sincronización del laboratorio."""

import os

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from backend.app.controllers.auth import require_identity
from backend.app.schemas.sync import SyncPullResponse, SyncPushRequest, SyncPushResponse
from backend.app.services import auth as auth_service
from backend.app.sync_cursor import InvalidSyncCursor
from backend.app.services import sync as service

router = APIRouter(tags=["sync"])


class SyncContextResponse(BaseModel):
    protocol_version: int
    scope_id: str
    device_id: str
    limits: dict


def _require_lab_enabled() -> None:
    if auth_service.auth_mode() == "pilot":
        return
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
    if auth_service.auth_mode() == "pilot":
        identity = require_identity(authorization)
        return SyncContextResponse(
            protocol_version=1,
            scope_id=str(identity.scope_id),
            device_id=str(identity.device_id),
            limits={"push_operations": 100, "push_bytes": 1048576, "pull_default": 50, "pull_max": 100},
        )
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
        if auth_service.auth_mode() == "pilot":
            identity = require_identity(authorization)
            if identity.role != "admin":
                raise HTTPException(status_code=403, detail="ROL_SIN_ESCRITURA")
            if str(request.device_id) != str(identity.device_id):
                raise HTTPException(status_code=403, detail="DEVICE_NOT_AUTHORIZED")
            results = service.process_push_identity(identity.scope_id, identity.device_id, operations)
        else:
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


@router.get("/sync/pull", response_model=SyncPullResponse)
def pull(
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(default=None, max_length=4096),
    authorization: str | None = Header(default=None),
) -> SyncPullResponse:
    _require_lab_enabled()
    token = _extract_token(authorization)
    try:
        if auth_service.auth_mode() == "pilot":
            identity = require_identity(authorization)
            response = service.pull_changes_for_identity(identity.scope_id, cursor=cursor, limit=limit)
        else:
            response = service.pull_changes(token=token, cursor=cursor, limit=limit)
    except HTTPException:
        raise
    except InvalidSyncCursor:
        raise HTTPException(status_code=400, detail="CURSOR_INVALID") from None
    except service.UnsupportedPullEntity:
        # Dato de historial irrecuperable para este protocolo: no se entrega una
        # pagina parcial ni se adelanta el cursor.
        raise HTTPException(status_code=500, detail="HISTORIAL_NO_SOPORTADO") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Servicio no disponible") from None
    return SyncPullResponse(**response)
