import test from "node:test";
import assert from "node:assert/strict";
import { parseNasdaqListings, boardQuote, refreshBoard, boardRows } from "../src/board.js";

const NASDAQ = "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares\nAAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N\nQQQ|Invesco QQQ Trust - ETF|G|N|N|100|Y|N\nZZZT|Test Co|Q|Y|N|100|N|N\nABCDW|ABC Acquisition Warrant|S|N|N|100|N|N\nFile Creation Time: 1116202609:00|||||||";
const OTHER = "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol\nBRK.B|Berkshire Hathaway Inc. - Class B|N|BRK.B|N|100|N|BRK.B\nSPY|SPDR S&P 500 ETF Trust|P|SPY|Y|100|N|SPY\nXYZ$A|Preferred|N|XYZ|N|100|N|XYZ\nFile Creation Time: 1116202609:00|||||||";
const chart = (price, closes) => { const now = Math.floor(Date.now() / 1000), ts = closes.map((_, i) => now - (closes.length - i) * 86400); return { chart: { error: null, result: [{ meta: { regularMarketPrice: price, regularMarketTime: now - 60, gmtoffset: 0, chartPreviousClose: 1 }, timestamp: ts, indicators: { quote: [{ close: closes }] } }] } }; };

test("Nasdaq Trader directory: stocks and ETFs kept; tests, warrants, preferreds and footer dropped; dots become dashes", () => {
  const l = parseNasdaqListings(NASDAQ, OTHER);
  assert.deepEqual(l.map((x) => x.symbol), ["AAPL", "QQQ", "BRK-B", "SPY"]);
  assert.equal(l.find((x) => x.symbol === "QQQ").etf, true); assert.equal(l[0].name, "Apple Inc.");
});

test("board quote uses the previous completed session for the change", () => {
  const q = boardQuote(chart(110, [90, 95, 100, 104]));
  assert.equal(q.p, 110); assert.ok(Math.abs(q.c - 5.77) < 0.1); assert.match(q.t, /Z$/);
  assert.equal(boardQuote({ chart: { error: { code: "x" }, result: null } }), null);
});

test("rolling refresh updates the stalest symbols first and records failures without losing old prices", async () => {
  const state = { B: { p: 5, c: 1, t: "x", u: 1 }, C: { p: 6, c: 1, t: "y", u: 5 } };
  const syms = ["A", "B", "C", "BAD"].map((symbol) => ({ symbol, name: symbol }));
  const seen = [];
  const f = async (url) => { const s = decodeURIComponent(new URL(url).pathname.split("/").pop()); seen.push(s); return s === "BAD.NS" ? new Response("", { status: 404 }) : Response.json(chart(10, [9, 9.5, 9.8, 10])); };
  const r = await refreshBoard({ state, symbols: syms, budget: 3, suffix: ".NS", fetchImpl: f, nowMs: 1000 });
  assert.deepEqual(seen.sort(), ["A.NS", "BAD.NS", "B.NS"].sort(), "never-updated A and BAD, then oldest B");
  assert.equal(r.ok, 2); assert.equal(r.failed, 1); assert.equal(state.BAD.f, 1); assert.equal(state.C.p, 6);
  const rows = boardRows(state, syms.map((s) => ({ ...s, kind: "S" })));
  assert.deepEqual(rows.map((x) => x[0]), ["A", "B", "C"], "unpriced symbols are not listed");
});
