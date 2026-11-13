# Free-first deployment (no Render dependency)

## Recommended architecture

- **Frontend:** keep GitHub Pages at https://ashishnaikbackup.github.io/marketpilot-ai/ (static hosting; no backend process).
- **API:** Cloudflare Workers Free. The Worker in `cloudflare-worker/src/index.js` implements the calculation/research endpoints needed by the app.
- **Persistence:** keep the current portfolio, journal, learning progress and reports in browser localStorage for now. This avoids paying for an always-on database and avoids putting private financial records in a shared server database.
- **Source control/CI:** GitHub repository and GitHub Actions.

Cloudflare's published Workers Free limits currently include 100,000 requests/day, 10 ms CPU time per request and 128 MB memory. This is suitable for small JSON calculations, not heavy AI inference, large backtests, scraping or live quote streaming. Limits can change; check the official page before relying on them: https://developers.cloudflare.com/workers/platform/limits/

## Deploy the API (one-time setup)

1. Create/sign in to a free Cloudflare account: https://dash.cloudflare.com/
2. In the dashboard choose **Workers & Pages → Create → Worker**.
3. Name it `marketpilot-api`.
4. Open the Worker editor and replace its starter code with the contents of `cloudflare-worker/src/index.js`, then deploy.
5. In **Worker → Settings → Bindings**, add a **Workers AI** binding named exactly `AI` (the repository's `wrangler.toml` also declares this binding for Wrangler deployments).
6. Your API base URL will look like `https://marketpilot-api.<your-account-subdomain>.workers.dev`.
7. Test `GET /api/v1/health`. It should return JSON with status `ok`.
8. Open MarketPilot → AI Copilot, paste the API base URL and save it. This enables `POST /api/v1/ai/chat` through the Workers AI binding. The selected Gemma model is intended for the Workers AI Free allowance; the published free allocation is 10,000 Neurons per day. On Workers Free, requests stop when the allowance is exceeded; do not upgrade to a paid plan.
9. Open MarketPilot → Backtest Lab and paste the same API base URL to enable the SMA backtest.

No card or paid Render service is required for this architecture. Do not enable paid Cloudflare Workers or paid add-ons unless you deliberately choose to.



## Deploying the API through GitHub Actions

The repository includes `.github/workflows/deploy-api.yml`. After the one-time Cloudflare setup, you can let GitHub deploy future Worker changes automatically:

1. In Cloudflare, create an API token with the permissions required to deploy Workers, and copy your Cloudflare account ID.
2. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Never put either value in a source file or commit.
4. Push a change under `cloudflare-worker/` to `main`, or run **Deploy MarketPilot API** from the Actions tab.

If those secrets are not configured, the workflow safely skips deployment. GitHub Pages deployment remains separate and continues from the frontend workflow. This still requires a Cloudflare account for the API/AI runtime; GitHub stores the code and automates deployments.

## Optional AI Copilot (free allocation)

The Worker includes `POST /api/v1/ai/chat`, using the Workers AI binding and the `@cf/google/gemma-4-26b-a4b-it` model. The model runs server-side; no AI key is exposed in the browser. The endpoint restricts message roles, message count and per-message length, and adds a fixed MarketPilot research policy that forbids fabricated quotes and unsupported CE/PE calls.

Cloudflare currently publishes a 10,000-Neuron daily free allocation for Workers AI. On the Workers Free plan, inference stops when the free allowance is exceeded; keep the account on the Free plan and do not enable paid upgrades. Some other models require a paid plan, so do not change the configured model without checking current model eligibility. See the official [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and [Workers AI setup guide](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/).

The Copilot sends recent chat messages and a compact summary of the locally imported option-chain snapshot to the Worker. Do not paste account credentials, personal identifiers, broker tokens or other secrets into chat. AI output is educational and may be wrong; it is not a trading signal or investment advice. The AI endpoint is public once deployed, so keep requests short and monitor usage in the Cloudflare dashboard. A daily allowance is not a guarantee of uninterrupted model capacity.

## India-first research workflow (current MVP)

The frontend includes an **India Market Lab** for NIFTY, BANKNIFTY and FINNIFTY. It accepts a manually pasted option-chain CSV, requires an expiry, a named source, an observation timestamp and underlying spot, then calculates descriptive PCR, change-in-OI PCR, modelled max pain, highest call/put OI strikes, ATM IV and average quoted spread where fields exist. The snapshot is stored only in the current browser's localStorage and can be read by the rule-based Copilot for an educational explanation.

The Worker option-chain analytics endpoint also returns OI totals, PCR, change-OI totals/ratio, volume totals, highest OI strikes and max pain from caller-supplied rows. It does not fetch or validate NSE data. The CSV importer cannot verify that the provider is authorised, the contract master is current, the timestamp is genuine, or the snapshot is complete. A max-pain calculation is an expiry payoff statistic, not a price forecast.

This is an offline/manual-data workflow, not a live market scanner. The Copilot is not yet connected to an LLM. No CE/PE buy/sell signal, best-entry time or execution instruction is generated from this data.

## Why not use a free hosted database immediately?

The current app's holdings, trade journal, reports and Academy progress are browser-local. A database would require authentication, user isolation, backup/restore and privacy controls. Adding a database just to appear more "production" would increase complexity and create a new free-tier dependency. Supabase Free is an option later (500 MB database per project, pauses after one week of inactivity; verify current limits at https://supabase.com/pricing), but it is not needed for this single-user MVP.

## What this does NOT provide

- No NSE/BSE or global live market feed, option chain, broker integration or real-time trade timing.
- No free hosting plan grants rights to redistribute exchange data. A licensed provider is still required.
- No AI analyst calls are enabled in this Worker. AI model usage can incur costs and must be separately opted into.
- Browser-local records do not sync across devices and can be lost if browser storage is cleared. Export/backup before changing devices.
- Workers Free has strict CPU and request limits; large analytics should run locally or in a separately budgeted service.

## Local development

Install Node.js, then:

```bash
cd cloudflare-worker
npm install
npm run dev
```

Deploy from a terminal with Wrangler:

```bash
npx wrangler login
npm run deploy
```

Before deployment, review the official free plan limits and ensure billing/paid features are not enabled.
