# Safety, derivatives risk and compliance guardrails

## Product boundary

The initial product is a market research, education and paper-trading platform. It does not place live orders, hold client funds, or act as a broker/investment adviser.

## Research candidates

Any candidate setup must show:
- instrument, expiry and contract assumptions;
- source and timestamp for every market input;
- bullish/bearish/neutral thesis and counter-thesis;
- entry zone as a hypothetical scenario, not an instruction;
- target scenario(s), invalidation and estimated risk/reward;
- costs, slippage and liquidity caveats where estimable;
- confidence calibration and historical evaluation methodology;
- explicit NO TRADE when data quality or setup quality is inadequate.

Never promise returns, label a setup as certain, or use an LLM-generated confidence number as a probability without calibration.

## F&O-specific warnings

Options are leveraged and time-sensitive. Premiums can decay; volatility and spreads can change quickly. A payoff-at-expiry chart is not a live P&L forecast. Display max loss, breakeven, expiry, lot size and assumptions before a strategy can be saved to paper trading.

Do not recommend naked short-option strategies as beginner-friendly. Strategy examples should emphasize defined risk and explain margin and gap risk.

## Data rights

Use exchange-authorized or contractually permitted providers. Do not scrape protected endpoints, bypass rate limits, or redistribute data without permission. Clearly label demo, delayed, EOD and historical data.

## Broker APIs and automated execution

Live execution is intentionally excluded from the initial scope. Before considering it, conduct a fresh legal/compliance review of applicable SEBI circulars, exchange implementation standards, broker terms, authentication, static-IP requirements where applicable, algo registration/approval, audit trails and hosting constraints. Do not assume that a personal API key makes an automated trading workflow compliant.

Reference starting points:
- SEBI circular, 4 Feb 2025: https://www.sebi.gov.in/legal/circulars/feb-2025/safer-participation-of-retail-investors-in-algorithmic-trading_91614.html
- NSE implementation standards and updates: https://www.nseindia.com/static/trade/empanelled-algo-providers-exchange

This document is engineering guidance, not legal advice. Requirements can change; verify the current primary-source rules before release.

## Security

- Keep provider keys server-side in environment/secret manager.
- Never commit `.env`, credentials, broker tokens or personal data.
- Add authentication and per-user authorization before persistent personal portfolios.
- Log security-relevant events without leaking secrets.
- Require explicit human confirmation for any future external action.
