from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_market_data_status_is_explicitly_unavailable() -> None:
    response = client.get("/api/v1/market-data/status")
    assert response.status_code == 200
    assert response.json()["provider_connected"] is False
    assert response.json()["data_mode"] == "unavailable"


def test_demo_data_always_returns_no_trade() -> None:
    response = client.post("/api/v1/research/screen", json={"instrument": "NIFTY"})
    body = response.json()
    assert response.status_code == 200
    assert body["decision"] == "NO_TRADE"
    assert any("Demo data" in reason for reason in body["reasons"])


def test_stale_or_incomplete_data_returns_no_trade() -> None:
    observed = (datetime.now(UTC) - timedelta(minutes=20)).isoformat()
    response = client.post(
        "/api/v1/research/screen",
        json={
            "instrument": "NIFTY",
            "source": "Example licensed feed",
            "exchange": "NSE",
            "data_mode": "live",
            "observed_at": observed,
            "available_fields": ["underlying_price"],
            "strategy_rules_validated": True,
        },
    )
    body = response.json()
    assert body["decision"] == "NO_TRADE"
    assert body["missing_fields"]
    assert any("stale" in reason.lower() for reason in body["reasons"])


def test_complete_fresh_data_only_passes_readiness_gate() -> None:
    observed = datetime.now(UTC).isoformat()
    fields = ["underlying_price", "option_chain", "open_interest", "implied_volatility"]
    response = client.post(
        "/api/v1/research/screen",
        json={
            "instrument": "NIFTY",
            "source": "Example licensed feed",
            "exchange": "NSE",
            "data_mode": "live",
            "observed_at": observed,
            "available_fields": fields,
            "strategy_rules_validated": True,
        },
    )
    body = response.json()
    assert body["decision"] == "ELIGIBLE_FOR_FURTHER_REVIEW"
    assert body["is_trade_recommendation"] is False
