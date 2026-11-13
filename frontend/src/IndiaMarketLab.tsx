import { useMemo, useState } from "react";
import { Database, FileText, ShieldCheck, Upload, AlertTriangle, Activity } from "lucide-react";

type ChainRow = { strike:number; option_type:"CE"|"PE"; open_interest:number; change_oi:number; volume:number; ltp:number; iv:number; bid:number; ask:number };
type Snapshot = { instrument:string; expiry:string; source:string; observedAt:string; importedAt:string; rows:ChainRow[]; metrics:{pcr:number|null;pcrChange:number|null;maxPain:number;topCall:number;topPut:number;atm:number;atmDistance:number;callIv:number|null;putIv:number|null;spreadPct:number|null}; disclaimer:string };
const STORAGE_KEY="marketpilot.latestIndiaChain.v1";
const SAMPLE="strike,option_type,open_interest,change_oi,volume,ltp,iv,bid,ask\n25000,CE,120000,15000,45000,185,14.2,184.5,185.5\n25000,PE,135000,22000,51000,172,14.8,171.5,172.5\n25100,CE,155000,18000,62000,132,14.5,131.5,132.5\n25100,PE,110000,-8000,39000,214,15.1,213.5,214.5\n25200,CE,210000,35000,78000,91,15.0,90.5,91.5\n25200,PE,90000,-12000,28000,270,15.6,269.5,270.5";
function parseCsv(input:string):ChainRow[]{
 const lines=input.trim().split(/\r?\n/).filter(Boolean); if(lines.length<2)throw Error("Paste a header and at least two data rows.");
 const split=(line:string)=>{const out:string[]=[];let cur="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(ch===","&&!quoted){out.push(cur.trim());cur="";}else cur+=ch;}out.push(cur.trim());return out;};
 const headers=split(lines[0]).map(x=>x.toLowerCase().replace(/\s+/g,"_"));
 const idx=(...names:string[])=>headers.findIndex(h=>names.includes(h));
 const fields={strike:idx("strike"),type:idx("option_type","type","cp","right"),oi:idx("open_interest","oi"),coi:idx("change_oi","oi_change","chg_oi"),volume:idx("volume","vol"),ltp:idx("ltp","last_price","premium"),iv:idx("iv","implied_volatility"),bid:idx("bid","bid_price"),ask:idx("ask","ask_price")};
 if(fields.strike<0||fields.type<0||fields.oi<0||fields.volume<0)throw Error("Required columns: strike, option_type (CE/PE), open_interest and volume.");
 const num=(v:string,optional=false)=>{if(optional&&(!v||v==="-"||v==="NA"))return 0;const n=Number(v);if(!Number.isFinite(n))throw Error("CSV contains a non-numeric value.");return n;};
 return lines.slice(1).map((line,i)=>{const v=split(line);const type=(v[fields.type]||"").toUpperCase();if(type!=="CE"&&type!=="PE")throw Error("Row "+(i+2)+": option_type must be CE or PE.");const row:ChainRow={strike:num(v[fields.strike]),option_type:type,open_interest:num(v[fields.oi]),change_oi:fields.coi<0?0:num(v[fields.coi],true),volume:num(v[fields.volume]),ltp:fields.ltp<0?0:num(v[fields.ltp],true),iv:fields.iv<0?0:num(v[fields.iv],true),bid:fields.bid<0?0:num(v[fields.bid],true),ask:fields.ask<0?0:num(v[fields.ask],true)};if(row.strike<=0||row.open_interest<0||row.volume<0||row.ltp<0||row.iv<0||row.bid<0||row.ask<0)throw Error("Row "+(i+2)+": values must be non-negative and strike must be positive.");if(row.bid&&row.ask&&row.ask<row.bid)throw Error("Row "+(i+2)+": ask cannot be below bid.");return row;});
}
function analyse(rows:ChainRow[],spot:number){
 const strikes=[...new Set(rows.map(r=>r.strike))].sort((a,b)=>a-b);
 if(strikes.length<2||!Number.isFinite(spot)||spot<=0)throw Error("Provide at least two strikes and a valid underlying spot.");
 const sum=(type:"CE"|"PE",key:"open_interest"|"change_oi"|"volume")=>rows.filter(r=>r.option_type===type).reduce((s,r)=>s+r[key],0);
 const callOI=sum("CE","open_interest"),putOI=sum("PE","open_interest"),callChange=sum("CE","change_oi"),putChange=sum("PE","change_oi");
 const by=(type:"CE"|"PE")=>strikes.map(strike=>({strike,oi:rows.filter(r=>r.strike===strike&&r.option_type===type).reduce((s,r)=>s+r.open_interest,0)}));
 const maxPain=strikes.map(candidate=>({strike:candidate,payout:rows.reduce((total,r)=>total+(r.option_type==="CE"?Math.max(candidate-r.strike,0):Math.max(r.strike-candidate,0))*r.open_interest,0)})).sort((a,b)=>a.payout-b.payout)[0].strike;
 const top=(type:"CE"|"PE")=>by(type).sort((a,b)=>b.oi-a.oi)[0]?.strike??0;
 const atm=strikes.reduce((best,k)=>Math.abs(k-spot)<Math.abs(best-spot)?k:best,strikes[0]);
 const iv=(type:"CE"|"PE")=>{const vals=rows.filter(r=>r.option_type===type&&r.strike===atm&&r.iv>0);return vals.length?vals.reduce((s,r)=>s+r.iv,0)/vals.length:null;};
 const spreads=rows.filter(r=>r.bid>0&&r.ask>0&&r.ltp>0).map(r=>(r.ask-r.bid)/r.ltp*100);
 return {pcr:callOI?putOI/callOI:null,pcrChange:callChange?putChange/callChange:null,maxPain,topCall:top("CE"),topPut:top("PE"),atm,atmDistance:atm-spot,callIv:iv("CE"),putIv:iv("PE"),spreadPct:spreads.length?spreads.reduce((a,b)=>a+b,0)/spreads.length:null};
}
export default function IndiaMarketLab(){
 const [instrument,setInstrument]=useState("NIFTY");const [spot,setSpot]=useState("25000");const [source,setSource]=useState("");const [expiry,setExpiry]=useState("");const [observedAt,setObservedAt]=useState("");const [csv,setCsv]=useState("");const [snapshot,setSnapshot]=useState<Snapshot|null>(null);const [error,setError]=useState("");
 const freshness=useMemo(()=>{if(!observedAt)return null;const age=Date.now()-new Date(observedAt).getTime();return Number.isFinite(age)?Math.round(age/60000):null;},[observedAt]);
 function importChain(){setError("");setSnapshot(null);try{if(!source.trim())throw Error("Enter where this option-chain data came from.");if(!expiry)throw Error("Select the option expiry date.");if(!observedAt||!Number.isFinite(new Date(observedAt).getTime()))throw Error("Enter the observation date and time.");const rows=parseCsv(csv);const metrics=analyse(rows,Number(spot));const item:Snapshot={instrument,expiry,source:source.trim(),observedAt,importedAt:new Date().toISOString(),rows,metrics,disclaimer:"User-supplied snapshot. Source, timestamp, exchange contract mapping and accuracy are not independently verified. Metrics are descriptive only, not a trade signal."};setSnapshot(item);localStorage.setItem(STORAGE_KEY,JSON.stringify(item));}catch(e){setError(e instanceof Error?e.message:"Unable to import this option chain.");}}
 function loadDemo(){setCsv(SAMPLE);setSource("Illustrative example only");setExpiry(new Date().toISOString().slice(0,10));setObservedAt(new Date().toISOString());setSpot("25120");setError("");setSnapshot(null);}
 return <div className="page-stack">
  <div className="notice"><ShieldCheck size={17}/><div><strong>India derivatives research · user-supplied data</strong><span>Import an option-chain CSV to calculate positioning metrics. No live exchange connection or trading recommendation is implied.</span></div><span className="notice-tag">RESEARCH</span></div>
  <section className="panel"><div className="panel-title"><div><h3>Option-chain data importer</h3><p>NIFTY · BANKNIFTY · FINNIFTY · paste CSV from a source you are authorised to use</p></div><Upload size={18} className="muted-icon"/></div>
   <div className="calculator-fields">
    <label>Instrument<select value={instrument} onChange={e=>setInstrument(e.target.value)}><option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option></select></label>
    <label>Underlying spot<input type="number" min="0.01" value={spot} onChange={e=>setSpot(e.target.value)}/></label>
    <label>Expiry date<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>\n    <label>Data source / provider<input value={source} onChange={e=>setSource(e.target.value)} placeholder="Name the source"/></label>
    <label>Observation time<input type="datetime-local" value={observedAt} onChange={e=>setObservedAt(e.target.value)}/></label>
   </div>
   <label className="india-csv-label">Option-chain CSV<textarea rows={9} value={csv} onChange={e=>setCsv(e.target.value)} placeholder="strike,option_type,open_interest,change_oi,volume,ltp,iv,bid,ask&#10;25000,CE,120000,15000,45000,185,14.2,184.5,185.5&#10;25000,PE,135000,22000,51000,172,14.8,171.5,172.5"/></label>
   <div className="india-actions"><button className="outline-button" onClick={loadDemo}><FileText size={14}/> Load illustrative sample</button><button className="primary-button" onClick={importChain}><Upload size={14}/> Analyse imported chain</button></div>
   {error&&<p className="error-text">{error}</p>}
   <p className="disclaimer-small">Required columns: strike, option_type (CE/PE), open_interest, volume. Optional: change_oi, ltp, iv, bid, ask. One row per strike and option side. Do not paste credentials or account information.</p>
  </section>
  {snapshot&&<><section className="panel"><div className="panel-title"><div><h3>{snapshot.instrument} positioning snapshot</h3><p>Expiry {snapshot.expiry} · {snapshot.source} · observed {new Date(snapshot.observedAt).toLocaleString("en-IN")}</p></div><Activity size={18} className="muted-icon"/></div>
   <div className="greeks-result">
    <div><span>Put / Call OI ratio</span><strong>{snapshot.metrics.pcr===null?"—":snapshot.metrics.pcr.toFixed(3)}</strong></div>
    <div><span>Put / Call change OI</span><strong>{snapshot.metrics.pcrChange===null?"—":snapshot.metrics.pcrChange.toFixed(3)}</strong></div>
    <div><span>Modelled max pain</span><strong>{snapshot.metrics.maxPain.toLocaleString("en-IN")}</strong></div>
    <div><span>Highest call OI strike</span><strong>{snapshot.metrics.topCall.toLocaleString("en-IN")}</strong></div>
    <div><span>Highest put OI strike</span><strong>{snapshot.metrics.topPut.toLocaleString("en-IN")}</strong></div>
    <div><span>Nearest ATM strike</span><strong>{snapshot.metrics.atm.toLocaleString("en-IN")}</strong></div>
    <div><span>ATM CE IV</span><strong>{snapshot.metrics.callIv===null?"—":snapshot.metrics.callIv.toFixed(2)+"%"}</strong></div>
    <div><span>ATM PE IV</span><strong>{snapshot.metrics.putIv===null?"—":snapshot.metrics.putIv.toFixed(2)+"%"}</strong></div>
    <div><span>Mean quoted spread</span><strong>{snapshot.metrics.spreadPct===null?"—":snapshot.metrics.spreadPct.toFixed(2)+"%"}</strong></div>
   </div>
   <div className="decision-card"><div className="decision-title"><AlertTriangle size={18}/><strong>Context only · not a CE/PE signal</strong></div><p>Highest call OI and put OI are descriptive concentration points, not guaranteed resistance or support. Max pain is an expiry-payoff statistic, not a prediction. PCR has no standalone bullish or bearish meaning.</p><p>Observation age entered: {freshness===null?"unknown":freshness<0?"future timestamp":freshness+" minutes"}. Timestamp freshness is not independently verified.</p></div>
   <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Strike</th><th>Side</th><th>OI</th><th>Change OI</th><th>Volume</th><th>LTP</th><th>IV</th></tr></thead><tbody>{snapshot.rows.slice().sort((a,b)=>a.strike-b.strike||a.option_type.localeCompare(b.option_type)).map((r,i)=><tr key={i}><td>{r.strike.toLocaleString("en-IN")}</td><td>{r.option_type}</td><td>{r.open_interest.toLocaleString("en-IN")}</td><td>{r.change_oi.toLocaleString("en-IN")}</td><td>{r.volume.toLocaleString("en-IN")}</td><td>{r.ltp||"—"}</td><td>{r.iv||"—"}</td></tr>)}</tbody></table></div>
   <p className="disclaimer-small">{snapshot.disclaimer}</p>
  </section></>}
  <section className="panel"><div className="panel-title"><div><h3>How MarketPilot uses this data</h3><p>Research workflow before a trade is even considered</p></div><Database size={18} className="muted-icon"/></div><div className="framework-grid">{[["1 · Validate","Source, timestamp, expiry, strike and contract mapping"],["2 · Read positioning","PCR, OI build-up, volume and strike concentrations"],["3 · Compare options","ATM distance, premium, IV, bid/ask and Greeks"],["4 · Add market context","Spot trend, VWAP, breadth, volatility and event risk"],["5 · Define risk","Entry trigger, invalidation, size, fees and slippage"],["6 · Decide","Bullish, bearish, neutral or NO TRADE — with reasons"]].map(([a,b])=><article key={a}><strong>{a}</strong><span>{b}</span></article>)}</div></section>
 </div>;
}
