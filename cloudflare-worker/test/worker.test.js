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

test("option-chain analytics returns PCR, max pain and OI concentration", async () => {
  const response = await call("/api/v1/analytics/option-chain", {
    rows: [
      {strike:100, option_type:"CE", open_interest:100, change_oi:10, volume:50},
      {strike:100, option_type:"PE", open_interest:150, change_oi:20, volume:60},
      {strike:110, option_type:"CE", open_interest:200, change_oi:30, volume:70},
      {strike:110, option_type:"PE", open_interest:80, change_oi:-5, volume:30}
    ]
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.pcr_oi, 230 / 300);
  assert.equal(result.highest_call_oi_strike, 110);
  assert.equal(result.highest_put_oi_strike, 100);
  assert.equal(result.data_mode, "caller_supplied_unverified");
});

test("AI chat fails safely when Workers AI binding is not configured", async () => {
  const response = await call("/api/v1/ai/chat", {messages:[{role:"user",content:"Explain PCR"}]});
  assert.equal(response.status,503);
  assert.match((await response.json()).detail,/AI binding is not configured/);
});

test("AI chat uses the server-side research guardrails and returns model output", async () => {
  const request = new Request("https://unit.test/api/v1/ai/chat", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({messages:[{role:"user",content:"Explain the imported option-chain context."}],context:"NIFTY PCR 1.05; source user supplied."})
  });
  let modelName = "";
  let sentMessages = [];
  const response = await app.fetch(request, {AI_CHAT_ENABLED:"true",AI:{run:async(model,payload)=>{modelName=model;sentMessages=payload.messages;return {response:"PCR is descriptive, not a standalone signal."};}}});
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(modelName,"@cf/google/gemma-4-26b-a4b-it");
  assert.match(sentMessages[0].content,/NO TRADE/);
  assert.match(sentMessages[1].content,/user-supplied context/);
  assert.match(result.answer,/descriptive/);
  assert.equal(result.workflow.understand.intent,"india_derivatives");
  assert.equal(result.workflow.retrieve.external_sources_searched,false);
  assert.equal(result.workflow.research.live_market_data_available,false);
});

test("AI status reports whether the Workers AI binding is configured", async () => {
  const absent = await app.fetch(new Request("https://unit.test/api/v1/ai/status"));
  assert.equal((await absent.json()).available, false);
  const configured = await app.fetch(new Request("https://unit.test/api/v1/ai/status"), {AI:{run:async()=>({response:"ok"})}});
  const result = await configured.json();
  assert.equal(result.available, true);
  assert.equal(result.mode, "configured");
});
