# MarketPilot AI — security review and launch checklist

Review date: 2026-11-13

## Scope and limits

This is a source-level review of the current frontend, Cloudflare Worker, GitHub Actions workflows and documented architecture. It is not a penetration test, dependency audit, secret-scanner result, or proof that no credential has ever been committed. Rotate any credential that may have appeared in repository history or logs.

## Current security posture

- The repository is public. Never commit provider API keys, broker credentials, personal identifiers, bank statements, access tokens or .env files.
- The browser frontend uses localStorage for personal-finance entries, watchlists, paper trades and imported option-chain snapshots. These records are local to that browser profile and are not encrypted or synchronised. Do not use shared/public devices for sensitive data.
- The Cloudflare Worker has public endpoints. CORS is not authentication and does not prevent scripts or server-to-server clients from calling an endpoint.
- The Worker AI route is disabled by default through the AI_CHAT_ENABLED opt-in flag. Keep it disabled until Cloudflare-side rate limiting and abuse monitoring are configured and account-level AI limits are verified. If enabled, treat it as an exposed, quota-consuming endpoint. Do not put an API secret in frontend code.
- No broker order-placement route is implemented. No market-data provider is configured. No live quote, option-chain, or trade-signal claim should be made.
- GitHub Actions builds/tests the backend, frontend and Worker. The npm audit checks for the frontend and Worker toolchain returned zero advisories after upgrading Wrangler to 4.161.0 (2026-11-13). Python dependency auditing and a full secret-history scan are still outstanding. Deployment secrets should be limited to the minimum scopes and stored only as repository/environment secrets.

## Pre-launch checks

1. Enable GitHub secret scanning and push protection where available; review repository history if any secret was ever committed.
2. Run dependency vulnerability checks for Python and npm packages; review and update vulnerable direct/transitive dependencies.
3. Add Cloudflare Worker rate limits, request-size limits and abuse monitoring before making AI endpoints broadly available.
4. Restrict Worker CORS to the deployed site and explicitly needed development origins. Remember this is browser policy, not access control.
5. Add authentication and encrypted server-side storage before supporting multiple users or sensitive synced financial records.
6. Add backup/export and deletion controls for user-entered finance data.
7. Test mobile navigation, keyboard focus, reduced-motion settings, CSV edge cases, timezone handling and stale/future data handling.
8. Do not connect a market-data source until exchange licensing, redistribution/display rights, instrument master, expiry calendar, timestamps, stale-data rejection and rate limits are confirmed.

## Safe operating rules

- Demo data is never a market quote.
- User-imported CSV data is labelled unverified and must retain source and observation time.
- Black-Scholes and backtests are model outputs, not market facts or validated trading strategies.
- CE/PE comparison must show assumptions and risks; if current verified data is missing, the correct state is NO TRADE.
- No automatic orders, guaranteed returns, or personalised investment advice.

## Audit results (2026-11-14)

- **Git history secret scan:** all 324 commits on all refs searched for AWS, GitHub, OpenAI/Anthropic-style, Slack, Telegram and private-key patterns, and for sensitive filenames. **No secrets found.** Only `backend/.env.example` and `frontend/.env.example` were ever committed, and both hold placeholders. A gitleaks workflow now repeats this on every push and weekly.
- **Python dependencies:** `pip-audit` found a vulnerable `pytest` (dev dependency). Bumped to 9.0.3+; re-audit reports no known vulnerabilities. `pip-audit` now runs in CI.
- **npm dependencies:** `npm audit` reports 0 vulnerabilities for the frontend and the Worker. CI now fails on high-severity advisories. Dependabot is enabled for npm, pip and GitHub Actions.
- **Worker hardening added:** CORS limited to an allowlist (`ALLOWED_ORIGINS`, default GitHub Pages and localhost) instead of `*`; the preflight now permits the `Authorization` header (previously the dashboard's token requests would have been blocked by browsers); constant-time bearer-token comparison; per-route rate limits and request-size limits; generic 500 errors that do not leak internals; a separate read token (`BOT_READ_TOKEN`) and run token (`BOT_RUN_TOKEN`).
- **Limits of the rate limiter:** it is per Worker instance and best effort. For hard guarantees add a Cloudflare rate-limiting rule.
- **Not done:** external penetration test; verification of the deployed Worker's secrets (requires your Cloudflare account).

## Known remaining work

Licensed NSE data and option chains, deployed-Worker verification, Cloudflare rate-limiting rule, enabling GitHub secret scanning/push protection in repository settings, and an external security test. See [STATUS.md](STATUS.md).
