import { useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, ShieldAlert, Trash2 } from "lucide-react";

type Trade = { id: string; instrument: string; strategy: string; direction: string; entry: number; quantity: number; stop: number; target: number; status: "OPEN" | "CLOSED"; exit?: number; created: string };
const KEY = "marketpilot-paper-journal-v1";
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export default function PaperPortfolio() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [instrument, setInstrument] = useState("NIFTY");
  const [strategy, setStrategy] = useState("Observation / directional thesis");
  const [direction, setDirection] = useState("LONG");
  const [entry, setEntry] = useState("100");
  const [quantity, setQuantity] = useState("1");
  const [stop, setStop] = useState("95");
  const [target, setTarget] = useState("110");
  const [exitPrice, setExitPrice] = useState<Record<string,string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { try { const raw=localStorage.getItem(KEY); if(raw) setTrades(JSON.parse(raw) as Trade[]); } catch { /* ignore invalid local journal */ } setLoaded(true); }, []);
  useEffect(() => { if(loaded) localStorage.setItem(KEY, JSON.stringify(trades)); }, [trades, loaded]);
  const closedPnl = useMemo(() => trades.filter(t=>t.status==="CLOSED" && t.exit!==undefined).reduce((sum,t)=>sum+(t.exit!-t.entry)*t.quantity*(t.direction==="LONG"?1:-1),0),[trades]);
  const openCount = trades.filter(t=>t.status==="OPEN").length;

  function addTrade() {
    const e=Number(entry), q=Number(quantity), s=Number(stop), t=Number(target);
    if(!Number.isFinite(e)||!Number.isFinite(q)||!Number.isFinite(s)||!Number.isFinite(t)||e<=0||q<=0||s<=0||t<=0) return;
    setTrades(prev=>[{id:crypto.randomUUID(),instrument,strategy,direction,entry:e,quantity:q,stop:s,target:t,status:"OPEN",created:new Date().toISOString()},...prev]);
  }
  function closeTrade(id:string) {
    const price=Number(exitPrice[id]); if(!Number.isFinite(price)||price<=0) return;
    setTrades(prev=>prev.map(t=>t.id===id?{...t,status:"CLOSED",exit:price}:t));
  }
  return <div className="page-stack">
    <div className="notice"><ShieldAlert size={17}/><div><strong>Paper only · no broker connection</strong><span>This journal stores hypothetical trades in this browser only. It never places orders or uses real money. Clear browser storage and the journal may be lost.</span></div><span className="notice-tag">SIMULATED</span></div>
    <section className="portfolio-stats"><article><span>Open paper positions</span><strong>{openCount}</strong></article><article><span>Closed paper P&amp;L</span><strong className={closedPnl>=0?"positive":"negative"}>{money(closedPnl)}</strong></article><article><span>Total journal entries</span><strong>{trades.length}</strong></article></section>
    <section className="panel"><div className="panel-title"><div><h3>Log a hypothetical trade</h3><p>Record an idea for learning and review — not a recommendation</p></div><Plus size={18} className="muted-icon"/></div>
      <div className="calculator-fields paper-fields">
        <label>Instrument<select value={instrument} onChange={e=>setInstrument(e.target.value)}><option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option><option>Other</option></select></label>
        <label>Direction<select value={direction} onChange={e=>setDirection(e.target.value)}><option value="LONG">Long</option><option value="SHORT">Short</option></select></label>
        <label>Entry assumption<input type="number" min="0" value={entry} onChange={e=>setEntry(e.target.value)}/></label>
        <label>Quantity / units<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
        <label>Invalidation / stop<input type="number" min="0" value={stop} onChange={e=>setStop(e.target.value)}/></label>
        <label>Target assumption<input type="number" min="0" value={target} onChange={e=>setTarget(e.target.value)}/></label>
        <label className="span-two">Thesis / strategy<input value={strategy} onChange={e=>setStrategy(e.target.value)}/></label>
      </div><button className="primary-button" onClick={addTrade}>Add to paper journal</button>
    </section>
    <section className="panel"><div className="panel-title"><div><h3>Trade journal</h3><p>Enter an exit price to close and record hypothetical P&amp;L</p></div><BookOpen size={18} className="muted-icon"/></div>
      {trades.length===0?<div className="empty-state"><div className="empty-icon"><BookOpen size={21}/></div><strong>No paper trades yet</strong><span>Start by recording a thesis. Review the outcome instead of risking capital.</span></div>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Instrument / thesis</th><th>Side</th><th>Entry</th><th>Stop</th><th>Target</th><th>Status / result</th><th></th></tr></thead><tbody>{trades.map(t=><tr key={t.id}><td><strong>{t.instrument}</strong><small>{t.strategy}</small></td><td>{t.direction}</td><td>{money(t.entry)}</td><td>{money(t.stop)}</td><td>{money(t.target)}</td><td>{t.status==="OPEN"?<div className="close-control"><input aria-label="Exit price" type="number" min="0" placeholder="Exit" value={exitPrice[t.id]??""} onChange={e=>setExitPrice(p=>({...p,[t.id]:e.target.value}))}/><button className="small-button" onClick={()=>closeTrade(t.id)}>Close</button></div>:<strong className={(t.exit!-t.entry)*(t.direction==="LONG"?1:-1)>=0?"positive":"negative"}>{money((t.exit!-t.entry)*t.quantity*(t.direction==="LONG"?1:-1))}</strong>}</td><td><button className="icon-button" title="Delete journal entry" onClick={()=>setTrades(p=>p.filter(x=>x.id!==t.id))}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
