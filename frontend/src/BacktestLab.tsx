import { useState } from "react";
import { Activity, AlertTriangle, Play, ShieldCheck } from "lucide-react";

type Result = {
  strategy: string; fast_window: number; slow_window: number; final_equity: number;
  total_return_pct: number; max_drawdown_pct: number; position_changes: number;
  bars_evaluated: number; fee_bps_per_change: number; slippage_bps_per_change: number;
  warning: string;
};

export default function BacktestLab() {
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_BASE_URL || "");
  const [prices, setPrices] = useState("100, 101, 99, 102, 104, 103, 105, 107, 106, 109, 111, 110, 112, 114, 113, 116, 118, 117, 119, 121, 120, 123, 125, 124, 127, 129, 128, 130, 132, 131");
  const [fast, setFast] = useState("5");
  const [slow, setSlow] = useState("20");
  const [fee, setFee] = useState("5");
  const [slippage, setSlippage] = useState("5");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setError(""); setResult(null);
    const values = prices.split(/[\s,;]+/).filter(Boolean).map(Number);
    if (values.some(v => !Number.isFinite(v) || v <= 0) || values.length < 22) {
      setError("Enter at least 22 positive closing prices, separated by commas or spaces."); return;
    }
    if (!apiUrl.trim()) { setError("Enter your deployed Cloudflare Worker API base URL first. GitHub Pages hosts only the static frontend."); return; }
    setLoading(true);
    try {
      const response = await fetch(apiUrl.replace(/\/$/, "") + "/api/v1/backtest/sma-crossover", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closes: values, fast_window: Number(fast), slow_window: Number(slow), fee_bps: Number(fee), slippage_bps: Number(slippage) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Backtest request failed. Check the API URL and input settings.");
      setResult(body as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the backend. Check its URL and CORS configuration.");
    } finally { setLoading(false); }
  }

  return <div className="page-stack">
    <div className="notice"><ShieldCheck size={17}/><div><strong>Historical research only · no trade execution</strong><span>Uses only closing prices you provide. No market feed is fetched and no future price is predicted.</span></div><span className="notice-tag">RESEARCH</span></div>
    <section className="panel">
      <div className="panel-title"><div><h3>Connect your MarketPilot API</h3><p>Backend URL is separate from the static GitHub Pages dashboard</p></div><Activity size={18} className="muted-icon"/></div>
      <div className="calculator-fields">
        <label className="span-two">API base URL<input value={apiUrl} onChange={e=>setApiUrl(e.target.value)} placeholder="https://marketpilot-api.<your-account-subdomain>.workers.dev"/></label>
        <label>Fast moving average<input type="number" min="2" max="499" value={fast} onChange={e=>setFast(e.target.value)}/></label>
        <label>Slow moving average<input type="number" min="3" max="500" value={slow} onChange={e=>setSlow(e.target.value)}/></label>
        <label>Fee per position change (bps)<input type="number" min="0" max="500" value={fee} onChange={e=>setFee(e.target.value)}/></label>
        <label>Slippage per position change (bps)<input type="number" min="0" max="500" value={slippage} onChange={e=>setSlippage(e.target.value)}/></label>
        <label className="span-two">Historical closing prices<textarea rows={5} value={prices} onChange={e=>setPrices(e.target.value)} placeholder="Paste chronological closing prices, oldest first"/></label>
      </div>
      <button className="primary-button" onClick={run} disabled={loading}><Play size={14}/>{loading ? "Running backtest…" : "Run educational backtest"}</button>
      {error && <div className="notice" role="alert"><AlertTriangle size={17}/><div><strong>Unable to run</strong><span>{error}</span></div></div>}
    </section>
    {result && <section className="panel">
      <div className="panel-title"><div><h3>Backtest results</h3><p>{result.strategy} · {result.bars_evaluated} evaluated bars</p></div><span className="pill muted">HISTORICAL INPUT</span></div>
      <div className="portfolio-stats">
        <article><span>Total return</span><strong className={result.total_return_pct >= 0 ? "positive" : "negative"}>{result.total_return_pct.toFixed(2)}%</strong></article>
        <article><span>Maximum drawdown</span><strong className="negative">{result.max_drawdown_pct.toFixed(2)}%</strong></article>
        <article><span>Position changes</span><strong>{result.position_changes}</strong></article>
      </div>
      <p className="subhead">Normalised final equity: {result.final_equity.toFixed(4)} · costs: {result.fee_bps_per_change} bps fee + {result.slippage_bps_per_change} bps slippage per change.</p>
      <div className="notice"><AlertTriangle size={17}/><div><strong>Interpret with caution</strong><span>{result.warning}</span></div></div>
    </section>}
  </div>;
}
