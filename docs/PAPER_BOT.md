# MarketPilot Autonomous Paper Trader

## What it does

A deterministic, versioned educational simulation engine. It is not a broker, financial adviser, validated strategy, or promise of profit. It sends no real orders.

- Separate virtual books: India INR 1,000,000 and Global USD 10,000.
- Cash equity/ETF rule: long-only trend filter using 20/50-session simple moving averages, 14-period RSI and five-session momentum.
- Options rule: long premium only. India uses CE/PE; global uses CALL/PUT. The underlying trend selects the option side. Contracts must pass expiry, delta, bid/ask spread, open-interest and volume filters.
- Risk guardrails: 0.25% of virtual equity risk budget per idea, 8% notional cap, maximum 12 concurrent positions, maximum four options, one lot per option position, 3% equity stop / 6% target, 30% option premium stop / 45% target, ten-day time exit.
- Entries use ask; marks/exits use bid. If quotes are stale or missing, no trade/mark is invented.
- Each run records source, mode, timestamp, decisions, reasons, entries, exits and P&L in D1.

This is an initial ruleset for software testing and learning, not a proven profitable strategy. Fees, taxes, corporate actions, market impact, funding, borrow costs, dividend adjustments and exchange-specific settlement details are not fully modelled. Backtest and paper results must not be treated as predictive.

## Normalized market snapshot contract

Configure MARKET_DATA_SNAPSHOT_URL as a server-side adapter endpoint. It must return one JSON object for the requested region query parameter. Configure MARKET_DATA_API_TOKEN as a Worker secret if the adapter requires authentication.

Required root fields:
- schema_version: 1
- region: INDIA or GLOBAL
- source: provider/adapter name
- data_mode: live or delayed (not demo, historical or eod)
- observed_at: ISO-8601 timestamp with timezone
- instruments: up to 1,000 instrument objects
- option_contracts: optional array of option contracts

Each instrument:
- symbol: unique canonical symbol
- asset_class: EQUITY, ETF or INDEX
- candles: at least 55 daily close bars in chronological order, e.g. [{ "timestamp":"2026-08-01T00:00:00Z", "close":123.45 }]
- quote: { "bid":123.4, "ask":123.5, "timestamp":"2026-11-13T10:19:58Z" }

Each option contract:
- contract_id, symbol, underlying
- option_type: India CE/PE; global CALL/PUT
- strike, expiry (YYYY-MM-DD), lot_size (actual contract multiplier)
- bid, ask, timestamp
- delta (signed option delta), iv (decimal, e.g. 0.25 for 25%)
- integer open_interest, integer volume

The Worker rejects snapshots older than 15 minutes and quote timestamps older than 5 minutes. The adapter is responsible for verifying source entitlements, instrument IDs, corporate actions, expiry calendars, lot sizes, timezones, market sessions, symbol mapping, and that the feed's use/display terms allow this application. data_mode=live is a provider assertion, not independent proof of a licensed feed.

## API endpoints

- GET /api/v1/paper-bot/status
- GET /api/v1/paper-bot/positions
- GET /api/v1/paper-bot/reports
- POST /api/v1/paper-bot/run (requires Authorization: Bearer BOT_RUN_TOKEN and a normalized snapshot in { "snapshot": ... })

Scheduled runner fetches MARKET_DATA_SNAPSHOT_URL?region=INDIA at 10:20 UTC weekdays and ?region=GLOBAL at 22:30 UTC weekdays. It stores successful and failed runs in bot_runs. These are scheduled windows, not a guarantee that every exchange is open; the adapter must handle holidays and global market calendars/DST.

## Cloudflare setup

1. Create a Cloudflare D1 database, e.g. marketpilot-paper-db.
2. Copy the database ID and add this binding to cloudflare-worker/wrangler.toml (replace the placeholder with your real D1 database ID):

   [[d1_databases]]
   binding = "DB"
   database_name = "marketpilot-paper-db"
   database_id = "YOUR_D1_DATABASE_ID"
   migrations_dir = "migrations"

3. Apply cloudflare-worker/migrations/0001_paper_bot.sql to the remote database with Wrangler or the Cloudflare D1 console.
4. Add Worker secrets MARKET_DATA_API_TOKEN and BOT_RUN_TOKEN if required.
5. Configure Worker variable MARKET_DATA_SNAPSHOT_URL to your private normalized provider adapter. Never expose a vendor token in the Pages frontend.
6. Add the cron triggers in cloudflare-worker/wrangler.toml to the deployed Worker.
7. Restrict API access using Cloudflare Access or another authentication layer before storing private paper-trading activity. CORS is not authentication. The read endpoints currently return paper account records to anyone who can reach the Worker; do not use sensitive personal data in them.
8. Keep AI_CHAT_ENABLED off until separate rate limiting and abuse monitoring are configured.

The GitHub deployment workflow currently skips deployment unless CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are configured. Cloudflare setup and an actual data-provider entitlement are not supplied by this repository.

## What is not included

- No data vendor adapter is currently implemented or connected.
- No NSE/BSE or US exchange market data is fetched by this repository alone.
- No broker login, broker API key, order routing or real-money execution.
- No mobile push, email or WhatsApp delivery; reports are available in the dashboard/API.
- No multi-year strategy validation or independent audit of profitability.
