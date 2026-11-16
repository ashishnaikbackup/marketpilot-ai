import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseYahooChart, yahooSymbols, fetchYahooSnapshot } from "../src/free-feeds.js";
import { regionProvider, providerInfo } from "../src/providers.js";
import { regionsFor, paperBotRoute } from "../src/paper-bot.js";
import { openDb, migrate } from "../../runner/sqlite-d1.mjs";
import { runOnce } from "../../runner/run.mjs";

const MIG = new URL("../migrations/", import.meta.url).pathname;
const chart = ({ n = 100, price = 140, off = 19800, intraday = false, ageSec = 600 } = {}) => {
  const step = intraday ? 1800 : 86400, now = Math.floor(Date.now() / 1000 / step) * step;
  const ts = Array.from({ length: n }, (_, i) => now - (n - i) * step), close = ts.map((_, i) => 100 + i * 0.4 + (i % 3 === 0 ? -1.5 : 0.7));
  return { chart: { error: null, result: [{ meta: { regularMarketPrice: price, regularMarketTime: Math.floor(Date.now() / 1000) - ageSec, gmtoffset: off, chartPreviousClose: 149 }, timestamp: ts, indicators: { quote: [{ close, open: close.map((c) => c - 0.2) }] } }] } };
};
const fakeFetch = (log = []) => async (url) => {
  const u = new URL(url); log.push(decodeURIComponent(u.pathname.split("/").pop()));
  if (u.pathname.endsWith("/BAD")) return new Response("", { status: 404 });
  return Response.json(chart({ intraday: u.searchParams.get("interval") === "30m" }));
};

test("parseYahooChart extracts price, timestamps, daily closes and local-time 30m bars", () => {
  const d = parseYahooChart(chart({ n: 60 }));
  assert.equal(d.price, 140); assert.equal(d.closes.length, 60); assert.match(d.timestamp, /Z$/);
  const i = parseYahooChart(chart({ n: 20, intraday: true }), { intraday: true });
  assert.equal(i.bars.length, 19, "newest (possibly forming) bar is dropped"); assert.match(i.bars[0].slot_ts, /T\d{2}:\d{2}:00\+05:30$/);
  assert.equal(parseYahooChart({ chart: { error: { code: "Not Found" }, result: null } }), null);
  assert.equal(parseYahooChart(chart({ price: 0 })), null);
});

test("symbol mapping: NSE suffixes, index tickers, global watchlist", () => {
  const u = { indices: [{ symbol: "NIFTY", key: "k" }], stocks: [{ symbol: "M&M", key: "s" }], etfs: [{ symbol: "NIFTYBEES", key: "e" }] };
  assert.deepEqual(yahooSymbols("INDIA", { UNIVERSE_INDIA: u }).map((x) => x.y), ["^NSEI", "M&M.NS", "NIFTYBEES.NS"]);
  assert.ok(yahooSymbols("GLOBAL", {}).length >= 20);
});

test("free feed is opt-in and honestly labelled delayed", () => {
  assert.equal(regionProvider({}, "INDIA").configured, false);
  const r = regionProvider({ FREE_FEEDS: "on" }, "INDIA");
  assert.equal(r.provider, "yahoo"); assert.equal(r.data_mode, "delayed"); assert.match(r.message, /DELAYED/); assert.match(r.message, /measures/);
  assert.equal(regionProvider({ FREE_FEEDS: "on", UPSTOX_ACCESS_TOKEN: "t" }, "INDIA").provider, "upstox");
  assert.equal(regionProvider({ FREE_FEEDS: "on", UPSTOX_ACCESS_TOKEN: "t" }, "GLOBAL").provider, "yahoo");
  assert.equal(providerInfo({ FREE_FEEDS: "on" }).data_mode, "delayed");
});

test("delayed scheduler: India in session, US only in US hours", () => {
  const env = { FREE_FEEDS: "on" };
  assert.deepEqual(regionsFor({ scheduledTime: Date.parse("2026-11-16T05:00:00Z") }, env).map((x) => x.region), ["INDIA"]);
  assert.deepEqual(regionsFor({ scheduledTime: Date.parse("2026-11-16T15:00:00Z") }, env).map((x) => x.region), ["GLOBAL"]);
  assert.deepEqual(regionsFor({ scheduledTime: Date.parse("2026-11-16T01:00:00Z") }, env), []);
});

