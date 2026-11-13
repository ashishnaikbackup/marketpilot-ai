# Market data provider boundary

The backend defines provider-neutral contracts in `app.domain.market_data`:

- `DataProvenance` records provider, exchange, instrument ID, data mode, observation time and receive time.
- `MarketQuote` and `OptionContract` define normalized payloads.
- `MarketDataProvider` is the async adapter protocol for quotes and option chains.
- `UnconfiguredMarketDataProvider` is the default and fails closed.

No real provider is wired in. A production adapter must verify credentials, exchange entitlements,
instrument identity, timestamps, stale data, rate limits and display/redistribution rights. Never
convert demo or historical observations into a current opportunity. Store all times with timezone
information and preserve original provider timestamps.
