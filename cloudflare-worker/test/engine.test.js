import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, priceFor, COSTS, trend } from "../src/engine.js";

const NOW = Date.parse("2026-11-13T09:00:00Z");
const iso = (ms) => new Date(ms).toISOString();
const candles = (f) => Array.from({ length: 60 }, (_, i) => ({ timestamp: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`, close: f(i) }));
const up = () => candles((i) => 100 + i * 0.5 + (i % 3 === 0 ? -1.5 : 0.5));
const down = () => candles((i) => 200 - i * 0.5 + (i % 3 === 0 ? 1.5 : -0.5));
const flat = () => candles((i) => 100 + (i % 2 ? 1 : -1));
const quote = (bid, ask, ageMs = 1000) => ({ bid, ask, timestamp: iso(NOW - ageMs) });
const snap = (instruments, extra = {}) => ({ schema_version: 1, region: "INDIA", source: "unit-test", data_mode: "live", observed_at: iso(NOW - 1000), instruments, ...extra });
const account = { starting_cash: 1_000_000 };
const run = (snapshot, open = [], closedHistory = []) => evaluate({ snapshot, account, open, closedHistory, nowMs: NOW });

test("trend rules classify synthetic series", () => {
  assert.equal(trend({ candles: up() }).side, "BULLISH");
  assert.equal(trend({ candles: down() }).side, "BEARISH");
  assert.equal(trend({ candles: flat() }).side, "NONE");
  assert.equal(trend({ candles: up().slice(0, 10) }).side, "NONE");
});

test("no setups means NO_TRADE with an explanation and no entries", () => {
  const r = run(snap([{ symbol: "FLAT", asset_class: "EQUITY", candles: flat(), quote: quote(100, 100.1) }]));
  assert.equal(r.entries.length, 0);
  assert.equal(r.report.stance, "NO_TRADE");
  assert.match(r.report.inactive_reason, /valid decision/);
});

test("bullish setup with fresh bid/ask opens a sized paper position with full trade record", () => {
  const r = run(snap([{ symbol: "AAA", exchange: "NSE", asset_class: "EQUITY", candles: up(), quote: quote(130, 130.2) }]));
  assert.equal(r.entries.length, 1);
  const e = r.entries[0];
  assert.equal(e.entry_price, 130.2);
  assert.equal(e.price_basis, "bid_ask");
  assert.equal(e.entry_fees, COSTS.INDIA.brokerage_per_order);
  assert.ok(e.risk_amount <= 1_000_000 * 0.0025 + 1e-6, "risk must respect the 0.25% budget");
  assert.ok(e.capital_allocated <= 1_000_000 * 0.08 + 1e-6, "notional must respect the 8% cap");
  assert.ok(e.stop_price < e.entry_price && e.target_price > e.entry_price);
  assert.equal(e.strategy, "trend-momentum-long");
  assert.match(e.explanation, /RSI/);
  const d = r.report.trades_executed[0];
  for (const k of ["symbol", "exchange", "quantity", "order_type", "entry", "stop", "target", "risk_amount", "capital_allocated", "brokerage", "strategy", "explanation"]) assert.ok(k in d, `decision missing ${k}`);
  assert.ok(r.report.portfolio.cash < 1_000_000);
  assert.ok(Math.abs(r.report.portfolio.equity - 1_000_000) < 25, "equity only moves by fees at entry");
});

test("stale or missing quote prevents entry and is reported, never invented", () => {
  const r = run(snap([{ symbol: "AAA", asset_class: "EQUITY", candles: up(), quote: quote(130, 130.2, 10 * 60_000) }]));
  assert.equal(r.entries.length, 0);
  assert.ok(r.report.trades_skipped.some((s) => /no fresh quote/i.test(s.reason)));
  assert.ok(r.report.next_session_watchlist.some((w) => w.symbol === "AAA"));
  assert.equal(priceFor(undefined, "BUY", COSTS.INDIA, "CASH", NOW), null);
});

test("last-trade-only quotes use the stated slippage assumption and are labelled", () => {
  const q = { last: 130, timestamp: iso(NOW - 1000) };
  const buy = priceFor(q, "BUY", COSTS.INDIA, "CASH", NOW);
  const sell = priceFor(q, "SELL", COSTS.INDIA, "CASH", NOW);
  assert.equal(buy.basis, "last_trade_with_modelled_slippage");
  assert.ok(buy.price > 130 && sell.price < 130);
  assert.equal(buy.slippage_bps, 5);
});

test("bearish equities are not shorted; they are skipped and watch-listed", () => {
  const r = run(snap([{ symbol: "BBB", asset_class: "EQUITY", candles: down(), quote: quote(100, 100.1) }]));
  assert.equal(r.entries.length, 0);
  assert.ok(r.report.trades_skipped.some((s) => /does not short/.test(s.reason)));
  assert.equal(r.report.next_session_watchlist[0].bias, "BEARISH");
});

test("stop-loss exit books net P&L after both brokerage legs and holding period", () => {
  const open = [{ id: "p1", symbol: "AAA", instrument_id: "AAA", asset_class: "EQUITY", quantity: 100, lot_size: 1, entry_price: 130, last_price: 130, stop_price: 126.1, target_price: 137.8, entry_fees: 20, opened_at: iso(NOW - 2 * 86400000), strategy: "trend-momentum-long" }];
  const r = run(snap([{ symbol: "AAA", asset_class: "EQUITY", candles: flat(), quote: quote(125, 125.2) }]), open);
  assert.equal(r.exits.length, 1);
  const x = r.exits[0];
  assert.equal(x.exit_reason, "STOP");
  assert.equal(x.gross_pnl, (125 - 130) * 100);
  assert.equal(x.net_pnl, -500 - 20 - 20);
  assert.equal(x.holding_days, 2);
  assert.equal(r.report.strategy_performance[0].trades, 1);
  assert.equal(r.report.portfolio.realized_pnl_net, -540);
});

test("open position without a fresh quote is held, not marked", () => {
  const open = [{ id: "p1", symbol: "AAA", instrument_id: "AAA", asset_class: "EQUITY", quantity: 10, lot_size: 1, entry_price: 130, last_price: 131, stop_price: 126, target_price: 138, entry_fees: 20, opened_at: iso(NOW - 3600_000), strategy: "x" }];
  const r = run(snap([{ symbol: "AAA", asset_class: "EQUITY", candles: flat(), quote: quote(131, 131.2, 20 * 60_000) }]), open);
  assert.equal(r.marks.length, 0);
  assert.equal(r.report.risk_exposure.stale_marks, 1);
  assert.match(r.decisions[0].reason, /No fresh quote/);
});

test("gross exposure cap and cash are respected across many bullish candidates", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ symbol: "S" + i, asset_class: "EQUITY", candles: up(), quote: quote(130, 130.2) }));
  const r = run(snap(many));
  assert.ok(r.entries.length <= 12);
  assert.ok(r.report.risk_exposure.gross_exposure_pct <= 60.01);
  assert.ok(r.report.portfolio.cash >= 0);
});

test("bullish underlying selects a liquid CE; illiquid contracts are rejected", () => {
  const expiry = new Date(NOW + 20 * 86400000).toISOString().slice(0, 10);
  const contract = (id, over = {}) => ({ contract_id: id, symbol: id, underlying: "NIFTY", option_type: "CE", strike: 25000, expiry, lot_size: 25, bid: 100, ask: 101, timestamp: iso(NOW - 1000), delta: 0.5, iv: 0.15, open_interest: 5000, volume: 500, ...over });
  const r = run(snap([{ symbol: "NIFTY", asset_class: "INDEX", candles: up(), quote: quote(130, 130.1) }], { option_contracts: [contract("GOOD"), contract("WIDE", { ask: 130 }), contract("PUT", { option_type: "PE" }), contract("THIN", { open_interest: 10 })] }));
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].instrument_id, "GOOD");
  assert.equal(r.entries[0].option_type, "CE");
  assert.equal(r.report.fo_summary.contracts_seen, 4);
  assert.equal(r.report.fo_summary.contracts_eligible, 1);
  assert.equal(r.report.fo_summary.by_underlying[0].underlying, "NIFTY");
});

test("EOD snapshots trade cash instruments at modelled close fills and disable options", () => {
  const eodQuote = { last: 130, timestamp: iso(NOW - 3 * 3600_000) };
  const expiry = new Date(NOW + 20 * 86400000).toISOString().slice(0, 10);
  const r = run(snap([{ symbol: "AAA", asset_class: "EQUITY", candles: up(), quote: eodQuote }], { region: "GLOBAL", data_mode: "eod", option_contracts: [{ contract_id: "X", symbol: "X", underlying: "AAA", option_type: "CALL", strike: 1, expiry, lot_size: 100, bid: 1, ask: 1.1, timestamp: iso(NOW), delta: 0.5, iv: 0.2, open_interest: 1000, volume: 100 }] }));
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].asset_class, "EQUITY");
  assert.equal(r.entries[0].price_basis, "eod_close_with_modelled_slippage");
  assert.match(r.report.fo_summary.options_disabled_reason, /End-of-day/);
  assert.equal(r.report.currency, "USD");
});

test("market overview, movers and sectors are computed from supplied candles only", () => {
  const r = run(snap([
    { symbol: "NIFTY", asset_class: "INDEX", candles: up(), quote: quote(130, 130.1) },
    { symbol: "AAA", asset_class: "EQUITY", sector: "IT", candles: up(), quote: quote(130, 130.2) },
    { symbol: "BBB", asset_class: "EQUITY", sector: "Banks", candles: down(), quote: quote(100, 100.1) },
  ]));
  assert.equal(r.report.market_overview.indices[0].symbol, "NIFTY");
  assert.equal(r.report.market_overview.breadth.scanned, 3);
  assert.equal(r.report.sector_moves.length, 2);
  assert.ok(Array.isArray(r.report.top_gainers) && Array.isArray(r.report.top_losers));
  for (const k of ["risk_exposure", "strategy_performance", "next_session_watchlist", "assumptions", "open_positions", "trades_skipped"]) assert.ok(k in r.report, k);
});
