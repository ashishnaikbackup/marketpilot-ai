import test from "node:test";
import assert from "node:assert/strict";
import { buildUniverse, render } from "../scripts/build-universe.mjs";

const NOW = Date.parse("2026-11-16T05:00:00Z"), exp = Date.parse("2026-11-24T10:00:00Z"), old = Date.parse("2026-01-01T10:00:00Z");
const rows = [];
rows.push({ segment: "NSE_INDEX", instrument_key: "NSE_INDEX|Nifty 50", name: "Nifty 50", trading_symbol: "NIFTY 50" });
rows.push({ segment: "NSE_INDEX", instrument_key: "NSE_INDEX|Nifty Bank", name: "Nifty Bank", trading_symbol: "NIFTY BANK" });
for (const t of ["CE", "PE"]) { rows.push({ segment: "NSE_FO", instrument_type: t, underlying_symbol: "NIFTY", underlying_key: "NSE_INDEX|Nifty 50", lot_size: 75, expiry: exp }); rows.push({ segment: "NSE_FO", instrument_type: t, underlying_symbol: "BANKNIFTY", underlying_key: "NSE_INDEX|Nifty Bank", lot_size: 30, expiry: exp }); }
for (let i = 0; i < 60; i++) {
  const sym = "STK" + String(i).padStart(2, "0");
  rows.push({ segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: sym, instrument_key: "NSE_EQ|" + sym, name: sym + " LTD" });
  rows.push({ segment: "NSE_FO", instrument_type: "CE", underlying_symbol: sym, underlying_key: "NSE_EQ|" + sym, lot_size: 100 + i, expiry: exp });
  rows.push({ segment: "NSE_FO", instrument_type: "CE", underlying_symbol: sym, underlying_key: "NSE_EQ|" + sym, lot_size: 100 + i, expiry: old });
}
rows.push({ segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "NIFTYBEES", instrument_key: "NSE_EQ|ETF1", name: "NIPPON NIFTY BEES" });
rows.push({ segment: "NSE_EQ", instrument_type: "EQ", trading_symbol: "NOFNO", instrument_key: "NSE_EQ|NOFNO", name: "No Options Ltd" });

test("universe builder picks indices, F&O stocks with lot sizes and future expiries, and ETFs", () => {
  const u = buildUniverse(rows, NOW);
  assert.deepEqual(u.indices.map((i) => i.symbol), ["NIFTY", "BANKNIFTY"]);
  assert.equal(u.indices[0].lot_size, 75); assert.deepEqual(u.indices[0].expiries, ["2026-11-24"]);
  assert.equal(u.stocks.length, 60); assert.equal(u.stocks[3].lot_size, 103); assert.deepEqual(u.stocks[0].expiries, ["2026-11-24"]);
  assert.deepEqual(u.etfs.map((e) => e.symbol), ["NIFTYBEES"]);
  assert.ok(!u.stocks.some((s) => s.symbol === "NOFNO"));
  assert.match(render(u), /^\/\/ .*GENERATED[\s\S]*export default \{/);
});
test("universe builder refuses a malformed master instead of overwriting the universe", () => {
  assert.throws(() => buildUniverse(rows.slice(0, 10), NOW), /refusing/);
});
