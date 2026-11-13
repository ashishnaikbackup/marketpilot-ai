import { useMemo, useState } from "react";
import { Activity, Bot, Download, FileUp, Play, ShieldCheck, Trash2 } from "lucide-react";

type Row = {
  timestamp:string; symbol:string; underlying:string; market:string; assetType:string;
  open:number; high:number; low:number; close:number; volume:number;
  optionType:string; strike:number; expiry:string; openInterest:number; bid:number; ask:number; lotSize:number;
};
type Trade = {
  id:string; symbol:string; underlying:string; market:string; assetType:string; optionType:string;
  side:string; quantity:number; entry:number; stop:number; target:number; mark:number; pnl:number; strike:number; expiry:string;
  status:"OPEN"|"CLOSED"; openedAt:string; closedAt?:string; exit?:number; exitReason?:string;
  sourceTime:string; thesis:string;
};
type Report = { date:string; createdAt:string; opened:number; closed:number; wins:number; losses:number; realised:number; openPnl:number; decisions:string[]; dataAsOf:string; skipped:string[] };
const ROWS_KEY="marketpilot.paperBot.rows.v1";
const TRADES_KEY="marketpilot.paperBot.trades.v1";
const REPORTS_KEY="marketpilot.paperBot.reports.v1";
const indiaDate=(value:string)=>{const d=new Date(value);return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);};
const money=(v:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(v);
const num=(v:string|undefined)=>{const n=Number(v);return Number.isFinite(n)?n:0;};
function csvParse(text:string):Row[] {
  const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
  if(lines.length<2) throw new Error("CSV needs a header and at least one data row.");
  const split=(line:string)=>{const out:string[]=[];let cur="",quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&line[i+1]==='"'&&quoted){cur+='"';i++;}else if(ch==='"')quoted=!quoted;else if(ch===","&&!quoted){out.push(cur.trim());cur="";}else cur+=ch;}out.push(cur.trim());return out;};
  const headers=split(lines[0]).map(x=>x.toLowerCase().replace(/[\s-]+/g,"_"));
  const idx=(...names:string[])=>headers.findIndex(h=>names.includes(h));
  const get=(cells:string[],...names:string[])=>{const i=idx(...names);return i<0?"":(cells[i]??"");};
  const rows:Row[]=[];
  for(const line of lines.slice(1)){
    const c=split(line);const symbol=get(c,"symbol","tradingsymbol","ticker").toUpperCase();
    const close=num(get(c,"close","ltp","last_price","price"));
    const timestamp=get(c,"timestamp","datetime","date","time");
    if(!symbol||!timestamp||close<=0) continue;
    const assetType=(get(c,"asset_type","type","instrument_type")||"EQUITY").toUpperCase();
    rows.push({
      timestamp,symbol,underlying:(get(c,"underlying","underlying_symbol")||symbol).toUpperCase(),
      market:(get(c,"market","exchange","region")||"GLOBAL").toUpperCase(),assetType:assetType.includes("OPT")||assetType==="CE"||assetType==="PE"?"OPTION":assetType.includes("FUT")?"FUTURE":assetType.includes("ETF")?"ETF":assetType.includes("EQ")||assetType.includes("STOCK")?"EQUITY":assetType,
      open:num(get(c,"open")),high:num(get(c,"high"))||close,low:num(get(c,"low"))||close,close,
      volume:num(get(c,"volume","vol")),optionType:(get(c,"option_type","right")||"").toUpperCase(),
      strike:num(get(c,"strike")),expiry:get(c,"expiry","expiry_date"),
      openInterest:num(get(c,"open_interest","oi")),bid:num(get(c,"bid","best_bid")),ask:num(get(c,"ask","best_ask")),
      lotSize:Math.max(1,num(get(c,"lot_size","lotsize"))||1)
    });
  }
  if(!rows.length) throw new Error("No valid rows found. Check symbol, timestamp and close columns.");
  return rows;
}
function ema(values:number[],period:number){if(values.length<period)return null;const k=2/(period+1);let v=values.slice(0,period).reduce((a,b)=>a+b,0)/period;for(const x of values.slice(period))v=x*k+v*(1-k);return v;}
function rsi(values:number[],period=14){if(values.length<=period)return null;let up=0,down=0;for(let i=values.length-period;i<values.length;i++){const d=values[i]-values[i-1];if(d>0)up+=d;else down-=d;}if(down===0)return 100;return 100-100/(1+up/down);}
function atr(rows:Row[],period=14){if(rows.length<period+1)return null;const tr=rows.slice(-period).map((r,i)=>{const prev=rows[rows.length-period-1+i];return Math.max(r.high-r.low,Math.abs(r.high-prev.close),Math.abs(r.low-prev.close));});return tr.reduce((a,b)=>a+b,0)/tr.length;}
function isoTime(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?null:d;}
function freshLabel(value:string){const d=isoTime(value);if(!d)return "Timestamp unclear";const age=Date.now()-d.getTime();if(age<30*60*1000)return "Recent timestamp";if(age<24*60*60*1000)return "Under 24 hours";return "Historical / stale";}
export default function PaperTradingBot(){
  const [rows,setRows]=useState<Row[]>(()=>{try{return JSON.parse(localStorage.getItem(ROWS_KEY)||"[]") as Row[];}catch{return [];}});
  const [trades,setTrades]=useState<Trade[]>(()=>{try{return JSON.parse(localStorage.getItem(TRADES_KEY)||"[]") as Trade[];}catch{return [];}});
  const [reports,setReports]=useState<Report[]>(()=>{try{return JSON.parse(localStorage.getItem(REPORTS_KEY)||"[]") as Report[];}catch{return [];}});
  const [capital,setCapital]=useState("1000000");
  const [riskPct,setRiskPct]=useState("0.5");
  const [maxPositions,setMaxPositions]=useState("5");
  const [watchlist,setWatchlist]=useState("NIFTY, BANKNIFTY, FINNIFTY, RELIANCE, TCS, INFY, AAPL, MSFT, SPY, QQQ");
  const [status,setStatus]=useState("Import a timestamped CSV to start. No live feed is connected.");
  const [skipped,setSkipped]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<Report|null>(null);
  const [source,setSource]=useState("User-imported CSV (unverified)");
  const [lastScan,setLastScan]=useState("");
  const persistRows=(v:Row[])=>{setRows(v);localStorage.setItem(ROWS_KEY,JSON.stringify(v));};
  const persistTrades=(v:Trade[])=>{setTrades(v);localStorage.setItem(TRADES_KEY,JSON.stringify(v));};
  const latestTime=useMemo(()=>rows.map(r=>isoTime(r.timestamp)?.getTime()||0).reduce((a,b)=>Math.max(a,b),0),[rows]);
  const latestDate=latestTime?new Date(latestTime).toISOString():"";
  const openTrades=trades.filter(t=>t.status==="OPEN");
  const realised=trades.filter(t=>t.status==="CLOSED").reduce((s,t)=>s+t.pnl,0);
  const openPnl=openTrades.reduce((s,t)=>s+t.pnl,0);
  const watched=watchlist.split(",").map(x=>x.trim().toUpperCase()).filter(Boolean);
  const grouped=useMemo(()=>{const m=new Map<string,Row[]>();for(const r of rows.filter(x=>x.assetType!=="OPTION"&&x.assetType!=="CE"&&x.assetType!=="PE")){const k=r.symbol;if(!m.has(k))m.set(k,[]);m.get(k)!.push(r);}for(const a of m.values())a.sort((x,y)=>(isoTime(x.timestamp)?.getTime()||0)-(isoTime(y.timestamp)?.getTime()||0));return m;},[rows]);
  async function importFile(file?:File){if(!file)return;try{const parsed=csvParse(await file.text());persistRows(parsed);setStatus(`Imported ${parsed.length} rows from ${file.name}. Source remains unverified.`);setReport(null);}catch(e){setStatus(e instanceof Error?e.message:"CSV import failed.");}}
  function runBot(){
    if(!rows.length){setStatus("No data imported. Import price bars and, optionally, option quotes first.");return;}
    setBusy(true);const cash=num(capital),risk=Math.min(2,Math.max(.1,num(riskPct)))/100,limit=Math.max(1,Math.min(20,Math.floor(num(maxPositions)||5)));
    if(cash<=0){setStatus("Virtual capital must be greater than zero.");setBusy(false);return;}
    const next=[...trades];const notes:string[]=[];const skips:string[]=[];
    // Update open simulations only from the newest imported close for the same instrument/contract.
    for(let i=0;i<next.length;i++){const t=next[i];if(t.status!=="OPEN")continue;const candidates=rows.filter(r=>t.assetType==="OPTION"?r.assetType==="OPTION"&&r.underlying===t.underlying&&r.optionType===t.optionType&&r.strike===t.strike&&r.expiry===t.expiry:r.symbol===t.symbol);const latest=candidates.sort((a,b)=>(isoTime(b.timestamp)?.getTime()||0)-(isoTime(a.timestamp)?.getTime()||0))[0];if(!latest)continue;const mark=latest.close;const move=(mark-t.entry)*t.quantity;const stopHit=mark<=t.stop,targetHit=mark>=t.target;next[i]={...t,mark,pnl:move,...(stopHit||targetHit?{status:"CLOSED",exit:stopHit?t.stop:t.target,closedAt:new Date().toISOString(),exitReason:stopHit?"Stop assumption reached":"Target assumption reached",pnl:((stopHit?t.stop:t.target)-t.entry)*t.quantity}:{})};if(stopHit||targetHit)notes.push(`Closed ${t.symbol}: ${stopHit?"stop":"target"} assumption reached.`);}
    let active=next.filter(t=>t.status==="OPEN").length;
    const used=new Set(next.filter(t=>t.status==="OPEN").map(t=>t.underlying));
    for(const [symbol,bars] of grouped){
      if(watched.length&&!watched.some(w=>symbol.includes(w)||w.includes(symbol)))continue;
      if(bars.length<30){skips.push(`${symbol}: fewer than 30 bars`);continue;}
      const closes=bars.map(r=>r.close),fast=ema(closes.slice(-60),9),slow=ema(closes.slice(-60),21),strength=rsi(closes),volAvg=bars.slice(-21,-1).reduce((s,r)=>s+r.volume,0)/20,last=bars[bars.length-1],volRatio=volAvg>0?last.volume/volAvg:0,range=atr(bars);
      const bull=fast!==null&&slow!==null&&fast>slow&&last.close>slow&&strength!==null&&strength>=52&&strength<=72&&volRatio>=1.0;
      const bear=fast!==null&&slow!==null&&fast<slow&&last.close<slow&&strength!==null&&strength<=48&&strength>=28&&volRatio>=1.0;
      if(!bull&&!bear){continue;}
      if(used.has(symbol)){skips.push(`${symbol}: already has an open simulated position`);continue;}
      if(active>=limit){skips.push(`Position limit ${limit} reached`);break;}
      const dataDate=isoTime(last.timestamp);if(!dataDate||Date.now()-dataDate.getTime()>7*86400000){skips.push(`${symbol}: latest bar is older than 7 days`);continue;}
      const options=rows.filter(r=>r.assetType==="OPTION"&&r.underlying===symbol&&r.optionType===(bull?"CE":"PE")&&r.close>0&&r.bid>0&&r.ask>=r.bid&&r.lotSize>0&&(!r.expiry||new Date(r.expiry).getTime()>Date.now()));
      let chosen:Row|undefined;
      if(options.length){chosen=options.sort((a,b)=>Math.abs(a.strike-last.close)-Math.abs(b.strike-last.close))[0];}
      let trade:Trade|undefined;
      if(chosen){
        const mid=(chosen.bid+chosen.ask)/2,spread=(chosen.ask-chosen.bid)/mid;
        if(spread>0.05||chosen.openInterest<=0||chosen.volume<=0){skips.push(`${symbol}: nearest ${bull?"CE":"PE"} fails liquidity/spread checks`);continue;}
        const qty=chosen.lotSize,stop=mid*.65,target=mid*1.6,riskMoney=(mid-stop)*qty;
        if(riskMoney>cash*risk){skips.push(`${symbol}: one option lot exceeds the ${(risk*100).toFixed(2)}% virtual risk budget`);continue;}
        trade={id:crypto.randomUUID(),symbol:`${symbol} ${chosen.expiry} ${chosen.optionType} ${chosen.strike}`,underlying:symbol,market:chosen.market,assetType:"OPTION",optionType:chosen.optionType,strike:chosen.strike,expiry:chosen.expiry,side:"BUY",quantity:qty,entry:mid,stop,target,mark:mid,pnl:0,status:"OPEN",openedAt:new Date().toISOString(),sourceTime:chosen.timestamp,thesis:`${bull?"Bullish":"Bearish"} underlying trend; 9/21 EMA alignment, RSI ${strength!.toFixed(1)}, volume ratio ${volRatio.toFixed(2)}x. Long option only; premium at mid assumed.`};
      } else if(bull && last.assetType!=="OPTION" && last.assetType!=="CE" && last.assetType!=="PE") {
        const stop=last.close-2*(range||last.close*.02),target=last.close+3*(last.close-stop),unit=last.assetType==="FUTURE"?last.lotSize:1,unitRisk=Math.max(.01,last.close-stop)*unit,units=Math.floor(cash*risk/unitRisk),qty=units*unit;
        if(qty<1){skips.push(${symbol}: minimum unit/lot exceeds the virtual risk budget`);continue;}
        trade={id:crypto.randomUUID(),symbol,underlying:symbol,market:last.market,assetType:last.assetType,optionType:"",strike:0,expiry:"",side:"BUY",quantity:qty,entry:last.close,stop,target,mark:last.close,pnl:0,status:"OPEN",openedAt:new Date().toISOString(),sourceTime:last.timestamp,thesis:`Bullish trend; 9/21 EMA alignment, RSI ${strength!.toFixed(1)}, volume ratio ${volRatio.toFixed(2)}x. Simulated ${last.assetType} entry at last close.`};
      } else {skips.push(`${symbol}: signal found but no eligible long-only cash/ETF or liquid matching CE/PE contract`);continue;}
      next.unshift(trade);used.add(symbol);active+=1;notes.push(`PAPER BUY ${trade.symbol} · ${trade.quantity} units · assumed entry ${trade.entry.toFixed(2)}`);
    }
    persistTrades(next);setSkipped(skips);setLastScan(new Date().toISOString());setStatus(`Scan complete. ${notes.length} trade events; ${skips.length} safeguards/no-entry reasons. No broker orders were sent.`);
    const daily=makeReport(next,notes,skips,latestDate);setReport(daily);const savedReports=[daily,...reports.filter(x=>x.date!==daily.date)];setReports(savedReports);localStorage.setItem(REPORTS_KEY,JSON.stringify(savedReports));setBusy(false);
  }
  function makeReport(sourceTrades:Trade[],decisions:string[],skip:string[],asOf:string):Report{
    const today=indiaDate(new Date().toISOString()),dayTrades=sourceTrades.filter(t=>indiaDate(t.openedAt)===today||Boolean(t.closedAt&&indiaDate(t.closedAt)===today)),closed=dayTrades.filter(t=>t.status==="CLOSED"),r=closed.reduce((s,t)=>s+t.pnl,0);
    return {date:today,createdAt:new Date().toISOString(),opened:dayTrades.filter(t=>indiaDate(t.openedAt)===today).length,closed:closed.length,wins:closed.filter(t=>t.pnl>0).length,losses:closed.filter(t=>t.pnl<0).length,realised:r,openPnl:sourceTrades.filter(t=>t.status==="OPEN").reduce((s,t)=>s+t.pnl,0),decisions, dataAsOf:asOf,skipped:skip};
  }
  function createReport(){const r=makeReport(trades,[],[],latestDate);setReport(r);const next=[r,...reports.filter(x=>x.date!==r.date)];setReports(next);localStorage.setItem(REPORTS_KEY,JSON.stringify(next));}
  function downloadReport(){if(!report)return;const text=[`MARKETPILOT AI — PAPER BOT DAILY REPORT`,`Date: ${report.date}`,`Generated: ${report.createdAt}`,`Data as of: ${report.dataAsOf||"not available"}`,`Data source: ${source} (unverified)`,`New paper trades: ${report.opened}`,`Closed paper trades: ${report.closed}`,`Wins / losses: ${report.wins} / ${report.losses}`,`Realised simulated P&L: ${money(report.realised)}`,`Open simulated P&L: ${money(report.openPnl)}`,`Decision log:`,...(report.decisions.length?report.decisions:["No new paper entries during this report."]),`Skipped / safeguards:`,...(report.skipped.length?report.skipped:["None recorded."]),`DISCLAIMER: Simulated only. User-imported prices are unverified. No live provider or broker is connected. Fees, slippage, taxes and market impact are not fully modelled.`].join("\n");const blob=new Blob([text],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`marketpilot-paper-report-${report.date}.txt`;a.click();URL.revokeObjectURL(url);}
  function clearBot(){if(!window.confirm("Delete imported bot data, simulated trades and saved bot reports from this browser?"))return;persistRows([]);persistTrades([]);setReports([]);localStorage.removeItem(REPORTS_KEY);setReport(null);setSkipped([]);setStatus("Local paper bot data cleared.");}
  const freshest=latestDate?freshLabel(latestDate):"No timestamp";
  return <div className="page-stack paper-bot">
    <div className="notice"><ShieldCheck size={17}/><div><strong>Simulation only · no broker · no live feed</strong><span>The bot can analyse timestamped files and create hypothetical trades. It cannot run in the background or fetch live prices in this free-only setup.</span></div><span className="notice-tag">PAPER BOT</span></div>
    <section className="panel"><div className="panel-title"><div><h3><Bot size={17}/> Autonomous paper analyst</h3><p>Import data → run strategy rules → simulate entries/exits → review report</p></div><span className="pill muted">{rows.length} imported rows</span></div>
      <div className="bot-import-row"><label className="bot-file"><FileUp size={17}/> Import market CSV<input type="file" accept=".csv,text/csv" onChange={e=>{void importFile(e.target.files?.[0]);e.currentTarget.value="";}}/></label><label>Data source<input value={source} onChange={e=>setSource(e.target.value)} /></label><div className="bot-freshness"><span>Latest timestamp</span><strong>{latestDate?new Date(latestDate).toLocaleString("en-IN"):"Not available"}</strong><small>{freshest}</small></div></div>
      <p className="disclaimer-small">Required price columns: timestamp, symbol, close. For best results include open, high, low, volume, market and asset_type. Optional option columns: underlying, option_type (CE/PE), strike, expiry, bid, ask, open_interest, lot_size. One row per timestamp and instrument. Imported data is not authenticated.</p>
    </section>
    <section className="panel"><div className="panel-title"><div><h3>Bot controls</h3><p>All capital is virtual. Conservative defaults; change only for experiments.</p></div><Activity size={18} className="muted-icon"/></div>
      <div className="calculator-fields paper-fields"><label>Watchlist symbols<input value={watchlist} onChange={e=>setWatchlist(e.target.value)} /></label><label>Virtual capital (₹)<input type="number" min="1" value={capital} onChange={e=>setCapital(e.target.value)} /></label><label>Max risk per trade (%)<input type="number" min=".1" max="2" step=".1" value={riskPct} onChange={e=>setRiskPct(e.target.value)} /></label><label>Max open positions<input type="number" min="1" max="20" value={maxPositions} onChange={e=>setMaxPositions(e.target.value)} /></label></div>
      <div className="bot-actions"><button className="primary-button" onClick={runBot} disabled={busy||!rows.length}><Play size={15}/>{busy?"Scanning…":"Run paper bot"}</button><button className="outline-button" onClick={createReport}>Generate daily report</button><button className="outline-button danger-button" onClick={clearBot}><Trash2 size={14}/> Clear local bot data</button></div><p className="bot-status">{status}</p><p className="disclaimer-small">Rules: 9/21 EMA trend, RSI band and relative volume confirmation; ATR-based stop for cash equities; long CE/PE only when a matching option quote passes spread/OI/volume checks. Max 0.5% virtual risk default, max positions cap. This is an educational heuristic, not a validated profitable strategy. It does not short options.</p>
    </section>
    <section className="portfolio-stats"><article><span>Open simulated positions</span><strong>{openTrades.length}</strong></article><article><span>Realised simulated P&amp;L</span><strong className={realised>=0?"positive":"negative"}>{money(realised)}</strong></article><article><span>Open marked P&amp;L</span><strong className={openPnl>=0?"positive":"negative"}>{money(openPnl)}</strong></article></section>
    {report&&<section className="panel bot-report"><div className="panel-title"><div><h3>Daily paper report · {report.date}</h3><p>Generated {new Date(report.createdAt).toLocaleString("en-IN")} · data as of {report.dataAsOf?new Date(report.dataAsOf).toLocaleString("en-IN"):"unknown"}</p></div><button className="outline-button" onClick={downloadReport}><Download size={14}/> Export report</button></div><div className="framework-grid"><article><strong>{report.opened}</strong><span>New simulated entries</span></article><article><strong>{report.closed}</strong><span>Closed positions</span></article><article><strong>{report.wins} / {report.losses}</strong><span>Wins / losses</span></article><article><strong>{money(report.realised)}</strong><span>Realised simulated P&amp;L</span></article></div><h4>Bot decision log</h4>{report.decisions.length?report.decisions.map((x,i)=><p key={i} className="bot-log">{x}</p>):<p className="disclaimer-small">No new trade events in this report. No trade is a valid outcome.</p>}{report.skipped.length>0&&<><h4>Skipped by safeguards</h4>{report.skipped.slice(0,12).map((x,i)=><p key={i} className="bot-log muted-copy">{x}</p>)}</>}</section>}
    <section className="panel"><div className="panel-title"><div><h3>Simulated trade ledger</h3><p>Entries are based on imported close/mid assumptions, not broker fills.</p></div><span className="pill muted">{trades.length} trades</span></div>{!trades.length?<div className="empty-state"><div className="empty-icon"><Bot size={20}/></div><strong>No simulated trades yet</strong><span>Import enough timestamped bars and run the bot. It may correctly choose not to trade.</span></div>:<div className="table-scroll"><table className="data-table"><thead><tr><th>Instrument / thesis</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark / exit</th><th>P&amp;L</th><th>Status</th></tr></thead><tbody>{trades.slice(0,100).map(t=><tr key={t.id}><td><strong>{t.symbol}</strong><small>{t.thesis}</small></td><td>{t.side}</td><td>{t.quantity}</td><td>{t.entry.toFixed(2)}</td><td>{(t.exit??t.mark).toFixed(2)}</td><td className={t.pnl>=0?"positive":"negative"}>{money(t.pnl)}</td><td><span className={t.status==="OPEN"?"pill muted":"pill"}>{t.status}</span></td></tr>)}</tbody></table></div>}</section>
    <p className="disclaimer-small">This module runs only when you import data and press Run. It does not monitor markets overnight, run while the browser is closed, or send automatic notifications. Daily report automation requires a deployed scheduled backend, persistent storage and an authorised data source.</p>
  </div>;
}
