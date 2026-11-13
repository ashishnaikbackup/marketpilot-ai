from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ai_provider_requires_server_secret(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    response = client.post("/api/v1/ai/explain", json={"provider":"openai",
        "question":"Explain the context", "research_context":"No verified market feed."})
    assert response.status_code == 503


def test_ai_request_validates_input():
    response = client.post("/api/v1/ai/explain", json={"provider":"openai",
        "question":"x", "research_context":"context"})
    assert response.status_code == 422
