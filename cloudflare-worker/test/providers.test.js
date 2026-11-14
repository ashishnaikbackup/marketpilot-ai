import test from "node:test";
import assert from "node:assert/strict";
import { buildTwelveDataSnapshot, fetchSnapshot, providerInfo, parseWatchlist } from "../src/providers.js";
import { regionsFor } from "../src/paper-bot.js";

const FETCHED = "2026-11-13T22:30:00Z";
const bars = (n, endDate = "2026-11-13") => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.parse(endDate) - i * 86400000).toISOString().slice(0, 10);
  return { datetime: d, close: String(100 + (n - i) * 0.5) };
}); // newest first, as Twelve Data returns

test("Twelve Data payload becomes an EOD snapshot and is never labelled live", () => {
  const snap = buildTwelveDataSnapshot({ region: "GLOBAL", payload: { SPY: { status: "ok", values: bars(60), meta: { exchange: "NYSE" } } }, entries: [{ symbol: "SPY", asset_class: "ETF" }], fetchedAt: FETCHED });
  assert.equal(snap.data_mode, "eod");
  assert.equal(snap.source, "twelvedata");
  assert.equal(snap.instruments[0].candles.length, 60);
  assert.ok(snap.instruments[0].candles[0].timestamp < snap.instruments[0].candles.at(-1).timestamp, "candles are oldest first");
  assert.equal(snap.instruments[0].quote.basis, "eod_close");
  assert.deepEqual(snap.option_contracts, []);
});

test("single-symbol responses and provider errors are handled", () => {
  const one = buildTwelveDataSnapshot({ region: "GLOBAL", payload: { status: "ok", values: bars(60) }, entries: [{ symbol: "AAPL", asset_class: "EQUITY" }], fetchedAt: FETCHED });
  assert.equal(one.instruments[0].symbol, "AAPL");
  assert.throws(() => buildTwelveDataSnapshot({ region: "GLOBAL", payload: { status: "error", message: "bad key" }, entries: [{ symbol: "A", asset_class: "EQUITY" }], fetchedAt: FETCHED }), /bad key/);
});

test("short history and stale bars are excluded rather than padded", () => {
  assert.throws(() => buildTwelveDataSnapshot({ region: "GLOBAL", payload: { SPY: { status: "ok", values: bars(20) } }, entries: [{ symbol: "SPY", asset_class: "ETF" }], fetchedAt: FETCHED }), /no usable/i);
  assert.throws(() => buildTwelveDataSnapshot({ region: "GLOBAL", payload: { SPY: { status: "ok", values: bars(60, "2026-10-01") } }, entries: [{ symbol: "SPY", asset_class: "ETF" }], fetchedAt: FETCHED }), /no usable/i);
});

test("API key is sent in a header and never in the URL", async () => {
  let seen;
  const fake = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ SPY: { status: "ok", values: bars(60, new Date().toISOString().slice(0, 10)) } }) }; };
  await fetchSnapshot({ MARKET_DATA_PROVIDER: "twelvedata", TWELVEDATA_API_KEY: "KEY123", GLOBAL_WATCHLIST: "SPY:ETF" }, "GLOBAL", "paper_eod", fake);
  assert.ok(!seen.url.includes("KEY123"));
  assert.equal(seen.init.headers.Authorization, "apikey KEY123");
});

test("India is refused on Twelve Data unless symbols are explicitly configured", async () => {
  await assert.rejects(fetchSnapshot({ MARKET_DATA_PROVIDER: "twelvedata", TWELVEDATA_API_KEY: "k" }, "INDIA", "x", async () => ({})), /free plan does not include NSE/);
});

test("unconfigured provider reports unavailable, never fake data", async () => {
  assert.equal(providerInfo({}).configured, false);
  assert.equal(providerInfo({}).data_mode, "unavailable");
  await assert.rejects(fetchSnapshot({}, "INDIA", "x"), /No market-data provider/);
  assert.equal(parseWatchlist("SPY:ETF,AAPL,bad symbol!").length, 2);
});

test("EOD providers only run at the EOD slot on weekdays", () => {
  const env = { MARKET_DATA_PROVIDER: "twelvedata", TWELVEDATA_API_KEY: "k" };
  const at = (iso) => ({ scheduledTime: Date.parse(iso) });
  assert.deepEqual(regionsFor(at("2026-11-13T22:30:00Z"), env), [{ region: "GLOBAL", eod: true }]); // Friday
  assert.deepEqual(regionsFor(at("2026-11-13T10:20:00Z"), env), [{ region: "INDIA", eod: true }]);
  assert.deepEqual(regionsFor(at("2026-11-13T12:15:00Z"), env), []);
  assert.deepEqual(regionsFor(at("2026-11-14T22:30:00Z"), env), []); // Saturday
});
