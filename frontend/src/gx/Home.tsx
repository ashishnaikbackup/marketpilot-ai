import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bot, Moon } from "lucide-react";
import { EquityChart } from "./Chart";
import { modeLabel, money, pctText, signed, tone, when, type Desk, type Decision } from "./api";

export function DecisionRow({ d, cur }: { d: Decision; cur: string }) {
  const buy = d.action === "PAPER_BUY", close = d.action === "CLOSE";
  const label = d.symbol + (d.option_type ? " " + d.option_type + " " + (d.strike ?? "") : "");
  return <div className="gx-row">
    <div><strong>{label}</strong><small>{buy ? (d.explanation || d.reason) : close ? "Closed: " + d.reason.replace("_", " ").toLowerCase() : d.reason}</small></div>
    <div className="r">{buy ? <><span className="gx-badge buy">BOUGHT</span><small>{money(d.entry, cur, 2)} × {(d.quantity ?? 1) * (d.lot_size ?? 1)}</small></> : close ? <><span className={"gx-badge sell"}>SOLD</span><small className={tone(d.pnl)}>{signed(d.pnl, cur)}</small></> : <span className="gx-badge hold">HOLD</span>}</div>
  </div>;
}

export default function Home({ desk, go }: { desk: Desk; go: (t: "trader" | "markets" | "ask" | "more") => void }) {
  const { portfolio: p, reports, equity, status } = desk, cur = p?.currency || (desk.region === "INDIA" ? "INR" : "USD");
  const latest = reports.find((r) => r.status === "completed"), rep = latest?.report;
  const acted = (rep?.decisions || []).filter((d) => d.action === "PAPER_BUY" || d.action === "CLOSE");
  const pctRet = p && p.starting_capital ? (p.total_pnl / p.starting_capital) * 100 : 0;
  const provider = status?.provider;
  return <>
    <div className="gx-card gx-hero">
      <small>Paper portfolio · simulated money</small>
      {p ? <>
        <div className="gx-big">{money(p.equity, cur)}</div>
        <div className={"gx-pl " + tone(p.total_pnl)}>{p.total_pnl > 0 ? <ArrowUpRight size={15} style={{ verticalAlign: -2 }} /> : p.total_pnl < 0 ? <ArrowDownRight size={15} style={{ verticalAlign: -2 }} /> : null} {signed(p.total_pnl, cur)} ({pctText(pctRet)}) <span className="gx-sub" style={{ fontWeight: 500 }}>all time</span></div>
        <div style={{ margin: "10px -4px 6px" }}><EquityChart points={equity} up={p.total_pnl >= 0} /></div>
        <div className="gx-tiles">
          <div className="gx-tile"><span>Cash available</span><strong>{money(p.cash, cur)}</strong></div>
          <div className="gx-tile"><span>Invested</span><strong>{money(p.latest_snapshot?.exposure ?? 0, cur)}</strong></div>
          <div className="gx-tile"><span>Open trades</span><strong>{p.latest_snapshot?.open_positions ?? 0}</strong></div>
          <div className="gx-tile"><span>Win rate</span><strong>{p.stats.win_rate_pct === null ? "—" : p.stats.win_rate_pct + "%"}</strong></div>
        </div>
      </> : <div className="gx-empty"><strong>{desk.loading ? "Loading…" : "No portfolio data yet"}</strong><p>{desk.error || "Connect your API in More → Connection to see your virtual portfolio."}</p></div>}
    </div>

    <div className="gx-card">
      <div className="gx-h"><h2>Bot update</h2>{latest && <small>{when(latest.completed_at)} · {modeLabel(latest.data_mode)}</small>}</div>
      {!latest ? <div className="gx-empty"><strong>The bot has not run yet</strong><p>{provider && !provider.configured ? provider.message : "It runs once a day after the market closes. Reports appear here automatically."}</p></div>
        : acted.length ? acted.map((d, i) => <DecisionRow key={i} d={d} cur={cur} />)
        : <div className="gx-row"><Moon size={22} color="#6b7280" /><div><strong>Sat out today. No trade.</strong><small>{rep?.inactive_reason || rep?.reason || "No setup met the rules. Doing nothing is a valid decision."}</small></div></div>}
      {latest && <button className="gx-btn ghost" style={{ marginTop: 10 }} onClick={() => go("trader")}>See full report</button>}
    </div>

    <div className="gx-card">
      <div className="gx-h"><h2>Data status</h2><span className={"gx-chip " + (provider?.configured ? (provider.data_mode === "live" ? "ok" : "warn") : "bad")}><i className="gx-dot" />{provider?.configured ? modeLabel(provider.data_mode) : "Not connected"}</span></div>
      <p className="gx-p">{provider?.message || "Connect to the API to see which market-data source is active."}</p>
      {provider?.configured && provider.data_mode === "eod" && <div className="gx-note"><AlertTriangle size={16} /><span>This data is end-of-day, not live. The bot only trades once per day and never uses end-of-day closes as live prices.</span></div>}
    </div>

    <div className="gx-card" style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Bot size={26} color="#00b386" /><div style={{ flex: 1 }}><strong>Ask about your bot</strong><div className="gx-sub">“Why did you buy that?” “How am I doing?”</div></div><button className="gx-btn ghost" onClick={() => go("ask")}>Ask</button>
    </div>
  </>;
}
