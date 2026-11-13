import { useMemo, useState } from "react";
import PayoffCalculator from "./PayoffCalculator";
import FOWorkbench from "./FOWorkbench";
import OpportunityScanner from "./OpportunityScanner";
import PaperPortfolio from "./PaperPortfolio";
import ResearchReports from "./ResearchReports";
import Learn from "./Learn";
import StrategyLab from "./StrategyLab";
import GlobalMarkets from "./GlobalMarkets";
import BacktestLab from "./BacktestLab";
import InvestmentHub from "./InvestmentHub";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, BookOpen,
  CalendarDays, ChevronDown, CircleHelp, Compass, Globe2, LayoutDashboard,
  Menu, Search, ShieldCheck, SlidersHorizontal, Sparkles, Target, TrendingUp,
  Wallet, X,
} from "lucide-react";

type Tab = "Overview" | "F&O Workbench" | "Opportunity Scanner" | "Strategy Lab" | "Paper Portfolio" | "Research Reports" | "Global Markets" | "Learn" | "Backtest Lab" | "Investment Hub";
const nav: { label: Tab; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard }, { label: "F&O Workbench", icon: BarChart3 },
  { label: "Opportunity Scanner", icon: Target }, { label: "Strategy Lab", icon: SlidersHorizontal },
  { label: "Paper Portfolio", icon: Wallet }, { label: "Research Reports", icon: CalendarDays },
  { label: "Global Markets", icon: Globe2 }, { label: "Investment Hub", icon: Wallet }, { label: "Backtest Lab", icon: Activity }, { label: "Learn", icon: BookOpen },
];
const demoMarkets = [
  { name: "NIFTY 50", value: "24,850.00", change: "+0.42%", up: true },
  { name: "BANKNIFTY", value: "51,240.00", change: "-0.18%", up: false },
  { name: "FINNIFTY", value: "23,610.00", change: "+0.31%", up: true },
  { name: "INDIA VIX", value: "14.25", change: "-2.10%", up: false },
];

