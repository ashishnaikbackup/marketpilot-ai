// Best time to buy / sell, from stored history. Descriptive statistics only, never a prediction.
// A slot is only called out when the sample is big enough AND the effect is statistically unusual
// after allowing for the many slots being compared. Otherwise the answer is "no reliable edge".

export const TIMING = { min_samples: 20, min_t: 2.5 };
const round = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
const stats = (xs) => {
  const n = xs.length; if (!n) return { n: 0, mean: null, t: null, win: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0, win: xs.filter((x) => x > 0).length / n };
};
// Wall-clock parts in the timestamp's own offset (Upstox sends +05:30), no timezone maths needed.
const slotOf = (ts) => /T(\d{2}:\d{2})/.exec(String(ts))?.[1] || null;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayOf = (day) => WD[new Date(day + "T00:00:00Z").getUTCDay()];

/** bars: [{slot_ts, open, close}] (30-minute). daily: [{day, close}] ascending. */
export function bestTimes(symbol, bars, daily) {
  const bySlot = new Map();
  for (const b of bars || []) {
    if (!(b.open > 0) || !(b.close > 0)) continue;
    const s = slotOf(b.slot_ts); if (!s) continue;
    (bySlot.get(s) || bySlot.set(s, []).get(s)).push((b.close / b.open - 1) * 100);
  }
  const slots = [...bySlot.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([slot, xs]) => { const s = stats(xs); return { slot, samples: s.n, avg_return_pct: round(s.mean, 3), up_share_pct: round(s.win * 100, 0), t_stat: round(s.t, 2) }; });
  const ok = (r) => r.samples >= TIMING.min_samples && Math.abs(r.t_stat) >= TIMING.min_t;
  const buy = slots.filter((r) => ok(r) && r.avg_return_pct < 0).sort((a, b) => a.avg_return_pct - b.avg_return_pct)[0] || null;
  const sell = slots.filter((r) => ok(r) && r.avg_return_pct > 0).sort((a, b) => b.avg_return_pct - a.avg_return_pct)[0] || null;
  const rets = new Map();
  for (let i = 1; i < (daily || []).length; i++) {
    const a = daily[i - 1].close, b = daily[i].close; if (!(a > 0) || !(b > 0)) continue;
    const w = weekdayOf(daily[i].day); (rets.get(w) || rets.set(w, []).get(w)).push((b / a - 1) * 100);
  }
  const weekdays = WD.slice(1, 6).filter((w) => rets.has(w)).map((w) => { const s = stats(rets.get(w)); return { weekday: w, samples: s.n, avg_return_pct: round(s.mean, 3), up_share_pct: round(s.win * 100, 0), t_stat: round(s.t, 2) }; });
  const reliable = Boolean(buy || sell);
  return {
    symbol, slots, weekdays, best_buy_slot: buy, best_sell_slot: sell, reliable,
    sample_bars: (bars || []).length,
    note: !(bars || []).length ? "No intraday history stored yet; it fills in automatically after the live feed starts."
      : reliable ? "Historical tendency only. Slots are 30-minute bars in exchange time. It can fade and is not a prediction."
      : "No reliable edge: differences between time slots are within normal noise for this sample, so the bot makes no timing suggestion.",
  };
}
