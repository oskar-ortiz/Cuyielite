"""Autenticación de piloto: usuarios, sesiones y autorización por rol."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from backend.app.repositories import auth as repo


class AuthError(Exception):
    def __init__(self, code: str, status: int = 401):
        super().__init__(code)
        self.code = code
        self.status = status


@dataclass(frozen=True)
class Identity:
    user_id: UUID
    username: str
    role: str
    scope_id: UUID
    device_id: UUID
    session_id: UUID
    auth_version: int


_PASSWORD = PasswordHasher()
_DUMMY_HASH = _PASSWORD.hash("synthetic-dummy-password-not-a-user")


def auth_mode() -> str:
    return os.environ.get("CUYIELITE_AUTH_MODE", "lab").strip().lower()


def _secret() -> bytes:
    value = os.environ.get("CUYIELITE_AUTH_JWT_SECRET", "")
    if len(value) < 32:
        raise AuthError("AUTH_CONFIG", 503)
    return value.encode("utf-8")


def _issuer() -> str:
    return os.environ.get("CUYIELITE_AUTH_ISSUER", "cuyielite")


def _audience() -> str:
    return os.environ.get("CUYIELITE_AUTH_AUDIENCE", "cuyielite-pilot")


def _access_ttl() -> int:
    return int(os.environ.get("CUYIELITE_AUTH_ACCESS_TTL", "900"))


def _refresh_ttl() -> int:
    return int(os.environ.get("CUYIELITE_AUTH_REFRESH_TTL", "2592000"))


def _refresh_grace() -> int:
    return int(os.environ.get("CUYIELITE_AUTH_REFRESH_GRACE", "60"))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return _PASSWORD.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        _PASSWORD.verify(password_hash, password)
        return True
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_refresh() -> tuple[str, str]:
    value = secrets.token_urlsafe(48)
    return value, _token_hash(value)


def _access_token(identity: Identity, device_version: int) -> str:
    now = _now()
    payload = {
        "iss": _issuer(),
        "aud": _audience(),
        "sub": str(identity.user_id),
        "sid": str(identity.session_id),
        "role": identity.role,
        "scope_id": str(identity.scope_id),
        "device_id": str(identity.device_id),
        "ver": identity.auth_version,
        "dver": device_version,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=_access_ttl())).timestamp()),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def _identity_from_user(user: dict, device: dict, session_id: UUID) -> Identity:
    return Identity(
        user_id=user["id"],
        username=user["username"],
        role=user["role"],
        scope_id=user["scope_id"],
        device_id=device["id"],
        session_id=session_id,
        auth_version=int(user["auth_version"]),
    )


def _check_device(user: dict, device: dict | None) -> dict:
    if device is None:
        raise AuthError("DEVICE_NOT_AUTHORIZED", 403)
    if device["scope_id"] != user["scope_id"]:
        raise AuthError("DEVICE_SCOPE", 403)
    if device["status"] != "active":
        raise AuthError("DEVICE_REVOKED", 403)
    return device


def _rate_key(username: str, ip: str | None) -> str:
    return f"{username}:{ip or 'unknown'}"


def _check_rate(key: str) -> None:
    row = repo.login_attempt(key)
    if row and row["blocked_until"] and row["blocked_until"] > _now():
        raise AuthError("LOGIN_BLOQUEADO", 429)


def _failure(key: str) -> None:
    now = _now()
    row = repo.login_attempt(key)
    if row is None or row["window_start"] + timedelta(minutes=15) <= now:
        repo.save_login_attempt(key, now, 1, None)
        return
    count = int(row["attempt_count"]) + 1
    blocked = now + timedelta(minutes=15) if count >= 5 else None
    repo.save_login_attempt(key, row["window_start"], count, blocked)


def login(
    username: str,
    password: str,
    device_id: UUID,
    device_name: str | None,
    platform: str | None,
    ip: str | None,
) -> dict:
    username = username.strip().lower()
    key = _rate_key(username, ip)
    _check_rate(key)
    user = repo.get_user_by_username(username)
    if user is None or not verify_password(user["password_hash"], password):
        if user is None:
            verify_password(_DUMMY_HASH, password)
        _failure(key)
        repo.record_audit("login_fallido", ip=ip)
        raise AuthError("CREDENCIALES_INVALIDAS", 401)
    if user["status"] != "active":
        repo.record_audit("login_deshabilitado", user["id"], scope_id=user["scope_id"], ip=ip)
        raise AuthError("USUARIO_DESHABILITADO", 403)
    try:
        device = repo.ensure_device(user["scope_id"], device_id, platform, device_name)
    except ValueError as error:
        repo.record_audit("login_dispositivo", user["id"], device_id, user["scope_id"], ip, {"error": str(error)})
        raise AuthError("DEVICE_NOT_AUTHORIZED", 403) from error

    refresh_value, refresh_hash = _new_refresh()
    session = repo.create_session(
        user["id"],
        device_id,
        user["scope_id"],
        refresh_hash,
        uuid4(),
        _now() + timedelta(seconds=_refresh_ttl()),
    )
    repo.touch_login(user["id"])
    repo.clear_login_attempts(key)
    repo.record_audit("login", user["id"], device_id, user["scope_id"], ip)
    identity = _identity_from_user(user, device, session["id"])
    return {
        "access_token": _access_token(identity, int(device["auth_version"])),
        "refresh_token": refresh_value,
        "expires_in": _access_ttl(),
        "user": {"id": str(user["id"]), "username": user["username"], "role": user["role"]},
        "scope_id": str(user["scope_id"]),
        "device_id": str(device_id),
        "must_change_password": bool(user["must_change_password"]),
    }


def _session_user_device(session: dict) -> tuple[dict, dict]:
    user = repo.get_user_by_id(session["user_id"])
    if user is None or user["status"] != "active":
        raise AuthError("USUARIO_DESHABILITADO", 403)
    device = _check_device(user, repo.get_device(session["device_id"]))
    return user, device


def _rotate_active(session: dict, user: dict, device: dict) -> dict:
    new_id = uuid4()
    refresh_value, refresh_hash = _new_refresh()
    repo.rotate_session(
        session["id"],
        new_id,
        refresh_hash,
        _now() + timedelta(seconds=_refresh_ttl()),
        _now() + timedelta(seconds=_refresh_grace()),
    )
    identity = _identity_from_user(user, device, new_id)
    return {
        "access_token": _access_token(identity, int(device["auth_version"])),
        "refresh_token": refresh_value,
        "expires_in": _access_ttl(),
        "user": {"id": str(user["id"]), "username": user["username"], "role": user["role"]},
        "scope_id": str(user["scope_id"]),
        "device_id": str(device["id"]),
        "must_change_password": bool(user["must_change_password"]),
    }


def _rotate_retry(session: dict, user: dict, device: dict) -> dict:
    if session.get("replaced_by"):
        repo.revoke_session(UUID(str(session["replaced_by"])))
    new_id = uuid4()
    refresh_value, refresh_hash = _new_refresh()
    repo.create_session(
        user["id"],
        device["id"],
        user["scope_id"],
        refresh_hash,
        session["family_id"],
        _now() + timedelta(seconds=_refresh_ttl()),
    )
    # create_session generates its own id; retrieve the replacement by hash.
    replacement = repo.find_session_by_hash(refresh_hash)
    if replacement is None:
        raise AuthError("SESSION_INCONSISTENT", 503)
    repo.replace_rotated_session(
        session["id"],
        replacement["id"],
        _now() + timedelta(seconds=_refresh_grace()),
    )
    identity = _identity_from_user(user, device, replacement["id"])
    return {
        "access_token": _access_token(identity, int(device["auth_version"])),
        "refresh_token": refresh_value,
        "expires_in": _access_ttl(),
        "user": {"id": str(user["id"]), "username": user["username"], "role": user["role"]},
        "scope_id": str(user["scope_id"]),
        "device_id": str(device["id"]),
        "must_change_password": bool(user["must_change_password"]),
    }


def refresh(refresh_token: str, ip: str | None = None) -> dict:
    if not isinstance(refresh_token, str) or len(refresh_token) < 32:
        raise AuthError("REFRESH_INVALIDO", 401)
    session = repo.find_session_by_hash(_token_hash(refresh_token))
    if session is None:
        raise AuthError("REFRESH_INVALIDO", 401)
    if session["expires_at"] <= _now():
        raise AuthError("REFRESH_EXPIRADO", 401)
    user, device = _session_user_device(session)
    if session["revoked_at"] is not None:
        grace = session.get("reuse_grace_until")
        if grace is not None and grace > _now() and session.get("replaced_by"):
            repo.record_audit("refresh_reintento", user["id"], device["id"], user["scope_id"], ip)
            return _rotate_retry(session, user, device)
        repo.revoke_family(session["family_id"])
        repo.record_audit("refresh_reutilizado", user["id"], device["id"], user["scope_id"], ip)
        raise AuthError("REFRESH_REUTILIZADO", 401)
    result = _rotate_active(session, user, device)
    repo.record_audit("refresh", user["id"], device["id"], user["scope_id"], ip)
    return result


def logout(refresh_token: str, ip: str | None = None) -> None:
    if not isinstance(refresh_token, str) or len(refresh_token) < 32:
        return
    session = repo.find_session_by_hash(_token_hash(refresh_token))
    if session is None:
        return
    repo.revoke_session(session["id"])
    repo.record_audit("logout", session["user_id"], session["device_id"], session["scope_id"], ip)


def authenticate_access(token: str) -> Identity:
    if not isinstance(token, str) or len(token) < 20:
        raise AuthError("UNAUTHORIZED", 401)
    try:
        claims = jwt.decode(
            token,
            _secret(),
            algorithms=["HS256"],
            audience=_audience(),
            issuer=_issuer(),
            options={"require": ["exp", "iat", "sub", "sid", "scope_id", "device_id"]},
        )
    except jwt.ExpiredSignatureError as error:
        raise AuthError("ACCESS_EXPIRADO", 401) from error
    except jwt.PyJWTError as error:
        raise AuthError("UNAUTHORIZED", 401) from error

    try:
        user_id = UUID(str(claims["sub"]))
        session_id = UUID(str(claims["sid"]))
        device_id = UUID(str(claims["device_id"]))
    except (ValueError, KeyError) as error:
        raise AuthError("UNAUTHORIZED", 401) from error

    user = repo.get_user_by_id(user_id)
    if user is None or user["status"] != "active":
        raise AuthError("USUARIO_DESHABILITADO", 403)
    device = _check_device(user, repo.get_device(device_id))
    session = repo.get_session(session_id)
    if session is None or session["revoked_at"] is not None:
        raise AuthError("SESSION_REVOCADA", 401)
    if str(session["device_id"]) != str(device_id) or str(session["user_id"]) != str(user_id):
        raise AuthError("SESSION_INCONSISTENT", 401)
    if int(claims.get("ver", -1)) != int(user["auth_version"]):
        raise AuthError("AUTH_VERSION", 401)
    if int(claims.get("dver", -1)) != int(device["auth_version"]):
        raise AuthError("DEVICE_VERSION", 401)
    if str(claims.get("scope_id")) != str(user["scope_id"]):
        raise AuthError("SCOPE_INCONSISTENT", 401)
    return _identity_from_user(user, device, session_id)


def change_password(identity: Identity, current_password: str, new_password: str) -> None:
    if len(new_password) < 12:
        raise AuthError("PASSWORD_DEBIL", 422)
    user = repo.get_user_by_id(identity.user_id)
    if user is None or not verify_password(user["password_hash"], current_password):
        raise AuthError("CREDENCIALES_INVALIDAS", 401)
    repo.update_password(identity.user_id, hash_password(new_password))
    repo.revoke_user_sessions(identity.user_id)
    repo.record_audit("password_cambiada", identity.user_id, identity.device_id, identity.scope_id)


def revoke_device(device_id: UUID, actor: str = "cli") -> None:
    repo.revoke_device(device_id)
    repo.record_audit("device_revocado", device_id=device_id, detail={"actor": actor})
