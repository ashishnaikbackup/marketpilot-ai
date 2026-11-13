# Market data and research gate

The API exposes two starter endpoints:

- `GET /api/v1/market-data/status` reports that no provider is configured.
- `POST /api/v1/research/screen` applies conservative data-readiness checks.

The screen requires an identified source and exchange, timezone-aware observation time,
fresh data (maximum five minutes for this intraday gate), required fields, and validated
strategy rules. Demo and historical modes always return `NO_TRADE`.

A passing result means only that the submitted payload passed these basic readiness checks.
It is not a signal, recommendation, suitability assessment, or order instruction. The
endpoint does not fetch or verify data with the named provider; a production adapter must
authenticate and validate the feed before submitting data to this gate.

Do not treat the sample source name in tests as a real provider. No exchange feed is
configured in this repository.
