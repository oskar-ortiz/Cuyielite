"""Contratos HTTP del acceso de piloto."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)
    device_id: UUID
    device_name: str | None = Field(default=None, max_length=120)
    platform: str | None = Field(default=None, max_length=20)


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(min_length=32, max_length=512)


class LogoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(min_length=32, max_length=512)


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class UserView(BaseModel):
    id: str
    username: str
    role: str


class SessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user: UserView
    scope_id: str
    device_id: str
    must_change_password: bool


class MeResponse(BaseModel):
    user: UserView
    scope_id: str
    device_id: str
