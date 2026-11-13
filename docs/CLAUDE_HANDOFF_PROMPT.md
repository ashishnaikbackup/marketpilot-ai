# Claude handoff prompt

Use this prompt when handing MarketPilot AI to Claude for an independent engineering review and the next implementation milestone. Claude must inspect the latest `main` branch first; this handoff describes the current state but the repository is authoritative.

---

## Prompt for Claude

You are the senior full-stack engineer and quantitative systems reviewer for **MarketPilot AI**:
https://github.com/ashishnaikbackup/marketpilot-ai

The user wants a functional, research-first financial intelligence platform. India index F&O is the first priority. Your job is to continue the existing codebase carefully, not rebuild it from scratch.

### User/product constraints

- Beginner user, currently has no invested capital and wants to learn before investing.
- Prefer free/open-source tooling and a usable browser dashboard.
- They view progress directly on GitHub and want a core MVP before leaving a smaller review/extension task to Claude.
- No broker account is required for the research, education or paper-trading MVP.
- Do not encourage real-money F&O trading or imply guaranteed returns.
- Keep MarketPilot AI independent from any other personal project/repository.

### Current implemented state — inspect before changing

**Frontend: React + TypeScript + Vite**
- Premium dark dashboard and responsive sidebar navigation.
- Overview page with sample index values explicitly marked DEMO; no live feed.
- F&O Workbench: empty option-chain state (no fabricated chain) and browser-side European Black-Scholes calculator for theoretical price, Delta, Gamma, annual Theta and Vega per 1 vol point.
- Opportunity Scanner: fail-closed local readiness result returning NO_TRADE because no authorised provider is configured.
- Strategy Lab: editable multi-leg calls/puts, long/short positions, quantities, lot sizes, expiry P&L curve over a user-selected spot range, approximate breakeven crossings and risk caveats.
- Paper Portfolio: browser-local journal with hypothetical entry, stop, target and manual exit; closed P&L is hypothetical, no broker orders.
- Research Reports: browser-local structured bull/base/bear brief, invalidation/risk/source notes and Markdown export.
- Global Markets: asset-class coverage map and browser-local watchlist, no live quotes.
- Learn: beginner learning path.
- Backtest Lab: interactive UI accepting chronological user-supplied closing prices and calling the SMA crossover API; requires a separately deployed API URL.
- Browser-local storage is not a cloud backup or multi-device account.

**Backend: FastAPI**
- Health endpoint.
- Deterministic multi-leg option expiry payoff endpoint: `POST /api/v1/options/expiry-payoff`.
- European Black-Scholes theoretical pricing/Greeks endpoint: `POST /api/v1/options/greeks`; bounded bisection implied-volatility endpoint: `POST /api/v1/options/implied-volatility`.
- Market-data status endpoint explicitly reports no provider connected.
- Research data-quality gate: `POST /api/v1/research/screen`, rejects demo, historical, stale, missing-timestamp, missing-source/exchange, incomplete and unvalidated inputs; default is NO_TRADE.
- Provider-neutral normalized data contracts and async `MarketDataProvider` protocol in `backend/app/domain/market_data.py`; default `UnconfiguredMarketDataProvider` fails closed.
- Descriptive option-chain analytics API for supplied rows (PCR, OI/change-in-OI, volume, OI concentration); does not fetch exchange data.
- Bootstrap instrument catalogue with lot sizes and expiry calendars deliberately unset pending a verified instrument master.
- Research candidate review gate requiring live/delayed freshness, provenance, at least two evidence points, invalidation, risk notes and reviewed rule ID; output is never a trade recommendation.
- Educational SMA crossover backtest endpoint using supplied close series, fee/slippage assumptions and max drawdown.
- Optional server-side OpenAI and Anthropic explainer endpoint with a separate API-key gate, secret checks, timeout handling and no client-side API keys.
- Pytest coverage for payoff, API validation, Greeks, research gates and unconfigured provider.

- Dockerfile at `backend/Dockerfile`, root `render.yaml` Blueprint and `docs/DEPLOYMENT.md` provide a deployable FastAPI service definition; no backend host has been provisioned.

