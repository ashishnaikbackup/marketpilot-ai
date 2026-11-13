# MarketPilot AI — Delivery Roadmap

## Priority order

The product is India-first. NIFTY/BANKNIFTY derivatives are the core workflow; global assets are later modules.

### Milestone 0 — Foundation (complete)
- [x] Repository structure and product principles
- [x] FastAPI service and health endpoint
- [x] Initial option payoff domain functions and tests
- [x] React/TypeScript dashboard shell with demo-data disclosure
- [x] CI workflow for backend lint/tests and frontend production build (verification in progress)

### Milestone 1 — Data foundation
- [x] Explicit unavailable-provider status endpoint
- [x] Conservative freshness/provenance/required-field gate with NO_TRADE fallback
- [x] Provider-neutral quote and option-chain adapter contracts (no provider connected yet)
- [x] Normalized provenance fields for provider, exchange, instrument and timestamps (adapter enforcement remains)
- [x] Bootstrap instrument catalogue with deliberately unverified lot-size/expiry fields; [ ] authoritative calendar and dated contract master
- [ ] Historical data storage and replay
- [ ] Provider terms, entitlement and redistribution review

### Milestone 2 — India cash/index market workspace
- [ ] NIFTY 50, BANKNIFTY, FINNIFTY and India VIX
- [ ] Index/sector overview, breadth, movers and watchlists
- [ ] Technical indicators with transparent calculation settings
- [ ] News and official-event calendar with source links

- [x] Descriptive option-chain PCR/OI/change-in-OI/volume analytics API for supplied validated rows (not connected to a provider)

### Milestone 3 — F&O workbench (highest product priority)
- [ ] Live option-chain table with strike, CE/PE LTP, volume, OI and change in OI (UI empty state is ready)
- [x] European Black-Scholes theoretical price, Greeks and bounded implied-volatility solver with documented assumptions (not exchange quotes)
- [ ] PCR, OI concentration and expiry comparisons
- [ ] ATM/ITM/OTM identification and strike/expiry filters
- [x] Single-leg expiry payoff calculator; [ ] defined-risk multi-leg strategy builder and payoff chart
- [ ] Max loss, max profit, breakeven, margin caveats and scenario shocks
- [ ] Historical volatility and IV context
- [ ] Explicit stale/missing-data states

- [x] Transparent long-only SMA crossover research backtest API with fee/slippage assumptions and drawdown; [ ] robust multi-strategy walk-forward engine
- [x] Candidate review gate with evidence, invalidation, risk notes, freshness and versioned rule ID; returns human-review eligibility only

### Milestone 4 — Research engine
- [ ] Rules-based, testable market feature calculations
- [x] Structured bull/base/bear, invalidation and risk fields in manual research brief; [ ] validated data-driven scenarios
- [ ] Candidate ranking with explainable evidence, never a guaranteed signal
- [x] NO TRADE state and minimum data-quality gates (starter readiness gate only)
- [ ] Backtesting with costs, slippage, survivorship and look-ahead controls

- [x] Provider-neutral request surface with optional server-side OpenAI and Anthropic adapters, API-key gate, timeouts, no browser keys and explicit source verification status
- [ ] Structured JSON schema validation, prompt versioning, token/cost logging and retrieval citations

### Milestone 5 — AI analyst
- [ ] Provider-neutral LLM interface
- [ ] OpenAI adapter
- [ ] Claude adapter
- [ ] Retrieval from timestamped, cited research records
- [ ] Structured report schema and hallucination/data checks
- [ ] Model comparison and token/cost observability

### Milestone 6 — Portfolio and paper trading
- [x] Browser-local paper trade journal with manual entry/exit and closed P&L; [ ] virtual cash, positions and full order lifecycle
- [x] Browser-local trade journal with thesis, direction, stop and target fields
- [ ] P&L, drawdown, exposure and risk limits
- [ ] Replay and paper-trade evaluation
- [ ] No broker order routing in this milestone

### Milestone 7 — Automated research reports
- [ ] Pre-market report
- [ ] Intraday event/threshold alerts
- [ ] Closing report
- [ ] Weekly review
- [ ] Monthly review
- [ ] Scheduler, retries, audit logs and notification preferences

### Milestone 8 — Global research
- [x] Global asset-class workspace and browser-local watchlist shell; [ ] live US and major global indices
- [ ] Global equities and ETFs
- [ ] FX, commodities, bonds and macro indicators
- [ ] Mutual funds/SIPs and long-term asset research
- [ ] Regional market calendars and currency conversion

### Milestone 9 — Production readiness
- [ ] Authentication, authorization and account isolation
- [ ] Secrets management, rate limiting and audit trails
- [x] Docker backend image and Render Blueprint deployment definition (service provisioning remains external)
- [ ] Monitoring, backups, disaster recovery and security review
- [ ] Data-provider licensing and legal review
- [x] Static frontend deployed to GitHub Pages; [ ] backend deployment and operational runbooks

## Definition of done

A feature is not complete merely because it renders. It must have:
- working backend/API behaviour;
- tests for core calculations;
- source and timestamp metadata where data is involved;
- loading, empty, error and stale-data states;
- documentation and a clear limitation statement;
- no secrets committed to Git.
