import { useMemo, useState } from "react";
import { Calculator, ShieldAlert } from "lucide-react";

type Side = "call" | "put";
type Direction = "long" | "short";

export default function PayoffCalculator() {
  const [side, setSide] = useState<Side>("call");
  const [direction, setDirection] = useState<Direction>("long");
  const [strike, setStrike] = useState(25000);
  const [premium, setPremium] = useState(120);
  const [spot, setSpot] = useState(25200);
  const [lots, setLots] = useState(1);
  const [lotSize, setLotSize] = useState(1);

  const result = useMemo(() => {
    const intrinsic = side === "call" ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
    const unitPnl = (intrinsic - premium) * (direction === "long" ? 1 : -1);
    const pnl = unitPnl * lots * lotSize;
    const breakeven = side === "call" ? strike + premium : Math.max(strike - premium, 0);
    const longMaxLoss = premium * lots * lotSize;
    return { pnl, breakeven, longMaxLoss };
  }, [side, direction, strike, premium, spot, lots, lotSize]);

  const money = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);

  return <section className="section-block">
    <div className="section-heading"><div><h2>F&O payoff calculator</h2><p>Model a single option leg at expiry — no live quote required</p></div><span className="pill muted">EDUCATIONAL TOOL</span></div>
    <div className="panel calculator-panel">
      <div className="calculator-heading"><div className="chain-icon"><Calculator size={20}/></div><div><h3>Expiry scenario calculator</h3><p>Enter your own assumptions. Values are not market quotes.</p></div></div>
      <div className="calculator-fields">
        <label>Option type<select value={side} onChange={e=>setSide(e.target.value as Side)}><option value="call">Call (CE)</option><option value="put">Put (PE)</option></select></label>
        <label>Position<select value={direction} onChange={e=>setDirection(e.target.value as Direction)}><option value="long">Buy / Long</option><option value="short">Sell / Short</option></select></label>
        <label>Strike price<input type="number" min="0" value={strike} onChange={e=>setStrike(Number(e.target.value))}/></label>
        <label>Premium<input type="number" min="0" value={premium} onChange={e=>setPremium(Number(e.target.value))}/></label>
        <label>Spot at expiry<input type="number" min="0" value={spot} onChange={e=>setSpot(Number(e.target.value))}/></label>
        <label>Number of lots<input type="number" min="1" value={lots} onChange={e=>setLots(Math.max(1,Number(e.target.value)))}/></label>
        <label>Lot size<input type="number" min="1" value={lotSize} onChange={e=>setLotSize(Math.max(1,Number(e.target.value)))}/></label>
      </div>
      <div className="calculator-result">
        <div><span>Gross P&L at expiry</span><strong className={result.pnl>=0?"positive":"negative"}>{result.pnl>=0?"+":"−"}₹{money(Math.abs(result.pnl))}</strong></div>
        <div><span>Breakeven (single-leg)</span><strong>{money(result.breakeven)}</strong></div>
        <div><span>{direction==="long"?"Maximum premium at risk":"Risk profile"}</span><strong>{direction==="long"?`₹${money(result.longMaxLoss)}`:(side==="call"?"Potentially unlimited":"Substantial")}</strong></div>
      </div>
      <div className="calculator-warning"><ShieldAlert size={15}/><span>Expiry payoff only. Excludes brokerage, taxes, slippage, margin, liquidity, volatility changes and early exit value. Short options can carry large or unlimited risk. This is not a trade signal.</span></div>
    </div>
  </section>;
}
