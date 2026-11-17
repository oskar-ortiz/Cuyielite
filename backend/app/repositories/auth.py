"""Persistencia de usuarios, dispositivos y sesiones del piloto."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from psycopg.rows import dict_row

from backend.app.database import get_connection


def _one(sql: str, params: tuple[Any, ...]) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def get_user_by_username(username: str) -> dict[str, Any] | None:
    return _one(
        "SELECT id, username, password_hash, role, scope_id, status, auth_version, "
        "must_change_password, last_login_at FROM app_users WHERE username = %s",
        (username,),
    )


def get_user_by_id(user_id: UUID) -> dict[str, Any] | None:
    return _one(
        "SELECT id, username, password_hash, role, scope_id, status, auth_version, "
        "must_change_password, last_login_at FROM app_users WHERE id = %s",
        (user_id,),
    )


def create_user(
    username: str,
    password_hash: str,
    role: str,
    scope_id: UUID,
    must_change_password: bool = True,
) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "INSERT INTO app_users(username, password_hash, role, scope_id, must_change_password) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id, username, role, scope_id, status, must_change_password",
                (username, password_hash, role, scope_id, must_change_password),
            )
            row = cur.fetchone()
        conn.commit()
        return row


def update_password(user_id: UUID, password_hash: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE app_users SET password_hash=%s, must_change_password=FALSE, "
                "auth_version=auth_version+1, updated_at=now() WHERE id=%s",
                (password_hash, user_id),
            )
        conn.commit()


def set_user_status(user_id: UUID, status: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE app_users SET status=%s, auth_version=auth_version+1, updated_at=now() WHERE id=%s",
                (status, user_id),
            )
        conn.commit()


def touch_login(user_id: UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE app_users SET last_login_at=now() WHERE id=%s", (user_id,))
        conn.commit()


def get_device(device_id: UUID) -> dict[str, Any] | None:
    return _one(
        "SELECT id, scope_id, status, revoked_at, auth_version, last_seen_at, "
        "platform, name FROM sync_devices WHERE id = %s",
        (device_id,),
    )


def ensure_device(scope_id: UUID, device_id: UUID, platform: str | None, name: str | None) -> dict[str, Any]:
    """Registra la instalación compartida sin asociarla a un usuario."""
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT id, scope_id, status, revoked_at, auth_version, last_seen_at, "
                "platform, name FROM sync_devices WHERE id=%s FOR UPDATE",
                (device_id,),
            )
            row = cur.fetchone()
            if row is None:
                import hashlib
                import secrets

                placeholder = hashlib.sha256(secrets.token_urlsafe(32).encode()).hexdigest()
                cur.execute(
                    "INSERT INTO sync_devices(id, scope_id, token_hash, platform, name) "
                    "VALUES (%s, %s, %s, %s, %s) RETURNING id, scope_id, status, revoked_at, "
                    "auth_version, last_seen_at, platform, name",
                    (device_id, scope_id, placeholder, platform, name),
                )
                row = cur.fetchone()
                conn.commit()
                return row
            if row["scope_id"] != scope_id:
                raise ValueError("El dispositivo pertenece a otro ámbito")
            if row["status"] != "active":
                raise ValueError("El dispositivo está revocado")
            cur.execute(
                "UPDATE sync_devices SET last_seen_at=now(), platform=COALESCE(%s, platform), "
                "name=COALESCE(%s, name) WHERE id=%s",
                (platform, name, device_id),
            )
            row["last_seen_at"] = datetime.now(timezone.utc)
        conn.commit()
        return row


def revoke_device(device_id: UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE sync_devices SET status='revoked', revoked_at=now(), "
                "auth_version=auth_version+1 WHERE id=%s",
                (device_id,),
            )
            cur.execute(
                "UPDATE auth_sessions SET revoked_at=now() WHERE device_id=%s AND revoked_at IS NULL",
                (device_id,),
            )
        conn.commit()


def create_session(
    user_id: UUID,
    device_id: UUID,
    scope_id: UUID,
    refresh_hash: str,
    family_id: UUID,
    expires_at: datetime,
) -> dict[str, Any]:
    with get_connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "INSERT INTO auth_sessions(user_id, device_id, scope_id, refresh_hash, family_id, expires_at) "
                "VALUES (%s, %s, %s, %s, %s, %s) "
                "RETURNING id, user_id, device_id, scope_id, family_id, expires_at, revoked_at",
                (user_id, device_id, scope_id, refresh_hash, family_id, expires_at),
            )
            row = cur.fetchone()
        conn.commit()
        return row


def find_session_by_hash(refresh_hash: str) -> dict[str, Any] | None:
    return _one(
        "SELECT id, user_id, device_id, scope_id, refresh_hash, family_id, expires_at, "
        "revoked_at, replaced_by, reuse_grace_until FROM auth_sessions WHERE refresh_hash=%s",
        (refresh_hash,),
    )


def get_session(session_id: UUID) -> dict[str, Any] | None:
    return _one(
        "SELECT id, user_id, device_id, scope_id, refresh_hash, family_id, expires_at, "
        "revoked_at, replaced_by, reuse_grace_until FROM auth_sessions WHERE id=%s",
        (session_id,),
    )


def revoke_session(session_id: UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE auth_sessions SET revoked_at=now() WHERE id=%s AND revoked_at IS NULL", (session_id,))
        conn.commit()


def revoke_family(family_id: UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE auth_sessions SET revoked_at=now() WHERE family_id=%s AND revoked_at IS NULL", (family_id,))
        conn.commit()


def rotate_session(
    old_session_id: UUID,
    new_session_id: UUID,
    refresh_hash: str,
    expires_at: datetime,
    reuse_grace_until: datetime,
) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE auth_sessions SET revoked_at=now(), replaced_by=%s, reuse_grace_until=%s, "
                "last_used_at=now() WHERE id=%s AND revoked_at IS NULL",
                (new_session_id, reuse_grace_until, old_session_id),
            )
            cur.execute(
                "INSERT INTO auth_sessions(id, user_id, device_id, scope_id, refresh_hash, family_id, expires_at) "
                "SELECT %s, user_id, device_id, scope_id, %s, family_id, %s FROM auth_sessions WHERE id=%s",
                (new_session_id, refresh_hash, expires_at, old_session_id),
            )
        conn.commit()


def replace_rotated_session(old_session_id: UUID, new_session_id: UUID, reuse_grace_until: datetime) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE auth_sessions SET replaced_by=%s, reuse_grace_until=%s WHERE id=%s",
                (new_session_id, reuse_grace_until, old_session_id),
            )
        conn.commit()


def revoke_user_sessions(user_id: UUID) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE auth_sessions SET revoked_at=now() WHERE user_id=%s AND revoked_at IS NULL", (user_id,))
        conn.commit()


def record_audit(
    event: str,
    user_id: UUID | None = None,
    device_id: UUID | None = None,
    scope_id: UUID | None = None,
    ip: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    try:
        import json

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO auth_audit(event, user_id, device_id, scope_id, ip, detail) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (event, user_id, device_id, scope_id, ip, json.dumps(detail or {})),
                )
            conn.commit()
    except Exception:
        # La auditoría no debe tumbar el inicio de sesión ni revelar detalles.
        return


def login_attempt(key: str) -> dict[str, Any] | None:
    return _one(
        "SELECT attempt_key, window_start, attempt_count, blocked_until FROM auth_login_attempts WHERE attempt_key=%s",
        (key,),
    )


def save_login_attempt(key: str, window_start: datetime, count: int, blocked_until: datetime | None) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO auth_login_attempts(attempt_key, window_start, attempt_count, blocked_until) "
                "VALUES (%s, %s, %s, %s) ON CONFLICT (attempt_key) DO UPDATE SET "
                "window_start=excluded.window_start, attempt_count=excluded.attempt_count, "
                "blocked_until=excluded.blocked_until",
                (key, window_start, count, blocked_until),
            )
        conn.commit()


def clear_login_attempts(key: str) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM auth_login_attempts WHERE attempt_key=%s", (key,))
        conn.commit()
