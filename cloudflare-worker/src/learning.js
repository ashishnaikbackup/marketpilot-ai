// Bot learning from the bot's own closed paper trades. Pure and deterministic.
// It can only make the bot MORE cautious or modestly bolder inside the hard limits in engine.js
// (risk cap, notional cap, exposure cap are never raised). Small samples change nothing.

export const LEARNING = { min_trades: 10, boost_trades: 20, cooldown_losses: 2, cooldown_days: 5, min_mult: 0.5, max_mult: 1.2 };
const round = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);

/** @param {{strategy?:string,symbol?:string,net_pnl:number,closed_at?:string}[]} trades */
export function learn(trades, nowMs = Date.now()) {
  const byStrategy = new Map(), bySymbol = new Map();
  for (const t of trades || []) {
    if (!Number.isFinite(t?.net_pnl)) continue;
    const k = t.strategy || "unknown";
    const g = byStrategy.get(k) || { n: 0, wins: 0, net: 0, gw: 0, gl: 0 };
    g.n++; g.net += t.net_pnl; if (t.net_pnl > 0) { g.wins++; g.gw += t.net_pnl; } else g.gl -= t.net_pnl;
    byStrategy.set(k, g);
    if (t.symbol) { const arr = bySymbol.get(t.symbol) || []; arr.push(t); bySymbol.set(t.symbol, arr); }
  }
  const strategies = {};
  for (const [name, g] of byStrategy) {
    const win = g.n ? (g.wins / g.n) * 100 : null, avg = g.n ? g.net / g.n : null;
    let mult = 1, note = `Only ${g.n} closed trade(s); the bot needs ${LEARNING.min_trades} before it changes anything.`;
    if (g.n >= LEARNING.min_trades) {
      if (avg < 0 && win < 40) { mult = LEARNING.min_mult; note = "Losing with a low win rate: position risk cut to half."; }
      else if (avg < 0) { mult = 0.75; note = "Net negative so far: position risk reduced by a quarter."; }
      else if (avg > 0 && win >= 50 && g.n >= LEARNING.boost_trades) { mult = LEARNING.max_mult; note = "Profitable over 20+ trades: risk nudged up 20%, still inside every hard limit."; }
      else note = "Results are mixed or the sample is still small: no change.";
    }
    strategies[name] = { trades: g.n, win_rate_pct: round(win, 1), avg_net_pnl: round(avg), net_pnl: round(g.net), profit_factor: g.gl > 0 ? round(g.gw / g.gl) : null, risk_multiplier: mult, note };
  }
  const cooldowns = {};
  for (const [sym, arr] of bySymbol) {
    const recent = arr.filter((t) => t.closed_at).sort((a, b) => Date.parse(b.closed_at) - Date.parse(a.closed_at)).slice(0, LEARNING.cooldown_losses);
    if (recent.length === LEARNING.cooldown_losses && recent.every((t) => t.net_pnl < 0)) {
      const until = Date.parse(recent[0].closed_at) + LEARNING.cooldown_days * 86400000;
      if (until > nowMs) cooldowns[sym] = { until: new Date(until).toISOString(), reason: `Last ${LEARNING.cooldown_losses} trades in ${sym} lost money; resting it for ${LEARNING.cooldown_days} days.` };
    }
  }
  return { strategies, cooldowns, total_trades: (trades || []).length, ready: Object.values(strategies).some((s) => s.trades >= LEARNING.min_trades), rules: "Learning only adjusts position risk between 0.5x and 1.2x and pauses a symbol after repeated losses. Hard risk limits never move." };
}

export const riskMultiplier = (learning, strategy) => learning?.strategies?.[strategy]?.risk_multiplier ?? 1;
