# MarketPilot AI — Delivery Roadmap

## Priority order

The product is India-first. NIFTY/BANKNIFTY derivatives are the core workflow; global assets are later modules.

### Milestone 0 — Foundation (in progress)
- [x] Repository structure and product principles
- [x] FastAPI service and health endpoint
- [x] Initial option payoff domain functions and tests
- [x] React/TypeScript dashboard shell with demo-data disclosure
- [ ] CI, formatting, linting and deployment pipeline

### Milestone 1 — Data foundation
- [ ] Provider interface for quotes, candles, instruments, expiries and option chains
- [ ] Data provenance, exchange timezone, timestamp and freshness metadata
- [ ] Market calendar and instrument master with expiry/lot-size versioning
- [ ] Historical data storage and replay
- [ ] Provider terms, entitlement and redistribution review

### Milestone 2 — India cash/index market workspace
- [ ] NIFTY 50, BANKNIFTY, FINNIFTY and India VIX
- [ ] Index/sector overview, breadth, movers and watchlists
- [ ] Technical indicators with transparent calculation settings
- [ ] News and official-event calendar with source links

### Milestone 3 — F&O workbench (highest product priority)
- [ ] Option-chain table with strike, CE/PE LTP, volume, OI and change in OI
- [ ] IV and Greeks with documented pricing assumptions
- [ ] PCR, OI concentration and expiry comparisons
- [ ] ATM/ITM/OTM identification and strike/expiry filters
- [ ] Defined-risk strategy builder and payoff chart
- [ ] Max loss, max profit, breakeven, margin caveats and scenario shocks
- [ ] Historical volatility and IV context
- [ ] Explicit stale/missing-data states

### Milestone 4 — Research engine
- [ ] Rules-based, testable market feature calculations
- [ ] Bull/base/bear scenarios and thesis invalidation
- [ ] Candidate ranking with explainable evidence, never a guaranteed signal
- [ ] NO TRADE state and minimum data-quality gates
- [ ] Backtesting with costs, slippage, survivorship and look-ahead controls

### Milestone 5 — AI analyst
- [ ] Provider-neutral LLM interface
- [ ] OpenAI adapter
- [ ] Claude adapter
- [ ] Retrieval from timestamped, cited research records
- [ ] Structured report schema and hallucination/data checks
- [ ] Model comparison and token/cost observability

### Milestone 6 — Portfolio and paper trading
- [ ] Virtual cash, positions and order lifecycle
- [ ] Trade journal and strategy tags
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
- [ ] US and major global indices
- [ ] Global equities and ETFs
- [ ] FX, commodities, bonds and macro indicators
- [ ] Mutual funds/SIPs and long-term asset research
- [ ] Regional market calendars and currency conversion

### Milestone 9 — Production readiness
- [ ] Authentication, authorization and account isolation
- [ ] Secrets management, rate limiting and audit trails
- [ ] Monitoring, backups, disaster recovery and security review
- [ ] Data-provider licensing and legal review
- [ ] Deployment and operational runbooks

## Definition of done

A feature is not complete merely because it renders. It must have:
- working backend/API behaviour;
- tests for core calculations;
- source and timestamp metadata where data is involved;
- loading, empty, error and stale-data states;
- documentation and a clear limitation statement;
- no secrets committed to Git.
