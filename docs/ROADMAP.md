# MarketPilot AI — Delivery Roadmap

## Priority order

The product is India-first. NIFTY/BANKNIFTY derivatives are the core workflow; global assets are later modules.

### Milestone 0 — Foundation (complete)
- [x] Repository structure and product principles
- [x] FastAPI service and health endpoint
- [x] Initial option payoff domain functions and tests
- [x] React/TypeScript dashboard shell with demo-data disclosure
- [x] CI workflow for backend lint/tests, frontend production build and Cloudflare Worker tests

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
- [x] India Market Lab: manual CSV import for NIFTY/BANKNIFTY/FINNIFTY with PCR, change-OI PCR, max pain, OI concentration, ATM IV and spread calculations (user-supplied data only)

- [x] Descriptive option-chain PCR/OI/change-in-OI/volume analytics API for supplied validated rows (not connected to a provider)

### Milestone 3 — F&O workbench (highest product priority)
- [ ] Live option-chain table with strike, CE/PE LTP, volume, OI and change in OI (UI empty state is ready)
- [x] European Black-Scholes theoretical price, Greeks and bounded implied-volatility solver with documented assumptions (not exchange quotes)
- [x] PCR and OI concentration calculations from imported option-chain rows; [ ] live expiry comparisons
- [ ] ATM/ITM/OTM identification and strike/expiry filters
- [x] Single-leg expiry payoff calculator; [ ] defined-risk multi-leg strategy builder and payoff chart
- [ ] Max loss, max profit, breakeven, margin caveats and scenario shocks
- [ ] Historical volatility and IV context
- [ ] Explicit stale/missing-data states

- [x] Transparent long-only SMA crossover research backtest API and dashboard workspace with fee/slippage assumptions and drawdown; [ ] robust multi-strategy walk-forward engine
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
- [x] Optional Cloudflare Workers AI chat endpoint with fixed India-market and personal-finance guardrails; [ ] deployment and usage protection
- [x] Copilot can retrieve locally stored option-chain and Money Manager summaries; [ ] source-backed external research retrieval and citations
- [ ] Provider-neutral LLM interface
- [ ] OpenAI adapter
- [ ] Claude adapter
- [ ] Retrieval from timestamped, cited research records
- [ ] Structured report schema and hallucination/data checks
- [ ] Model comparison and token/cost observability

### Milestone 6 — Portfolio and paper trading
- [x] Browser-local paper trade journal with manual entry/exit and closed P&L; [ ] virtual cash, positions and full order lifecycle
- [x] Browser-local trade journal with thesis, direction, stop and target fields
- [x] FinPilot-style manual holdings ledger with INR-converted unrealised P&L and user-entered FX; [ ] persistent account-backed holdings and realised/unrealised performance
- [x] Money Manager with manual income/expense ledger, monthly budgets, savings goals, local cash-flow/health indicators and CSV import/export; [ ] bank/UPI integration and per-user encrypted sync
- [x] Position-sizing, stop-loss/target, risk-budget and reward/risk calculator; [ ] execution-aware portfolio-level risk aggregation
- [ ] P&L, drawdown, exposure and risk limits
- [ ] Replay and paper-trade evaluation
- [ ] No broker order routing in this milestone

### Milestone 7 — Automated research reports
- [x] In-app budget-overrun indicators and savings-goal progress (browser-local); [ ] scheduled/push alerts with quiet hours and audit history
- [ ] Pre-market report
- [ ] Intraday event/threshold alerts
- [ ] Closing report
- [ ] Weekly review
- [ ] Monthly review
- [ ] Scheduler, retries, audit logs and notification preferences

### Milestone 8 — Global research
- [x] Global asset-class workspace and browser-local watchlist shell; [ ] live US and major global indices
- [x] Asset comparison from user-entered return/volatility/cost assumptions; [ ] source-backed fund/stock/ETF fundamentals comparison
- [x] SIP, lump-sum and goal calculators
- [x] CSV historical asset analyzer with CAGR, volatility, max drawdown, RSI and SMA20/50; [ ] validated adjusted-price history, dividends and benchmark-aware analytics
- [x] Self-paced Academy with quizzes and local progress; [ ] structured curriculum assessments and synced learner profiles
- [x] India and selected US/Asia market-session references plus risk checklist; [ ] timezone-aware live calendar and provider-backed intraday timing analysis
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
- [x] Vite GitHub Pages build/deploy workflow and project-base configuration
- [ ] GitHub Pages repository source switched to GitHub Actions and React dashboard verified live
- [ ] Cloudflare Worker deployed to the user's account and API health verified
- [ ] backend deployment and operational runbooks

## Definition of done

A feature is not complete merely because it renders. It must have:
- working backend/API behaviour;
- tests for core calculations;
- source and timestamp metadata where data is involved;
- loading, empty, error and stale-data states;
- documentation and a clear limitation statement;
- no secrets committed to Git.
