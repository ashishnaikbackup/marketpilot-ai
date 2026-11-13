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
  const [tab, setTab] = useState("Portfolio & P&L");
  const [historyCsv, setHistoryCsv] = useState("");
  const [tradeSide,setTradeSide]=useState("Long");
  const [tradeEntry,setTradeEntry]=useState("100");
  const [tradeStop,setTradeStop]=useState("95");
  const [tradeTarget,setTradeTarget]=useState("110");
  const [tradeCapital,setTradeCapital]=useState("100000");
  const [tradeRisk,setTradeRisk]=useState("1");
  const [tradeLot,setTradeLot]=useState("1");
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
  const history = useMemo(() => {
    const rows = historyCsv.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    if (rows.length < 21 || rows.length > 5002) return null;
    const parsed = rows.slice(1).map(line=>line.split(/[;,\t]/)).map(parts=>({date:parts[0]?.trim()||"",close:Number(parts[1])})).filter(x=>x.date && Number.isFinite(x.close) && x.close>0).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    if (parsed.length < 20 || parsed.some(x=>!Number.isFinite(Date.parse(x.date)))) return null;
    const prices=parsed.map(x=>x.close), returns=prices.slice(1).map((x,i)=>x/prices[i]-1);
    const mean=returns.reduce((a,b)=>a+b,0)/(returns.length||1);
    const variance=returns.reduce((a,b)=>a+Math.pow(b-mean,2),0)/Math.max(1,returns.length-1);
    let peak=prices[0],dd=0; for(const x of prices){peak=Math.max(peak,x);dd=Math.max(dd,(peak-x)/peak);}
    const changes=returns.slice(-14),gains=changes.filter(x=>x>0),losses=changes.filter(x=>x<0).map(x=>Math.abs(x));
    const avgGain=gains.reduce((a,b)=>a+b,0)/14,avgLoss=losses.reduce((a,b)=>a+b,0)/14;
    const rsi=avgLoss===0?100:100-(100/(1+avgGain/avgLoss));
    const sma=(n:number)=>prices.length>=n?prices.slice(-n).reduce((a,b)=>a+b,0)/n:null;
    const days=Math.max(1,(Date.parse(parsed[parsed.length-1].date)-Date.parse(parsed[0].date))/86400000);
    const cagr=(Math.pow(prices[prices.length-1]/prices[0],365/days)-1)*100;
    const lo=Math.min(...prices),hi=Math.max(...prices),range=hi-lo||1;
    const points=prices.map((v,i)=>`${(i/(prices.length-1))*600},${150-((v-lo)/range)*135}`).join(" ");
    return {rows:parsed,last:prices[prices.length-1],total:(prices[prices.length-1]/prices[0]-1)*100,cagr,vol:Math.sqrt(variance*252)*100,drawdown:dd*100,rsi,sma20:sma(20),sma50:sma(50),points};
  },[historyCsv]);
  const tradePlan = useMemo(() => {
    const entry=Number(tradeEntry),stop=Number(tradeStop),target=Number(tradeTarget),capital=Number(tradeCapital),riskPct=Number(tradeRisk),lot=Math.max(1,Number(tradeLot)||1);
    const riskPerUnit=tradeSide==="Long"?entry-stop:stop-entry;
    const rewardPerUnit=tradeSide==="Long"?target-entry:entry-target;
    const valid=entry>0&&stop>0&&target>0&&capital>0&&riskPct>0&&riskPct<=5&&riskPerUnit>0&&rewardPerUnit>0;
    const maxRisk=capital*riskPct/100,units=valid?Math.floor(maxRisk/riskPerUnit/lot)*lot:0;
    return {valid,riskPerUnit,rewardPerUnit,maxRisk,units,plannedLoss:units*riskPerUnit,plannedProfit:units*rewardPerUnit,rr:riskPerUnit>0?rewardPerUnit/riskPerUnit:0};
  },[tradeSide,tradeEntry,tradeStop,tradeTarget,tradeCapital,tradeRisk,tradeLot]);
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

  const tabs = [{name:"Portfolio & P&L",icon:Wallet},{name:"Compare assets",icon:BarChart3},{name:"Calculators",icon:Calculator},{name:"Research journal",icon:TrendingUp},{name:"Market timing",icon:Clock3},{name:"Historical Data Lab",icon:BarChart3},{name:"Trade & Risk Planner",icon:ShieldCheck}];
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
    {tab==="Trade & Risk Planner" && <section className="panel"><div className="panel-title"><div><h3>Position sizing & scenario P&L</h3><p>Calculate risk using your own entry, stop, target and capital assumptions</p></div><span className="pill muted">PLANNING TOOL</span></div>
      <div className="notice"><ShieldCheck size={16}/><div><strong>This is not a trade signal</strong><span>It does not suggest a security, entry time or direction. It only sizes a hypothetical position from values you enter.</span></div></div>
      <div className="calculator-fields hub-fields">
        <label>Position side<select value={tradeSide} onChange={e=>setTradeSide(e.target.value)}><option>Long</option><option>Short</option></select></label>
        <label>Entry price<input type="number" min="0" value={tradeEntry} onChange={e=>setTradeEntry(e.target.value)}/></label>
        <label>Stop-loss price<input type="number" min="0" value={tradeStop} onChange={e=>setTradeStop(e.target.value)}/></label>
        <label>Target price<input type="number" min="0" value={tradeTarget} onChange={e=>setTradeTarget(e.target.value)}/></label>
        <label>Trading capital (₹)<input type="number" min="0" value={tradeCapital} onChange={e=>setTradeCapital(e.target.value)}/></label>
        <label>Risk per idea (%) · max 5<input type="number" min="0.1" max="5" step="0.1" value={tradeRisk} onChange={e=>setTradeRisk(e.target.value)}/></label>
        <label>Lot / unit multiple<input type="number" min="1" value={tradeLot} onChange={e=>setTradeLot(e.target.value)}/></label>
      </div>
      {!tradePlan.valid?<p className="negative hub-footnote">Check your inputs: for Long, stop must be below entry and target above entry; for Short, stop must be above entry and target below entry. Risk must be between 0 and 5%.</p>:<div className="portfolio-stats history-stats"><article><span>Suggested max units from risk cap</span><strong>{tradePlan.units.toLocaleString("en-IN")}</strong></article><article><span>Planned maximum loss</span><strong className="negative">{money(tradePlan.plannedLoss)}</strong></article><article><span>Potential target P&L</span><strong className="positive">{money(tradePlan.plannedProfit)}</strong></article><article><span>Reward / risk</span><strong>{tradePlan.rr.toFixed(2)} : 1</strong></article><article><span>Risk per unit</span><strong>{money(tradePlan.riskPerUnit)}</strong></article><article><span>Risk budget</span><strong>{money(tradePlan.maxRisk)}</strong></article></div>}
      <p className="hub-footnote">Position sizing assumes a fill exactly at the entered prices and ignores gaps, partial fills, slippage, brokerage, taxes, margin, liquidity, contract rules and correlated portfolio exposure. Actual loss can exceed the planned stop-loss risk. Derivatives require contract-specific lot sizes and margin checks.</p>
    </section>}
    {tab==="Historical Data Lab" && <section className="panel"><div className="panel-title"><div><h3>Historical asset analyzer</h3><p>Import CSV close-price history for Indian stocks, ETFs, gold, funds or global tickers</p></div><span className="pill muted">YOUR DATA</span></div>
      <div className="notice"><ShieldCheck size={16}/><div><strong>No fabricated quotes</strong><span>Paste or import your own historical data. Required CSV columns: date,close. Use daily closes and include a header row.</span></div></div>
      <label className="hub-upload">Import CSV file<input type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];if(file){const reader=new FileReader();reader.onload=()=>setHistoryCsv(String(reader.result||""));reader.readAsText(file);}}}/></label>
      <label className="history-paste">Or paste CSV data<textarea rows={7} value={historyCsv} onChange={e=>setHistoryCsv(e.target.value)} placeholder={"date,close\\n2025-01-01,100\\n2025-01-02,101\\n..."} /></label>
      {historyCsv.trim() && !history && <p className="negative hub-footnote">Unable to calculate. Check the CSV header, dates, positive close values and include 20–5000 valid rows.</p>}
      {history && <><div className="history-chart"><div className="chart-title"><strong>Close-price history</strong><span>{history.rows.length} observations · {history.rows[0].date} to {history.rows[history.rows.length-1].date}</span></div><svg viewBox="0 0 600 160" role="img" aria-label="Historical closing price line chart"><polyline points={history.points} fill="none" stroke="#91a3ff" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/></svg></div>
      <div className="portfolio-stats history-stats"><article><span>Total return</span><strong className={history.total>=0?"positive":"negative"}>{history.total.toFixed(2)}%</strong></article><article><span>Approx. CAGR</span><strong>{history.cagr.toFixed(2)}%</strong></article><article><span>Annualised volatility</span><strong>{history.vol.toFixed(2)}%</strong></article><article><span>Maximum drawdown</span><strong className="negative">{history.drawdown.toFixed(2)}%</strong></article><article><span>RSI (14)</span><strong>{history.rsi.toFixed(1)}</strong></article><article><span>Price vs SMA20</span><strong className={history.sma20!==null&&history.last>=history.sma20?"positive":"negative"}>{history.sma20===null?"N/A":history.last>=history.sma20?"Above":"Below"}</strong></article></div>
      <div className="notice"><BarChart3 size={16}/><div><strong>Historical context only</strong><span>Last close {history.last.toFixed(4)} · SMA20 {history.sma20?.toFixed(4)??"not available"} · SMA50 {history.sma50?.toFixed(4)??"not available"}. These indicators describe the uploaded sample; they do not generate a live trade signal.</span></div></div>
      <p className="hub-footnote">CAGR uses calendar-day span. Volatility annualises daily close-to-close sample standard deviation by √252. RSI uses a simple 14-observation average. No dividends, splits, corporate actions, benchmark, taxes, transaction costs or survivorship adjustments are applied. Check adjusted-close data quality before comparing securities.</p></>}
    </section>}
    {tab==="Market timing" && <div className="hub-two-col"><section className="panel"><div className="panel-title"><div><h3>India cash & derivatives session</h3><p>Regular NSE equity market session · India Standard Time</p></div><Clock3 size={17}/></div><div className="timing-list"><article><time>09:00–09:08</time><div><strong>Pre-open order entry</strong><span>Indicative price discovery; avoid treating early indications as confirmed trend.</span></div></article><article><time>09:08–09:15</time><div><strong>Matching / transition</strong><span>Opening price formation and transition into normal market.</span></div></article><article><time>09:15–10:00</time><div><strong>Opening volatility window</strong><span>Observe opening range, spreads, gaps and confirmation. Avoid chasing a single candle.</span></div></article><article><time>10:00–14:30</time><div><strong>Developing session</strong><span>Assess trend, breadth, volume and risk/reward; lower activity is not automatically a signal.</span></div></article><article><time>14:30–15:30</time><div><strong>Closing / position review</strong><span>Watch closing liquidity, event risk and overnight exposure. Follow your plan, not urgency.</span></div></article></div></section>
      <section className="panel"><div className="panel-title"><div><h3>Before considering a trade</h3><p>Decision-quality checklist, not an entry signal</p></div><ShieldCheck size={17}/></div><ul className="hub-bullets"><li>Is the instrument liquid and the spread reasonable?</li><li>Is the data source authorised, fresh and timestamped?</li><li>What is the broader trend, volatility regime and event risk?</li><li>Where is the thesis invalidated, and what is the maximum loss?</li><li>Does expected reward justify fees, slippage and risk?</li><li>Is the setup within a tested written strategy and risk limit?</li><li>If evidence is incomplete, the correct result is NO TRADE.</li></ul><div className="notice"><ShieldCheck size={16}/><div><strong>No personalised live buy/sell calls</strong><span>Specific trade timing requires a connected licensed feed, tested strategy, full risk controls and regulatory review.</span></div></div></section></div>}
  </div>;
}
