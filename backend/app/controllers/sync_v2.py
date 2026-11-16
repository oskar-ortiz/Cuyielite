"""Rutas explícitas del protocolo v2 de sincronización de dominio."""

from fastapi import APIRouter, Header, HTTPException, Query

from backend.app.controllers.auth import require_identity
from backend.app.controllers.sync import _extract_token, _require_lab_enabled
from backend.app.schemas.sync import SyncPullResponse
from backend.app.schemas.sync_v2 import V2_ENTITIES, SyncPushV2Request
from backend.app.services import auth as auth_service
from backend.app.services import sync as sync_v1
from backend.app.services import sync_v2

router = APIRouter(tags=['sync-v2'])


@router.get('/sync/v2/context')
def context_v2(authorization: str | None = Header(default=None)) -> dict:
    _require_lab_enabled()
    if auth_service.auth_mode() == 'pilot':
        identity = require_identity(authorization)
        return {
            'protocol_version': 2,
            'scope_id': str(identity.scope_id),
            'device_id': str(identity.device_id),
            'supported_entities': list(V2_ENTITIES),
            'limits': {'push_operations': 100, 'push_bytes': 1048576, 'pull_default': 50, 'pull_max': 100},
        }
    identity = sync_v1.authenticate(_extract_token(authorization))
    if identity is None:
        raise HTTPException(status_code=401, detail='UNAUTHORIZED')
    return {
        'protocol_version': 2,
        'scope_id': str(identity['scope_id']),
        'device_id': str(identity['device_id']),
        'supported_entities': list(V2_ENTITIES),
        'limits': {'push_operations': 100, 'push_bytes': 1048576, 'pull_default': 50, 'pull_max': 100},
    }


@router.post('/sync/v2/push')
def push_v2(
    request: SyncPushV2Request,
    authorization: str | None = Header(default=None),
) -> dict:
    _require_lab_enabled()
    op_ids = [str(op.operation_id) for op in request.operations]
    if len(set(op_ids)) != len(op_ids):
        raise HTTPException(status_code=422, detail='duplicate operation_id')
    keys = [(op.entity, str(op.record_id)) for op in request.operations]
    if len(set(keys)) != len(keys):
        raise HTTPException(status_code=422, detail='duplicate record in batch')
    try:
        if auth_service.auth_mode() == 'pilot':
            identity = require_identity(authorization)
            if identity.role != 'admin':
                raise HTTPException(status_code=403, detail='ROL_SIN_ESCRITURA')
            if str(request.device_id) != str(identity.device_id):
                raise HTTPException(status_code=403, detail='DEVICE_NOT_AUTHORIZED')
            results = sync_v2.process_push_v2_identity(identity.scope_id, identity.device_id, [op.model_dump() for op in request.operations])
        else:
            results = sync_v2.process_push_v2(
                _extract_token(authorization),
                request.device_id,
                [op.model_dump() for op in request.operations],
            )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail='Servicio no disponible') from error
    return {'protocol_version': 2, 'results': results}


@router.get('/sync/v2/pull', response_model=SyncPullResponse)
def pull_v2(
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = Query(default=None, max_length=4096),
    authorization: str | None = Header(default=None),
) -> SyncPullResponse:
    _require_lab_enabled()
    try:
        if auth_service.auth_mode() == 'pilot':
            identity = require_identity(authorization)
            response = sync_v1.pull_changes_for_identity(identity.scope_id, cursor=cursor, limit=limit, protocol=2)
        else:
            response = sync_v1.pull_changes(
                token=_extract_token(authorization), cursor=cursor, limit=limit, protocol=2
            )
    except HTTPException:
        raise
    except sync_v1.InvalidSyncCursor:
        raise HTTPException(status_code=400, detail='CURSOR_INVALID') from None
    except sync_v1.UnsupportedPullEntity:
        raise HTTPException(status_code=500, detail='HISTORIAL_NO_SOPORTADO') from None
    except Exception:
        raise HTTPException(status_code=503, detail='Servicio no disponible') from None
    return SyncPullResponse(**response)
