# MarketPilot AI — security review and launch checklist

Review date: 2026-11-13

## Scope and limits

This is a source-level review of the current frontend, Cloudflare Worker, GitHub Actions workflows and documented architecture. It is not a penetration test, dependency audit, secret-scanner result, or proof that no credential has ever been committed. Rotate any credential that may have appeared in repository history or logs.

## Current security posture

- The repository is public. Never commit provider API keys, broker credentials, personal identifiers, bank statements, access tokens or .env files.
- The browser frontend uses localStorage for personal-finance entries, watchlists, paper trades and imported option-chain snapshots. These records are local to that browser profile and are not encrypted or synchronised. Do not use shared/public devices for sensitive data.
- The Cloudflare Worker has public endpoints. CORS is not authentication and does not prevent scripts or server-to-server clients from calling an endpoint.
- The Worker AI route must be treated as an exposed, quota-consuming endpoint. Before enabling it for public use, add Cloudflare-side rate limiting and abuse monitoring, and verify account-level AI limits. Do not put an API secret in frontend code.
- No broker order-placement route is implemented. No market-data provider is configured. No live quote, option-chain, or trade-signal claim should be made.
- GitHub Actions currently builds/tests the backend, frontend and Worker. Deployment secrets should be limited to the minimum scopes and stored only as repository/environment secrets.

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

## Known remaining work

A full security sign-off still requires a secret scan, dependency audit, deployed Worker configuration review, Cloudflare rate-limit setup, and an external security test. A licensed live market-data provider and server-side market-data pipeline are also not present.