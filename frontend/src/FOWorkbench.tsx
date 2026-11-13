import { useState } from "react";
import { Activity, Calculator, Database, ShieldCheck } from "lucide-react";

type Greeks = { theoretical_price: number; delta: number; gamma: number; theta_per_year: number; vega_per_1pct: number; model: string; disclaimer: string };

function modelGreeks(side:"call"|"put",s:number,k:number,days:number,r:number,v:number):Greeks {
  if (![s,k,days,r,v].every(Number.isFinite) || s<=0 || k<=0 || days<=0 || v<=0 || v>5 || r<-.05 || r>.3) {
    throw new Error("Use positive spot, strike, days and volatility. Volatility must be at most 500%; rate must be between -5% and 30%.");
  }
  const erf=(x:number)=>{const sign=x<0?-1:1;const a=Math.abs(x);const p=0.3275911;const z=1/(1+p*a);const y=1-(((((1.061405429*z-1.453152027)*z)+1.421413741)*z-0.284496736)*z+0.254829592)*z*Math.exp(-a*a);return sign*y;};
  const cdf=(x:number)=>0.5*(1+erf(x/Math.SQRT2));
  const pdf=(x:number)=>Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);
  const t=days/365,root=Math.sqrt(t),d1=(Math.log(s/k)+(r+0.5*v*v)*t)/(v*root),d2=d1-v*root,disc=Math.exp(-r*t),density=pdf(d1),isCall=side==="call";
  return {model:"black_scholes_european",theoretical_price:isCall?s*cdf(d1)-k*disc*cdf(d2):k*disc*cdf(-d2)-s*cdf(-d1),delta:isCall?cdf(d1):cdf(d1)-1,gamma:density/(s*v*root),theta_per_year:-(s*density*v)/(2*root)+(isCall?-r*k*disc*cdf(d2):r*k*disc*cdf(-d2)),vega_per_1pct:s*density*root/100,disclaimer:"Theoretical model from user assumptions; not a quote or signal."};
}

