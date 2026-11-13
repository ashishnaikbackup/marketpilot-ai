from fastapi.testclient import TestClient

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
