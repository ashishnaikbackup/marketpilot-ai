import pytest

from app.domain.options import (
    OptionPosition,
    OptionSide,
    breakeven,
    intrinsic_value,
    long_option_max_loss,
    position_expiry_pnl,
)


def test_long_call_expiry_profit() -> None:
    position = OptionPosition(OptionSide.CALL, quantity=1, strike=100, premium=8, lot_size=25)
    assert position_expiry_pnl(position, 120) == 300
    assert breakeven(position) == 108
    assert long_option_max_loss(position) == 200


def test_long_put_expiry_profit() -> None:
    position = OptionPosition(OptionSide.PUT, quantity=2, strike=100, premium=5, lot_size=10)
    assert position_expiry_pnl(position, 80) == 300
    assert breakeven(position) == 95


def test_short_call_has_opposite_payoff() -> None:
    position = OptionPosition(OptionSide.CALL, quantity=-1, strike=100, premium=8, lot_size=25)
    assert position_expiry_pnl(position, 120) == -300


def test_intrinsic_value() -> None:
    assert intrinsic_value(OptionSide.CALL, 110, 100) == 10
    assert intrinsic_value(OptionSide.PUT, 90, 100) == 10
    assert intrinsic_value(OptionSide.CALL, 90, 100) == 0


def test_reject_zero_quantity() -> None:
    with pytest.raises(ValueError):
        OptionPosition(OptionSide.PUT, quantity=0, strike=100, premium=5)