export default function FOWorkbench() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [side, setSide] = useState("call");
  const [spot, setSpot] = useState("25000");
  const [strike, setStrike] = useState("25000");
  const [days, setDays] = useState("7");
  const [rate, setRate] = useState("0.06");
  const [vol, setVol] = useState("0.18");
  const [marketPremium, setMarketPremium] = useState("250");
  const [ivResult, setIvResult] = useState<number | null>(null);
  const [ivError, setIvError] = useState("");
  const [result, setResult] = useState<Greeks | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [comparison, setComparison] = useState<{call:Greeks;put:Greeks}|null>(null);
  const [comparisonError, setComparisonError] = useState("");

  function compareCallPut() {
    setComparisonError(""); setComparison(null);
    try {
      const values={s:Number(spot),k:Number(strike),days:Number(days),r:Number(rate),v:Number(vol)};
      setComparison({call:modelGreeks("call",values.s,values.k,values.days,values.r,values.v),put:modelGreeks("put",values.s,values.k,values.days,values.r,values.v)});
    } catch(e) { setComparisonError(e instanceof Error?e.message:"Unable to compare both option sides."); }
  }

  function calculate() {
    setLoading(true); setError(""); setResult(null);
    try {
      const s=Number(spot), k=Number(strike), t=Number(days)/365, r=Number(rate), v=Number(vol);
      if (![s,k,t,r,v].every(Number.isFinite) || s<=0 || k<=0 || t<=0 || v<=0) throw new Error("Enter positive spot, strike, time and volatility values.");
      const erf=(x:number)=>{const sign=x<0?-1:1;const a=Math.abs(x);const p=0.3275911;const z=1/(1+p*a);const y=1-(((((1.061405429*z-1.453152027)*z)+1.421413741)*z-0.284496736)*z+0.254829592)*z*Math.exp(-a*a);return sign*y;};
      const cdf=(x:number)=>0.5*(1+erf(x/Math.SQRT2));
      const pdf=(x:number)=>Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);
      const root=Math.sqrt(t), d1=(Math.log(s/k)+(r+0.5*v*v)*t)/(v*root), d2=d1-v*root, disc=Math.exp(-r*t), density=pdf(d1);
      const gamma=density/(s*v*root), vega=s*density*root/100, commonTheta=-(s*density*v)/(2*root);
      const isCall=side==="call";
      const price=isCall?s*cdf(d1)-k*disc*cdf(d2):k*disc*cdf(-d2)-s*cdf(-d1);
      const delta=isCall?cdf(d1):cdf(d1)-1;
      const theta=isCall?commonTheta-r*k*disc*cdf(d2):commonTheta+r*k*disc*cdf(-d2);
      setResult({model:"black_scholes_european",theoretical_price:price,delta,gamma,theta_per_year:theta,vega_per_1pct:vega,disclaimer:"Browser-side model from user-supplied assumptions. Not a quote or signal."});
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to calculate."); }
    finally { setLoading(false); }
  }

  function solveImpliedVolatility() {
    setIvError(""); setIvResult(null);
    const s=Number(spot), k=Number(strike), t=Number(days)/365, r=Number(rate), premium=Number(marketPremium);
    if (![s,k,t,r,premium].every(Number.isFinite) || s<=0 || k<=0 || t<=0 || premium<=0) { setIvError("Enter valid positive spot, strike, days and option premium."); return; }
    const erf=(x:number)=>{const sign=x<0?-1:1;const a=Math.abs(x);const p=0.3275911;const z=1/(1+p*a);const y=1-(((((1.061405429*z-1.453152027)*z)+1.421413741)*z-0.284496736)*z+0.254829592)*z*Math.exp(-a*a);return sign*y;};
    const cdf=(x:number)=>0.5*(1+erf(x/Math.SQRT2));
    const price=(v:number)=>{const root=Math.sqrt(t),d1=(Math.log(s/k)+(r+0.5*v*v)*t)/(v*root),d2=d1-v*root,disc=Math.exp(-r*t);return side==="call"?s*cdf(d1)-k*disc*cdf(d2):k*disc*cdf(-d2)-s*cdf(-d1)};
    let low=0.000001,high=5;
    if(premium<price(low)-0.000001||premium>price(high)+0.000001){setIvError("Premium is outside the supported model price range.");return;}
    for(let i=0;i<100;i++){const mid=(low+high)/2,model=price(mid);if(Math.abs(model-premium)<0.0000001){setIvResult(mid);return;}if(model<premium)low=mid;else high=mid;}
    setIvResult((low+high)/2);
  }

  return <div className="page-stack">
    <div className="notice"><ShieldCheck size={17}/><div><strong>Market data provider not connected</strong><span>Live option chain, LTP, OI, volume, IV and exchange Greeks are intentionally unavailable. No market values are fabricated.</span></div><span className="notice-tag">NO FEED</span></div>
    <section className="panel"><div className="panel-title"><div><h3>India index derivatives</h3><p>Choose the instrument you want to research</p></div><Activity size={18} className="muted-icon"/></div><div className="workbench-controls"><label>Underlying<select value={symbol} onChange={e=>setSymbol(e.target.value)}><option>NIFTY</option><option>BANKNIFTY</option><option>FINNIFTY</option></select></label><label>Expiry<select disabled><option>Connect market calendar first</option></select></label><label>Option type<select disabled><option>CE / PE chain unavailable</option></select></label></div><div className="empty-state"><div className="empty-icon"><Database size={21}/></div><strong>{symbol} option chain is not connected</strong><span>Once an authorised feed is configured, this area will show strike, CE/PE LTP, bid/ask, volume, OI, change in OI, IV and timestamp.</span></div></section>
    <section className="panel"><div className="panel-title"><div><h3>Modelled Greeks calculator</h3><p>Browser-side European Black-Scholes · user-supplied assumptions only</p></div><Calculator size={18} className="muted-icon"/></div><div className="calculator-fields greeks-fields">
      <label>Option side<select value={side} onChange={e=>setSide(e.target.value)}><option value="call">Call (CE)</option><option value="put">Put (PE)</option></select></label>
      <label>Underlying spot<input type="number" min="0.01" value={spot} onChange={e=>setSpot(e.target.value)}/></label>
      <label>Strike<input type="number" min="0.01" value={strike} onChange={e=>setStrike(e.target.value)}/></label>
      <label>Days to expiry<input type="number" min="0.1" value={days} onChange={e=>setDays(e.target.value)}/></label>
      <label>Risk-free rate (decimal)<input type="number" step="0.001" value={rate} onChange={e=>setRate(e.target.value)}/></label>
      <label>Volatility (decimal)<input type="number" step="0.01" value={vol} onChange={e=>setVol(e.target.value)}/></label>
    </div><button className="primary-button" onClick={calculate} disabled={loading}>{loading ? "Calculating…" : "Calculate theoretical Greeks"}</button>
    {error && <p className="error-text">{error}</p>}
    {result && <div className="greeks-result"><div><span>Theoretical price</span><strong>{result.theoretical_price.toFixed(2)}</strong></div><div><span>Delta</span><strong>{result.delta.toFixed(4)}</strong></div><div><span>Gamma</span><strong>{result.gamma.toFixed(6)}</strong></div><div><span>Theta / year</span><strong>{result.theta_per_year.toFixed(2)}</strong></div><div><span>Vega / 1 vol point</span><strong>{result.vega_per_1pct.toFixed(4)}</strong></div></div>}
    <div className="cepe-compare"><div className="cepe-heading"><div><strong>Compare CALL (CE) vs PUT (PE)</strong><span>Same spot, strike, expiry, rate and volatility assumptions</span></div><button className="outline-button" onClick={compareCallPut}>Compare both sides</button></div>
      {comparisonError&&<p className="error-text">{comparisonError}</p>}
      {comparison&&<div className="cepe-table-wrap"><table className="data-table cepe-table"><thead><tr><th>Model output</th><th>CALL · CE</th><th>PUT · PE</th><th>What it tells you</th></tr></thead><tbody>
        <tr><td>Theoretical premium</td><td>{comparison.call.theoretical_price.toFixed(2)}</td><td>{comparison.put.theoretical_price.toFixed(2)}</td><td>Model estimate only; not market LTP</td></tr>
        <tr><td>Delta</td><td>{comparison.call.delta.toFixed(4)}</td><td>{comparison.put.delta.toFixed(4)}</td><td>Directional sensitivity</td></tr>
        <tr><td>Gamma</td><td>{comparison.call.gamma.toFixed(6)}</td><td>{comparison.put.gamma.toFixed(6)}</td><td>How quickly delta changes</td></tr>
        <tr><td>Theta / year</td><td>{comparison.call.theta_per_year.toFixed(2)}</td><td>{comparison.put.theta_per_year.toFixed(2)}</td><td>Modelled time sensitivity</td></tr>
        <tr><td>Vega / 1 vol point</td><td>{comparison.call.vega_per_1pct.toFixed(4)}</td><td>{comparison.put.vega_per_1pct.toFixed(4)}</td><td>Sensitivity to implied volatility</td></tr>
      </tbody></table></div>}
      <p className="disclaimer-small">A higher model premium or a positive/negative delta does not make an option better. A real CE/PE decision also needs a verified price, bid/ask spread, volume, OI, IV, expiry, trend, trigger, costs and a defined maximum loss. If these are missing, the right result is NO TRADE.</p>
    </div>
    <p className="disclaimer-small">Model output calculated in this browser, not a quote or implied volatility. Assumes European exercise and omits dividends, early exercise, jumps, liquidity and trading costs.</p>
    <div className="iv-solver"><div><strong>Implied volatility solver</strong><span>Enter an option premium to estimate model-implied volatility</span></div><label>Option premium<input type="number" min="0.01" value={marketPremium} onChange={e=>setMarketPremium(e.target.value)}/></label><button className="outline-button" onClick={solveImpliedVolatility}>Solve IV</button>{ivError&&<p className="error-text">{ivError}</p>}{ivResult!==null&&<strong className="iv-result">{(ivResult*100).toFixed(2)}% annualised model IV</strong>}</div></section>
  </div>;
}
