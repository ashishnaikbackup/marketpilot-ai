import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DecisionRow } from "./Home";
import { modeLabel, money, pctText, signed, tone, when, type Desk, type Position, type Report } from "./api";

function Acc({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  const [o, setO] = useState(open);
  return <div className="gx-acc"><button onClick={() => setO(!o)} aria-expanded={o}>{title}{o ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>{o && <div className="gx-acc-b">{children}</div>}</div>;
}
const KV = ({ k, v }: { k: string; v: ReactNode }) => <><span>{k}</span><b>{v}</b></>;

function OpenCard({ p, cur }: { p: Position; cur: string }) {
  const mult = p.quantity * p.lot_size, pnl = (p.last_price - p.entry_price) * mult, lo = p.stop_price, hi = p.target_price;
  const pos = Math.max(0, Math.min(1, (p.last_price - lo) / (hi - lo || 1))), entryPos = Math.max(0, Math.min(1, (p.entry_price - lo) / (hi - lo || 1)));
  return <div className="gx-card" style={{ padding: 16 }}>
    <div className="gx-row" style={{ border: 0, padding: 0 }}>
      <div><strong>{p.symbol}{p.option_type ? " " + p.option_type + " " + (p.strike ?? "") : ""}</strong><small>{p.exchange || p.asset_class} · {p.quantity * p.lot_size} units · bought {when(p.opened_at)}</small></div>
      <div className={"r " + tone(pnl)}>{signed(pnl, cur)}<small>{pctText(((p.last_price / p.entry_price) - 1) * 100)}</small></div>
    </div>
    <div className="gx-bar" style={{ ["--s" as string]: entryPos * 100 + "%" }}><span /><i style={{ left: `calc(${pos * 100}% - 1px)` }} /></div>
    <div className="gx-bar-l"><span>Stop {money(p.stop_price, cur, 2)}</span><span>Now {money(p.last_price, cur, 2)}</span><span>Target {money(p.target_price, cur, 2)}</span></div>
    {p.explanation && <p className="gx-sub" style={{ marginTop: 10 }}>Why: {p.explanation}</p>}
  </div>;
}

function ClosedRow({ p, cur }: { p: Position; cur: string }) {
  const [o, setO] = useState(false);
  return <div className="gx-card" style={{ padding: "6px 16px" }}>
    <button className="gx-row" style={{ width: "100%", background: "none", border: 0, textAlign: "left" }} onClick={() => setO(!o)}>
      <div><strong>{p.symbol}{p.option_type ? " " + p.option_type + " " + (p.strike ?? "") : ""}</strong><small>{(p.exit_reason || "").replace("_", " ").toLowerCase()} · {when(p.closed_at)}</small></div>
      <div className={"r " + tone(p.realized_pnl)}>{signed(p.realized_pnl, cur)}<small>after fees</small></div>
    </button>
    {o && <div className="gx-kv" style={{ paddingBottom: 12 }}>
      <KV k="Order" v={(p.order_type || "MARKET (simulated)") + " · BUY"} /><KV k="Entry → Exit" v={money(p.entry_price, cur, 2) + " → " + money(p.exit_price, cur, 2)} />
      <KV k="Quantity" v={p.quantity * p.lot_size} /><KV k="Stop / Target" v={money(p.stop_price, cur, 2) + " / " + money(p.target_price, cur, 2)} />
      <KV k="Risk at entry" v={money(p.risk_amount, cur)} /><KV k="Capital used" v={money(p.capital_allocated, cur)} />
      <KV k="Fees (in + out)" v={money((p.entry_fees || 0) + (p.exit_fees || 0), cur, 2)} /><KV k="Slippage assumed" v={p.slippage_bps ? p.slippage_bps + " bps" : "none (real bid/ask)"} />
      <KV k="Held" v={p.holding_days != null ? p.holding_days + " days" : "—"} /><KV k="Strategy" v={p.strategy || "—"} />
      <div style={{ gridColumn: "1 / -1" }}><span>Why it entered: </span>{p.explanation || p.thesis || "—"}</div>
    </div>}
  </div>;
}

export function ReportView({ r }: { r: Report }) {
  const b = r.report, cur = b.currency || (r.region === "INDIA" ? "INR" : "USD");
  if (r.status !== "completed") return <div className="gx-note err">Skipped: {b.reason || b.inactive_reason || "data was unavailable."} The bot did nothing.</div>;
  const pf = b.portfolio, risk = b.risk_exposure;
  return <>
    <div className="gx-note info"><span>{b.stance === "ACTIVE" ? "The bot traded in this run." : "No trade: " + (b.inactive_reason || "no setup passed the rules.")} Data: {modeLabel(b.data_mode)} from {b.source}.</span></div>
    <Acc title="1. Market overview" open>{b.market_overview?.indices.length ? b.market_overview.indices.map((i) => <div className="gx-row" key={i.symbol}><div><strong>{i.symbol}</strong><small>Trend: {(i.trend || "—").toLowerCase()}</small></div><div className={"r " + tone(i.change_pct)}>{pctText(i.change_pct)}</div></div>) : <p className="gx-sub">No index data in this run.</p>}
      {b.market_overview && <p className="gx-sub">Scanned {b.market_overview.breadth.scanned}: {b.market_overview.breadth.bullish} bullish, {b.market_overview.breadth.bearish} bearish, {b.market_overview.breadth.neutral} neutral.</p>}</Acc>
    <Acc title="2. Sector movements">{b.sector_moves?.length ? b.sector_moves.map((s) => <div className="gx-row" key={s.sector}><div><strong>{s.sector}</strong><small>{s.constituents} stocks</small></div><div className={"r " + tone(s.avg_change_pct)}>{pctText(s.avg_change_pct)}</div></div>) : <p className="gx-sub">No sector tags were supplied by the data source.</p>}</Acc>
    <Acc title="3. Stock movers">{[...(b.top_gainers || []), ...(b.top_losers || [])].length ? [...(b.top_gainers || []), ...(b.top_losers || [])].map((m) => <div className="gx-row" key={m.symbol}><div><strong>{m.symbol}</strong></div><div className={"r " + tone(m.change_pct)}>{pctText(m.change_pct)}</div></div>) : <p className="gx-sub">No movers.</p>}</Acc>
    <Acc title="4. F&O analysis">{b.fo_summary?.by_underlying.length ? b.fo_summary.by_underlying.map((u) => <div key={u.underlying}><strong>{u.underlying}</strong><div className="gx-kv"><KV k="Contracts seen / usable" v={u.contracts + " / " + u.eligible_contracts} /><KV k="Call OI / Put OI" v={u.call_open_interest + " / " + u.put_open_interest} /><KV k="PCR (OI)" v={u.pcr_oi ?? "—"} /><KV k="Average IV" v={u.mean_iv_pct != null ? u.mean_iv_pct + "%" : "—"} /></div></div>) : <p className="gx-sub">{b.fo_summary?.options_disabled_reason || "No option contracts were supplied. F&O analysis needs a licensed live options feed, which is not connected."}</p>}</Acc>
    <Acc title="5. Decisions" open>{b.decisions?.length ? b.decisions.map((d, i) => <DecisionRow key={i} d={d} cur={cur} />) : <p className="gx-sub">No positions to manage and no setups.</p>}</Acc>
    <Acc title="6. Trades skipped and why">{b.trades_skipped?.length ? b.trades_skipped.map((s, i) => <div className="gx-row" key={i}><div><strong>{s.symbol}</strong><small>{s.reason}</small></div></div>) : <p className="gx-sub">Nothing was skipped.</p>}</Acc>
    <Acc title="7. Open positions">{b.open_positions?.length ? b.open_positions.map((o, i) => <div className="gx-row" key={i}><div><strong>{o.symbol}</strong><small>{o.stale ? "No fresh price. Value not updated." : "Entry " + money(o.entry, cur, 2) + " · now " + money(o.mark, cur, 2)}</small></div><div className={"r " + tone(o.unrealized)}>{signed(o.unrealized, cur)}</div></div>) : <p className="gx-sub">None.</p>}</Acc>
    <Acc title="8. Portfolio and P&L">{pf ? <div className="gx-kv"><KV k="Equity" v={money(pf.equity, cur)} /><KV k="Cash" v={money(pf.cash, cur)} /><KV k="Invested" v={money(pf.invested, cur)} /><KV k="P&L this run (realised)" v={signed(pf.realized_this_run, cur)} /><KV k="Total P&L" v={signed(pf.total_pnl, cur) + " (" + pctText(pf.total_return_pct) + ")"} /></div> : null}</Acc>
    <Acc title="9. Risk">{risk ? <div className="gx-kv"><KV k="Exposure" v={risk.gross_exposure_pct + "% of " + risk.max_gross_exposure_pct + "% limit"} /><KV k="Positions" v={risk.open_positions + " of " + risk.max_positions} /><KV k="Loss if every stop hit" v={money(risk.capital_at_risk_to_stops, cur)} /><KV k="Prices out of date" v={risk.stale_marks} /></div> : null}</Acc>
    <Acc title="10. Strategy performance">{b.strategy_performance?.length ? b.strategy_performance.map((s) => <div className="gx-row" key={s.strategy}><div><strong>{s.strategy}</strong><small>{s.trades} trades · win rate {s.win_rate_pct ?? "—"}%</small></div><div className={"r " + tone(s.net_pnl)}>{signed(s.net_pnl, cur)}</div></div>) : <p className="gx-sub">No closed trades yet.</p>}</Acc>
    <Acc title="11. Next-session watchlist">{b.next_session_watchlist?.length ? b.next_session_watchlist.map((w) => <div className="gx-row" key={w.symbol}><div><strong>{w.symbol}</strong><small>{w.note}</small></div><div className="r"><span className={"gx-badge " + (w.bias === "BULLISH" ? "buy" : "sell")}>{w.bias}</span></div></div>) : <p className="gx-sub">Nothing to watch.</p>}</Acc>
    <Acc title="Assumptions and limits">{b.assumptions && <p className="gx-sub">Brokerage {money(b.assumptions.brokerage_per_order, cur)} per order. Slippage {b.assumptions.equity_slippage_bps_if_no_bid_ask} bps on stocks and {b.assumptions.option_slippage_bps_if_no_bid_ask} bps on options when no bid/ask exists. Not modelled: {b.assumptions.not_modelled.join(", ")}.</p>}{(b.notes || []).map((n, i) => <p className="gx-sub" key={i}>• {n}</p>)}</Acc>
  </>;
}

export default function Trader({ desk }: { desk: Desk }) {
  const [tab, setTab] = useState<"open" | "closed" | "reports">("open");
  const [sel, setSel] = useState<string | null>(null);
  const cur = desk.region === "INDIA" ? "INR" : "USD", open = desk.positions.filter((p) => p.status === "OPEN"), closed = desk.positions.filter((p) => p.status === "CLOSED");
  const chosen = desk.reports.find((r) => r.id === sel);
  const st = desk.portfolio?.stats;
  return <>
    <div className="gx-seg">{(["open", "closed", "reports"] as const).map((t) => <button key={t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); setSel(null); }}>{t === "open" ? "Open (" + open.length + ")" : t === "closed" ? "History (" + closed.length + ")" : "Daily reports"}</button>)}</div>
    {tab === "open" && (open.length ? open.map((p) => <OpenCard key={p.id} p={p} cur={cur} />) : <div className="gx-card gx-empty"><strong>No open trades</strong><p>The bot only trades when its rules line up. Staying in cash is a valid decision.</p></div>)}
    {tab === "closed" && <>
      {st && st.closed_trades > 0 && <div className="gx-card"><div className="gx-tiles">
        <div className="gx-tile"><span>Net P&L</span><strong className={tone(st.net_realized_pnl)}>{signed(st.net_realized_pnl, cur)}</strong></div>
        <div className="gx-tile"><span>Win rate</span><strong>{st.win_rate_pct}%</strong></div>
        <div className="gx-tile"><span>Profit factor</span><strong>{st.profit_factor ?? "—"}</strong></div>
        <div className="gx-tile"><span>Max drawdown</span><strong>{st.max_drawdown_pct}%</strong></div></div>
        <p className="gx-sub" style={{ marginTop: 10 }}>Based on {st.closed_trades} closed trades. Too few trades to judge the strategy. Treat these as a log, not proof.</p></div>}
      {closed.length ? closed.map((p) => <ClosedRow key={p.id} p={p} cur={cur} />) : <div className="gx-card gx-empty"><strong>No closed trades yet</strong><p>Finished trades appear here with the full record: entry, exit, fees, reason.</p></div>}
    </>}
    {tab === "reports" && (chosen ? <>
      <button className="gx-btn plain" style={{ marginBottom: 12 }} onClick={() => setSel(null)}>← All reports</button>
      <div className="gx-h"><h2>{when(chosen.completed_at)}</h2><small>{chosen.trigger.replace("_", " ")}</small></div><ReportView r={chosen} /></>
      : desk.reports.length ? <div className="gx-card" style={{ padding: "6px 16px" }}>{desk.reports.map((r) => <button key={r.id} className="gx-row" style={{ width: "100%", background: "none", border: 0, textAlign: "left" }} onClick={() => setSel(r.id)}>
        <div><strong>{when(r.completed_at)}</strong><small>{r.status === "completed" ? r.opened + " bought · " + r.closed + " sold · " + modeLabel(r.data_mode) : "Skipped (no data)"}</small></div>
        <div className={"r " + tone(r.realized_pnl)}>{r.status === "completed" ? signed(r.realized_pnl, cur) : "—"}</div></button>)}</div>
        : <div className="gx-card gx-empty"><strong>No reports yet</strong><p>A report is written after every bot run, including days when it chose not to trade.</p></div>)}
  </>;
}
