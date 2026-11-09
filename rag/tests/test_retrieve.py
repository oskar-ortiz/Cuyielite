import pytest

from rag.src.retrieve import validate_top_k


@pytest.mark.parametrize("value", [1, 5, 20])
def test_top_k_accepts_inclusive_limits(value: int) -> None:
    assert validate_top_k(value) == value


@pytest.mark.parametrize("value", [0, 21, -1, True, 1.5, "5"])
def test_top_k_rejects_values_outside_contract(value: object) -> None:
    with pytest.raises(ValueError, match="top_k"):
        validate_top_k(value)  # type: ignore[arg-type]
