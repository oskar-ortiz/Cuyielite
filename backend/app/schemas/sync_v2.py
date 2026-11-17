"""Contratos explícitos del protocolo v2 de sincronización de dominio."""

import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

V2_ENTITIES = ('cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias')
_VERSION_PATTERN = re.compile(r'^[1-9][0-9]*$')


class SyncOperationV2(BaseModel):
    model_config = ConfigDict(extra='forbid')

    operation_id: UUID
    entity: Literal['cuyes', 'partos', 'pesajes', 'eventos', 'parto_crias']
    record_id: UUID
    action: Literal['create', 'update']
    base_version: str | None = None
    client_created_at: str | None = None
    client_edited_at: str | None = None
    data: dict

    @model_validator(mode='after')
    def _versions(self):
        if self.action == 'create':
            if self.base_version is not None:
                raise ValueError('base_version debe ser null en create')
            if self.client_created_at is None:
                raise ValueError('client_created_at required for create')
        else:
            if self.base_version is None or not _VERSION_PATTERN.fullmatch(self.base_version):
                raise ValueError('base_version decimal positivo requerido en update')
        return self


class SyncPushV2Request(BaseModel):
    model_config = ConfigDict(extra='forbid')

    protocol_version: Literal[2]
    device_id: UUID
    operations: list[SyncOperationV2] = Field(max_length=100)
