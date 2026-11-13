# Architecture

## High-level design

```
React + TypeScript dashboard (GitHub Pages)
        |
        +--> Browser localStorage
        |      +--> Paper journal / holdings / research
        |      +--> Money Manager / budgets / savings goals
        |      +--> Imported option-chain snapshots
        |
        | HTTPS / JSON
        v
Cloudflare Worker (optional free API)
  |       |          |
  |       |          +--> Workers AI binding (optional Gemma chat)
  |       +--> Deterministic options / chain / backtest calculations
  +--> Research readiness gate (fail closed)
        |
        +--> Licensed market-data provider (NOT CONNECTED)
        +--> Persistent database / scheduler (FUTURE)

FastAPI application (local/self-hosted alternative)
  +--> Existing domain APIs and optional OpenAI/Anthropic adapters
```

## Backend boundaries

- `api/`: HTTP transport and request/response validation.
- `core/`: configuration, logging and cross-cutting concerns.
- `domain/`: pure calculations that can be tested independently.
- `providers/`: adapters for market data and AI vendors.
- `services/`: orchestration, report generation and screening.
- `models/`: persistence models when database work begins.

The domain layer must not call external APIs. Provider adapters must normalize vendor payloads into internal schemas and preserve source/timestamp/freshness metadata.

## Market data contract

Every market-data response should include:
- instrument identifier and exchange;
- observation timestamp in ISO-8601 with timezone;
- received timestamp;
- source/provider;
- data mode: `live`, `delayed`, `eod`, `historical`, or `demo`;
- freshness status and any missing-field warnings.

A value without provenance must not be presented as a current market quote.

## F&O calculation conventions

- Store option side, strike, expiry, underlying and contract metadata explicitly.
- Treat lot size and expiry calendars as versioned reference data, not hard-coded permanent constants.
- Greeks require explicit pricing model, rate, dividend/yield and volatility assumptions.
- PCR and OI are descriptive positioning measures, not directional guarantees.
- Max pain is a descriptive calculation, not a forecast.
- Payoff calculators must clearly distinguish expiry payoff from mark-to-market P&L, and exclude costs unless separately supplied.

## AI boundary

LLMs explain validated structured data and cited documents; they do not invent quotes, calculate authoritative P&L, or bypass risk gates. The current Workers AI Copilot receives recent chat plus a compact summary of browser-local user records. It is a single model call with a fixed research policy, not yet a multi-agent system or external retrieval engine. Numeric calculations stay in deterministic code. Store model, prompt version, input references, output timestamp and citations for each report.

## Deployment evolution

Start with a modular monolith. The public dashboard is static; the Cloudflare Worker is the optional stateless API. Current personal data stays in browser localStorage. Add authenticated per-user persistence and a scheduled job service only when the product needs account sync and background alerts. Do not mistake GitHub Pages for a backend.
