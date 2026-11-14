import test from "node:test";
import assert from "node:assert/strict";
import { paperBotRoute } from "../src/paper-bot.js";

const db = {
  prepare() {
    const result = {
      all: async () => ({ results: [] }),
      first: async () => null,
      run: async () => ({ success: true }),
    };
    return { ...result, bind() { return result; } };
  },
};
const request = (path, token) => new Request("https://unit.test"+path, {
  headers: token ? { Authorization: "Bearer "+token } : {},
});

test("paper bot positions do not expose records without a read token", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/positions"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/positions"));
  assert.equal(response.status, 401);
});

test("paper bot positions reject wrong read tokens", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/positions", "wrong"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/positions"));
  assert.equal(response.status, 401);
});

test("paper bot positions return only after valid read token", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/positions", "private-test-token"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/positions"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).positions, []);
});

test("paper bot reports are protected by the read token", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/reports"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/reports"));
  assert.equal(response.status, 401);
});

test("paper bot reports return only after valid read token", async () => {
  const response = await paperBotRoute(request("/api/v1/paper-bot/reports", "private-test-token"), { DB: db, BOT_READ_TOKEN: "private-test-token" }, new URL("https://unit.test/api/v1/paper-bot/reports"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).reports, []);
});

test("manual run sizes long futures by lot, records expiry and persists atomically via one batch", async () => {
  const statements = [];
  let batches = 0;
  const mockDb = {
    prepare(sql) {
      const stmt = (args) => ({
        sql, args,
        first: async () => (sql.includes("FROM bot_accounts") ? { region: "INDIA", starting_cash: 1000000 } : null),
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      });
      return { ...stmt([]), bind: (...args) => { const b = stmt(args); statements.push(b); return b; } };
    },
    batch: async (list) => { batches++; assert.ok(list.length >= 3); return list.map(() => ({ success: true })); },
  };
  const candles = Array.from({ length: 60 }, (_, i) => ({ close: 100 + i * 0.5 + (i % 3 === 0 ? -1.5 : 0.5) }));
  const price = candles.at(-1).close;
  const observedAt = new Date().toISOString();
  const expiry = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const snapshot = { schema_version: 1, region: "INDIA", source: "test-fixture", data_mode: "live", observed_at: observedAt, instruments: [{ symbol: "NIFTY-FUT", instrument_id: "NIFTY-FUT-ID", asset_class: "FUTURE", expiry, lot_size: 25, candles, quote: { bid: price - 0.1, ask: price, timestamp: observedAt } }], option_contracts: [] };
  const request = new Request("https://unit.test/api/v1/paper-bot/run", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer run-secret" }, body: JSON.stringify({ snapshot }) });
  const response = await paperBotRoute(request, { DB: mockDb, BOT_RUN_TOKEN: "run-secret" }, new URL("https://unit.test/api/v1/paper-bot/run"));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.opened, 1);
  assert.equal(result.stance, "ACTIVE");
  assert.equal(result.decisions[0].asset_class, "FUTURE");
  assert.equal(batches, 1, "all writes must go through a single atomic batch");
  const insert = statements.find((x) => x.sql.includes("INSERT INTO bot_positions"));
  assert.ok(insert);
  assert.equal(insert.args[4], "FUTURE");
  assert.equal(insert.args[7], expiry);
  assert.equal(insert.args[9], 25);
  assert.ok(statements.some((x) => x.sql.includes("INSERT INTO bot_equity_snapshots")));
  assert.ok(statements.some((x) => x.sql.includes("INSERT INTO bot_runs")));
});

test("stale snapshot is skipped, nothing is written, and the reason is explicit", async () => {
  let batches = 0;
  const mockDb = { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }) }), batch: async () => { batches++; } };
  const old = new Date(Date.now() - 3600_000).toISOString();
  const snapshot = { schema_version: 1, region: "INDIA", source: "t", data_mode: "live", observed_at: old, instruments: [] };
  const request = new Request("https://unit.test/api/v1/paper-bot/run", { method: "POST", headers: { Authorization: "Bearer run-secret" }, body: JSON.stringify({ snapshot }) });
  const response = await paperBotRoute(request, { DB: mockDb, BOT_RUN_TOKEN: "run-secret" }, new URL("https://unit.test/api/v1/paper-bot/run"));
  const result = await response.json();
  assert.equal(result.status, "skipped");
  assert.equal(batches, 0);
});

