import { pctText, tone, when, type Desk } from "./api";

export default function Insights({ desk }: { desk: Desk }) {
  const i = desk.insights;
  if (!i) return null;
  const strategies = Object.entries(i.learning.strategies), paused = Object.entries(i.learning.cooldowns);
  return <>
    <div className="gx-card"><div className="gx-h"><h2>Bot learning</h2><small>{i.learning.total_trades} closed trades</small></div>
      {strategies.length ? strategies.map(([n, s]) => <div className="gx-row" key={n}><div><strong>{n}</strong><small>{s.note}</small></div><div className="r">{s.win_rate_pct ?? "—"}% wins · risk ×{s.risk_multiplier}</div></div>) : <p className="gx-sub">No closed trades yet, so there is nothing to learn from.</p>}
      {paused.map(([sym, c]) => <div className="gx-note" key={sym}><span><b>{sym}</b> paused until {when(c.until)}. {c.reason}</span></div>)}
      <p className="gx-sub">{i.learning.rules}</p></div>
    <div className="gx-card"><div className="gx-h"><h2>Best time to buy / sell</h2></div>
      {i.timing.length ? i.timing.map((t) => <div className="gx-row" key={t.symbol}><div><strong>{t.symbol}</strong><small>{t.note}</small></div>
        <div className="r">{t.reliable ? <>Buy ~{t.best_buy_slot?.slot ?? "—"} · Sell ~{t.best_sell_slot?.slot ?? "—"}</> : "No reliable edge"}</div></div>)
        : <p className="gx-sub">Needs stored 30-minute history. It fills automatically once the live Indian feed is running.</p>}
      {i.timing.flatMap((t) => t.weekdays.map((w) => ({ ...w, s: t.symbol }))).slice(0, 5).map((w) => <div className="gx-row" key={w.s + w.weekday}><div><small>{w.s} · {w.weekday} ({w.samples} days)</small></div><div className={"r " + tone(w.avg_return_pct)}>{pctText(w.avg_return_pct, 3)}</div></div>)}
      <p className="gx-sub">{i.disclaimer}</p></div>
  </>;
}
