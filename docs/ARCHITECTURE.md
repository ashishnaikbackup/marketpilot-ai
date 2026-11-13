# Architecture

## High-level design

```
React + TypeScript dashboard
        |
        | REST / JSON
        v
FastAPI application
  |       |          |
  |       |          +--> AI provider gateway (OpenAI / Claude; server-side)
  |       +--> Research and risk domain services
  +--> Market data provider interfaces
        |
        v
PostgreSQL (planned) + background job queue (planned)
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

LLMs explain validated structured data and cited documents; they do not invent quotes, calculate authoritative P&L, or bypass risk gates. Numeric calculations stay in deterministic code. Store model, prompt version, input references, output timestamp and citations for each report.

## Deployment evolution

Start with a modular monolith. Add a job worker and PostgreSQL when scheduled reports and persistent portfolios are implemented. Avoid premature microservices.
