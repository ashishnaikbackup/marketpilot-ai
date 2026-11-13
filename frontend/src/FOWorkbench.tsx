import { useState } from "react";
import { Activity, Calculator, Database, ShieldCheck } from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

type Greeks = { theoretical_price: number; delta: number; gamma: number; theta_per_year: number; vega_per_1pct: number; model: string; disclaimer: string };

export default function FOWorkbench() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [side, setSide] = useState("call");
  const [spot, setSpot] = useState("25000");
  const [strike, setStrike] = useState("25000");
  const [days, setDays] = useState("7");
  const [rate, setRate] = useState("0.06");
  const [vol, setVol] = useState("0.18");
  const [result, setResult] = useState<Greeks | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function calculate() {
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch(`${API}/options/greeks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, spot: Number(spot), strike: Number(strike), years_to_expiry: Number(days) / 365, risk_free_rate: Number(rate), volatility: Number(vol) }),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}. Is the backend running?`);
      setResult(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to calculate. Check the backend."); }
    finally { setLoading(false); }
  }

  return <div className="page-stack">
    <div className="notice"><ShieldCheck size={17}/><div><strong>Market data provider not connected</strong><span>Live option chain, LTP, OI, volume, IV and exchange Greeks are intentionally unavailable. No market values are fabricated.</span></div><span className="notice-tag">NO FEED</span></div>
    <section className="panel"><div className="panel-title"><div><h3>India index derivatives</h3><p>Choose the instrument you want to research</p></div><Activity size={18} className="muted-icon"/></div><div className="workbench-controls"><label>Underlying<select value={symbol} onChange={e=>setSymbol(e.target.value)}><option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option></select></label><label>Expiry<select disabled><option>Connect market calendar first</option></select></label><label>Option type<select disabled><option>CE / PE chain unavailable</option></select></label></div><div className="empty-state"><div className="empty-icon"><Database size={21}/></div><strong>{symbol} option chain is not connected</strong><span>Once an authorised feed is configured, this area will show strike, CE/PE LTP, bid/ask, volume, OI, change in OI, IV and timestamp.</span></div></section>
    <section className="panel"><div className="panel-title"><div><h3>Modelled Greeks calculator</h3><p>European Black-Scholes · user-supplied assumptions only</p></div><Calculator size={18} className="muted-icon"/></div><div className="calculator-fields greeks-fields">
      <label>Option side<select value={side} onChange={e=>setSide(e.target.value)}><option value="call">Call (CE)</option><option value="put">Put (PE)</option></select></label>
      <label>Underlying spot<input type="number" min="0.01" value={spot} onChange={e=>setSpot(e.target.value)}/></label>
      <label>Strike<input type="number" min="0.01" value={strike} onChange={e=>setStrike(e.target.value)}/></label>
      <label>Days to expiry<input type="number" min="0.1" value={days} onChange={e=>setDays(e.target.value)}/></label>
      <label>Risk-free rate (decimal)<input type="number" step="0.001" value={rate} onChange={e=>setRate(e.target.value)}/></label>
      <label>Volatility (decimal)<input type="number" step="0.01" value={vol} onChange={e=>setVol(e.target.value)}/></label>
    </div><button className="primary-button" onClick={calculate} disabled={loading}>{loading ? "Calculating…" : "Calculate theoretical Greeks"}</button>
    {error && <p className="error-text">{error}</p>}
    {result && <div className="greeks-result"><div><span>Theoretical price</span><strong>{result.theoretical_price.toFixed(2)}</strong></div><div><span>Delta</span><strong>{result.delta.toFixed(4)}</strong></div><div><span>Gamma</span><strong>{result.gamma.toFixed(6)}</strong></div><div><span>Theta / year</span><strong>{result.theta_per_year.toFixed(2)}</strong></div><div><span>Vega / 1 vol point</span><strong>{result.vega_per_1pct.toFixed(4)}</strong></div></div>}
    <p className="disclaimer-small">Model output only, not a quote or implied volatility. Assumes European exercise and omits dividends, early exercise, jumps, liquidity and trading costs.</p></section>
  </div>;
}
