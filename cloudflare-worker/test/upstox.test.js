import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseQuotes, parseCandles, parseOptionChain, parseContracts, pickExpiries, marketPhase, istDay, fetchUpstoxSnapshot, universeList } from "../src/upstox.js";
import { regionProvider, providerInfo, fetchSnapshot } from "../src/providers.js";
import { regionsFor, paperBotRoute } from "../src/paper-bot.js";

let DatabaseSync = null;
try { ({ DatabaseSync } = await import("node:sqlite")); } catch { /* skip */ }
function d1(sqlite) {
  const wrap = (sql, args = []) => ({ sql, args, bind: (...a) => wrap(sql, a),
    first: async () => sqlite.prepare(sql).get(...args) ?? null, all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => { sqlite.prepare(sql).run(...args); return { success: true }; } });
  return { prepare: (s) => wrap(s), batch: async (l) => { for (const s of l) sqlite.prepare(s.sql).run(...s.args); return []; } };
}
const migrate = (sq) => { for (const f of ["0001_paper_bot.sql", "0002_paper_bot_v2.sql", "0003_live_data_learning.sql"]) sq.exec(readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8")); };

// 2026-11-16 is a Monday. 05:00 UTC = 10:30 IST (market open).
const NOW = Date.parse("2026-11-16T05:00:00Z");

test("market phase follows NSE hours in IST and weekdays", () => {
  assert.equal(marketPhase(NOW), "open");
  assert.equal(marketPhase(Date.parse("2026-11-16T03:00:00Z")), "closed"); // 08:30 IST
  assert.equal(marketPhase(Date.parse("2026-11-16T10:30:00Z")), "closed"); // 16:00 IST
  assert.equal(marketPhase(Date.parse("2026-11-14T05:00:00Z")), "closed"); // Saturday
  assert.equal(istDay(Date.parse("2026-11-15T20:00:00Z")), "2026-11-16");
});

test("parseQuotes keeps bid/ask, maps keys, and drops quotes without price or timestamp", () => {
  const m = parseQuotes({ data: {
    "NSE_EQ:INFY": { instrument_token: "NSE_EQ|INE009A01021", last_price: 1500.5, timestamp: "2026-11-16T10:29:58.000+05:30", volume: 1000, depth: { buy: [{ price: 1500.4 }], sell: [{ price: 1500.6 }] } },
    "NSE_INDEX:Nifty 50": { last_price: 25000, last_trade_time: Date.parse("2026-11-16T05:00:00Z") },
    "NSE_EQ:BAD": { instrument_token: "NSE_EQ|BAD", last_price: 0, timestamp: "2026-11-16T10:30:00+05:30" },
    "NSE_EQ:NOTS": { instrument_token: "NSE_EQ|NOTS", last_price: 10 },
  } });
  assert.deepEqual([...m.keys()].sort(), ["NSE_EQ|INE009A01021", "NSE_INDEX|Nifty 50"]);
  assert.equal(m.get("NSE_EQ|INE009A01021").bid, 1500.4);
  assert.equal(m.get("NSE_INDEX|Nifty 50").bid, undefined);
  assert.equal(m.get("NSE_INDEX|Nifty 50").timestamp, "2026-11-16T05:00:00.000Z");
});

test("parseCandles returns ascending bars and skips junk", () => {
  const bars = parseCandles({ data: { candles: [["2026-11-13T00:00:00+05:30", 11, 13, 10, 12, 500, 0], ["2026-11-12T00:00:00+05:30", 10, 12, 9, 11, 400, 0], ["bad", 1, 1, 1, 0, 1, 0]] } });
  assert.deepEqual(bars.map((b) => [b.day, b.close]), [["2026-11-12", 11], ["2026-11-13", 12]]);
});

const chainRow = (strike, over = {}) => ({ expiry: "2026-12-29", strike_price: strike, underlying_spot_price: 25000,
  call_options: { instrument_key: "NSE_FO|C" + strike, market_data: { ltp: 100, volume: 900, oi: 12000, prev_oi: 11000, bid_price: 99.5, ask_price: 100.5 }, option_greeks: { delta: 0.5, gamma: 0.001, theta: -10, vega: 12, iv: 14.5 } },
  put_options: { instrument_key: "NSE_FO|P" + strike, market_data: { ltp: 90, volume: 800, oi: 15000, prev_oi: 15500, bid_price: 89.5, ask_price: 90.5 }, option_greeks: { delta: -0.5, iv: 15 } }, ...over });

test("parseOptionChain normalizes OI change, IV percent→fraction, lot size, and trims far strikes", () => {
  const c = parseOptionChain({ data: [chainRow(25000), chainRow(40000)] }, { underlying: "NIFTY", lotSize: 75, fetchedAt: "2026-11-16T05:00:00.000Z" });
  assert.equal(c.length, 2);
  const ce = c.find((x) => x.option_type === "CE"), pe = c.find((x) => x.option_type === "PE");
  assert.equal(ce.iv, 0.145); assert.equal(ce.oi_change, 1000); assert.equal(pe.oi_change, -500);
  assert.equal(ce.lot_size, 75); assert.equal(ce.contract_id, "NSE_FO|C25000"); assert.equal(ce.underlying, "NIFTY");
  assert.equal(ce.bid, 99.5); assert.equal(pe.delta, -0.5);
});

test("contracts and expiry selection", () => {
  const c = parseContracts({ data: [{ expiry: "2026-12-29", lot_size: 75 }, { expiry: "2026-11-17", lot_size: 75 }, { expiry: "2026-11-24" }] });
  assert.deepEqual(c, { lot_size: 75, expiries: ["2026-11-17", "2026-11-24", "2026-12-29"] });
  assert.deepEqual(pickExpiries(c.expiries, NOW), ["2026-11-17", "2026-11-24"], "Nov 24 is already 7+ days out");
  assert.deepEqual(pickExpiries(c.expiries, Date.parse("2026-11-20T05:00:00Z")), ["2026-11-24", "2026-12-29"]);
  assert.deepEqual(pickExpiries(c.expiries, NOW, { stock: true }), ["2026-11-17"]);
  assert.deepEqual(pickExpiries(["2026-01-01"], NOW), []);
});

test("provider routing: Upstox for India, Twelve Data for global, honest modes", () => {
  const env = { UPSTOX_ACCESS_TOKEN: "t", TWELVEDATA_API_KEY: "k" };
  assert.equal(regionProvider(env, "INDIA").provider, "upstox");
  assert.equal(regionProvider(env, "INDIA").data_mode, "live");
  assert.equal(regionProvider(env, "GLOBAL").provider, "twelvedata");
  assert.equal(regionProvider(env, "GLOBAL").data_mode, "eod");
  const info = providerInfo(env);
  assert.equal(info.data_mode, "mixed"); assert.deepEqual(info.regions, ["INDIA", "GLOBAL"]); assert.equal(info.provider, "upstox+twelvedata");
  assert.equal(regionProvider({ TWELVEDATA_API_KEY: "k" }, "INDIA").configured, false);
  assert.equal(providerInfo({}).configured, false);
});

test("scheduler: India live runs only in session; global stays end-of-day", () => {
  const env = { UPSTOX_ACCESS_TOKEN: "t", TWELVEDATA_API_KEY: "k" };
  assert.deepEqual(regionsFor({ scheduledTime: NOW }, env), [{ region: "INDIA", eod: false }]);
  assert.deepEqual(regionsFor({ scheduledTime: Date.parse("2026-11-16T03:00:00Z") }, env), []);
  assert.deepEqual(regionsFor({ scheduledTime: Date.parse("2026-11-16T10:20:00Z") }, env), [{ region: "INDIA", eod: true }]);
  assert.deepEqual(regionsFor({ scheduledTime: Date.parse("2026-11-16T22:30:00Z") }, env), [{ region: "GLOBAL", eod: true }]);
});

// ---- Whole flow on real SQL with a fake Upstox ----
const universe = { source: "test", generated_at: "2026-11-15T00:00:00Z",
  indices: [{ symbol: "NIFTY", key: "NSE_INDEX|Nifty 50" }],
  stocks: [{ symbol: "AAA", key: "NSE_EQ|AAA", lot_size: 100, expiries: ["2026-11-24", "2026-12-29"] }], etfs: [{ symbol: "BEES", key: "NSE_EQ|BEES" }] };
const history = (n) => ({ data: { candles: Array.from({ length: n }, (_, i) => [new Date(Date.parse("2026-11-13T00:00:00+05:30") - i * 86400000).toISOString().slice(0, 10) + "T00:00:00+05:30", 100, 101, 99, 100 + (n - i) * 0.3, 1000, 0]) } });
function fakeUpstox(log) {
  return async (url, init) => {
    assert.equal(init.headers.Authorization, "Bearer tok"); assert.ok(!String(url).includes("tok"), "token never in URL");
    const u = new URL(url); log.push(u.pathname);
    if (u.pathname === "/v2/market-quote/quotes") {
      const ts = "2026-11-16T10:29:59.000+05:30", data = {};
      for (const k of u.searchParams.get("instrument_key").split(",")) data[k.replace("|", ":")] = { instrument_token: k, last_price: 130, timestamp: ts, depth: { buy: [{ price: 129.9 }], sell: [{ price: 130.1 }] } };
      return Response.json({ data });
    }
    if (u.pathname.startsWith("/v3/historical-candle/")) return Response.json(history(u.pathname.includes("/minutes/") ? 40 : 90));
    if (u.pathname === "/v2/option/contract") return Response.json({ data: [{ expiry: "2026-11-17", lot_size: 75 }, { expiry: "2026-11-24", lot_size: 75 }, { expiry: "2026-12-29", lot_size: 75 }] });
    if (u.pathname === "/v2/option/chain") return Response.json({ data: [chainRow(25000, { expiry: u.searchParams.get("expiry_date") }), chainRow(25100, { expiry: u.searchParams.get("expiry_date") })] });
    return new Response("nope", { status: 404 });
  };
}

test("live India snapshot: backfills history, loads chains for indices + rotating F&O stocks, stores state", { skip: !DatabaseSync }, async () => {
  const sq = new DatabaseSync(":memory:"); migrate(sq);
  const env = { DB: d1(sq), UPSTOX_ACCESS_TOKEN: "tok", UPSTOX_HISTORY_BATCH: "10", UPSTOX_CHAIN_BATCH: "2" };
  const log = [];
  const snap = await fetchUpstoxSnapshot(env, "INDIA", "paper_intraday", fakeUpstox(log), NOW, universe);
  assert.equal(snap.source, "upstox"); assert.equal(snap.data_mode, "live"); assert.equal(snap.region, "INDIA");
  assert.equal(snap.instruments.length, 3, "all three reach 55+ closes after one backfill pass");
  assert.ok(snap.instruments.every((i) => i.candles.length >= 55 && i.quote.bid && i.quote.timestamp));
  assert.ok(snap.option_contracts.some((c) => c.underlying === "NIFTY") && snap.option_contracts.some((c) => c.underlying === "AAA"));
  assert.ok(snap.option_contracts.every((c) => Number.isInteger(c.lot_size)));
  assert.equal(snap.coverage.option_chains.failed.length, 0);
  assert.ok(sq.prepare("SELECT COUNT(*) n FROM bot_candles").get().n > 150);
  assert.ok(sq.prepare("SELECT COUNT(*) n FROM bot_intraday WHERE symbol='NIFTY'").get().n >= 40);
  assert.ok(sq.prepare("SELECT value FROM bot_state WHERE key='chain_cursor'").get());
  // The snapshot is accepted by the real bot run path.
  const r = await paperBotRoute(new Request("https://t/api/v1/paper-bot/run", { method: "POST", headers: { Authorization: "Bearer run" }, body: JSON.stringify({ snapshot: { ...snap, observed_at: new Date().toISOString() } }) }), { ...env, BOT_RUN_TOKEN: "run" }, new URL("https://t/api/v1/paper-bot/run"));
  assert.equal(r.status, 200);
  const rep = (await r.json());
  assert.equal(rep.status, "completed"); assert.equal(rep.data_coverage.universe_size, 3);
  // Second run reuses stored history: no historical-candle calls needed.
  const log2 = [];
  await fetchUpstoxSnapshot(env, "INDIA", "paper_intraday", fakeUpstox(log2), NOW + 300000, universe);
  assert.equal(log2.filter((p) => p.startsWith("/v3/historical-candle")).length, 0, log2.join(" "));
});

test("eod mode skips option chains; closed market refuses live runs; failures are explicit", { skip: !DatabaseSync }, async () => {
  const sq = new DatabaseSync(":memory:"); migrate(sq);
  const env = { DB: d1(sq), UPSTOX_ACCESS_TOKEN: "tok" };
  const log = [];
  const snap = await fetchUpstoxSnapshot(env, "INDIA", "paper_eod", fakeUpstox(log), Date.parse("2026-11-16T10:20:00Z"), universe);
  assert.equal(snap.data_mode, "eod"); assert.equal(snap.option_contracts.length, 0);
  assert.ok(!log.includes("/v2/option/chain"));
  await assert.rejects(() => fetchUpstoxSnapshot(env, "INDIA", "paper_intraday", fakeUpstox([]), Date.parse("2026-11-16T12:00:00Z"), universe), /closed/);
  await assert.rejects(() => fetchUpstoxSnapshot({ DB: env.DB }, "INDIA", "paper_intraday", fakeUpstox([]), NOW, universe), /UPSTOX_ACCESS_TOKEN/);
  await assert.rejects(() => fetchUpstoxSnapshot(env, "INDIA", "paper_intraday", async () => new Response("", { status: 401 }), NOW, universe), /Upstox HTTP 401/);
});

test("fetchSnapshot dispatches to Upstox for India and refuses it for global", async () => {
  await assert.rejects(() => fetchSnapshot({ UPSTOX_ACCESS_TOKEN: "t" }, "INDIA", "paper_intraday"), /D1 database/);
  assert.equal(universeList({ indices: [{ symbol: "A", key: "k" }], stocks: [], etfs: [] }, 5).length, 1);
});
