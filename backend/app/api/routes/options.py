from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.domain.options import OptionPosition, OptionSide, position_expiry_pnl

router = APIRouter(prefix="/options", tags=["options"])


class PositionInput(BaseModel):
    side: Literal["call", "put"]
    quantity: int = Field(description="Positive for long, negative for short; units before lot size")
    strike: float = Field(gt=0)
    premium: float = Field(ge=0)
    lot_size: int = Field(default=1, gt=0)


class PayoffRequest(BaseModel):
    positions: list[PositionInput] = Field(min_length=1, max_length=20)
    spot_min: float = Field(ge=0)
    spot_max: float = Field(gt=0)
    steps: int = Field(default=21, ge=2, le=201)


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
