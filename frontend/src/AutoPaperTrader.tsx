import { useCallback, useEffect, useState } from "react";
import { Activity, Bot, Clock3, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
type Status={configured:boolean;feed_configured:boolean;mode:string;strategy_version:string;schedule_utc:string[];message:string};
type Position={id:string;region:string;symbol:string;asset_class:string;option_type?:string;strike?:number;quantity:number;lot_size:number;entry_price:number;last_price:number;stop_price:number;target_price:number;status:string;last_observed_at:string;};
type Decision={symbol:string;action:string;reason:string;entry?:number;pnl?:number;asset_class?:string;option_type?:string;strike?:number;expiry?:string;quantity?:number;lot_size?:number};
type Report={id:string;region:string;completed_at:string;status:string;scanned:number;opened:number;closed:number;realized_pnl:number;report:{decisions?:Decision[]};};
const KEY="marketpilot-paperbot-api-v1";
const money=(n:number,c:string)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:c,maximumFractionDigits:2}).format(n);
export default function AutoPaperTrader(){
 const [api,setApi]=useState(()=>localStorage.getItem(KEY)||"");
 const [readToken,setReadToken]=useState(()=>sessionStorage.getItem(KEY+"-read-token")||"");
 const [draft,setDraft]=useState(api),[status,setStatus]=useState<Status|null>(null),[positions,setPositions]=useState<Position[]>([]),[reports,setReports]=useState<Report[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[updated,setUpdated]=useState("");
 const refresh=useCallback(async()=>{
  const base=api.trim().replace(/\/+$/,"");if(!base){setError("Add your deployed Cloudflare Worker API URL.");return;}
  setLoading(true);setError("");
  try{
   const results=await Promise.all([fetch(base+"/api/v1/paper-bot/status",{cache:"no-store"}),fetch(base+"/api/v1/paper-bot/positions",{cache:"no-store",headers:readToken?{Authorization:"Bearer "+readToken}:{}}),fetch(base+"/api/v1/paper-bot/reports",{cache:"no-store",headers:readToken?{Authorization:"Bearer "+readToken}:{}})]);
   const s=await results[0].json();if(!results[0].ok)throw new Error(s.detail||"Unable to read status.");setStatus(s);
   if(results[1].ok)setPositions((await results[1].json()).positions||[]);else setPositions([]);
   if(results[2].ok)setReports((await results[2].json()).reports||[]);else setReports([]);
   setUpdated(new Date().toLocaleString());if(!results[1].ok||!results[2].ok)setError(results[1].status===401||results[2].status===401?"Paper bot read token is missing or incorrect.":"Worker is reachable, but D1 storage is not ready or the read token is not configured.");
  }catch(e){setStatus(null);setPositions([]);setReports([]);setError(e instanceof Error?e.message:"Could not connect to API.");}
  finally{setLoading(false);}
 },[api,readToken]);
 useEffect(()=>{if(api)void refresh();},[api,refresh]);
 const open=positions.filter(p=>p.status==="OPEN"),latest=reports[0],decisions=latest?.report?.decisions||[],buys=decisions.filter(d=>d.action==="PAPER_BUY"),exits=decisions.filter(d=>d.action==="CLOSE");
 const schedule=status?.schedule_utc||["10:20 UTC weekdays — India closing scan","22:30 UTC weekdays — global closing scan"];
 return <div className="page-stack">
  <div className="notice"><ShieldCheck size={17}/><div><strong>Autonomous paper trader · virtual money only</strong><span>It scans, simulates entries/exits and writes reports. It never connects to a broker or places real orders. Live operation requires a licensed data adapter and Cloudflare D1.</span></div><span className="notice-tag">PAPER ONLY</span></div>
  <section className="panel paperbot-connect"><div className="panel-title"><div><h3>Connect the paper-trading service</h3><p>Cloudflare Worker URL and your separate paper-bot read token. Never enter broker passwords or provider API keys here.</p></div><Bot size={19} className="muted-icon"/></div>
   <div className="scanner-form"><label>MarketPilot API base URL<input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="https://marketpilot-api.your-subdomain.workers.dev"/></label><label>Paper bot read token<input type="password" value={readToken} onChange={e=>{setReadToken(e.target.value);sessionStorage.setItem(KEY+"-read-token",e.target.value);}} placeholder="Worker BOT_READ_TOKEN secret"/></label><button className="primary-button" onClick={()=>{const v=draft.trim().replace(/\/+$/,"");setApi(v);localStorage.setItem(KEY,v);}} disabled={!draft.trim()}>Save & connect</button><button className="outline-button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={14}/> {loading?"Checking…":"Refresh"}</button></div>
   {error&&<p className="error-text">{error}</p>}{updated&&<p className="disclaimer-small">Last checked: {updated}</p>}<p className="disclaimer-small">The read token is a private app-access secret, not a broker credential. It is stored in this browser profile; do not share it or use a public/shared device.</p>
  </section>
  <section className="paperbot-status-grid">
   <article className="panel"><span>Database</span><strong>{status?.configured?"Connected":"Not configured"}</strong><small>Persistent virtual positions and reports</small></article>
   <article className="panel"><span>Market data</span><strong>{status?.feed_configured?"Adapter configured":"No provider"}</strong><small>Fresh, licensed feed required</small></article>
   <article className="panel"><span>Mode</span><strong>Paper only</strong><small>Rule set {status?.strategy_version||"trend-options-v1"}</small></article>
   <article className="panel"><span>Open positions</span><strong>{open.length}</strong><small>India and global virtual books</small></article>
  </section>
  <section className="panel"><div className="panel-title"><div><h3>How the bot thinks</h3><p>Repeatable process, not impulsive trades</p></div><Activity size={18} className="muted-icon"/></div>
   <div className="paperbot-flow"><article><b>01 · Scan</b><span>India/global equities, ETFs and supported option contracts in the provider's configured universe.</span></article><article><b>02 · Verify</b><span>Check source, timestamp, quote freshness, bid/ask, expiry, liquidity and option Greeks.</span></article><article><b>03 · Decide</b><span>Trend, RSI and momentum rules. CE for bullish and PE for bearish underlying trends. Otherwise NO TRADE.</span></article><article><b>04 · Simulate</b><span>Virtual position sizing, stops, targets, mark-to-market and realised P&amp;L.</span></article><article><b>05 · Explain</b><span>Every buy, hold, exit and rejection records its reason and source timestamp.</span></article></div>
  </section>
  <section className="panel"><div className="panel-title"><div><h3>Scheduled reports</h3><p>India and global end-of-day windows · UTC</p></div><Clock3 size={18} className="muted-icon"/></div>
   {schedule.map(x=><div className="report-row" key={x}><div className="report-icon"><Clock3 size={15}/></div><div><strong>{x}</strong><span>Runs only when D1 and the normalized data adapter are configured.</span></div><b className="pill muted">SCHEDULED</b></div>)}
   <p className="disclaimer-small">These are report windows, not guaranteed data availability. Holidays, provider outages, DST and market-specific closes must be handled by the feed adapter.</p>
  </section>
  <section className="panel"><div className="panel-title"><div><h3>Latest bot activity</h3><p>{latest?latest.region+" · "+new Date(latest.completed_at).toLocaleString()+" · "+latest.status:"No bot run has been recorded yet."}</p></div><Bot size={18} className="muted-icon"/></div>
   {latest?<><div className="portfolio-stats"><article><span>Scanned</span><strong>{latest.scanned}</strong></article><article><span>New entries</span><strong>{latest.opened}</strong></article><article><span>Closed</span><strong>{latest.closed}</strong></article><article><span>Realised P&amp;L</span><strong className={latest.realized_pnl>=0?"positive":"negative"}>{money(latest.realized_pnl,latest.region==="INDIA"?"INR":"USD")}</strong></article></div>
    <h4 className="paperbot-subhead">What the bot bought</h4>
    {buys.length?buys.map((d,i)=><div className="bot-decision" key={i}><div><strong>{d.symbol}</strong><span>{(d.asset_class||"PAPER")+(d.option_type?" · "+d.option_type+" "+(d.strike||"")+" · "+(d.expiry||""):"")+" · "+(d.quantity||1)+" units"}</span><small>{d.reason}</small></div><b>{d.entry===undefined?"—":d.entry}</b></div>):<div className="empty-state"><strong>No purchases in this run</strong><span>No qualifying setup is a valid decision. Staying in cash is allowed.</span></div>}
    {exits.length>0&&<><h4 className="paperbot-subhead">Exits</h4>{exits.map((d,i)=><div className="bot-decision" key={i}><div><strong>{d.symbol}</strong><span>{d.reason}</span></div><b className={(d.pnl||0)>=0?"positive":"negative"}>{d.pnl===undefined?"—":money(d.pnl,latest.region==="INDIA"?"INR":"USD")}</b></div>)}</>}
   </>:<div className="empty-state"><div className="empty-icon"><Bot size={21}/></div><strong>Waiting for first scheduled run</strong><span>Connect D1 and an authorised data adapter. No simulated activity is invented.</span></div>}
  </section>
  <section className="panel"><div className="panel-title"><div><h3>Open virtual positions</h3><p>Marked only when fresh bid quotes are available</p></div><TrendingUp size={18} className="muted-icon"/></div>
   {open.length?<div className="table-scroll"><table className="data-table"><thead><tr><th>Instrument</th><th>Region</th><th>Entry</th><th>Last mark</th><th>Stop</th><th>Target</th><th>Data time</th></tr></thead><tbody>{open.map(p=><tr key={p.id}><td><strong>{p.symbol}</strong><small>{p.asset_class+(p.option_type?" · "+p.option_type+" "+p.strike:"")}</small></td><td>{p.region}</td><td>{p.entry_price}</td><td>{p.last_price}</td><td>{p.stop_price}</td><td>{p.target_price}</td><td>{new Date(p.last_observed_at).toLocaleString()}</td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>No open virtual positions</strong><span>Positions appear only after a valid feed and a qualifying setup.</span></div>}
  </section>
  <section className="panel"><div className="panel-title"><div><h3>Recent end-of-day reports</h3><p>Stored server-side in D1</p></div><TrendingDown size={18} className="muted-icon"/></div>
   {reports.length?reports.map(r=><details className="paperbot-report" key={r.id}><summary><span><strong>{r.region} · {new Date(r.completed_at).toLocaleString()}</strong><small>{r.status} · {r.scanned} scanned · {r.opened} opened · {r.closed} closed</small></span><b className={(r.realized_pnl||0)>=0?"positive":"negative"}>{money(r.realized_pnl||0,r.region==="INDIA"?"INR":"USD")}</b></summary><pre>{JSON.stringify(r.report,null,2)}</pre></details>):<p className="disclaimer-small">No reports stored yet.</p>}
  </section>
 </div>;
}