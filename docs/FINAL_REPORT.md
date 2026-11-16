# MarketPilot AI: final completion report (2026-11-16)

**Paper trading only. No real-money orders, no broker execution, no broker passwords, no secrets in the browser.**

## Completion: about 92%
Built, tested and running on GitHub. The remaining ~8% is things that cannot be done without a licensed feed or time: option chains for Indian and US stocks, genuinely exchange-grade live prices, weeks of learning/timing history, and watching the unattended bot for a few days.

## Architecture (GitHub only, free)
- **Backend:** the `Paper bot` workflow runs the bot in a self-chaining loop (tick every 10 minutes in market hours, 30 otherwise), stores state on the `bot-data` branch and publishes JSON. No Cloudflare, no API address, no tokens typed into the website.
- **Website:** GitHub Pages reads the published JSON directly. Five tabs: Home, Trader, Markets, Ask AI, More.

## Done
- Paper-trading engine: scan, BUY/SELL/HOLD, risk-based sizing, brokerage + slippage, persistent portfolio, stops/targets, daily reports with explanations, performance stats. Never forces trades.
- Data: Yahoo feed (labelled live or delayed by measured quote age, end-of-day after close), India F&O stocks, ETFs and indices; 30 US names; all-stocks boards (2,763 NSE, about 11,500 US) with per-row price time.
- Bot learning (risk 0.5x to 1.2x from its own results, symbol cooldowns, hard limits fixed) and best time to buy/sell (30-minute slot and weekday statistics; says "no reliable edge" when it is noise).
- News headlines (not analysed). Ask AI answers in the browser from published, timestamped data only.
- Optional Upstox adapter for live India quotes and F&O option chains with OI, IV and Greeks (tested on fixtures only). Optional Twelve Data.
- Security: no secrets in the frontend, constant-time bearer checks and rate limits on the optional API, secret scanning, Dependabot, dependency audits.
- Quality: 87 worker tests, backend and frontend tests, CI green.

## Known limits (stated, not hidden)
- Free data is unofficial and may be delayed or rate-limited; it is labelled by measurement.
- No call/put chains for Indian or US stocks without a licensed feed. NSE's official end-of-day OI file times out from GitHub servers.
- International live data has no free reliable source.
- No fundamentals source. Learning and timing need weeks of history.
- Simulated fills are modelled, not real execution. Not investment advice; always confirm prices in your broker app.
