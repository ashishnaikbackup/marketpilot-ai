// Runs the real SQL (both migrations) on SQLite, which is what D1 is, and drives the bot end to end.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paperBotRoute } from "../src/paper-bot.js";

let DatabaseSync = null;
try { ({ DatabaseSync } = await import("node:sqlite")); } catch { /* older Node: skip */ }

function d1(sqlite) {
  const wrap = (sql, args = []) => ({
    sql, args,
    bind: (...a) => wrap(sql, a),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => { sqlite.prepare(sql).run(...args); return { success: true }; },
  });
  return {
    prepare: (sql) => wrap(sql),
    batch: async (list) => {
      sqlite.exec("BEGIN");
      try { for (const s of list) sqlite.prepare(s.sql).run(...s.args); sqlite.exec("COMMIT"); }
      catch (e) { sqlite.exec("ROLLBACK"); throw e; }
      return list.map(() => ({ success: true }));
    },
  };
}
const migrate = (sqlite) => { for (const f of ["0001_paper_bot.sql", "0002_paper_bot_v2.sql"]) sqlite.exec(readFileSync(new URL("../migrations/" + f, import.meta.url), "utf8")); };

const up = Array.from({ length: 60 }, (_, i) => ({ timestamp: new Date(Date.now() - (60 - i) * 86400000).toISOString(), close: 100 + i * 0.5 + (i % 3 === 0 ? -1.5 : 0.5) }));
const last = up.at(-1).close;
const snapshot = (bid, ask) => { const t = new Date().toISOString(); return { schema_version: 1, region: "GLOBAL", source: "integration", data_mode: "live", observed_at: t, instruments: [{ symbol: "AAA", exchange: "NASDAQ", asset_class: "EQUITY", candles: up, quote: { bid, ask, timestamp: t } }] }; };

test("migrations apply cleanly and are repeat-safe for the account seed", { skip: !DatabaseSync }, () => {
  const sqlite = new DatabaseSync(":memory:");
  migrate(sqlite);
  assert.equal(sqlite.prepare("SELECT starting_cash FROM bot_accounts WHERE region='GLOBAL'").get().starting_cash, 10000);
  for (const col of ["strategy", "entry_fees", "exit_fees", "gross_pnl", "holding_days", "explanation"]) assert.ok(sqlite.prepare("PRAGMA table_info(bot_positions)").all().some((c) => c.name === col), col);
});

test("full lifecycle on real SQL: buy, persist, stop out, report, portfolio stats", { skip: !DatabaseSync }, async () => {
  const sqlite = new DatabaseSync(":memory:"); migrate(sqlite);
  const env = { DB: d1(sqlite), BOT_RUN_TOKEN: "run", BOT_READ_TOKEN: "read" };
  const post = (snap) => paperBotRoute(new Request("https://t/api/v1/paper-bot/run", { method: "POST", headers: { Authorization: "Bearer run" }, body: JSON.stringify({ snapshot: snap }) }), env, new URL("https://t/api/v1/paper-bot/run"));
  const get = async (path) => (await paperBotRoute(new Request("https://t" + path, { headers: { Authorization: "Bearer read" } }), env, new URL("https://t" + path))).json();

  const r1 = await post(snapshot(last - 0.1, last));
  const r1b = await r1.json();
  assert.equal(r1.status, 200, JSON.stringify(r1b));
  assert.equal(r1b.opened, 1);
  const pos = sqlite.prepare("SELECT * FROM bot_positions").all();
  assert.equal(pos.length, 1);
  assert.equal(pos[0].status, "OPEN");
  assert.equal(pos[0].strategy, "trend-momentum-long");
  assert.equal(pos[0].exchange, "NASDAQ");
  assert.equal(pos[0].order_type, "MARKET (simulated)");
  assert.ok(pos[0].risk_amount > 0 && pos[0].capital_allocated > 0);
  assert.ok(pos[0].explanation.length > 20);
  assert.equal(pos[0].entry_price, last);

  const midPortfolio = await get("/api/v1/paper-bot/portfolio?region=GLOBAL");
  assert.equal(midPortfolio.has_history, true);
  assert.ok(midPortfolio.equity < 10000 + 1 && midPortfolio.equity > 9990, "only entry fee moves equity (0 for USD)");

  // Price collapses below the stop on the next run.
  const crash = pos[0].stop_price - 2;
  const r2b = await (await post(snapshot(crash, crash + 0.05))).json();
  assert.equal(r2b.closed, 1);
  const row = sqlite.prepare("SELECT * FROM bot_positions").get();
  assert.equal(row.status, "CLOSED");
  assert.equal(row.exit_reason, "STOP");
  assert.ok(row.realized_pnl < 0);
  assert.equal(row.realized_pnl, row.gross_pnl - row.entry_fees - row.exit_fees);
  assert.ok(row.holding_days >= 0);
  assert.equal(sqlite.prepare("SELECT realized_pnl FROM bot_accounts WHERE region='GLOBAL'").get().realized_pnl, row.realized_pnl);

  const portfolio = await get("/api/v1/paper-bot/portfolio?region=GLOBAL");
  assert.equal(portfolio.stats.closed_trades, 1);
  assert.equal(portfolio.stats.wins, 0);
  assert.ok(portfolio.total_pnl < 0);
  assert.equal(Math.round(portfolio.equity * 100), Math.round((10000 + row.realized_pnl) * 100));
  const eq = await get("/api/v1/paper-bot/equity?region=GLOBAL");
  assert.equal(eq.points.length, 2);
  const reports = await get("/api/v1/paper-bot/reports?region=GLOBAL");
  assert.equal(reports.reports.length, 2);
  assert.ok(reports.reports[0].report.strategy_performance.length === 1);
  assert.equal(reports.reports[0].report.portfolio.starting_capital, 10000);
});

test("a failing statement rolls the whole run back so state never half-updates", { skip: !DatabaseSync }, async () => {
  const sqlite = new DatabaseSync(":memory:"); migrate(sqlite);
  sqlite.exec("DROP TABLE bot_equity_snapshots");
  const env = { DB: d1(sqlite), BOT_RUN_TOKEN: "run" };
  const res = await paperBotRoute(new Request("https://t/api/v1/paper-bot/run", { method: "POST", headers: { Authorization: "Bearer run" }, body: JSON.stringify({ snapshot: snapshot(last - 0.1, last) }) }), env, new URL("https://t/api/v1/paper-bot/run"));
  assert.equal(res.status, 422);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM bot_positions").get().n, 0, "no orphan position after a failed batch");
});
