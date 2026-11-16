import { pctText, tone, when, type Desk } from "./api";

const short = (n: number | null | undefined) => (typeof n === "number" ? (Math.abs(n) >= 1e5 ? (n / 1e5).toFixed(1) + "L" : n.toLocaleString("en-IN")) : "—");

export default function Insights({ desk }: { desk: Desk }) {
  const i = desk.insights, fo = desk.foEod, news = desk.news?.[desk.region] || [];
  const foBlock = desk.region === "INDIA" && fo ? <div className="gx-card"><div className="gx-h"><h2>F&O open interest (end of day)</h2><small>NSE file for {fo.trade_date || fo.file_date}</small></div>
    {fo.underlyings.slice(0, 12).map((u) => <div className="gx-row" key={u.underlying}><div><strong>{u.underlying}</strong><small>Expiry {u.expiry} · put/call {u.pcr_oi ?? "—"} · support {u.support_strike ?? "—"} · resistance {u.resistance_strike ?? "—"} · max pain {u.max_pain ?? "—"}</small></div>
      <div className="r"><small>Call OI {short(u.call_open_interest)} ({u.change_in_call_oi >= 0 ? "+" : ""}{short(u.change_in_call_oi)})<br />Put OI {short(u.put_open_interest)} ({u.change_in_put_oi >= 0 ? "+" : ""}{short(u.change_in_put_oi)})</small></div></div>)}
    <p className="gx-sub">{fo.source}. Official end-of-day data, not live. Open interest levels are context, not predictions.</p></div> : null;
  const newsBlock = news.length ? <div className="gx-card"><div className="gx-h"><h2>Headlines</h2><small>{desk.news ? when(desk.news.fetched_at) : ""}</small></div>
    {news.slice(0, 8).map((n) => <div className="gx-row" key={n.link}><div><a href={n.link} target="_blank" rel="noreferrer noopener"><strong>{n.title}</strong></a><small>{n.source || "News"}{n.published ? " · " + when(n.published) : ""}</small></div></div>)}
    <p className="gx-sub">Headlines only, from Google News. Not analysed and not used by the bot.</p></div> : null;
  if (!i) return <>{foBlock}{newsBlock}</>;
  const strategies = Object.entries(i.learning.strategies), paused = Object.entries(i.learning.cooldowns);
  return <>
    {foBlock}
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
    {newsBlock}
  </>;
}
