import { modeLabel, pctText, tone, when, type Desk } from "./api";

export default function Markets({ desk }: { desk: Desk }) {
  const latest = desk.reports.find((r) => r.status === "completed"), b = latest?.report;
  if (!b) return <div className="gx-card gx-empty"><strong>No market data yet</strong><p>Markets show what the bot saw in its last run. Nothing is invented. {desk.status?.provider && !desk.status.provider.configured ? desk.status.provider.message : "Data appears after the first completed run."}</p></div>;
  const idx = b.market_overview?.indices || [], br = b.market_overview?.breadth;
  return <>
    <div className="gx-note info"><span>As of {when(latest!.observed_at)} · <b>{modeLabel(b.data_mode)}</b> data from {b.source}. {b.data_mode === "eod" ? "These are closing prices, not live quotes." : ""}</span></div>
    {idx.length > 0 && <div className="gx-card"><div className="gx-h"><h2>Indices</h2></div><div className="gx-tiles">{idx.map((i) => <div className="gx-tile" key={i.symbol}><span>{i.symbol}</span><strong className={tone(i.change_pct)}>{pctText(i.change_pct)}</strong></div>)}</div></div>}
    {br && <div className="gx-card"><div className="gx-h"><h2>Market mood</h2><small>{br.scanned} stocks scanned</small></div>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: "#eef1f4" }}><i style={{ width: (br.bullish / br.scanned) * 100 + "%", background: "#00a37a" }} /><i style={{ width: (br.neutral / br.scanned) * 100 + "%", background: "#cbd2d9" }} /><i style={{ width: (br.bearish / br.scanned) * 100 + "%", background: "#e5484d" }} /></div>
      <div className="gx-bar-l" style={{ marginTop: 6 }}><span>{br.bullish} rising trend</span><span>{br.neutral} sideways</span><span>{br.bearish} falling trend</span></div></div>}
    <div className="gx-grid2">
      <div className="gx-card"><div className="gx-h"><h2>Top gainers</h2></div>{(b.top_gainers || []).length ? b.top_gainers!.map((m) => <div className="gx-row" key={m.symbol}><div><strong>{m.symbol}</strong></div><div className="r up">{pctText(m.change_pct)}</div></div>) : <p className="gx-sub">None.</p>}</div>
      <div className="gx-card"><div className="gx-h"><h2>Top losers</h2></div>{(b.top_losers || []).length ? b.top_losers!.map((m) => <div className="gx-row" key={m.symbol}><div><strong>{m.symbol}</strong></div><div className="r down">{pctText(m.change_pct)}</div></div>) : <p className="gx-sub">None.</p>}</div>
    </div>
    {(b.sector_moves || []).length > 0 && <div className="gx-card"><div className="gx-h"><h2>Sectors</h2></div>{b.sector_moves!.map((s) => <div className="gx-row" key={s.sector}><div><strong>{s.sector}</strong></div><div className={"r " + tone(s.avg_change_pct)}>{pctText(s.avg_change_pct)}</div></div>)}</div>}
    <div className="gx-card"><div className="gx-h"><h2>Options (F&O)</h2></div>
      {b.fo_summary?.by_underlying.length ? b.fo_summary.by_underlying.map((u) => <div className="gx-row" key={u.underlying}><div><strong>{u.underlying}</strong><small>Put/call ratio {u.pcr_oi ?? "—"} · average IV {u.mean_iv_pct ?? "—"}%</small></div><div className="r">{u.contracts} contracts</div></div>)
        : <p className="gx-sub">{b.fo_summary?.options_disabled_reason || "Options analysis needs a licensed live option-chain feed (NSE data vendor). None is connected, so nothing is shown rather than guessing."}</p>}</div>
  </>;
}
