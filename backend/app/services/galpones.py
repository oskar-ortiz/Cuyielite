"""Servicio de galpones y pozas."""

from uuid import UUID

from backend.app.repositories import galpones as repo


def list_galpones(limit: int, offset: int) -> list[dict]:
    return repo.list_galpones(limit, offset)


def list_pozas_by_galpon(galpon_id: UUID, limit: int, offset: int) -> list[dict]:
    if not repo.galpon_exists_active(galpon_id):
        raise ValueError("galpon no encontrado")
    return repo.list_pozas_by_galpon(galpon_id, limit, offset)