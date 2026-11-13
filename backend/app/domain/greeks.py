"""Black-Scholes reference pricing and Greeks for European options.

Inputs are assumptions, not exchange quotes. The model omits dividends, jumps,
transaction costs, early exercise and market microstructure.
"""

from dataclasses import dataclass
from math import erf, exp, log, pi, sqrt

from app.domain.options import OptionSide


@dataclass(frozen=True)
class GreeksResult:
    theoretical_price: float
    delta: float
    gamma: float
    theta_per_year: float
    vega_per_1pct: float


def _normal_cdf(value: float) -> float:
    return 0.5 * (1.0 + erf(value / sqrt(2.0)))


def _normal_pdf(value: float) -> float:
    return exp(-0.5 * value * value) / sqrt(2.0 * pi)


def black_scholes_greeks(
    side: OptionSide,
    spot: float,
    strike: float,
    years_to_expiry: float,
    risk_free_rate: float,
    volatility: float,
) -> GreeksResult:
    """Return European Black-Scholes price and standard Greeks.

    Theta is per year; vega is for a 1.00 absolute volatility change divided by
    100 (i.e. the price change for a one-volatility-point move).
    """
    if spot <= 0 or strike <= 0 or years_to_expiry <= 0 or volatility <= 0:
        raise ValueError("spot, strike, time and volatility must be positive")

    root_t = sqrt(years_to_expiry)
    d1 = (
        log(spot / strike)
        + (risk_free_rate + 0.5 * volatility * volatility) * years_to_expiry
    ) / (volatility * root_t)
    d2 = d1 - volatility * root_t
    discount = exp(-risk_free_rate * years_to_expiry)
    density = _normal_pdf(d1)
    gamma = density / (spot * volatility * root_t)
    vega = spot * density * root_t / 100.0
    common_theta = -(spot * density * volatility) / (2.0 * root_t)

    if side == OptionSide.CALL:
        price = spot * _normal_cdf(d1) - strike * discount * _normal_cdf(d2)
        delta = _normal_cdf(d1)
        theta = common_theta - risk_free_rate * strike * discount * _normal_cdf(d2)
    else:
        price = strike * discount * _normal_cdf(-d2) - spot * _normal_cdf(-d1)
        delta = _normal_cdf(d1) - 1.0
        theta = common_theta + risk_free_rate * strike * discount * _normal_cdf(-d2)

    return GreeksResult(
        theoretical_price=price,
        delta=delta,
        gamma=gamma,
        theta_per_year=theta,
        vega_per_1pct=vega,
    )
