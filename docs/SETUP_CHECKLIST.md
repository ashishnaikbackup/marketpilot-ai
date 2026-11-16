# MarketPilot setup (GitHub only, about 2 minutes)

There is **no Cloudflare, no API address and no token to paste into the website**. Everything runs in GitHub.

1. **Pages**: Settings → Pages → Source: *GitHub Actions* (the site deploys from `main`).
2. **Start the bot**: Actions tab → **Paper bot** → *Run workflow*. After that it runs by itself every 10 minutes during the Indian and US sessions (and once after each close). It stores its state on the `bot-data` branch and publishes JSON the website reads.
3. Open the website. The dashboard loads directly. Until the first run it shows clearly labelled sample data.

## Data sources

| Source | Needs | Covers | Mode |
|---|---|---|---|
| **Yahoo Finance public chart feed** (default) | nothing | India (NSE F&O stocks, ETFs, Nifty/Bank Nifty) and 30 large US stocks/ETFs | **Delayed** (~15 min). Unofficial, so it can be rate-limited or change. No option chains. |
| **Upstox Analytics Token** (optional) | free Upstox account; add the token as GitHub secret `UPSTOX_ACCESS_TOKEN` | India **live** quotes plus **F&O call/put option chains** with OI, IV and Greeks | **Live** in market hours |
| Twelve Data (optional) | `TWELVEDATA_API_KEY` secret | US end-of-day | End of day |

Nothing is ever labelled live unless it is. International live data has no free reliable source; it stays delayed. Real-money trading is not implemented anywhere.

## Optional

- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` secrets for daily report messages.
- The old Cloudflare Worker still exists in `cloudflare-worker/` and can be deployed from the "Deploy MarketPilot API (optional)" workflow, but nothing needs it.
- GitHub pauses scheduled workflows in a public repo after 60 days without repository activity; just click *Run workflow* again if that happens.
