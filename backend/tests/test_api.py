import pytest\n\nfrom fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_expiry_payoff_endpoint() -> None:
    response = client.post(
        "/api/v1/options/expiry-payoff",
        json={
            "positions": [{"side": "call", "quantity": 1, "strike": 100, "premium": 8, "lot_size": 25}],
            "spot_min": 80,
            "spot_max": 120,
            "steps": 3,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["calculation"] == "expiry_payoff"
    assert body["points"][1]["gross_pnl"] == -200
    assert body["points"][2]["gross_pnl"] == 300
    assert body["includes_fees"] is False


def test_expiry_payoff_rejects_invalid_range() -> None:
    response = client.post(
        "/api/v1/options/expiry-payoff",
        json={
            "positions": [{"side": "put", "quantity": 1, "strike": 100, "premium": 5}],
            "spot_min": 100,
            "spot_max": 100,
        },
    )
    assert response.status_code == 422



def test_expiry_payoff_rejects_zero_quantity() -> None:
    response = client.post(
        "/api/v1/options/expiry-payoff",
        json={
            "positions": [{"side": "call", "quantity": 0, "strike": 100, "premium": 5}],
            "spot_min": 80,
            "spot_max": 120,
        },
    )
    assert response.status_code == 422


def test_greeks_endpoint_returns_modelled_assumptions() -> None:
    response = client.post(
        "/api/v1/options/greeks",
        json={
            "side": "call",
            "spot": 100,
            "strike": 100,
            "years_to_expiry": 1,
            "risk_free_rate": 0.05,
            "volatility": 0.2,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "black_scholes_european"
    assert body["data_mode"] == "modelled_assumptions"
    assert body["gamma"] > 0
    assert "not a market quote" in body["disclaimer"]


def test_implied_volatility_endpoint_returns_modelled_iv() -> None:
    response = client.post(
        "/api/v1/options/implied-volatility",
        json={
            "side": "call",
            "spot": 100,
            "strike": 100,
            "years_to_expiry": 1,
            "risk_free_rate": 0.05,
            "option_price": 10.450583572,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["implied_volatility"] == pytest.approx(0.2, abs=1e-5)
    assert body["data_mode"] == "modelled_from_user_supplied_option_price"


def test_implied_volatility_endpoint_rejects_unrealistic_price() -> None:
    response = client.post(
        "/api/v1/options/implied-volatility",
        json={
            "side": "call",
            "spot": 100,
            "strike": 100,
            "years_to_expiry": 1,
            "risk_free_rate": 0.05,
            "option_price": 500,
        },
    )
    assert response.status_code == 422