test("Yahoo snapshot: builds, stores history, skips failures, and the bot accepts it end to end", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mp-")), { sqlite, db } = openDb(join(dir, "t.sqlite")); migrate(sqlite, MIG);
  const log = [];
  const env = { DB: db, FREE_FEEDS: "on", BOT_RUN_TOKEN: "run", GLOBAL_WATCHLIST: "AAA,BBB:ETF,BAD" };
  const snap = await fetchYahooSnapshot(env, "GLOBAL", "paper_intraday", fakeFetch(log));
  assert.equal(snap.data_mode, "delayed"); assert.equal(snap.instruments.length, 2); assert.equal(snap.skipped[0].symbol, "BAD");
  assert.ok(snap.instruments.every((i) => i.candles.length >= 55 && i.quote.basis === "delayed_last"));
  assert.ok(sqlite.prepare("SELECT COUNT(*) n FROM bot_candles").get().n > 100);
  assert.ok(sqlite.prepare("SELECT COUNT(*) n FROM bot_intraday").get().n > 10);
  const res = await paperBotRoute(new Request("https://t/api/v1/paper-bot/run", { method: "POST", headers: { Authorization: "Bearer run" }, body: JSON.stringify({ snapshot: snap }) }), env, new URL("https://t/api/v1/paper-bot/run"));
  const rep = await res.json();
  assert.equal(rep.status, "completed"); assert.equal(rep.data_mode, "delayed");
  assert.ok(rep.trades_executed.length >= 1, "delayed quotes (10 min old) are within the 40-minute delayed window");
  assert.equal(rep.trades_executed[0].price_basis, "delayed_last_with_modelled_slippage");
});

test("label follows measured quote age: old quotes are delayed, fresh in-session quotes are live, never in a closed market", async () => {
  const inSession = Date.parse("2026-11-16T05:00:00Z");
  const fresh = async (ageSec, nowMs) => { const f = async () => Response.json({ chart: { error: null, result: [{ ...chart().chart.result[0], meta: { ...chart().chart.result[0].meta, regularMarketTime: Math.floor(nowMs / 1000) - ageSec } }] } }); return fetchYahooSnapshot({ FREE_FEEDS: "on", UNIVERSE_INDIA: { indices: [{ symbol: "NIFTY", key: "k" }], stocks: [], etfs: [] } }, "INDIA", "paper_intraday", f, nowMs); };
  assert.equal((await fresh(30, inSession)).data_mode, "live");
  assert.equal((await fresh(900, inSession)).data_mode, "delayed");
  assert.equal((await fresh(30, Date.parse("2026-11-16T12:00:00Z"))).data_mode, "delayed", "market closed: never live");
  assert.equal((await fresh(5, inSession)).coverage.measured_quote_age_sec, 5);
});

test("runner tick publishes every static file the website reads, with no network and no secrets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mp-"));
  const realFetch = globalThis.fetch; globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    const out = await runOnce({ dataDir: dir, nowMs: Date.parse("2026-11-14T12:00:00Z"), fetchImpl: async () => { throw new Error("offline"); } });
    assert.equal(out.files, 15, "14 data files plus sources.json diagnostics");
    for (const f of ["status", "meta", "portfolio-INDIA", "positions-GLOBAL", "equity-INDIA", "reports-GLOBAL", "insights-INDIA", "grounding-INDIA"]) assert.ok(existsSync(join(dir, "public/paper-bot", f + ".json")), f);
    const all = ["status", "portfolio-INDIA", "grounding-INDIA"].map((f) => readFileSync(join(dir, "public/paper-bot", f + ".json"), "utf8")).join("");
    assert.ok(!all.includes("static-export"), "internal read token must not be published");
    assert.equal(JSON.parse(readFileSync(join(dir, "public/paper-bot/status.json"), "utf8")).hosting, "github-actions");
  } finally { globalThis.fetch = realFetch; }
});
