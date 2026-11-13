"""Deterministic descriptive option-chain analytics. Inputs must come from a trusted adapter."""
from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class ChainRow:
    strike: float
    option_type: str
    open_interest: int
    change_in_open_interest: int = 0
    volume: int = 0
    implied_volatility: float | None = None


def option_chain_summary(rows: Iterable[ChainRow]) -> dict:
    data = list(rows)
    if not data:
        return {"status": "unavailable", "reason": "Option chain is empty.", "put_call_oi_ratio": None,
                "call_oi": 0, "put_oi": 0, "call_change_oi": 0, "put_change_oi": 0,
                "call_volume": 0, "put_volume": 0, "max_call_oi_strike": None,
                "max_put_oi_strike": None, "interpretation": "No directional inference."}
    if any(r.strike <= 0 or min(r.open_interest, r.volume) < 0 for r in data):
        raise ValueError("Strike must be positive and OI/volume cannot be negative.")
    calls = [r for r in data if r.option_type.upper() == "CE"]
    puts = [r for r in data if r.option_type.upper() == "PE"]
    if len(calls) + len(puts) != len(data):
        raise ValueError("option_type must be CE or PE.")
    call_oi, put_oi = sum(x.open_interest for x in calls), sum(x.open_interest for x in puts)
    return {
        "status": "calculated_from_supplied_chain",
        "put_call_oi_ratio": round(put_oi / call_oi, 4) if call_oi else None,
        "call_oi": call_oi, "put_oi": put_oi,
        "call_change_oi": sum(x.change_in_open_interest for x in calls),
        "put_change_oi": sum(x.change_in_open_interest for x in puts),
        "call_volume": sum(x.volume for x in calls), "put_volume": sum(x.volume for x in puts),
        "max_call_oi_strike": max(calls, key=lambda x: x.open_interest).strike if calls else None,
        "max_put_oi_strike": max(puts, key=lambda x: x.open_interest).strike if puts else None,
        "interpretation": "Descriptive positioning only; PCR and OI concentrations are not standalone signals.",
    }
