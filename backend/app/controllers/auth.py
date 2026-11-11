"""Autorización de laboratorio compartida por endpoints de dominio."""

from fastapi import HTTPException

from backend.app.services import sync as sync_service


def require_scope(authorization: str | None):
    scheme, separator, token = (authorization or "").partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    identity = sync_service.authenticate(token.strip())
    if identity is None:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")
    return identity["scope_id"]
