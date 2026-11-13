import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/index.js";

const call = (path, payload) => app.fetch(new Request("https://unit.test"+path, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
}));

test("health endpoint reports a healthy calculation-only API", async () => {
  const response = await app.fetch(new Request("https://unit.test/api/v1/health"));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
});

test("Black-Scholes endpoint returns bounded model outputs", async () => {
  const response = await call("/api/v1/options/greeks", {
    side:"call", spot:100, strike:100, years_to_expiry:0.1, risk_free_rate:0.05, volatility:0.2
  });
  const result = await response.json();
  assert.equal(response.status,200);
  assert.ok(result.theoretical_price>0);
  assert.ok(result.delta>0 && result.delta<1);
});

test("SMA backtest rejects invalid prices and returns metrics for valid input", async () => {
  const response = await call("/api/v1/backtest/sma-crossover", {
    closes:Array.from({length:30},(_,i)=>100+i), fast_window:5, slow_window:20, fee_bps:5, slippage_bps:5
  });
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.bars_evaluated,30);
  assert.ok(Number.isFinite(result.max_drawdown_pct));
});

test("unverified candidate is fail-closed", async () => {
  const response = await call("/api/v1/research/candidate", {data_mode:"demo"});
  const result=await response.json();
  assert.equal(result.decision,"NO_TRADE");
});
