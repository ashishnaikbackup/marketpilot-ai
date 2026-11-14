# MarketPilot setup checklist (about 15 minutes)

Everything runs from GitHub and free Cloudflare. You never put keys in the website.
This app is **paper trading only**. It cannot place real orders.

## 1. Create the Cloudflare credentials (one time)

1. Sign up at cloudflare.com (free).
2. Find your **Account ID**: Cloudflare dashboard → Workers & Pages → right-hand side.
3. Create an **API token**: My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers**, then add **Account → D1 → Edit**. Copy it once.

## 2. Add GitHub secrets

Repository → Settings → Secrets and variables → Actions → New repository secret.

| Secret | Required | What it is |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | yes | Token from step 1.3 |
| `CLOUDFLARE_ACCOUNT_ID` | yes | From step 1.2 |
| `BOT_READ_TOKEN` | yes | A long random password you invent (32+ characters). The website uses it to **read** bot data. It cannot trade. |
| `BOT_RUN_TOKEN` | optional | A different long random password. Only needed to push a snapshot by hand. Leave unset to disable manual runs. |
| `TWELVEDATA_API_KEY` | optional | Enables end-of-day US data. See "Market data" below. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | optional | Daily report message |

Until the two Cloudflare secrets exist, the deploy workflow skips deployment (it does not fail) and tells you so.

## 3. Deploy

Actions tab → **Deploy MarketPilot API** → Run workflow. It will:

1. run the tests,
2. create the D1 database (`marketpilot-paper-db`) if needed,
3. apply the database migrations,
4. deploy the Worker,
5. copy your secrets to the Worker, and
6. call `/api/v1/health` and `/api/v1/paper-bot/status` on the live URL.

Open the run and look for the notice **"Worker URL: https://marketpilot-api.<you>.workers.dev"**.

## 4. Connect the website

Open https://ashishnaikbackup.github.io/marketpilot-ai/ → **More → Connect**: paste the Worker URL and your `BOT_READ_TOKEN`.
(Optional: set the repo variable `VITE_API_BASE_URL` so the URL is pre-filled for everyone.)

## 5. Market data

The bot invents nothing. Without a data source it stays idle and says so.

| Option | Covers | Mode | Notes |
|---|---|---|---|
| **Twelve Data** (`TWELVEDATA_API_KEY`) | US stocks and ETFs (`GLOBAL_WATCHLIST`, default SPY, QQQ, AAPL, MSFT, NVDA, AMZN, GOOGL, META) | **End of day** | Free Basic plan is US-only, 8 requests/minute, 800/day, and per Twelve Data's pricing page "internal non-display usage only". Check their terms before showing prices to other people. |
| **Snapshot adapter** (`MARKET_DATA_SNAPSHOT_URL`, `MARKET_DATA_API_TOKEN`) | Anything you can license, including NSE and option chains | live or delayed, as your adapter states | You (or a vendor) provide a small server that returns the normalized snapshot in [PAPER_BOT.md](PAPER_BOT.md). |

**India:** no licensed NSE feed is connected, so India shows "No data" and the bot does not trade it. NSE market data (especially option chains, OI, IV and Greeks) needs a licensed vendor or a broker data API subscription. When you have one, build the adapter and set `MARKET_DATA_SNAPSHOT_URL`. Nothing else changes.

## 6. Optional: AI wording

The Ask AI tab already answers from your bot's data. To let Workers AI rephrase answers, set `AI_CHAT_ENABLED=true` as a Worker variable. Rate limits (10 to 20 requests/min per IP) are built in. Add a Cloudflare rate-limiting rule for hard guarantees.

## 7. Turn on GitHub protections

Settings → Code security: enable **Secret scanning**, **Push protection** and **Dependabot alerts**. The repo already runs a weekly gitleaks scan and pip/npm audits in CI.

## Schedule

The Worker runs on cron. With an end-of-day provider it trades **once a day**: India 10:20 UTC (15:50 IST) and Global 22:30 UTC, weekdays only. With a live/delayed adapter it also scans every 5 to 15 minutes during sessions.
