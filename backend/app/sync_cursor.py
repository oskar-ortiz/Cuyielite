"""Opaque, scope-bound cursors for the laboratory pull protocol."""

import base64
import hashlib
import hmac
import json
import os
import re
from dataclasses import dataclass
from uuid import UUID


MAX_SEQUENCE = 9_223_372_036_854_775_807
MAX_CURSOR_LENGTH = 4096
_DECIMAL = re.compile(r"(?:0|[1-9][0-9]*)\Z")
_B64URL = re.compile(r"[A-Za-z0-9_-]+\Z")


class InvalidSyncCursor(ValueError):
    """The cursor is malformed, forged, belongs to another scope, or is future-dated."""


@dataclass(frozen=True)
class CursorPosition:
    after: int
    through: int | None


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _decode_b64url(value: str) -> bytes:
    if not value or not _B64URL.fullmatch(value):
        raise InvalidSyncCursor("CURSOR_INVALID")
    try:
        decoded = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, TypeError):
        raise InvalidSyncCursor("CURSOR_INVALID") from None
    if _b64url(decoded) != value:
        raise InvalidSyncCursor("CURSOR_INVALID")
    return decoded


def cursor_key() -> bytes:
    value = os.environ.get("SYNC_CURSOR_SIGNING_KEY", "")
    key = value.encode("utf-8")
    if len(key) < 32:
        raise RuntimeError("SYNC_CURSOR_SIGNING_KEY no está configurada o es demasiado corta")
    return key


def encode_cursor(scope_id: UUID | str, after: int, through: int | None, key: bytes) -> str:
    scope = str(UUID(str(scope_id)))
    if after < 0 or after > MAX_SEQUENCE:
        raise ValueError("after fuera de rango")
    if through is not None and (through < after or through > MAX_SEQUENCE):
        raise ValueError("through fuera de rango")
    payload = {
        "protocol_version": 1,
        "scope_id": scope,
        "after": str(after),
        "through": None if through is None else str(through),
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    encoded = _b64url(raw)
    signature = _b64url(hmac.new(key, raw, hashlib.sha256).digest())
    return f"{encoded}.{signature}"


def decode_cursor(token: str, expected_scope_id: UUID | str, key: bytes) -> CursorPosition:
    if not isinstance(token, str) or len(token) > MAX_CURSOR_LENGTH:
        raise InvalidSyncCursor("CURSOR_INVALID")
    parts = token.split(".")
    if len(parts) != 2:
        raise InvalidSyncCursor("CURSOR_INVALID")
    raw = _decode_b64url(parts[0])
    signature = _decode_b64url(parts[1])
    expected_signature = hmac.new(key, raw, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected_signature):
        raise InvalidSyncCursor("CURSOR_INVALID")
    try:
        payload = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise InvalidSyncCursor("CURSOR_INVALID") from None
    if not isinstance(payload, dict) or set(payload) != {"protocol_version", "scope_id", "after", "through"}:
        raise InvalidSyncCursor("CURSOR_INVALID")
    if payload["protocol_version"] != 1:
        raise InvalidSyncCursor("CURSOR_INVALID")
    try:
        token_scope = str(UUID(payload["scope_id"]))
        expected_scope = str(UUID(str(expected_scope_id)))
    except (ValueError, TypeError, AttributeError):
        raise InvalidSyncCursor("CURSOR_INVALID") from None
    if token_scope != expected_scope or payload["scope_id"] != token_scope:
        raise InvalidSyncCursor("CURSOR_INVALID")

    after_raw = payload["after"]
    through_raw = payload["through"]
    if not isinstance(after_raw, str) or not _DECIMAL.fullmatch(after_raw):
        raise InvalidSyncCursor("CURSOR_INVALID")
    if through_raw is not None and (not isinstance(through_raw, str) or not _DECIMAL.fullmatch(through_raw)):
        raise InvalidSyncCursor("CURSOR_INVALID")
    after = int(after_raw)
    through = int(through_raw) if through_raw is not None else None
    if after > MAX_SEQUENCE or (through is not None and (through > MAX_SEQUENCE or through < after)):
        raise InvalidSyncCursor("CURSOR_INVALID")
    return CursorPosition(after=after, through=through)
