"""Pure option payoff calculations.

These functions calculate expiry payoff only. They do not estimate live option value,
margin, fees, taxes, slippage or early exercise effects.
"""

from dataclasses import dataclass
from enum import StrEnum


class OptionSide(StrEnum):
    CALL = "call"
    PUT = "put"


@dataclass(frozen=True)
class OptionPosition:
    side: OptionSide
    quantity: int
    strike: float
    premium: float
    lot_size: int = 1

    def __post_init__(self) -> None:
        if self.quantity == 0:
            raise ValueError("quantity cannot be zero")
        if self.strike <= 0 or self.premium < 0 or self.lot_size <= 0:
            raise ValueError("strike and lot size must be positive; premium cannot be negative")


def intrinsic_value(side: OptionSide, spot_at_expiry: float, strike: float) -> float:
    if spot_at_expiry < 0 or strike <= 0:
        raise ValueError("spot cannot be negative and strike must be positive")
    if side == OptionSide.CALL:
        return max(spot_at_expiry - strike, 0.0)
    return max(strike - spot_at_expiry, 0.0)


def position_expiry_pnl(position: OptionPosition, spot_at_expiry: float) -> float:
    """Return gross expiry P&L in currency units, before costs."""
    intrinsic = intrinsic_value(position.side, spot_at_expiry, position.strike)
    per_unit = intrinsic - position.premium
    return per_unit * position.quantity * position.lot_size


def breakeven(position: OptionPosition) -> float:
    if position.side == OptionSide.CALL:
        return position.strike + position.premium
    return max(position.strike - position.premium, 0.0)


def long_option_max_loss(position: OptionPosition) -> float:
    """Maximum loss for a long option position, in currency units."""
    if position.quantity <= 0:
        raise ValueError("long_option_max_loss requires a positive quantity")
    return position.premium * position.quantity * position.lot_size
