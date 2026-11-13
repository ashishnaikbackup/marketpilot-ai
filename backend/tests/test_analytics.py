from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.domain.analytics import ChainRow, option_chain_summary
from app.domain.backtest import sma_crossover_backtest
from app.domain.scanner import evaluate_candidate
from app.main import app

client = TestClient(app)


def test_option_chain_metrics_are_descriptive():
    result = option_chain_summary([ChainRow(22000, "CE", 100), ChainRow(22000, "PE", 250)])
    assert result["put_call_oi_ratio"] == 2.5
    assert "not standalone" in result["interpretation"]


def test_chain_rejects_unknown_option_type():
    with pytest.raises(ValueError):
        option_chain_summary([ChainRow(1, "FUT", 1)])


def test_backtest_applies_costs_and_returns_risk_metrics():
    prices = [100 + i * 0.5 for i in range(40)]
    result = sma_crossover_backtest(prices, 3, 8, 2, 3)
    assert result["bars_evaluated"] > 0
    assert result["fee_bps_per_change"] == 2
    assert "max_drawdown_pct" in result


def test_backtest_rejects_invalid_windows_and_bad_prices():
    with pytest.raises(ValueError):
        sma_crossover_backtest([100] * 30, 10, 5)
    with pytest.raises(ValueError):
        sma_crossover_backtest([100, 0] + [100] * 30, 3, 8)


def test_candidate_gate_fails_closed():
    result = evaluate_candidate(
        data_mode="demo", observed_at=None, source=None, exchange=None, evidence=[],
        invalidation=None, risk_notes=None, rule_id=None,
    )
    assert result["decision"] == "NO_TRADE"
    assert len(result["reasons"]) >= 5


def test_candidate_can_only_be_eligible_for_human_review():
    result = evaluate_candidate(
        data_mode="live", observed_at=datetime.now(UTC), source="licensed", exchange="NSE",
        evidence=["trend", "breadth"], invalidation="close below", risk_notes="event risk",
        rule_id="reviewed-v1",
    )
    assert result["decision"] == "ELIGIBLE_FOR_HUMAN_REVIEW"
    assert result["is_trade_recommendation"] is False


def test_candidate_rejects_stale_data():
    result = evaluate_candidate(
        data_mode="live", observed_at=datetime.now(UTC) - timedelta(hours=1),
        source="licensed", exchange="NSE", evidence=["a", "b"], invalidation="x",
        risk_notes="y", rule_id="v1",
    )
    assert result["decision"] == "NO_TRADE"
