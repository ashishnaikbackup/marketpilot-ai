import { Suspense, lazy, useState, type ComponentType } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Setup } from "./Setup";
import type { Settings } from "./api";

type Tool = { id: string; name: string; hint: string; Comp: ComponentType };
const tools: Tool[] = [
  { id: "fo", name: "Options (F&O) workbench", hint: "Greeks and implied volatility calculator", Comp: lazy(() => import("../FOWorkbench")) },
  { id: "payoff", name: "Payoff calculator", hint: "See profit and loss at expiry", Comp: lazy(() => import("../PayoffCalculator")) },
  { id: "strategy", name: "Strategy lab", hint: "Build multi-leg option strategies", Comp: lazy(() => import("../StrategyLab")) },
  { id: "india", name: "India market lab", hint: "Analyse an option chain you import", Comp: lazy(() => import("../IndiaMarketLab")) },
  { id: "scanner", name: "Opportunity scanner", hint: "Evidence checklist, including NO TRADE", Comp: lazy(() => import("../OpportunityScanner")) },
  { id: "backtest", name: "Backtest lab", hint: "Test a moving-average idea on past prices", Comp: lazy(() => import("../BacktestLab")) },
  { id: "global", name: "Global markets", hint: "Overseas market guide", Comp: lazy(() => import("../GlobalMarkets")) },
  { id: "invest", name: "Investment hub", hint: "SIP and goal calculators, assets", Comp: lazy(() => import("../InvestmentHub")) },
  { id: "money", name: "Money manager", hint: "Budget, spending and savings goals", Comp: lazy(() => import("../MoneyManager")) },
  { id: "manual", name: "Manual paper portfolio", hint: "Practise trades by hand in this browser", Comp: lazy(() => import("../PaperPortfolio")) },
  { id: "csvbot", name: "CSV paper bot", hint: "Run the bot on a file you import", Comp: lazy(() => import("../PaperTradingBot")) },
  { id: "notes", name: "Research notes", hint: "Write and keep your own reports", Comp: lazy(() => import("../ResearchReports")) },
  { id: "copilot", name: "AI Copilot (general)", hint: "Education chat; needs Workers AI enabled", Comp: lazy(() => import("../MarketPilotCopilot")) },
  { id: "learn", name: "Academy", hint: "Learn markets step by step", Comp: lazy(() => import("../Learn")) },
];

export default function More({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const tool = tools.find((t) => t.id === open);
  if (tool) return <>
    <button className="gx-btn plain" onClick={() => setOpen(null)}><ArrowLeft size={15} style={{ verticalAlign: -3 }} /> Back</button>
    <div className="gx-legacy"><Suspense fallback={<p style={{ color: "#9aa7bf" }}>Loading…</p>}><tool.Comp /></Suspense></div>
  </>;
  return <>
    <Setup settings={settings} onSave={onSave} />
    <div className="gx-h" style={{ marginTop: 22 }}><h2>Learning and tools</h2></div>
    <div className="gx-tools">{tools.map((t) => <button key={t.id} className="gx-tool" onClick={() => setOpen(t.id)}><strong>{t.name}</strong><small>{t.hint}</small></button>)}</div>
    <div className="gx-note info" style={{ marginTop: 18 }}><ShieldCheck size={16} /><span>MarketPilot is for learning and simulation only. It does not place real trades, hold your money or give investment advice.</span></div>
    <p className="gx-foot"><a href="https://github.com/ashishnaikbackup/marketpilot-ai/blob/main/docs/SETUP_CHECKLIST.md" target="_blank" rel="noreferrer">Setup guide</a> · <a href="https://github.com/ashishnaikbackup/marketpilot-ai" target="_blank" rel="noreferrer">Source code</a></p>
  </>;
}
