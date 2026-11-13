import { useState } from "react";
import { AlertTriangle, Search, ShieldCheck } from "lucide-react";

type ScreenResult = { decision: string; reasons: string[]; missing_fields: string[]; message: string; data_mode: string; snapshot?: { source:string; observedAt:string; expiry:string; metrics:{pcr:number|null;maxPain:number;topCall:number;topPut:number;atm:number} } };

export default function OpportunityScanner() {
  const [instrument, setInstrument] = useState("NIFTY");
  const [result, setResult] = useState<ScreenResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  function runGate() {
    setLoading(true); setError("");
    let imported: ScreenResult["snapshot"] | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem("marketpilot.latestIndiaChain.v1") || "null");
      if (saved && saved.instrument === instrument && saved.metrics) imported = { source:saved.source, observedAt:saved.observedAt, expiry:saved.expiry, metrics:saved.metrics };
    } catch { imported = undefined; }
    setResult({
      decision: "NO_TRADE",
      data_mode: imported ? "user_supplied_unverified" : "unavailable",
      snapshot: imported,
      missing_fields: ["verified_underlying_price_series", "VWAP_and_market_breadth", "verified_provider_provenance", "tested_entry_and_invalidation_rules"],
      reasons: imported ? [
        "An option-chain snapshot was imported, but its source and timestamp are user-entered and unverified.",
        "OI, PCR and max pain are descriptive context; they do not establish direction.",
        "No verified spot-price trend, VWAP, breadth or volatility regime is available.",
        "No tested entry trigger, invalidation, costs and position sizing rule is configured."
      ] : [
        "No imported option-chain snapshot is available for this instrument.",
        "Market-data source, exchange and observation timestamp are missing.",
        "Underlying price action, VWAP, breadth and option positioning are unavailable.",
        "No validated strategy rules are enabled."
      ],
      message: imported ? "Imported chain context is available for research, but it is insufficient for a defensible CE/PE decision. The scanner remains fail-closed." : "The readiness gate is intentionally fail-closed. Import a chain in India Market Lab and provide verified price/context data before human review."
    });
    setLoading(false);
  }
  return <div className="page-stack">
    <div className="notice"><ShieldCheck size={17}/><div><strong>Evidence before opinions</strong><span>The scanner cannot issue a trade idea from illustrative data. It must be able to return NO TRADE.</span></div><span className="notice-tag">GUARDED</span></div>
    <section className="panel scanner-panel"><div className="panel-title"><div><h3>Research readiness scanner</h3><p>Run data-quality gates before any strategy analysis</p></div><Search size={18} className="muted-icon"/></div>
      <div className="scanner-form"><label>Instrument<select value={instrument} onChange={e=>setInstrument(e.target.value)}><option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option></select></label><button className="primary-button" onClick={runGate} disabled={loading}>{loading ? "Checking…" : "Run readiness check"}</button></div>
      {error && <p className="error-text">{error}</p>}
      {result && <div className="decision-card"><div className="decision-title"><AlertTriangle size={20}/><strong>{result.decision.replace(/_/g, " ")}</strong></div><p>{result.message}</p>{result.snapshot && <p><strong>Imported context:</strong> {instrument} · expiry {result.snapshot.expiry} · source {result.snapshot.source} · PCR {result.snapshot.metrics.pcr===null?"—":result.snapshot.metrics.pcr.toFixed(3)} · max pain {result.snapshot.metrics.maxPain} · top call OI {result.snapshot.metrics.topCall} · top put OI {result.snapshot.metrics.topPut} · observed {new Date(result.snapshot.observedAt).toLocaleString("en-IN")}</p>}<h4>Why this result?</h4><ul>{result.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></div>}
    </section>
    <section className="panel"><div className="panel-title"><div><h3>Research framework</h3><p>What a future candidate report must contain</p></div></div><div className="framework-grid">{[["Market regime","Trend, volatility and breadth context"],["Bull case","Evidence supporting upside, not a prediction"],["Base case","Range, key levels and neutral outcome"],["Bear case","Evidence supporting downside"],["Invalidation","What would disprove the thesis"],["Risk plan","Defined loss, sizing and event risk"]].map(([title,desc])=><article key={title}><strong>{title}</strong><span>{desc}</span></article>)}</div><p className="disclaimer-small">No entries, targets or probability estimates are generated until validated market data, tested rules and backtest controls are available.</p></section>
  </div>;
}
