# MarketPilot AI: project status (2026-11-14)

Honest status based on what was run and tested, not on code volume.
**Nothing here has been deployed or run against a real market-data provider yet.** That needs credentials only you can create (see [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)).

## Original seven open items

| # | Item | Status now |
|---|---|---|
| 1 | Authorised NSE provider | **Blocked (external).** Needs a licensed vendor/broker data subscription. The adapter interface is ready; Twelve Data (US, end-of-day) is wired in. |
| 2 | Reliable live option-chain data | **Blocked (external).** Same as above. The engine, summary (OI, PCR, IV) and tests handle contracts when an adapter supplies them. |
| 3 | Live CE/PE recommendations | **Blocked (data).** Rule code exists and is tested on supplied contracts. Stays off until a verified feed exists. |
| 4 | Cloudflare Worker secrets | **Automated, needs your credentials.** The deploy workflow now creates D1, migrates, deploys and sets secrets from GitHub secrets. |
| 5 | AI chat disabled | **Resolved differently.** New data-grounded assistant works without an LLM. Workers AI rewording is opt-in (`AI_CHAT_ENABLED`). |
| 6 | Python dependency audit | **Done.** One finding (pytest), fixed. CI audits on every run. |
| 7 | Git history secret scan | **Done.** 324 commits, nothing found. gitleaks now runs in CI. |

## Feature checklist

**Completed and covered by automated tests**
- Paper-trading engine: trend/RSI/momentum rules, fills at real bid/ask or modelled slippage, brokerage on both legs, per-trade risk budget, exposure and position caps, stop/target/time exits, net P&L, no trade and no mark without a fresh quote, explicit NO_TRADE reasons.
- Persistence: atomic D1 batch writes, verified on real SQLite with both migrations (including rollback on failure).
- Portfolio analytics: equity curve, cash, exposure, win rate, profit factor, average win/loss, holding time, max drawdown, per-strategy stats.
- Daily report (11 sections incl. decisions, skipped trades with reasons, open/closed, risk, strategy stats, watchlist) with full history.
- Grounded assistant: latest trade, portfolio review, risks, momentum/watchlist, market summary, compare, data status; refuses to guess.
- Security: CORS allowlist, constant-time tokens, rate and size limits, read/run token separation, audits, secret scan.
- Provider adapters: Twelve Data (EOD), generic snapshot URL; key in header, never in URL; EOD is never labelled live.
- New simple mobile-first UI (Home, Trader, Markets, Ask AI, More); all 14 earlier tools preserved under More.

Test totals: Worker 55 tests (incl. SQLite integration), backend 34, frontend type-check and build.

**Partially done**
- F&O: calculators (Black-Scholes Greeks, IV, payoff), CSV option-chain lab, and an engine that picks CE/PE long-premium contracts with delta, OI, volume, spread and expiry filters. **Missing:** change in OI, support/resistance from OI, gamma/theta/vega on supplied chains, and any live chain.
- Global markets: US stocks and ETFs at end of day. SPY/QQQ stand in for indices. No international exchanges.
- UI: verified in a headless browser against a mock API at phone and desktop widths. **Not yet seen against the real deployed API.**

**Not implemented**
- Fundamentals and news in the assistant (no source connected).
- Intraday live scanning (needs a live/delayed feed).
- Shorting, multi-leg option strategies in the bot, corporate-action handling, statutory charges and taxes in P&L.
- Real broker execution, by design and permanently.

**Needs verification after you deploy**
- Worker URL and secrets; `/health` and `/paper-bot/status` smoke test (the workflow runs it).
- A real Twelve Data call, plan limits and terms for your use.
- First scheduled end-of-day run writes a report.

## Completion estimate

- About **60%** of the vision exists as tested code (engine, persistence, reports, assistant, security, UI, tooling).
- **0%** is verified in production, and **India live trading intelligence is blocked** on a paid licensed feed.
- Realistic outcome once you add Cloudflare credentials and a Twelve Data key: a working US end-of-day paper trader with daily reports. India and F&O go live only after a licensed NSE source is connected.

## Strategy caveat

The rules are a simple educational trend-following ruleset. They are untested on historical data, so there is no evidence of profitability. Treat results as a software demonstration.
