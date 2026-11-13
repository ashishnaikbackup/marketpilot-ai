import pytest

from app.domain.greeks import black_scholes_greeks
from app.domain.options import OptionSide


def test_at_the_money_call_delta_is_near_half() -> None:
    result = black_scholes_greeks(OptionSide.CALL, 100, 100, 1, 0.0, 0.2)
    assert result.theoretical_price > 0
    assert result.delta == pytest.approx(0.5398, abs=0.001)
    assert result.gamma > 0
    assert result.vega_per_1pct > 0


def test_put_call_delta_parity_for_same_inputs() -> None:
    call = black_scholes_greeks(OptionSide.CALL, 100, 100, 1, 0.05, 0.2)
    put = black_scholes_greeks(OptionSide.PUT, 100, 100, 1, 0.05, 0.2)
    assert call.delta - put.delta == pytest.approx(1.0)


def test_invalid_model_inputs_are_rejected() -> None:
    with pytest.raises(ValueError):
        black_scholes_greeks(OptionSide.CALL, 100, 100, 0, 0.05, 0.2)
