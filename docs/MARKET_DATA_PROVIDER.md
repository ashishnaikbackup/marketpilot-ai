# Market data provider decision and integration notes

MarketPilot must not scrape or redistribute exchange data in violation of provider terms. The paper trader accepts a normalized server-side adapter payload; a provider-specific adapter must be implemented and tested before live claims are enabled.

## India provider options

### DhanHQ
- Market Quote API supports LTP/OHLC/market depth snapshots for up to 1,000 instruments per request.
- Option Chain API returns strike-wise CE/PE data including bid/ask, OI, volume, IV and Greeks for NSE/BSE/MCX options. Its documented rate limit is one unique request every three seconds.
- Live Market Feed uses WebSockets and documents up to 5,000 instruments per connection.
- Dhan's release notes say access tokens are valid for 24 hours and describe API-key/TOTP-based token generation. Token rotation must be handled securely; never put a Dhan token in the frontend.
- Official docs: https://dhanhq.co/docs/v2/market-quote/ ; https://dhanhq.co/docs/v2/option-chain/ ; https://dhanhq.co/docs/v2/live-market-feed/ ; https://dhanhq.co/docs/v2/releases/

### Upstox
- Market Data Feed V3 supports WebSocket live updates and full-feed depth/Greeks.
- Put/Call Option Chain API returns expiry, strike, spot, CE/PE market data, bid/ask, OI, volume and Greeks.
- Official docs: https://upstox.com/developer/api-documentation/v3/get-market-data-feed/ ; https://upstox.com/developer/api-documentation/get-pc-option-chain/

### Zerodha
- Kite Connect Personal is free but does not include historical or real-time market data.
- Kite Connect's paid Connect plan is documented at ₹500/month and includes real-time WebSocket data and historical candles. Recheck current pricing before subscribing.
- Official pricing details: https://support.zerodha.com/category/trading-and-markets/general-kite/kite-api/articles/what-are-the-charges-for-kite-apis
- WebSocket docs: https://kite.trade/docs/connect/v3/websocket/

## Global data options

### Twelve Data
- Advertises equities across 90+ international exchanges, ETFs, mutual funds, FX and commodities.
- Basic is documented as 800 API credits/day. Basic/Grow WebSocket access is limited to trial symbols (up to eight simultaneous symbols); full symbol streaming is on higher plans.
- It is useful as a starter for global equity/ETF research, not a complete global listed-options feed.
- Official docs: https://twelvedata.com/docs ; https://twelvedata.com/docs/websocket/websocket-getting-started

### Alpaca
- Free market-data tier documents US equities on IEX only and indicative US options data.
- Full US equity exchange coverage and OPRA real-time options are on the paid Algo Trader Plus plan (currently documented at US$99/month); verify current terms/pricing.
- This is US-focused, not a one-provider solution for all global exchanges.
- Official docs: https://docs.alpaca.markets/us/v1.1/docs/about-market-data-api ; https://alpaca.markets/data

## Recommended implementation path

1. India: use DhanHQ or Upstox only if the user has an eligible account and accepts the provider's API terms. Implement one adapter at a time, including instrument master, historical daily candles, live bid/ask, option chain, expiry calendar, lot size and token refresh.
2. Global equities: start with Twelve Data only for the exchanges/symbols covered by the user's plan. Add provider entitlements and timestamps to every quote.
3. Global listed options: choose a dedicated provider (for example Alpaca for US options) and clearly label indicative versus OPRA-real-time data. Do not pretend this covers all global options.
4. Keep provider credentials in Cloudflare Worker secrets. Use the D1-backed paper trader only after the adapter passes schema, stale-data, market-session and symbol-identity tests.
5. Do not enable any broker order placement. Any future live order routing requires a separate compliance, broker approval and security project.

## Licensing and regulatory boundaries

NSE's Data Sharing & Usage Policy requires subscribers to agree permitted use, handling, display and redistribution conditions; it explicitly restricts redistribution unless agreed. Review the actual agreement and intended app display/use before using an NSE feed: https://www.nseindia.com/static/market-data/nse-data-policy

The current MarketPilot bot only simulates virtual trades. It does not submit orders. Any future API-based retail algo order routing must be reviewed against current SEBI and exchange rules and the selected broker's approved API process. NSE's current algo guidance is here: https://www.nseindia.com/static/trade/platform-services-non-neat-decision-support-tools-algorithm-trading
