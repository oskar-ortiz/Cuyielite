"""Administración explícita de usuarios y dispositivos del piloto."""

from __future__ import annotations

import argparse
import getpass
import sys
from uuid import UUID

from backend.app.database import get_connection
from backend.app.repositories import auth as repo
from backend.app.repositories import sync as sync_repo
from backend.app.services import auth as auth_service


def _password() -> str:
    value = getpass.getpass("Contraseña: ")
    confirm = getpass.getpass("Repetir contraseña: ")
    if value != confirm:
        raise SystemExit("Las contraseñas no coinciden")
    if len(value) < 12:
        raise SystemExit("La contraseña debe tener al menos 12 caracteres")
    return value


def _user(username: str) -> dict:
    user = repo.get_user_by_username(username.strip().lower())
    if user is None:
        raise SystemExit("Usuario no encontrado")
    return user


def create_user(args: argparse.Namespace) -> None:
    scope_id = UUID(args.scope)
    if sync_repo.get_scope(scope_id) is None:
        raise SystemExit("El ámbito no existe")
    if repo.get_user_by_username(args.username.strip().lower()) is not None:
        raise SystemExit("El usuario ya existe")
    repo.create_user(
        args.username.strip().lower(),
        auth_service.hash_password(_password()),
        args.role,
        scope_id,
        must_change_password=True,
    )
    print("Usuario creado")


def set_password(args: argparse.Namespace) -> None:
    user = _user(args.username)
    repo.update_password(user["id"], auth_service.hash_password(_password()))
    repo.revoke_user_sessions(user["id"])
    print("Contraseña actualizada; sesiones revocadas")


def set_status(args: argparse.Namespace) -> None:
    user = _user(args.username)
    repo.set_user_status(user["id"], args.status)
    if args.status == "disabled":
        repo.revoke_user_sessions(user["id"])
    print("Estado actualizado")


def revoke_device(args: argparse.Namespace) -> None:
    device_id = UUID(args.device_id)
    if repo.get_device(device_id) is None:
        raise SystemExit("Dispositivo no encontrado")
    auth_service.revoke_device(device_id, actor="cli")
    print("Dispositivo revocado")


def list_users(_: argparse.Namespace) -> None:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT username, role, scope_id, status, must_change_password FROM app_users ORDER BY username"
        ).fetchall()
    for username, role, scope_id, status, must_change in rows:
        print(f"{username}\t{role}\t{scope_id}\t{status}\tmust_change={must_change}")


def list_devices(_: argparse.Namespace) -> None:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, scope_id, status, platform, name, last_seen_at, revoked_at "
            "FROM sync_devices ORDER BY created_at"
        ).fetchall()
    for device_id, scope_id, status, platform, name, last_seen, revoked in rows:
        print(f"{device_id}\t{scope_id}\t{status}\t{platform or '-'}\t{name or '-'}\t{last_seen}\t{revoked}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Administración de acceso del piloto")
    sub = parser.add_subparsers(required=True)

    create = sub.add_parser("create-user")
    create.add_argument("--username", required=True)
    create.add_argument("--role", choices=("admin", "viewer"), required=True)
    create.add_argument("--scope", required=True, help="UUID del ámbito autorizado")
    create.set_defaults(func=create_user)

    password = sub.add_parser("set-password")
    password.add_argument("--username", required=True)
    password.set_defaults(func=set_password)

    status = sub.add_parser("set-status")
    status.add_argument("--username", required=True)
    status.add_argument("--status", choices=("active", "disabled"), required=True)
    status.set_defaults(func=set_status)

    device = sub.add_parser("revoke-device")
    device.add_argument("--device-id", required=True)
    device.set_defaults(func=revoke_device)

    users = sub.add_parser("list-users")
    users.set_defaults(func=list_users)

    devices = sub.add_parser("list-devices")
    devices.set_defaults(func=list_devices)

    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
