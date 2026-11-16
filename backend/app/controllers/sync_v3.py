"""Protocolo 3: descarga de solo lectura de categorías y alertas derivadas."""

from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query

from backend.app.controllers.auth import require_identity
from backend.app.controllers.sync import _extract_token, _require_lab_enabled
from backend.app.services import auth as auth_service
from backend.app.services import derived as service
from backend.app.services import sync as sync_v1
from backend.app.sync_cursor import InvalidSyncCursor

router = APIRouter(tags=["sync"])


def _identity(authorization: str | None) -> tuple[UUID, UUID]:
    """Ámbito y dispositivo autorizados, en modo piloto o laboratorio."""
    if auth_service.auth_mode() == "pilot":
        identity = require_identity(authorization)
        return identity.scope_id, identity.device_id
    identity = sync_v1.authenticate(_extract_token(authorization))
    if identity is None:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    return identity["scope_id"], identity["device_id"]


@router.get("/sync/v3/context")
def context_v3(authorization: str | None = Header(default=None)) -> dict:
    _require_lab_enabled()
    scope_id, device_id = _identity(authorization)
    try:
        return service.context(scope_id, device_id)
    except service.DerivedUnavailable:
        raise HTTPException(status_code=403, detail="DEVICE_NOT_AUTHORIZED") from None


@router.get("/sync/v3/pull")
def pull_v3(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    authorization: str | None = Header(default=None),
) -> dict:
    _require_lab_enabled()
    scope_id, _ = _identity(authorization)
    try:
        return service.pull(scope_id, cursor, limit)
    except InvalidSyncCursor:
        raise HTTPException(status_code=400, detail="CURSOR_INVALID") from None
    except service.DerivedUnavailable:
        raise HTTPException(status_code=403, detail="DEVICE_NOT_AUTHORIZED") from None
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail="HISTORIAL_NO_SOPORTADO") from error
