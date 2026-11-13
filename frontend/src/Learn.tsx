import { BookOpen, GraduationCap } from "lucide-react";

const lessons=[
 ["Market basics","Indices, stocks, ETFs, market breadth, liquidity and how exchanges work."],
 ["Options foundations","Calls, puts, strike, premium, expiry, intrinsic value, time value and moneyness."],
 ["Options risk","Long vs short risk, breakeven, assignment, gaps, liquidity, margin and transaction costs."],
 ["Volatility and Greeks","Implied vs realised volatility; Delta, Gamma, Theta and Vega; model assumptions."],
 ["Research discipline","Bull/base/bear scenarios, evidence quality, thesis invalidation and NO TRADE."],
 ["Portfolio foundations","Diversification, asset allocation, mutual funds, SIPs, drawdowns and compounding."]
];
export default function Learn(){return <div className="page-stack"><div className="notice"><GraduationCap size={17}/><div><strong>Learn before risking capital</strong><span>Begin with concepts and paper exercises. This section is educational, not personalised investment advice.</span></div><span className="notice-tag">LEARN</span></div><section className="panel"><div className="panel-title"><div><h3>Learning path</h3><p>Beginner to confident market researcher</p></div><BookOpen size={18} className="muted-icon"/></div><div className="framework-grid">{lessons.map(([title,desc],i)=><article key={title}><div className="lesson-number">0{i+1}</div><strong>{title}</strong><span>{desc}</span></article>)}</div><p className="disclaimer-small">Suggested order: complete the foundations first, then options and risk, then practise using the paper journal. Do not use leverage or F&amp;O as a beginner learning shortcut.</p></section></div>}
