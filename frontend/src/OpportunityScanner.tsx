import { useState } from "react";
import { AlertTriangle, Search, ShieldCheck } from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";
type ScreenResult = { decision: string; reasons: string[]; missing_fields: string[]; message: string; data_mode: string };

export default function OpportunityScanner() {
  const [instrument, setInstrument] = useState("NIFTY");
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function runGate() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${API}/research/screen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instrument, data_mode: "demo", available_fields: [], strategy_rules_validated: false }) });
      if (!response.ok) throw new Error(`Research API returned ${response.status}. Start the backend and retry.`);
      setResult(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to reach research API."); }
    finally { setLoading(false); }
  }
  return <div className="page-stack">
    <div className="notice"><ShieldCheck size={17}/><div><strong>Evidence before opinions</strong><span>The scanner cannot issue a trade idea from illustrative data. It must be able to return NO TRADE.</span></div><span className="notice-tag">GUARDED</span></div>
    <section className="panel scanner-panel"><div className="panel-title"><div><h3>Research readiness scanner</h3><p>Run data-quality gates before any strategy analysis</p></div><Search size={18} className="muted-icon"/></div>
      <div className="scanner-form"><label>Instrument<select value={instrument} onChange={e=>setInstrument(e.target.value)}><option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option></select></label><button className="primary-button" onClick={runGate} disabled={loading}>{loading ? "Checking…" : "Run readiness check"}</button></div>
      {error && <p className="error-text">{error}</p>}
      {result && <div className="decision-card"><div className="decision-title"><AlertTriangle size={20}/><strong>{result.decision.replace(/_/g, " ")}</strong></div><p>{result.message}</p><h4>Why this result?</h4><ul>{result.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}
    </section>
    <section className="panel"><div className="panel-title"><div><h3>Research framework</h3><p>What a future candidate report must contain</p></div></div><div className="framework-grid">{[["Market regime","Trend, volatility and breadth context"],["Bull case","Evidence supporting upside, not a prediction"],["Base case","Range, key levels and neutral outcome"],["Bear case","Evidence supporting downside"],["Invalidation","What would disprove the thesis"],["Risk plan","Defined loss, sizing and event risk"]].map(([title,desc])=><article key={title}><strong>{title}</strong><span>{desc}</span></article>)}</div><p className="disclaimer-small">No entries, targets or probability estimates are generated until validated market data, tested rules and backtest controls are available.</p></section>
  </div>;
}
