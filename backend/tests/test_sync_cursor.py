"""Cursor signing tests without a database connection."""

from uuid import UUID

import pytest

from backend.app.sync_cursor import InvalidSyncCursor, decode_cursor, encode_cursor


SCOPE = UUID("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")
KEY = b"synthetic-cursor-signing-key-for-unit-tests-only"


def test_cursor_roundtrip_preserves_decimal_sequences_as_strings():
    token = encode_cursor(SCOPE, 9_007_199_254_740_993, 9_007_199_254_741_003, KEY)
    decoded = decode_cursor(token, SCOPE, KEY)
    assert decoded.after == 9_007_199_254_740_993
    assert decoded.through == 9_007_199_254_741_003


def test_checkpoint_has_null_through():
    token = encode_cursor(SCOPE, 18, None, KEY)
    assert decode_cursor(token, SCOPE, KEY).through is None


@pytest.mark.parametrize("token", ["", "a", "a.b.c", "%%.%%", "a." + "A" * 44])
def test_malformed_or_tampered_cursor_is_rejected(token):
    with pytest.raises(InvalidSyncCursor):
        decode_cursor(token, SCOPE, KEY)


def test_scope_binding_and_key_rotation_are_enforced():
    token = encode_cursor(SCOPE, 0, 0, KEY)
    with pytest.raises(InvalidSyncCursor):
        decode_cursor(token, UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), KEY)
    with pytest.raises(InvalidSyncCursor):
        decode_cursor(token, SCOPE, b"different-cursor-signing-key-not-the-same")


def test_encode_rejects_invalid_position():
    with pytest.raises(ValueError):
        encode_cursor(SCOPE, 4, 3, KEY)