export default function App() {
  const [active, setActive] = useState<Tab>("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [index, setIndex] = useState("NIFTY 50");
  const [query, setQuery] = useState("");
  const filteredNav = useMemo(() => nav.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())), [query]);

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Activity size={21}/></div><div><strong>marketpilot<span>ai</span></strong><small>MARKET INTELLIGENCE</small></div><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="search-box"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search workspace"/></div>
      <nav className="nav-list">{filteredNav.map(({label,icon:Icon})=><button key={label} className={`nav-item ${active===label?"active":""}`} onClick={()=>{setActive(label);setMobileOpen(false)}}><Icon size={17}/><span>{label}</span>{label==="Opportunity Scanner"&&<i className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="data-card"><div className="data-card-top"><span className="pulse-dot"/> SYSTEM STATUS</div><strong>Research workspace</strong><small>Demo mode · no live feed connected</small></div><a className="nav-item" href="https://github.com/ashishnaikbackup/marketpilot-ai/blob/main/README.md" target="_blank" rel="noreferrer"><CircleHelp size={17}/><span>Help & documentation</span></a><div className="profile"><div className="avatar">MP</div><div><strong>Personal workspace</strong><small>Research mode</small></div><ChevronDown size={15}/></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="icon-button menu-toggle" onClick={()=>setMobileOpen(true)} aria-label="Open menu"><Menu size={19}/></button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><div className="market-status"><span className="pulse-dot"/> DEMO DATA</div><span className="icon-button" aria-hidden="true"><Bell size={18}/></span><div className="top-avatar">A</div></div></header>
      <div className="content">
        <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={13}/> YOUR MARKET RESEARCH DESK</div><h1>{active==="Overview"?"Good morning. Here's your market desk.":active}</h1><p className="subhead">{active==="Overview"?"A clear view of Indian markets, derivatives and the research that matters.":"This workspace is being built in milestones. Current market values are illustrative demo data."}</p></div><div className="date-button"><CalendarDays size={15}/> Today <ChevronDown size={14}/></div></div>
        {active === "Overview" ? <>
        <div className="notice"><ShieldCheck size={17}/><div><strong>Transparent demo mode</strong><span>These sample index values are illustrative only — not live, delayed or historical exchange quotes. Connect an authorised data provider before using market analytics.</span></div><span className="notice-tag">DEMO</span></div>
        <section className="section-block"><div className="section-heading"><div><h2>India market snapshot</h2><p>Core indices · F&O focus</p></div><button className="text-button" onClick={()=>setActive("Global Markets")}>View markets <ArrowUpRight size={14}/></button></div><div className="market-grid">{demoMarkets.map(item=><article className="market-card" key={item.name}><div className="market-card-top"><span>{item.name}</span><span className={item.up?"positive":"negative"}>{item.up?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>}</span></div><strong>{item.value}</strong><div className={item.up?"change positive":"change negative"}>{item.change}<span> demo sample</span></div><div className="sparkline"><svg viewBox="0 0 180 34" preserveAspectRatio="none"><path d={item.up?"M0 26 C18 23 24 27 40 18 S65 24 80 15 S104 18 120 10 S150 16 180 4":"M0 5 C18 9 24 4 40 15 S65 8 80 18 S104 14 120 23 S150 16 180 29"}/></svg></div></article>)}</div></section>
        <section className="section-block"><div className="section-heading"><div><h2>F&O intelligence</h2><p>Start with the indices you follow</p></div><div className="select-wrap"><select value={index} onChange={e=>setIndex(e.target.value)}><option>NIFTY 50</option><option>BANKNIFTY</option><option>FINNIFTY</option></select><ChevronDown size={14}/></div></div>
          <div className="fo-grid"><article className="panel"><div className="panel-title"><div><h3>{index} options overview</h3><p>Option chain module · awaiting authorised feed</p></div><span className="pill muted">NOT CONNECTED</span></div><div className="chain-placeholder"><div className="chain-icon"><BarChart3 size={23}/></div><strong>Options chain will appear here</strong><span>Calls · Strike · Puts · OI · Change in OI · IV · Greeks</span><button className="outline-button" onClick={()=>setActive("F&O Workbench")}>Explore F&O workbench <ArrowUpRight size={14}/></button></div></article>
          <article className="panel"><div className="panel-title"><div><h3>Market context</h3><p>Research checklist</p></div><Activity size={17} className="muted-icon"/></div><div className="context-list">{["Trend & market structure","Options positioning","Volatility regime","Event risk"].map(x=><div key={x}><span>{x}</span><b className="pill muted">Awaiting data</b></div>)}</div><div className="context-foot"><ShieldCheck size={15}/> No directional conclusion without validated inputs.</div></article></div></section>
        <section className="section-block lower-grid">
          <article className="panel"><div className="panel-title"><div><h3>Investment & wealth management</h3><p>FinPilot capabilities integrated into your market desk</p></div><Wallet size={18} className="muted-icon"/></div><div className="context-list">{["Multi-asset portfolio and unrealised P&L","Stocks · ETFs · mutual funds · gold · global assets","SIP, lump-sum and financial goal calculators","Historical data lab and position risk planner"].map(x=><div key={x}><span>{x}</span><b className="pill muted">AVAILABLE</b></div>)}</div><button className="outline-button" onClick={()=>setActive("Investment Hub")}>Open Investment Hub <ArrowUpRight size={14}/></button></article>
          <article className="panel"><div className="panel-title"><div><h3>MarketPilot Academy</h3><p>Self-paced learning from beginner to advanced</p></div><BookOpen size={18} className="muted-icon"/></div><div className="context-list">{["Market and asset-class foundations","Risk, portfolio construction and investing","F&O, Greeks and strategy risk","Backtesting and research discipline"].map(x=><div key={x}><span>{x}</span><b className="pill muted">LEARN</b></div>)}</div><button className="outline-button" onClick={()=>setActive("Academy")}>Continue learning <ArrowUpRight size={14}/></button></article>
        </section>
        <PayoffCalculator />
        <section className="section-block lower-grid"><article className="panel"><div className="panel-title"><div><h3>Opportunity scanner</h3><p>Evidence-led candidates, including NO TRADE</p></div><Target size={18} className="muted-icon"/></div><div className="empty-state"><div className="empty-icon"><Compass size={21}/></div><strong>No opportunities generated</strong><span>Scanner stays inactive until reliable market data and tested rules are configured.</span></div></article>
          <article className="panel"><div className="panel-title"><div><h3>Research schedule</h3><p>Automated reporting roadmap</p></div><CalendarDays size={18} className="muted-icon"/></div>{[{title:"Pre-market brief",desc:"India cues · global markets · event calendar",icon:TrendingUp},{title:"Closing report",desc:"Index recap · breadth · F&O activity",icon:BarChart3},{title:"Weekly & monthly review",desc:"Performance · risk · themes · lessons",icon:CalendarDays}].map(({title,desc,icon:Icon})=><div className="report-row" key={title}><div className="report-icon"><Icon size={16}/></div><div><strong>{title}</strong><span>{desc}</span></div><b className="pill muted">Planned</b></div>)}</article></section>
        <footer><span>MARKETPILOT AI <i>·</i> RESEARCH FIRST</span><span>Market data is illustrative until a licensed source is connected.</span></footer>
        </> : active === "F&O Workbench" ? <FOWorkbench /> : active === "Opportunity Scanner" ? <OpportunityScanner /> : active === "Paper Portfolio" ? <PaperPortfolio /> : active === "Research Reports" ? <ResearchReports /> : active === "Learn" ? <Learn /> : active === "Backtest Lab" ? <BacktestLab /> : active === "Investment Hub" ? <InvestmentHub /> : active === "Strategy Lab" ? <StrategyLab /> : active === "Global Markets" ? <GlobalMarkets /> : <section className="panel coming-soon"><div className="chain-icon"><BookOpen size={22}/></div><h3>{active} workspace</h3><p>This module is in the next delivery milestone. No fabricated market data is shown here.</p><span className="pill muted">IN DEVELOPMENT</span></section>}
      </div>
    </main>
  </div>;
}
