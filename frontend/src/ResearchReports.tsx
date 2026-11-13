import { useEffect, useState } from "react";
import { FileText, Plus, Save } from "lucide-react";

type Report = { id: string; title: string; instrument: string; regime: string; bull: string; base: string; bear: string; invalidation: string; risks: string; source: string; created: string };
const KEY = "marketpilot-research-reports-v1";

export default function ResearchReports() {
  const [reports,setReports]=useState<Report[]>([]);
  const [title,setTitle]=useState("India market research brief");
  const [instrument,setInstrument]=useState("NIFTY");
  const [regime,setRegime]=useState("Not assessed — no verified market data");
  const [bull,setBull]=useState("");
  const [base,setBase]=useState("");
  const [bear,setBear]=useState("");
  const [invalidation,setInvalidation]=useState("");
  const [risks,setRisks]=useState("");
  const [source,setSource]=useState("");
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw)setReports(JSON.parse(raw) as Report[])}catch{/* invalid local report history */}setLoaded(true)},[]);
  useEffect(()=>{if(loaded)localStorage.setItem(KEY,JSON.stringify(reports))},[reports,loaded]);
  function save(){if(!title.trim())return;setReports(p=>[{id:crypto.randomUUID(),title,instrument,regime,bull,base,bear,invalidation,risks,source,created:new Date().toISOString()},...p])}
  function exportReport(r:Report){const text=[`# ${r.title}`,`Instrument: ${r.instrument}`,`Created: ${new Date(r.created).toLocaleString()}`,`Market regime: ${r.regime}`,"", "## Bull scenario",r.bull||"Not provided","", "## Base scenario",r.base||"Not provided","", "## Bear scenario",r.bear||"Not provided","", "## Invalidation",r.invalidation||"Not provided","", "## Risks",r.risks||"Not provided","", `Source: ${r.source||"Not provided"}`,"", "Manual research notes only. Not a recommendation. Verify every source and data timestamp."].join("\n");const blob=new Blob([text],{type:"text/markdown"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${r.instrument.toLowerCase()}-research-brief.md`;a.click();URL.revokeObjectURL(url)}
  return <div className="page-stack"><div className="notice"><FileText size={17}/><div><strong>Research reports · manual draft mode</strong><span>Reports are saved locally in this browser. Automated market reports will require a verified market-data source and scheduler.</span></div><span className="notice-tag">LOCAL</span></div>
    <section className="panel"><div className="panel-title"><div><h3>Create a structured research brief</h3><p>Capture competing scenarios and what would invalidate your thesis</p></div><Plus size={18} className="muted-icon"/></div>
      <div className="calculator-fields report-fields">
        <label>Report title<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <label>Instrument<select value={instrument} onChange={e=>setInstrument(e.target.value)}><option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option><option>Global / Other</option></select></label>
        <label className="span-two">Market regime / context<input value={regime} onChange={e=>setRegime(e.target.value)}/></label>
        <label>Bull scenario<textarea rows={3} value={bull} onChange={e=>setBull(e.target.value)} placeholder="Evidence, conditions and key assumptions"/></label>
        <label>Base scenario<textarea rows={3} value={base} onChange={e=>setBase(e.target.value)} placeholder="Neutral case and range-bound possibilities"/></label>
        <label>Bear scenario<textarea rows={3} value={bear} onChange={e=>setBear(e.target.value)} placeholder="Downside evidence and conditions"/></label>
        <label>Thesis invalidation<textarea rows={3} value={invalidation} onChange={e=>setInvalidation(e.target.value)} placeholder="What would prove this thesis wrong?"/></label>
        <label>Risks / events<textarea rows={3} value={risks} onChange={e=>setRisks(e.target.value)} placeholder="Events, volatility, liquidity, data caveats"/></label>
        <label>Source / reference<input value={source} onChange={e=>setSource(e.target.value)} placeholder="URL or source name"/></label>
      </div><button className="primary-button" onClick={save}><Save size={14}/> Save research brief</button>
    </section>
    <section className="panel"><div className="panel-title"><div><h3>Saved research briefs</h3><p>{reports.length} saved in this browser</p></div></div>{reports.length===0?<div className="empty-state"><div className="empty-icon"><FileText size={21}/></div><strong>No saved reports</strong><span>Create a research brief above. Never treat manual notes as verified market data.</span></div>:<div className="saved-reports">{reports.map(r=><article key={r.id}><div><strong>{r.title}</strong><span>{r.instrument} · {new Date(r.created).toLocaleString()}</span></div><button className="small-button" onClick={()=>exportReport(r)}>Export Markdown</button></article>)}</div>}</section>
  </div>;
}