test("portfolio and equity endpoints require the read token and compute stats", async () => {
  const acct = { region: "INDIA", starting_cash: 1000000 };
  const snaps = [{ equity: 1010000, cash: 900000, recorded_at: "2026-11-02" }, { equity: 1050000, cash: 900000, recorded_at: "2026-11-01" }, { equity: 1000000, cash: 1000000, recorded_at: "2026-10-31" }];
  const closed = [{ realized_pnl: 5000, holding_days: 2 }, { realized_pnl: -1000, holding_days: 1 }];
  const mockDb = { prepare: (sql) => ({ bind: () => ({
    first: async () => acct,
    all: async () => ({ results: sql.includes("bot_equity_snapshots") ? snaps : closed }),
  }) }) };
  const env = { DB: mockDb, BOT_READ_TOKEN: "r" };
  const route = (path, token) => paperBotRoute(request(path, token), env, new URL("https://unit.test" + path));
  assert.equal((await route("/api/v1/paper-bot/portfolio")).status, 401);
  assert.equal((await route("/api/v1/paper-bot/equity")).status, 401);
  const res = await route("/api/v1/paper-bot/portfolio?region=INDIA", "r");
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.total_pnl, 10000);
  assert.equal(body.stats.closed_trades, 2);
  assert.equal(body.stats.win_rate_pct, 50);
  assert.equal(body.stats.profit_factor, 5);
  assert.ok(body.stats.max_drawdown_pct < 0, "drawdown from the 1,050,000 peak to 1,010,000");
  const eq = await (await route("/api/v1/paper-bot/equity?region=INDIA", "r")).json();
  assert.equal(eq.points[0].recorded_at, "2026-10-31", "points are returned oldest first for charting");
});

test("assistant answers only from stored bot data and refuses to guess when there is none", async () => {
  const report = { data_mode: "eod", source: "twelvedata", observed_at: "2026-11-13T22:30:00Z", decisions: [{ action: "PAPER_BUY", symbol: "AAPL", quantity: 5, entry: 200, stop: 194, target: 212, risk_amount: 30, explanation: "Price above rising averages." }],
    risk_exposure: { gross_exposure_pct: 10, max_gross_exposure_pct: 60, open_positions: 1, max_positions: 12, capital_at_risk_to_stops: 30, stale_marks: 0 }, next_session_watchlist: [{ symbol: "MSFT", bias: "BULLISH", momentum_pct: 2.1, note: "Needs fresh quote." }] };
  const make = (withData) => ({ prepare: (sql) => ({ bind: () => ({ first: async () => {
    if (!withData) return null;
    if (sql.includes("bot_accounts")) return { starting_cash: 1000000 };
    if (sql.includes("bot_runs")) return { completed_at: "2026-11-13T22:31:00Z", data_mode: "eod", report_json: JSON.stringify(report) };
    return { equity: 1002000, cash: 900000, exposure: 102000, open_positions: 1, realized_pnl: 0, unrealized_pnl: 2000 };
  }, all: async () => ({ results: [] }) }) }) });
  const ask = (q, withData, token = "r") => paperBotRoute(new Request("https://unit.test/api/v1/paper-bot/ask", { method: "POST", headers: { Authorization: "Bearer " + token }, body: JSON.stringify({ question: q, region: "GLOBAL" }) }), { DB: make(withData), BOT_READ_TOKEN: "r" }, new URL("https://unit.test/api/v1/paper-bot/ask"));
  assert.equal((await ask("why did you buy?", true, "bad")).status, 401);
  const trade = await (await ask("Explain the latest trade", true)).json();
  assert.equal(trade.topic, "latest_trades");
  assert.match(trade.answer, /BOUGHT AAPL/);
  assert.equal(trade.simulated, true);
  assert.match((await (await ask("review my portfolio", true)).json()).answer, /simulated money/);
  assert.match((await (await ask("what are the risks", true)).json()).answer, /10% of equity/);
  assert.match((await (await ask("best opportunities", true)).json()).answer, /MSFT/);
  const empty = await (await ask("what is happening in the market", false)).json();
  assert.match(empty.answer, /no completed bot run/i);
  assert.equal((await (await ask("tell me a joke", true)).json()).grounded, false);
});
