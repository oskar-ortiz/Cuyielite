"""Autorización compartida por endpoints de dominio, ML y RAG."""

from fastapi import HTTPException

from backend.app.services import auth as auth_service
from backend.app.services import sync as sync_service


def extract_bearer(authorization: str | None) -> str:
    scheme, separator, token = (authorization or "").partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        return ""
    return token.strip()


def _translate(error: auth_service.AuthError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.code)


def require_identity(authorization: str | None) -> auth_service.Identity:
    if auth_service.auth_mode() != "pilot":
        raise HTTPException(status_code=404, detail="AUTH_PILOT_DISABLED")
    try:
        return auth_service.authenticate_access(extract_bearer(authorization))
    except auth_service.AuthError as error:
        raise _translate(error) from None


def require_scope(authorization: str | None):
    if auth_service.auth_mode() == "pilot":
        return require_identity(authorization).scope_id
    token = extract_bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    identity = sync_service.authenticate(token)
    if identity is None:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    return identity["scope_id"]
