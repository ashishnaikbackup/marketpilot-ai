# MarketPilot AI — Paper Trading Bot

## What it does

The Paper Trading Bot is an educational simulation engine. It scans the user's imported price bars, applies a deterministic trend/momentum/volume filter, records hypothetical long entries, marks or closes positions when a later imported price reaches a stop/target assumption, and creates an end-of-day text report.

It supports user-imported Indian and global symbols in one CSV. It can simulate cash equities/ETFs, futures (long-only) and long CE/PE options when a matching option quote is supplied. It never sends broker orders.

## How to use

1. Open **Paper Trading Bot** in the MarketPilot sidebar.
2. Import a timestamped CSV. A source name can be entered, but the source is not independently authenticated.
3. Set the symbols to scan, virtual capital, risk per trade and maximum open positions.
4. Select **Run paper bot**. Review every paper entry and every skipped reason.
5. Import a newer file and run again to update marks and evaluate stops/targets.
6. Generate and export the daily report. Data and paper trades are stored in this browser's localStorage.

The bot does not run while the page is closed. It does not refresh market prices, monitor the market in the background or send push/email notifications.

## CSV schema

Required columns:
- `timestamp`: ISO 8601 date/time with timezone preferred
- `symbol`: instrument symbol
- `close`: close or last traded price

Recommended cash/futures columns:
- `market`: NSE, BSE, NYSE, NASDAQ or other source market label
- `asset_type`: EQUITY, ETF or FUTURE
- `open`, `high`, `low`, `volume`
- `lot_size` for futures

Optional option quote columns (one row per contract snapshot):
- `asset_type`: OPTION
- `underlying`: underlying symbol matching the price-bar `symbol`
- `option_type`: CE or PE
- `strike`, `expiry` (YYYY-MM-DD)
- `bid`, `ask`, `open_interest`, `volume`, `lot_size`
- `close`: option premium/last price

Rows without a symbol, timestamp or positive close are ignored. Option quote data must be supplied as `asset_type=OPTION` and `option_type=CE` or `PE`.

## Current heuristic (not validated)

- Minimum 30 bars for an underlying.
- 9-period EMA vs 21-period EMA trend alignment.
- RSI 14 confirmation: 52–72 for bullish, 28–48 for bearish.
- Current volume at least the preceding 20-bar average.
- Cash equity/ETF/futures: long-only entry on bullish conditions; stop distance uses 2× ATR(14), target is 3R.
- Options: long CE for bullish or long PE for bearish only when a matching contract is supplied, bid/ask spread is no more than 5%, and OI and volume are positive. It selects the closest strike to the underlying close and uses the bid/ask midpoint as a simulated entry. Premium stop and target are model assumptions, not exchange execution.
- Risk budget defaults to 0.5% of virtual capital per trade; the UI allows up to 2%. Position count is capped.
- If the conditions or data are missing, it skips the symbol. A no-trade day is valid.

This is a deliberately simple rule set for learning, not a profitable strategy claim. It is not a recommendation. The bot does not short options. Futures and options lot sizes must come from a current verified instrument master before serious testing.

## Simulation limitations

- Imported timestamps, exchange, symbols, corporate actions, instrument master, lot size, expiry, bid/ask, OI and volume are not independently verified.
- A fill at the last close or bid/ask midpoint is an assumption, not a tradeable fill. The current simulation does not fully model brokerage, STT, GST, stamp duty, exchange charges, slippage, queue position, partial fills, market impact, circuit limits, expiry settlement, dividends, splits, rollovers or overnight gaps.
- Stop/target decisions use imported closes; intrabar high/low execution ordering is not reconstructed.
- The bot is local to one browser profile. Clearing browser data can delete its state. Export reports before clearing storage.
- The daily report is generated when the user clicks the report button or runs the scan. It is not scheduled in the background.

## Data and live automation roadmap

### India equities and F&O
Groww's official Trading API documentation advertises live data for CASH and FNO segments, including LTP, quote and OHLC. Its API page currently lists ₹499/month plus taxes for the API subscription; an active Groww account and API subscription are required. See:
- https://groww.in/trade-api
- https://groww.in/trade-api/docs/curl/live-data
- https://groww.in/trade-api/docs

Dhan's official support pages state that Trading APIs are free, while Data APIs (real-time prices, historical intraday data, depth and option chain) require ₹499 plus GST/month. See:
- https://dhan.co/support/platforms/dhanhq-api/how-to-use-algo-in-dhan/
- https://dhan.co/support/platforms/dhanhq-api/how-to-access-dhan-api/

MarketPilot does not currently have either broker connected. Do not add broker credentials to frontend source, localStorage, screenshots, issues or commits. A future adapter must store secrets server-side, implement token renewal/expiry handling, provider health checks, timestamp/staleness checks, exchange instrument master and rate limits.

### Global equities
Global feeds have separate exchange entitlements and market-data rights. Twelve Data's free Basic tier is explicitly internal non-display usage; it must not be used to display quotes in this dashboard. Its individual plans are for personal/internal use and exclude third-party redistribution. See:
- https://twelvedata.com/pricing
- https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage

Massive's free US Stocks Basic plan is end-of-day, not current-session live data; it is for individual use. See:
- https://massive.com/pricing
- https://massive.com/knowledge-base/article/on-the-free-basic-plan-when-can-i-pull-the-previous-trading-days-data

No single free plan has been verified to provide licensed live NSE equities, Indian F&O option chains and all global stock exchanges for this personal dashboard.

## Scheduled bot/reporting still required

To run unattended and publish an end-of-day/night report, the next stage needs:
1. An approved live-data provider account and API entitlement (or a clearly labelled EOD-only provider for global symbols).
2. Server-side provider adapter with secrets, rate limiting, retries, timestamps and stale-feed rejection.
3. Persistent storage (for example Cloudflare D1/KV) for watchlists, bars, positions, fills and daily reports.
4. A Cloudflare Cron Trigger aligned to India and relevant global exchange sessions, with exchange holiday calendars and idempotent run IDs.
5. A notification channel (email/Telegram/push) configured by the user.
6. Walk-forward backtesting, out-of-sample validation, transaction-cost modelling and paper-trading acceptance criteria.
7. Regulatory review before any live order functionality. This project remains paper-only.

SEBI's retail algorithmic trading framework and exchange implementation standards apply to API-based algo trading. The NSE page describes current retail algo/Client Direct API requirements. Keep this product simulation-only until the broker confirms the compliant route:
- https://www.sebi.gov.in/legal/circulars/feb-2025/safer-participation-of-retail-investors-in-algorithmic-trading_91614.html
- https://www.nseindia.com/static/trade/platform-services-non-neat-decision-support-tools-algorithm-trading

## Non-negotiable safeguards

- Paper only. No order placement endpoint is used.
- Never fabricate live quotes or fill confirmations.
- Never call an imported snapshot verified.
- Do not use a free data plan outside its licence.
- Always show source, timestamp, freshness and market session.
- Enforce maximum loss, position count, stale-data rejection and a kill switch before any future live execution.