**Delivery**
- CI workflow `.github/workflows/ci.yml` checks backend Ruff + pytest and frontend TypeScript/Vite production build.
- Frontend GitHub Pages workflow `.github/workflows/deploy-pages.yml`.
- Vite base path configured for `/marketpilot-ai/`.
- Current static site: https://ashishnaikbackup.github.io/marketpilot-ai/
- Latest verified implementation commit: `bc8df11b751f0a1e63b5d00fe3bfe3e89eec3328`.
- CI passed at that commit: backend Ruff + pytest and frontend TypeScript/Vite production build. Run: https://github.com/ashishnaikbackup/marketpilot-ai/actions/runs/43390795663
- GitHub Pages deployment succeeded for that commit. Run: https://github.com/ashishnaikbackup/marketpilot-ai/actions/runs/43390795667
- Read `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/SAFETY_AND_COMPLIANCE.md`, `docs/MARKET_DATA_PROVIDER.md` and `docs/OPTIONS_MODELS.md`.

### Highest-priority remaining work

1. Inspect current `main`, reproduce builds/tests, verify GitHub Pages deployment and fix any regression.
2. Add a real provider adapter only after selecting a provider with documented API access, entitlements, display/redistribution rights, cost and rate limits. Until then, keep all quote/chain panels explicitly unavailable.
3. Build the normalized option-chain API and UI for NIFTY/BANKNIFTY/FINNIFTY with source, exchange, instrument ID, observation/receive timestamps, mode, freshness and missing-field indicators.
4. Add instrument master, exchange calendar, expiry/lot-size versioning and historical/replay boundaries.
5. Improve analytics: PCR, OI/change-in-OI distributions, IV solver/context, ATM/ITM/OTM, max pain only as descriptive context, and expiry comparisons. Keep deterministic calculations in tested code; state model assumptions and limitations.
6. Improve scanner from a simple readiness gate to a transparent rules engine with bull/base/bear evidence, invalidation, risk/reward and explicit NO_TRADE. Never invent entry, target, probability or signal.
7. Upgrade paper portfolio from browser-local journal to a tested paper ledger with virtual cash, position lifecycle, fees/slippage assumptions, realised/unrealised P&L, drawdown and audit history. No real broker execution.
8. Build scheduled pre-market, intraday, closing, weekly and monthly reports only after reliable data and scheduler/notification infrastructure exist.
9. Add provider-neutral OpenAI and Anthropic adapters server-side with structured schema validation, source citations, prompt versioning, timeouts/retries, token/cost logging and safe fallbacks. LLMs explain validated data; they do not calculate authoritative Greeks/P&L or fabricate quotes.
10. Production backend deployment, auth/account isolation, secrets, observability, backups and security review.

### New remaining gaps after the latest implementation

- No real market-data adapter or exchange entitlements are connected; never imply live data availability.
- AI endpoint is optional and sends only caller-provided context; add structured output validation, prompt versions, privacy controls, token/cost telemetry and citation verification.
- The SMA backtest is a toy baseline. Add proper bar timestamps, walk-forward splits, benchmark comparison, trade-level accounting, taxes/fees and bias controls before drawing conclusions.
- Add persistent, authenticated server-side paper ledger and research storage with per-user isolation, migrations, backups and audit history.
- Add scheduler/notifications only after deployment and persistence are configured.
- Add a verified instrument master and holiday/expiry calendar from an authorised source; current catalogue contains no contract lot sizes.

### Non-negotiable rules

- Never fabricate live/delayed/EOD prices, option-chain values, OI, IV, Greeks or signals.
- Distinguish `live`, `delayed`, `eod`, `historical`, `demo`, `modelled_assumptions` and `unavailable`.
- Preserve provider, exchange, instrument identity, observed_at and received_at timestamps with timezone.
- Do not scrape protected exchange endpoints or bypass rate limits.
- Keep expiry payoff separate from mark-to-market, margin and transaction costs.
- Do not present Black-Scholes European model output as exchange Greeks or an authoritative valuation for American-style index options.
- PCR, OI and max pain are descriptive context, not standalone directional signals.
- No unattended live orders. Any future execution requires separate legal, exchange, broker, security and regulatory review.
- Never place secrets in frontend bundles or Git.
- Use small, reversible commits, tests, accessible responsive UI and update the roadmap accurately.

### How to work

First provide a short gap assessment based on actual code and latest CI. Then implement the next bounded milestone end-to-end, add tests, update docs and deploy the frontend if changed. Verify the exact final commit and CI. Do not claim a feature is complete merely because a placeholder renders. Do not overwrite working code without a clear reason.

The repository is the source of truth; this prompt can become stale.
