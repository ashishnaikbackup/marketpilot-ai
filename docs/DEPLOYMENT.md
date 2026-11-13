# Backend deployment

The FastAPI service can be deployed as a Docker web service using the root `render.yaml` blueprint or any container host.

## Render blueprint

1. Create a Render account and connect this GitHub repository.
2. Create a new Blueprint and select this repository.
3. Review the `marketpilot-ai-api` service before deploying.
4. Set a long random `MARKETPILOT_API_KEY` in the service environment. Store provider keys only in the host secret manager if using the optional AI explainer.
5. Deploy and verify `https://YOUR_API_HOST/api/v1/health` and `/docs`.
6. Keep auto-deploy disabled until CI and the deployment are reviewed.

## Current deployment limits

- GitHub Pages hosts only the static frontend. The API is not automatically deployed by GitHub Pages.
- No market-data provider, instrument master, database, user authentication, scheduler or broker is connected.
- The service currently exposes deterministic calculation/research endpoints and an optional API-key-protected AI explainer. Do not publish the AI key in browser code.
- Render free instances may sleep and local filesystems may be ephemeral. Do not use local disk for durable account, trade or report storage.
- Configure production CORS to the exact frontend origin(s); avoid wildcard origins with credentials.
- Configure monitoring, secret rotation, backups and a persistent database before any multi-user deployment.

## Smoke checks

- `GET /api/v1/health` returns service health.
- `GET /api/v1/market-data/status` must continue to report unavailable until a licensed provider is installed.
- `GET /api/v1/instruments` shows lot size and expiry calendar as unverified/blank until an authoritative instrument master is configured.
- `POST /api/v1/research/candidate` should return `NO_TRADE` when provenance, freshness, evidence or risk controls are missing.
