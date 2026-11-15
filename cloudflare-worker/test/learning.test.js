import test from "node:test";
import assert from "node:assert/strict";
import { learn, riskMultiplier } from "../src/learning.js";
import { bestTimes } from "../src/timing.js";

const NOW = Date.parse("2026-11-16T05:00:00Z");
const trade = (strategy, pnl, symbol = "X", daysAgo = 1) => ({ strategy, net_pnl: pnl, symbol, closed_at: new Date(NOW - daysAgo * 86400000).toISOString() });

test("learning does nothing on small samples", () => {
  const l = learn([trade("s", -100), trade("s", -100)], NOW);
  assert.equal(riskMultiplier(l, "s"), 1); assert.equal(l.ready, false);
});
test("learning cuts risk for a losing strategy and boosts a proven one, within bounds", () => {
  const bad = learn(Array.from({ length: 12 }, (_, i) => trade("s", i < 3 ? 50 : -80, "S" + i, 30)), NOW);
  assert.equal(riskMultiplier(bad, "s"), 0.5);
  const good = learn(Array.from({ length: 24 }, (_, i) => trade("s", i % 3 ? 120 : -60, "S" + i, 30)), NOW);
  assert.equal(riskMultiplier(good, "s"), 1.2);
  assert.equal(riskMultiplier(good, "other"), 1);
});
test("symbol cooldown after two straight losses, expires after five days", () => {
  assert.ok(learn([trade("s", -5, "ABC", 1), trade("s", -7, "ABC", 2)], NOW).cooldowns.ABC);
  assert.equal(learn([trade("s", -5, "ABC", 9), trade("s", -7, "ABC", 10)], NOW).cooldowns.ABC, undefined);
  assert.equal(learn([trade("s", 5, "ABC", 1), trade("s", -7, "ABC", 2)], NOW).cooldowns.ABC, undefined);
});

const bar = (day, hhmm, o, c) => ({ slot_ts: `${day}T${hhmm}:00+05:30`, open: o, close: c });
test("timing reports no reliable edge on noise and flags a consistent slot", () => {
  const noise = [], edge = [];
  for (let d = 0; d < 30; d++) {
    const day = new Date(Date.parse("2026-10-01T00:00:00Z") + d * 86400000).toISOString().slice(0, 10);
    noise.push(bar(day, "09:15", 100, 100 + (d % 2 ? 0.3 : -0.3)));
    edge.push(bar(day, "09:15", 100, 99.5 + (d % 5) * 0.01), bar(day, "14:45", 100, 100.6 + (d % 4) * 0.01), bar(day, "11:15", 100, 100 + (d % 2 ? 0.2 : -0.2)));
  }
  const n = bestTimes("N", noise, []);
  assert.equal(n.reliable, false); assert.match(n.note, /No reliable edge/);
  const e = bestTimes("E", edge, []);
  assert.equal(e.best_buy_slot.slot, "09:15"); assert.equal(e.best_sell_slot.slot, "14:45"); assert.equal(e.reliable, true);
  assert.equal(bestTimes("Z", [], []).reliable, false);
  const few = bestTimes("F", edge.slice(0, 6), []);
  assert.equal(few.best_buy_slot, null, "needs 20+ samples per slot");
});
test("weekday stats use daily closes", () => {
  const daily = Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.parse("2026-10-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10), close: 100 + i }));
  assert.ok(bestTimes("W", [], daily).weekdays.length > 0);
});
