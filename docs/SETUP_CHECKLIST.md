# MarketPilot setup (GitHub only, about 2 minutes)

There is **no Cloudflare, no API address and no token to paste into the website**. Everything runs in GitHub.

1. **Pages**: Settings → Pages → Source: *GitHub Actions* (the site deploys from `main`).
2. **Start the bot**: Actions tab → **Paper bot** → *Run workflow*. After that it keeps itself running: each run loops for about 5.5 hours (a tick every 10 minutes in the Indian and US sessions, every 30 minutes otherwise) and then starts the next run. GitHub's own cron was observed not to fire, so a cron entry only restarts the chain if it ever breaks. It stores its state on the `bot-data` branch and publishes JSON the website reads.
3. Open the website. The dashboard loads directly. Until the first run it shows clearly labelled sample data.

## Data sources

| Source | Needs | Covers | Mode |
|---|---|---|---|
| **Yahoo Finance public chart feed** (default) | nothing | India (NSE F&O stocks, ETFs, Nifty/Bank Nifty) and 30 large US stocks/ETFs | **Delayed** (~15 min). Unofficial, so it can be rate-limited or change. No option chains. |
| **Upstox Analytics Token** (optional) | free Upstox account; add the token as GitHub secret `UPSTOX_ACCESS_TOKEN` | India **live** quotes plus **F&O call/put option chains** with OI, IV and Greeks | **Live** in market hours |
| **NSE F&O bhavcopy** (automatic attempt) | nothing | Official end-of-day option open interest, PCR, OI change, support/resistance, max pain. **NSE currently times out requests from GitHub's servers**, so this stays empty unless NSE allows them; the reason is published in `sources.json`. Use the Upstox token for option chains instead. | End of day |
| **Google News RSS** (automatic) | nothing | Headlines for India and US (not analysed) | Headlines |
| Twelve Data (optional) | `TWELVEDATA_API_KEY` secret | US end-of-day | End of day |

Nothing is ever labelled live unless it is. International live data has no free reliable source; it stays delayed. Real-money trading is not implemented anywhere.

## Optional

- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` secrets for daily report messages.
- The old Cloudflare Worker still exists in `cloudflare-worker/` and can be deployed from the "Deploy MarketPilot API (optional)" workflow, but nothing needs it.
- GitHub pauses scheduled workflows in a public repo after 60 days without repository activity; just click *Run workflow* again if that happens.
