from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.domain.analytics import ChainRow, option_chain_summary
from app.domain.backtest import sma_crossover_backtest
from app.domain.instruments import list_instruments
from app.domain.scanner import evaluate_candidate
from datetime import datetime

router = APIRouter(tags=["research analytics"])


class ChainInput(BaseModel):
    strike: float = Field(gt=0)
    option_type: str
    open_interest: int = Field(ge=0)
    change_in_open_interest: int = 0
    volume: int = Field(ge=0)
    implied_volatility: float | None = Field(default=None, ge=0, le=1000)


class ChainRequest(BaseModel):
    rows: list[ChainInput] = Field(min_length=1, max_length=5000)


class BacktestRequest(BaseModel):
    closes: list[float] = Field(min_length=22, max_length=10000)
    fast_window: int = Field(default=5, ge=2, le=499)
    slow_window: int = Field(default=20, ge=3, le=500)
    fee_bps: float = Field(default=5, ge=0, le=500)
    slippage_bps: float = Field(default=5, ge=0, le=500)


class CandidateRequest(BaseModel):
    data_mode: str
    observed_at: datetime | None = None
    source: str | None = None
    exchange: str | None = None
    evidence: list[str] = Field(default_factory=list, max_length=20)
    invalidation: str | None = None
    risk_notes: str | None = None
    rule_id: str | None = None


@router.get("/instruments")
def instruments():
    return list_instruments()


@router.post("/analytics/option-chain")
def chain_analytics(payload: ChainRequest):
    try:
        rows = [ChainRow(**row.model_dump()) for row in payload.rows]
        return option_chain_summary(rows)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/research/candidate")
def research_candidate(payload: CandidateRequest):
    return evaluate_candidate(**payload.model_dump())


@router.post("/backtest/sma-crossover")
def backtest(payload: BacktestRequest):
    try:
        return sma_crossover_backtest(payload.closes, payload.fast_window, payload.slow_window,
                                      payload.fee_bps, payload.slippage_bps)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
