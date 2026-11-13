"""Research data-quality gates. Missing or untrusted inputs always produce NO_TRADE."""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["research"])
REQUIRED_MARKET_FIELDS = {"underlying_price", "option_chain", "open_interest", "implied_volatility"}


class DataQualityRequest(BaseModel):
    instrument: str = Field(min_length=1, max_length=40)
    source: str | None = None
    exchange: str | None = None
    data_mode: Literal["live", "delayed", "eod", "historical", "demo", "unavailable"] = "demo"
    observed_at: datetime | None = None
    available_fields: list[str] = Field(default_factory=list)
    strategy_rules_validated: bool = False


@router.get("/market-data/status", summary="Describe configured market-data availability")
def market_data_status() -> dict:
    """No provider is configured in the starter deployment."""
    return {
        "provider_connected": False,
        "provider": None,
        "data_mode": "unavailable",
        "instruments": [],
        "message": "Connect an authorised market-data provider before using live analytics.",
    }


@router.post("/research/screen", summary="Apply research data-quality gates")
def screen_research(payload: DataQualityRequest) -> dict:
    missing = sorted(REQUIRED_MARKET_FIELDS - set(payload.available_fields))
    reasons: list[str] = []

    if payload.data_mode == "demo":
        reasons.append("Demo data cannot generate a market opportunity.")
    if payload.data_mode == "historical":
        reasons.append("Historical data is for replay and study, not a current opportunity.")
    if payload.data_mode == "eod":
        reasons.append("End-of-day data cannot be used for intraday opportunity screening.")
    if payload.data_mode == "unavailable":
        reasons.append("No usable market data is available.")
    if not payload.source or not payload.exchange:
        reasons.append("Market-data source and exchange are not identified.")
    if payload.observed_at is None:
        reasons.append("Observation timestamp is missing.")
    elif payload.observed_at.tzinfo is None:
        reasons.append("Observation timestamp must include a timezone.")
    else:
        age_seconds = (datetime.now(UTC) - payload.observed_at.astimezone(UTC)).total_seconds()
        if age_seconds < -60:
            reasons.append("Observation timestamp is in the future.")
        elif age_seconds > 300:
            reasons.append("Market data is stale for intraday screening.")
    if missing:
        reasons.append("Required fields are missing: " + ", ".join(missing) + ".")
    if not payload.strategy_rules_validated:
        reasons.append("No validated strategy rules are enabled.")

    return {
        "instrument": payload.instrument,
        "decision": "NO_TRADE" if reasons else "ELIGIBLE_FOR_FURTHER_REVIEW",
        "reasons": reasons,
        "missing_fields": missing,
        "data_mode": payload.data_mode,
        "source": payload.source,
        "exchange": payload.exchange,
        "observed_at": payload.observed_at.isoformat() if payload.observed_at else None,
        "is_trade_recommendation": False,
        "message": (
            "This gate checks data readiness only. Passing it is not a trade signal "
            "or investment recommendation."
        ),
    }
