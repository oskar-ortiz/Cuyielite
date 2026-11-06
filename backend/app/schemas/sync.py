"""Esquemas de sincronizacion para la API."""

import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SyncOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation_id: UUID
    entity: str = Field(pattern="^(galpon|poza)$")
    record_id: UUID
    action: str = Field(pattern="^(create|update)$")
    base_version: str | None = None
    client_created_at: str | None = None
    client_edited_at: str | None = None
    data: dict | None = None

    @model_validator(mode="after")
    def _check_versions(self):
        if self.action == "create":
            if self.base_version is not None:
                raise ValueError("base_version must be null for create")
            if self.client_created_at is None:
                raise ValueError("client_created_at required for create")
        else:
            if self.base_version is None:
                raise ValueError("base_version required for update")
            if not re.fullmatch(r"[1-9][0-9]*", self.base_version):
                raise ValueError("base_version must be decimal")
        return self


class SyncPushRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    protocol_version: int = 1
    device_id: UUID
    operations: list[SyncOperation]


class SyncRecord(BaseModel):
    id: UUID
    version: str
    created_at: str
    updated_at: str
    deleted_at: str | None = None
    last_client_edited_at: str | None = None
    data: dict | None = None


class SyncOperationResult(BaseModel):
    operation_id: UUID
    entity: str
    record_id: UUID
    status: str
    changed: bool = False
    code: str | None = None
    record: SyncRecord | None = None


class SyncPushResponse(BaseModel):
    protocol_version: int = 1
    results: list[SyncOperationResult]


class SyncPullItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seq: str = Field(pattern=r"^(0|[1-9][0-9]*)$")
    entity: str = Field(pattern=r"^(galpon|poza)$")
    record: SyncRecord


class SyncPullResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    protocol_version: int = 1
    scope_id: UUID
    items: list[SyncPullItem]
    next_cursor: str = Field(min_length=1, max_length=4096)
    has_more: bool
