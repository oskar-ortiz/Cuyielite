"""Endpoints de acceso para el piloto."""

from fastapi import APIRouter, Header, HTTPException, Request

from backend.app.controllers.auth import require_identity
from backend.app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    SessionResponse,
    UserView,
)
from backend.app.services import auth as auth_service

router = APIRouter(tags=["auth"])


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _translate(error: auth_service.AuthError) -> HTTPException:
    return HTTPException(status_code=error.status, detail=error.code)


@router.post("/auth/login", response_model=SessionResponse)
def login(request: Request, body: LoginRequest) -> SessionResponse:
    try:
        result = auth_service.login(
            body.username,
            body.password,
            body.device_id,
            body.device_name,
            body.platform,
            _ip(request),
        )
    except auth_service.AuthError as error:
        raise _translate(error) from None
    return SessionResponse(**result)


@router.post("/auth/refresh", response_model=SessionResponse)
def refresh(request: Request, body: RefreshRequest) -> SessionResponse:
    try:
        result = auth_service.refresh(body.refresh_token, _ip(request))
    except auth_service.AuthError as error:
        raise _translate(error) from None
    return SessionResponse(**result)


@router.post("/auth/logout")
def logout(request: Request, body: LogoutRequest) -> dict:
    auth_service.logout(body.refresh_token, _ip(request))
    return {"ok": True}


@router.get("/auth/me", response_model=MeResponse)
def me(authorization: str | None = Header(default=None)) -> MeResponse:
    identity = require_identity(authorization)
    return MeResponse(
        user=UserView(id=str(identity.user_id), username=identity.username, role=identity.role),
        scope_id=str(identity.scope_id),
        device_id=str(identity.device_id),
    )


@router.post("/auth/change-password")
def change_password(
    body: ChangePasswordRequest,
    authorization: str | None = Header(default=None),
) -> dict:
    identity = require_identity(authorization)
    try:
        auth_service.change_password(identity, body.current_password, body.new_password)
    except auth_service.AuthError as error:
        raise _translate(error) from None
    return {"ok": True}
