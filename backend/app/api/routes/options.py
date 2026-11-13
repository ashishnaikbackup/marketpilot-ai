from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.domain.greeks import black_scholes_greeks, implied_volatility
from app.domain.options import OptionPosition, OptionSide, position_expiry_pnl

router = APIRouter(prefix="/options", tags=["options"])


class PositionInput(BaseModel):
    side: Literal["call", "put"]
    quantity: int = Field(description="Positive for long, negative for short; units before lot size")
    strike: float = Field(gt=0)
    premium: float = Field(ge=0)
    lot_size: int = Field(default=1, gt=0)

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_nonzero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("quantity cannot be zero")
        return value


class PayoffRequest(BaseModel):
    positions: list[PositionInput] = Field(min_length=1, max_length=20)
    spot_min: float = Field(ge=0)
    spot_max: float = Field(gt=0)
    steps: int = Field(default=21, ge=2, le=201)


class ImpliedVolatilityRequest(BaseModel):
    side: Literal["call", "put"]
    spot: float = Field(gt=0)
    strike: float = Field(gt=0)
    years_to_expiry: float = Field(gt=0, le=10)
    risk_free_rate: float = Field(ge=-0.05, le=0.30)
    option_price: float = Field(gt=0)


class GreeksRequest(BaseModel):
    side: Literal["call", "put"]
    spot: float = Field(gt=0)
    strike: float = Field(gt=0)
    years_to_expiry: float = Field(gt=0, le=10)
    risk_free_rate: float = Field(ge=-0.05, le=0.30)
    volatility: float = Field(gt=0, le=5, description="Annualised volatility as a decimal")


@router.post("/expiry-payoff", summary="Calculate a multi-leg option payoff at expiry")
def expiry_payoff(payload: PayoffRequest) -> dict:
    if payload.spot_max <= payload.spot_min:
        raise HTTPException(status_code=422, detail="spot_max must be greater than spot_min")

    positions = [
        OptionPosition(
            side=OptionSide(position.side),
            quantity=position.quantity,
            strike=position.strike,
            premium=position.premium,
            lot_size=position.lot_size,
        )
        for position in payload.positions
    ]

    interval = (payload.spot_max - payload.spot_min) / (payload.steps - 1)
    points = []
    for index in range(payload.steps):
        spot = payload.spot_min + interval * index
        pnl = sum(position_expiry_pnl(position, spot) for position in positions)
        points.append({"underlying_at_expiry": round(spot, 4), "gross_pnl": round(pnl, 2)})

    return {
        "calculation": "expiry_payoff",
        "data_mode": "calculation_only",
        "includes_fees": False,
        "includes_slippage": False,
        "points": points,
        "disclaimer": "Gross payoff at expiry only; not live option value, margin or a trade recommendation.",
    }


@router.post("/greeks", summary="Calculate theoretical European option Greeks")
def option_greeks(payload: GreeksRequest) -> dict:
    result = black_scholes_greeks(
        side=OptionSide(payload.side),
        spot=payload.spot,
        strike=payload.strike,
        years_to_expiry=payload.years_to_expiry,
        risk_free_rate=payload.risk_free_rate,
        volatility=payload.volatility,
    )
    return {
        "model": "black_scholes_european",
        "inputs": payload.model_dump(),
        "theoretical_price": round(result.theoretical_price, 6),
        "delta": round(result.delta, 6),
        "gamma": round(result.gamma, 8),
        "theta_per_year": round(result.theta_per_year, 6),
        "vega_per_1pct": round(result.vega_per_1pct, 6),
        "data_mode": "modelled_assumptions",
        "disclaimer": (
            "Model output from user-supplied assumptions, not a market quote or signal. "
            "European Black-Scholes omits dividends, early exercise, jumps and trading costs."
        ),
    }


@router.post("/implied-volatility", summary="Solve European Black-Scholes implied volatility")
def option_implied_volatility(payload: ImpliedVolatilityRequest) -> dict:
    try:
        value = implied_volatility(
            side=OptionSide(payload.side),
            spot=payload.spot,
            strike=payload.strike,
            years_to_expiry=payload.years_to_expiry,
            risk_free_rate=payload.risk_free_rate,
            option_price=payload.option_price,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "model": "black_scholes_european_bisection",
        "implied_volatility": round(value, 8),
        "implied_volatility_percent": round(value * 100, 4),
        "inputs": payload.model_dump(),
        "data_mode": "modelled_from_user_supplied_option_price",
        "disclaimer": (
            "Model-implied volatility from the price you entered, not an exchange IV quote. "
            "European assumptions apply; market microstructure and dividends are omitted."
        ),
    }
