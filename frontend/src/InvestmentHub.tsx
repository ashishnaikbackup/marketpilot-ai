import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, Calculator, Clock3, Plus, ShieldCheck, Trash2, TrendingUp, Wallet } from "lucide-react";

type Holding = { id: string; symbol: string; asset: string; quantity: number; average: number; last: number; currency: string; fx: number };
type Comparison = { id: string; symbol: string; category: string; expected: number; volatility: number; cost: number; horizon: number };
type ResearchNote = { id: string; symbol: string; thesis: string; catalyst: string; risk: string; invalidation: string; created: string };

const ASSETS = ["Indian equity", "ETF", "Mutual fund", "Gold", "Silver", "Commodity", "Bond / FD", "REIT", "US equity", "Global ETF", "FX", "Crypto"];
const money = (v: number, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0);
const readStore = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};
const id = () => globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random());

export default function InvestmentHub() {
  const [tab, setTab] = useState("Portfolio");
  const [holdings, setHoldings] = useState<Holding[]>(() => readStore("mp-investment-holdings-v1", []));
  const [comparisons, setComparisons] = useState<Comparison[]>(() => readStore("mp-investment-comparisons-v1", [
    { id: "sample-a", symbol: "Add your asset", category: "Indian equity", expected: 0, volatility: 0, cost: 0, horizon: 5 }
  ]));
  const [notes, setNotes] = useState<ResearchNote[]>(() => readStore("mp-research-notes-v1", []));
  const [symbol, setSymbol] = useState("");
  const [asset, setAsset] = useState(ASSETS[0]);
  const [qty, setQty] = useState("1");
  const [average, setAverage] = useState("");
  const [last, setLast] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [fx, setFx] = useState("1");
  const [compareSymbol, setCompareSymbol] = useState("");
  const [compareCategory, setCompareCategory] = useState(ASSETS[0]);
  const [expected, setExpected] = useState("10");
  const [volatility, setVolatility] = useState("18");
  const [cost, setCost] = useState("0.5");
  const [horizon, setHorizon] = useState("5");
  const [sip, setSip] = useState("1000");
  const [rate, setRate] = useState("10");
  const [years, setYears] = useState("10");
  const [lump, setLump] = useState("10000");
  const [goal, setGoal] = useState("1000000");
  const [thesis, setThesis] = useState("");
  const [catalyst, setCatalyst] = useState("");
  const [risk, setRisk] = useState("");
  const [invalidation, setInvalidation] = useState("");

  useEffect(() => { localStorage.setItem("mp-investment-holdings-v1", JSON.stringify(holdings)); }, [holdings]);
  useEffect(() => { localStorage.setItem("mp-investment-comparisons-v1", JSON.stringify(comparisons)); }, [comparisons]);
  useEffect(() => { localStorage.setItem("mp-research-notes-v1", JSON.stringify(notes)); }, [notes]);

  const totals = useMemo(() => holdings.reduce((a, h) => {
    const invested = h.quantity * h.average * h.fx;
    const value = h.quantity * h.last * h.fx;
    a.invested += invested; a.value += value; a.pnl += value - invested; return a;
  }, { invested: 0, value: 0, pnl: 0 }), [holdings]);
  const sipResult = useMemo(() => {
    const p = Math.max(0, Number(sip) || 0), r = (Number(rate) || 0) / 1200, n = Math.max(0, Number(years) || 0) * 12;
    const fv = r === 0 ? p * n : p * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    return { invested: p * n, value: fv, gain: fv - p * n };
  }, [sip, rate, years]);
  const lumpResult = useMemo(() => {
    const p = Math.max(0, Number(lump) || 0), r = (Number(rate) || 0) / 100, n = Math.max(0, Number(years) || 0);
    const value = p * Math.pow(1 + r, n); return { invested: p, value, gain: value - p };
  }, [lump, rate, years]);
  const compareRank = useMemo(() => comparisons.filter(x => x.symbol !== "Add your asset").map(x => ({ ...x, net: x.expected - x.cost, score: x.volatility > 0 ? (x.expected - x.cost) / x.volatility : 0, future: 100000 * Math.pow(1 + (x.expected - x.cost) / 100, x.horizon) })).sort((a,b)=>b.score-a.score), [comparisons]);

  function addHolding() {
    const q=Number(qty), a=Number(average), l=Number(last), f=Number(fx);
    if (!symbol.trim() || !(q>0) || !(a>0) || !(l>0) || !(f>0)) return;
    setHoldings(old=>[...old,{id:id(),symbol:symbol.trim().toUpperCase(),asset,quantity:q,average:a,last:l,currency,fx:f}]);
    setSymbol(""); setQty("1"); setAverage(""); setLast("");
  }
  function addComparison() {
    if (!compareSymbol.trim() || Number(volatility)<=0 || Number(horizon)<=0) return;
    setComparisons(old=>[...old.filter(x=>x.symbol!=="Add your asset"),{id:id(),symbol:compareSymbol.trim().toUpperCase(),category:compareCategory,expected:Number(expected),volatility:Number(volatility),cost:Number(cost),horizon:Number(horizon)}]);
    setCompareSymbol("");
  }
  function saveNote() {
    if (!symbol.trim() || !thesis.trim() || !risk.trim() || !invalidation.trim()) return;
    setNotes(old=>[{id:id(),symbol:symbol.trim().toUpperCase(),thesis,catalyst,risk,invalidation,created:new Date().toLocaleDateString("en-IN")},...old]);
    setThesis("");setCatalyst("");setRisk("");setInvalidation("");
  }

  const tabs = [{name:"Portfolio & P&L",icon:Wallet},{name:"Compare assets",icon:BarChart3},{name:"Calculators",icon:Calculator},{name:"Research journal",icon:TrendingUp},{name:"Market timing",icon:Clock3}];
  return <div className="page-stack investment-hub">
    <div className="notice"><ShieldCheck size={17}/><div><strong>FinPilot wealth tools + MarketPilot market research</strong><span>One integrated workspace. Personal calculations use your entries; no live prices or AI trade signals are implied.</span></div><span className="notice-tag">INTEGRATED</span></div>
    <div className="hub-tabs">{tabs.map(({name,icon:Icon})=><button key={name} className={tab===name?"selected":""} onClick={()=>setTab(name)}><Icon size={15}/>{name}</button>)}</div>
    {tab==="Portfolio & P&L" && <>
      <section className="portfolio-stats"><article><span>Total invested (converted to INR)</span><strong>{money(totals.invested)}</strong></article><article><span>Current value (manual marks)</span><strong>{money(totals.value)}</strong></article><article><span>Unrealised P&L</span><strong className={totals.pnl>=0?"positive":"negative"}>{money(totals.pnl)} ({totals.invested?((totals.pnl/totals.invested)*100).toFixed(2):"0.00"}%)</strong></article></section>
      <section className="panel"><div className="panel-title"><div><h3>Add holding</h3><p>Indian stocks, ETFs, funds, gold and international assets</p></div><span className="pill muted">MANUAL INPUT</span></div>
        <div className="calculator-fields hub-fields">
          <label>Symbol / asset<input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="e.g. RELIANCE, GOLDBEES, AAPL"/></label>
          <label>Asset class<select value={asset} onChange={e=>setAsset(e.target.value)}>{ASSETS.map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Quantity / units<input type="number" min="0" value={qty} onChange={e=>setQty(e.target.value)}/></label>
          <label>Average buy price<input type="number" min="0" value={average} onChange={e=>setAverage(e.target.value)}/></label>
          <label>Latest price (manual)<input type="number" min="0" value={last} onChange={e=>setLast(e.target.value)}/></label>
          <label>Price currency<select value={currency} onChange={e=>{setCurrency(e.target.value);setFx(e.target.value==="INR"?"1":fx)}}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
          <label>FX to INR<input type="number" min="0" step="0.0001" value={fx} onChange={e=>setFx(e.target.value)}/></label>
        </div><button className="primary-button" onClick={addHolding}><Plus size={14}/>Add to portfolio</button>
      </section>
      <section className="panel"><div className="panel-title"><div><h3>Holdings ledger</h3><p>Unrealised P&L calculated from your entered prices and FX rate</p></div><span className="pill muted">{holdings.length} HOLDINGS</span></div>
        {holdings.length===0?<div className="empty-state"><Wallet size={23}/><strong>Your portfolio is empty</strong><span>Add a holding above to start tracking exposure and P&L.</span></div>:<div className="table-scroll"><table className="hub-table"><thead><tr><th>Asset</th><th>Class</th><th>Units</th><th>Avg cost</th><th>Manual LTP</th><th>Unrealised P&L (INR)</th><th/></tr></thead><tbody>{holdings.map(h=>{const pnl=(h.last-h.average)*h.quantity*h.fx;return <tr key={h.id}><td><strong>{h.symbol}</strong><small>{h.currency}</small></td><td>{h.asset}</td><td>{h.quantity}</td><td>{money(h.average,h.currency)}</td><td>{money(h.last,h.currency)}</td><td className={pnl>=0?"positive":"negative"}>{money(pnl)}</td><td><button className="icon-button" onClick={()=>setHoldings(old=>old.filter(x=>x.id!==h.id))} aria-label={"Remove "+h.symbol}><Trash2 size={14}/></button></td></tr>})}</tbody></table></div>}
      </section>
      <p className="hub-footnote">P&L excludes brokerage, taxes, dividends, corporate actions and accrued interest. Foreign holdings use the FX-to-INR rate you enter. Data is saved in this browser only; it is not a broker statement or tax report.</p>
    </>}
    {tab==="Compare assets" && <section className="panel"><div className="panel-title"><div><h3>Asset comparison workbench</h3><p>Compare return assumptions, volatility and costs across asset classes</p></div><span className="pill muted">USER ASSUMPTIONS</span></div>
      <div className="calculator-fields hub-fields">
        <label>Asset / ticker<input value={compareSymbol} onChange={e=>setCompareSymbol(e.target.value)} placeholder="e.g. NIFTYBEES, GOLDBEES, SPY"/></label>
        <label>Asset class<select value={compareCategory} onChange={e=>setCompareCategory(e.target.value)}>{ASSETS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Expected annual return (%)<input type="number" value={expected} onChange={e=>setExpected(e.target.value)}/></label>
        <label>Annual volatility (%)<input type="number" min="0.01" value={volatility} onChange={e=>setVolatility(e.target.value)}/></label>
        <label>Annual cost / expense (%)<input type="number" min="0" value={cost} onChange={e=>setCost(e.target.value)}/></label>
        <label>Horizon (years)<input type="number" min="1" value={horizon} onChange={e=>setHorizon(e.target.value)}/></label>
      </div><button className="primary-button" onClick={addComparison}><Plus size={14}/>Add comparison</button>
      {compareRank.length>0&&<div className="table-scroll"><table className="hub-table"><thead><tr><th>Asset</th><th>Net assumption</th><th>Volatility</th><th>Risk-adjusted ratio*</th><th>₹1 lakh projected</th><th/></tr></thead><tbody>{compareRank.map(x=><tr key={x.id}><td><strong>{x.symbol}</strong><small>{x.category}</small></td><td>{x.net.toFixed(2)}%</td><td>{x.volatility.toFixed(2)}%</td><td>{x.score.toFixed(2)}</td><td>{money(x.future)}</td><td><button className="icon-button" onClick={()=>setComparisons(old=>old.filter(y=>y.id!==x.id))} aria-label={"Remove "+x.symbol}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>}
      <p className="hub-footnote">*Net expected return divided by volatility is a simple comparison ratio, not a Sharpe ratio. Projections assume a constant annual rate and ignore taxes, inflation, tracking error, currency movement and changing market conditions. Ranking is mathematical sorting of your assumptions, not an investment recommendation.</p>
    </section>}
    {tab==="Calculators" && <div className="hub-two-col"><section className="panel"><div className="panel-title"><div><h3>SIP & compounding calculator</h3><p>Monthly contribution with monthly compounding</p></div><Calculator size={17}/></div><div className="calculator-fields hub-fields"><label>Monthly SIP (₹)<input type="number" min="0" value={sip} onChange={e=>setSip(e.target.value)}/></label><label>Assumed annual return (%)<input type="number" value={rate} onChange={e=>setRate(e.target.value)}/></label><label>Years<input type="number" min="1" value={years} onChange={e=>setYears(e.target.value)}/></label></div><div className="calc-result"><span>Invested {money(sipResult.invested)}</span><strong>{money(sipResult.value)}</strong><span className="positive">Illustrative gain {money(sipResult.gain)}</span></div></section>
      <section className="panel"><div className="panel-title"><div><h3>Lump-sum growth calculator</h3><p>Annual compounding assumption</p></div><TrendingUp size={17}/></div><div className="calculator-fields hub-fields"><label>Initial amount (₹)<input type="number" min="0" value={lump} onChange={e=>setLump(e.target.value)}/></label><label>Assumed annual return (%)<input type="number" value={rate} onChange={e=>setRate(e.target.value)}/></label><label>Years<input type="number" min="1" value={years} onChange={e=>setYears(e.target.value)}/></label></div><div className="calc-result"><span>Invested {money(lumpResult.invested)}</span><strong>{money(lumpResult.value)}</strong><span className="positive">Illustrative gain {money(lumpResult.gain)}</span></div></section>
      <section className="panel"><div className="panel-title"><div><h3>Goal planning</h3><p>Estimate monthly contribution required</p></div><Calculator size={17}/></div><div className="calculator-fields hub-fields"><label>Target amount (₹)<input type="number" min="1" value={goal} onChange={e=>setGoal(e.target.value)}/></label><label>Return assumption (%)<input type="number" value={rate} onChange={e=>setRate(e.target.value)}/></label><label>Years<input type="number" min="1" value={years} onChange={e=>setYears(e.target.value)}/></label></div><div className="calc-result"><span>Estimated monthly SIP</span><strong>{money((Number(goal)||0)/((Number(rate)===0?Number(years)*12:(Math.pow(1+(Number(rate)||0)/1200,Number(years)*12)-1)/((Number(rate)||0)/1200)*(1+(Number(rate)||0)/1200))) )}</strong><span>Before tax, inflation and investment risk</span></div></section>
      <section className="panel"><div className="panel-title"><div><h3>Risk & return basics</h3><p>Read before using projections</p></div><ShieldCheck size={17}/></div><ul className="hub-bullets"><li>Higher expected return usually comes with higher uncertainty.</li><li>Past returns do not predict future performance.</li><li>Compare like-for-like periods, currency and total-return data.</li><li>Include fees, taxes, inflation and liquidity in real decisions.</li></ul></section></div>}
    {tab==="Research journal" && <><section className="panel"><div className="panel-title"><div><h3>Investment research brief</h3><p>Record your thesis before making a decision</p></div><span className="pill muted">EVIDENCE FIRST</span></div><div className="calculator-fields hub-fields"><label>Symbol / asset<input value={symbol} onChange={e=>setSymbol(e.target.value)} placeholder="Ticker / fund / commodity"/></label><label className="span-two">Investment thesis<textarea rows={3} value={thesis} onChange={e=>setThesis(e.target.value)} placeholder="Why are you researching this asset?"/></label><label>Catalysts / supporting evidence<textarea rows={3} value={catalyst} onChange={e=>setCatalyst(e.target.value)}/></label><label>Key risks<textarea rows={3} value={risk} onChange={e=>setRisk(e.target.value)}/></label><label className="span-two">What would invalidate the thesis?<textarea rows={2} value={invalidation} onChange={e=>setInvalidation(e.target.value)}/></label></div><button className="primary-button" onClick={saveNote}><Plus size={14}/>Save research note</button></section>
      <section className="panel"><div className="panel-title"><h3>Saved research</h3><span className="pill muted">{notes.length} NOTES</span></div>{notes.length===0?<div className="empty-state"><BookOpen size={22}/><strong>No research saved yet</strong><span>Write a thesis with evidence, risk and invalidation above.</span></div>:notes.map(n=><article className="research-note" key={n.id}><div><strong>{n.symbol}</strong><small>{n.created}</small></div><p>{n.thesis}</p><span><b>Evidence:</b> {n.catalyst||"Not added"}</span><span><b>Risks:</b> {n.risk}</span><span><b>Invalidation:</b> {n.invalidation}</span><button className="outline-button" onClick={()=>setNotes(old=>old.filter(x=>x.id!==n.id))}>Delete note</button></article>)}</section></>}
    {tab==="Market timing" && <div className="hub-two-col"><section className="panel"><div className="panel-title"><div><h3>India cash & derivatives session</h3><p>Regular NSE equity market session · India Standard Time</p></div><Clock3 size={17}/></div><div className="timing-list"><article><time>09:00–09:08</time><div><strong>Pre-open order entry</strong><span>Indicative price discovery; avoid treating early indications as confirmed trend.</span></div></article><article><time>09:08–09:15</time><div><strong>Matching / transition</strong><span>Opening price formation and transition into normal market.</span></div></article><article><time>09:15–10:00</time><div><strong>Opening volatility window</strong><span>Observe opening range, spreads, gaps and confirmation. Avoid chasing a single candle.</span></div></article><article><time>10:00–14:30</time><div><strong>Developing session</strong><span>Assess trend, breadth, volume and risk/reward; lower activity is not automatically a signal.</span></div></article><article><time>14:30–15:30</time><div><strong>Closing / position review</strong><span>Watch closing liquidity, event risk and overnight exposure. Follow your plan, not urgency.</span></div></article></div></section>
      <section className="panel"><div className="panel-title"><div><h3>Before considering a trade</h3><p>Decision-quality checklist, not an entry signal</p></div><ShieldCheck size={17}/></div><ul className="hub-bullets"><li>Is the instrument liquid and the spread reasonable?</li><li>Is the data source authorised, fresh and timestamped?</li><li>What is the broader trend, volatility regime and event risk?</li><li>Where is the thesis invalidated, and what is the maximum loss?</li><li>Does expected reward justify fees, slippage and risk?</li><li>Is the setup within a tested written strategy and risk limit?</li><li>If evidence is incomplete, the correct result is NO TRADE.</li></ul><div className="notice"><ShieldCheck size={16}/><div><strong>No personalised live buy/sell calls</strong><span>Specific trade timing requires a connected licensed feed, tested strategy, full risk controls and regulatory review.</span></div></div></section></div>}
  </div>;
}
