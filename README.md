# MarketPilot AI

**AI-powered market research and F&O intelligence — India first, global by design.**

**Dashboard URL:** https://ashishnaikbackup.github.io/marketpilot-ai/ (GitHub Pages must be configured to publish with GitHub Actions; see [Pages troubleshooting](docs/PAGES_TROUBLESHOOTING.md)).

MarketPilot AI is an integrated financial intelligence platform combining MarketPilot's active-market research and F&O tools with FinPilot-style wealth planning, portfolio analytics and long-term investment research. Its first product focus is Indian index derivatives: **NIFTY 50, BANKNIFTY and FINNIFTY**, with options-chain analytics, volatility context, scenario analysis, risk calculations, paper trading and scheduled research reports.

> **Current status:** Functional research-first MVP foundation. The dashboard includes India F&O tools, a guarded scanner, strategy payoff lab, browser-local paper journal, report builder, global watchlist, integrated investment hub (portfolio/P&L, asset comparisons, SIP/lump-sum/goal calculators, research journal, market-session guide, position sizing and stop/target/reward-risk planner), an interactive learning academy, and a clean light-theme wealth/research UI. The India Market Lab imports user-supplied NIFTY/BANKNIFTY/FINNIFTY option-chain CSVs and calculates PCR, change-OI PCR, max pain, highest OI strikes, ATM IV and quoted spreads. A new Money Manager adds local income/expense tracking, monthly budgets, savings goals, CSV import/export and an educational financial-health checklist. The Copilot can read locally saved imported-chain metrics and an opt-in summary of Money Manager records, and call an optional Cloudflare Workers AI chat endpoint (Gemma model on the published free daily allowance) when the Worker and AI binding are deployed; it falls back to a local educational knowledge base otherwise. It is not connected to live exchange data. The Investment Hub also supports CSV-based historical price analysis (return, CAGR, annualised volatility, drawdown, RSI and moving averages), a hypothetical position-sizing and risk/reward planner, and official exchange-session references for US and Asian markets. No live exchange feed, broker connection, AI-generated trade signal or real-money execution is enabled.

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
- India Market Lab: import a user-supplied option-chain CSV, calculate PCR, change-OI PCR, max pain, OI concentrations, ATM IV and quoted spreads; the Copilot can explain the imported snapshot.\n- Money Manager: manual income/expense ledger, category budgets, savings goals, cash-flow summary, simple financial-health checklist and CSV backup. It is not bank-connected.
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

## Research APIs added

- `GET /api/v1/instruments` returns the bootstrap universe; lot sizes and expiry calendars remain intentionally unset until a dated authorised instrument master is configured.
- `POST /api/v1/analytics/option-chain` calculates descriptive PCR, OI, change-in-OI, volume and concentration from caller-supplied rows. It does not fetch or verify exchange data.
- `POST /api/v1/research/candidate` applies timestamp, provenance, evidence, invalidation, risk-note and reviewed-rule gates. It can return only `NO_TRADE` or `ELIGIBLE_FOR_HUMAN_REVIEW`.
- `POST /api/v1/ai/chat` optionally calls Cloudflare Workers AI through a server-side binding, with fixed research guardrails and no client-side AI secret. It is educational and does not create trade signals.
- `POST /api/v1/backtest/sma-crossover` runs a simple long-only SMA research simulation on caller-supplied closes, with fee/slippage assumptions and drawdown. The dashboard includes a Backtest Lab that calls this endpoint after the user enters a deployed API URL. It is an educational baseline, not a validated strategy.
- `POST /api/v1/ai/explain` optionally calls OpenAI or Anthropic using server-side secrets. It requires a separate `MARKETPILOT_API_KEY` request header and explains only supplied context; it is not a quote, signal or recommendation.

## Investment and wealth workspace

The integrated Investment Hub adds manual holdings and unrealised P&L with user-entered prices/FX, asset comparison from explicit assumptions, SIP/lump-sum/goal calculators, research journaling, India market-session education and a CSV historical data lab for stocks, ETFs, gold, funds and global assets. The Academy has self-paced modules and knowledge checks with browser-local progress. These tools are calculation/education layers, not live market feeds or personalised recommendations.

## First implemented API

The React dashboard now includes an India F&O workbench (with a modelled Greeks calculator), a research readiness scanner, and a browser-local paper journal. The backend exposes provider-neutral quote/option-chain contracts but intentionally ships with no connected provider. The options expiry-payoff endpoint accepts multiple call/put legs and returns a spot-versus-gross-expiry-P&L curve. The Greeks endpoint calculates European Black-Scholes theoretical price, delta, gamma, annual theta and vega from user-supplied assumptions. A bounded bisection solver estimates model-implied volatility from a user-supplied option premium. A separate research gate rejects demo, stale, incomplete or unprovenanced data with NO_TRADE. These calculations do not include exchange quotes, fees, slippage, margin or a trade recommendation. See the OpenAPI docs, [model notes](docs/OPTIONS_MODELS.md), and [provider contract](docs/MARKET_DATA_PROVIDER.md) for details.

## Free-first hosting

The frontend remains on GitHub Pages. A lightweight Cloudflare Workers API is included under `cloudflare-worker/` as the free-first backend alternative to Render. See [Free deployment guide](docs/FREE_DEPLOYMENT.md) for setup and limits. The Worker handles health/status, option calculations, option-chain summaries, research readiness checks, the SMA crossover backtest and optional Cloudflare Workers AI chat. No database is required for the current browser-local single-user MVP.

## Configuration

Copy `backend/.env.example` to `backend/.env`. Do not commit secrets. The initial app works without an AI key or market-data key.

## Development stages

See [Roadmap](docs/ROADMAP.md), [Architecture](docs/ARCHITECTURE.md), [Deployment guide](docs/DEPLOYMENT.md), [Safety & Compliance](docs/SAFETY_AND_COMPLIANCE.md), and the [Claude handoff prompt](docs/CLAUDE_HANDOFF_PROMPT.md).

## Data and regulatory note

Exchange data access, redistribution, display rights and broker API use are subject to provider contracts and applicable exchange/regulatory terms. The project will not scrape protected endpoints or imply that unofficial data is exchange-authorised. Any future execution feature requires a separate compliance and security review.

## Disclaimer

MarketPilot AI is a software and educational research project, not an investment adviser or broker. Research scenarios are uncertain and can be wrong. Derivatives can cause rapid and substantial losses. Verify information independently and consult a SEBI-registered investment adviser where appropriate.
