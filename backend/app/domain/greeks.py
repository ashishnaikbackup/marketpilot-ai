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


def implied_volatility(
    side: OptionSide,
    spot: float,
    strike: float,
    years_to_expiry: float,
    risk_free_rate: float,
    option_price: float,
    tolerance: float = 1e-7,
    max_iterations: int = 100,
) -> float:
    """Solve European Black-Scholes implied volatility by bisection.

    Returns annualised volatility as a decimal. Requires a positive option price
    within the model's price range for volatility in (0, 5].
    """
    if option_price <= 0:
        raise ValueError("option_price must be positive")
    if tolerance <= 0 or max_iterations < 1:
        raise ValueError("solver tolerance and iteration count must be positive")

    low, high = 1e-6, 5.0
    low_price = black_scholes_greeks(
        side, spot, strike, years_to_expiry, risk_free_rate, low
    ).theoretical_price
    high_price = black_scholes_greeks(
        side, spot, strike, years_to_expiry, risk_free_rate, high
    ).theoretical_price
    if option_price < low_price - tolerance or option_price > high_price + tolerance:
        raise ValueError("option_price is outside the supported Black-Scholes price range")

    for _ in range(max_iterations):
        mid = (low + high) / 2.0
        model_price = black_scholes_greeks(
            side, spot, strike, years_to_expiry, risk_free_rate, mid
        ).theoretical_price
        if abs(model_price - option_price) <= tolerance:
            return mid
        if model_price < option_price:
            low = mid
        else:
            high = mid

    return (low + high) / 2.0
