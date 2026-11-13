"""Optional server-side AI research explainer. AI is never a market-data or signal source."""
import os
import secrets
from typing import Literal
import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(tags=["AI research"])


class ExplainRequest(BaseModel):
    provider: Literal["openai", "anthropic"]
    question: str = Field(min_length=5, max_length=2000)
    research_context: str = Field(min_length=1, max_length=12000)
    source_urls: list[str] = Field(default_factory=list, max_length=20)


SYSTEM = ("You are MarketPilot AI's cautious financial research explainer. Explain only the supplied "
          "context. Do not invent prices, facts, citations, probabilities, signals or recommendations. "
          "Separate facts from assumptions, list missing information and risks, and remind the user "
          "that derivatives are high risk. You are not an investment adviser.")


@router.post("/ai/explain")
async def explain(payload: ExplainRequest, x_api_key: str | None = Header(default=None)):
    expected_key = os.getenv("MARKETPILOT_API_KEY")
    if not expected_key:
        raise HTTPException(503, "AI endpoint is disabled until MARKETPILOT_API_KEY is configured.")
    if not x_api_key or not secrets.compare_digest(x_api_key, expected_key):
        raise HTTPException(401, "A valid API key is required.")
    if payload.provider == "openai":
        key, model = os.getenv("OPENAI_API_KEY"), os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        if not key:
            raise HTTPException(503, "OpenAI provider is not configured on the server.")
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {key}"}
        body = {"model": model, "temperature": 0.2,
                "messages": [{"role": "system", "content": SYSTEM},
                             {"role": "user", "content": f"Question: {payload.question}\n\nResearch context:\n{payload.research_context}\n\nSource URLs supplied (not independently verified): {payload.source_urls}"}]}
    else:
        key, model = os.getenv("ANTHROPIC_API_KEY"), os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")
        if not key:
            raise HTTPException(503, "Anthropic provider is not configured on the server.")
        url = "https://api.anthropic.com/v1/messages"
        headers = {"x-api-key": key, "anthropic-version": "2023-06-01"}
        body = {"model": model, "max_tokens": 1200, "temperature": 0.2,
                "system": SYSTEM,
                "messages": [{"role": "user", "content": f"Question: {payload.question}\n\nResearch context:\n{payload.research_context}\n\nSource URLs supplied (not independently verified): {payload.source_urls}"}]}
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=5.0)) as client:
            response = await client.post(url, headers=headers, json=body)
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(504, "AI provider timed out. Retry later.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, "AI provider returned an error. Check server configuration and quota.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(502, "AI provider is temporarily unavailable.") from exc
    if payload.provider == "openai":
        answer = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    else:
        answer = "\n".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
    if not answer:
        raise HTTPException(502, "AI provider returned an empty response.")
    return {"provider": payload.provider, "model": model, "answer": answer,
            "sources": payload.source_urls, "source_verification": "not_verified_by_ai_service",
            "is_trade_recommendation": False}
