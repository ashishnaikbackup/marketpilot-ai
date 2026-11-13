"""Explainable readiness and scenario evidence engine; never emits a trade recommendation."""
from datetime import UTC, datetime


def evaluate_candidate(*, data_mode: str, observed_at: datetime | None, source: str | None,
                       exchange: str | None, evidence: list[str], invalidation: str | None,
                       risk_notes: str | None, rule_id: str | None) -> dict:
    reasons = []
    if data_mode not in {"live", "delayed"}:
        reasons.append("Only live or delayed data can enter this intraday research review.")
    if not observed_at or observed_at.tzinfo is None:
        reasons.append("A timezone-aware observation timestamp is required.")
    else:
        age = (datetime.now(UTC) - observed_at.astimezone(UTC)).total_seconds()
        if age < -60 or age > 300:
            reasons.append("Data timestamp is future-dated or older than the 5-minute freshness limit.")
    if not source or not exchange:
        reasons.append("Provider and exchange provenance are required.")
    if len([x for x in evidence if x.strip()]) < 2:
        reasons.append("At least two explicit evidence points are required.")
    if not invalidation or not invalidation.strip():
        reasons.append("A thesis invalidation condition is required.")
    if not risk_notes or not risk_notes.strip():
        reasons.append("Risk notes are required.")
    if not rule_id or not rule_id.strip():
        reasons.append("A versioned, reviewed rule identifier is required.")
    return {"decision": "NO_TRADE" if reasons else "ELIGIBLE_FOR_HUMAN_REVIEW",
            "reasons": reasons, "evidence": evidence, "invalidation": invalidation,
            "risk_notes": risk_notes, "rule_id": rule_id,
            "is_trade_recommendation": False,
            "message": "Eligibility is not a signal, recommendation, probability or instruction to trade."}
