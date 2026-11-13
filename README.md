# MarketPilot AI

**AI-powered market research and F&O intelligence — India first, global by design.**

**Live dashboard:** https://ashishnaikbackup.github.io/marketpilot-ai/ (static frontend; market data and backend services are not connected).

MarketPilot AI is a research-first financial intelligence platform. Its first product focus is Indian index derivatives: **NIFTY 50, BANKNIFTY and FINNIFTY**, with options-chain analytics, volatility context, scenario analysis, risk calculations, paper trading and scheduled research reports.

> **Current status:** Functional research-first MVP foundation. The dashboard includes India F&O tools, a guarded scanner, strategy payoff lab, browser-local paper journal, report builder, learning path and global watchlist. No live exchange feed, broker connection, AI-generated signal or real-money execution is enabled.

## Product principles

1. **Evidence before opinions:** every research view should show its data timestamp, source, assumptions and limitations.
2. **No fabricated live data:** distinguish live, delayed, end-of-day, historical and demo data in the UI and API.
3. **Risk-first F&O research:** show payoff, breakeven, max loss, expiry and volatility context before presenting a strategy.
4. **No forced trades:** the scanner must be allowed to return **NO TRADE**.
5. **Human in control:** paper trading first. No unattended live order placement.
6. **Provider-neutral AI:** OpenAI and Claude are optional providers behind one server-side interface. API keys never belong in frontend code or Git.
7. **Compliance-aware:** broker APIs and automated execution are out of scope until applicable exchange/broker approvals and SEBI requirements are reviewed.

## Planned capabilities

- India market overview: NIFTY, BANKNIFTY, FINNIFTY, India VIX, sectors and market breadth.
- F&O workbench: option chain, OI/change in OI, volume, IV, Greeks, PCR, expiry and payoff analysis.
- Research scanner: bullish/bearish/neutral scenarios, entry zone, targets, invalidation and risk/reward — or NO TRADE.
- Strategy lab: payoff and breakeven for defined-risk option structures.
- Paper portfolio and trade journal.
- Daily pre-market, intraday, closing, weekly and monthly reports.
- Global indices, equities, FX, commodities, bonds, funds and macro research.
- Learning centre for markets, derivatives and risk management.

## Repository structure

```
backend/        FastAPI service, domain calculations and tests
frontend/       React + TypeScript + Vite dashboard
docs/           Product, architecture, roadmap and safety decisions
.github/        CI and GitHub Pages deployment workflows
```

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

API health: http://localhost:8000/api/v1/health  
OpenAPI docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The static frontend can be built and hosted independently. The current Greeks calculator, paper journal, report builder and watchlists work in the browser. Backend APIs can be run locally for API testing. No market data provider is configured; any sample overview values are labelled DEMO.

## First implemented API

The React dashboard now includes an India F&O workbench (with a modelled Greeks calculator), a research readiness scanner, and a browser-local paper journal. The backend exposes provider-neutral quote/option-chain contracts but intentionally ships with no connected provider. The options expiry-payoff endpoint accepts multiple call/put legs and returns a spot-versus-gross-expiry-P&L curve. The Greeks endpoint calculates European Black-Scholes theoretical price, delta, gamma, annual theta and vega from user-supplied assumptions. A bounded bisection solver estimates model-implied volatility from a user-supplied option premium. A separate research gate rejects demo, stale, incomplete or unprovenanced data with NO_TRADE. These calculations do not include exchange quotes, fees, slippage, margin or a trade recommendation. See the OpenAPI docs, [model notes](docs/OPTIONS_MODELS.md), and [provider contract](docs/MARKET_DATA_PROVIDER.md) for details.

## Configuration

Copy `backend/.env.example` to `backend/.env`. Do not commit secrets. The initial app works without an AI key or market-data key.

## Development stages

See [Roadmap](docs/ROADMAP.md), [Architecture](docs/ARCHITECTURE.md), [Safety & Compliance](docs/SAFETY_AND_COMPLIANCE.md), and the [Claude handoff prompt](docs/CLAUDE_HANDOFF_PROMPT.md).

## Data and regulatory note

Exchange data access, redistribution, display rights and broker API use are subject to provider contracts and applicable exchange/regulatory terms. The project will not scrape protected endpoints or imply that unofficial data is exchange-authorised. Any future execution feature requires a separate compliance and security review.

## Disclaimer

MarketPilot AI is a software and educational research project, not an investment adviser or broker. Research scenarios are uncertain and can be wrong. Derivatives can cause rapid and substantial losses. Verify information independently and consult a SEBI-registered investment adviser where appropriate.
