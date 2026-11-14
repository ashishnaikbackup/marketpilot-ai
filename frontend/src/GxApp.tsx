import { useEffect, useState } from "react";
import { Activity, Bot, Home as HomeIcon, LineChart, MoreHorizontal, RefreshCw, Wallet } from "lucide-react";
import "./gx/gx.css";
import { loadSettings, modeLabel, useDesk, type Region, type Settings } from "./gx/api";
import Home from "./gx/Home";
import Trader from "./gx/Trader";
import Markets from "./gx/Markets";
import Ask from "./gx/Ask";
import More from "./gx/More";
import { Setup } from "./gx/Setup";

type Tab = "home" | "trader" | "markets" | "ask" | "more";
const TABS: { id: Tab; label: string; Icon: typeof HomeIcon }[] = [
  { id: "home", label: "Home", Icon: HomeIcon }, { id: "trader", label: "Trader", Icon: Wallet }, { id: "markets", label: "Markets", Icon: LineChart }, { id: "ask", label: "Ask AI", Icon: Bot }, { id: "more", label: "More", Icon: MoreHorizontal },
];

export default function GxApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [region, setRegion] = useState<Region>("INDIA");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const desk = useDesk(settings, region);
  const provider = desk.status?.provider;
  const regions = provider?.regions;
  // Open on a market the connected data source actually covers (e.g. Twelve Data free plan = Global only).
  useEffect(() => { if (regions?.length && !regions.includes(region)) setRegion(regions[0]); }, [regions, region]);
  const chip = !settings.api ? { cls: "", text: "Not connected" } : desk.error ? { cls: "bad", text: "Offline" } : provider?.configured ? { cls: provider.data_mode === "live" ? "ok" : "warn", text: modeLabel(provider.data_mode) + " data" } : desk.connected ? { cls: "warn", text: "No data source" } : { cls: "", text: "Connecting…" };
  const needsSetup = !settings.api || (desk.needsToken && tab !== "more");

  return <div className="gx">
    <header className="gx-top"><div className="gx-top-in">
      <div className="gx-logo"><i><Activity size={17} /></i><span>market<b>pilot</b></span></div>
      <nav className="gx-tabs" aria-label="Main">{TABS.map(({ id, label }) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className="gx-grow" />
      <span className={"gx-chip " + chip.cls}><i className="gx-dot" />{chip.text}</span>
      <button className="gx-icon" onClick={desk.refresh} aria-label="Refresh"><RefreshCw size={16} className={desk.loading ? "gx-spin" : ""} /></button>
    </div></header>
    <main className="gx-wrap">
      {tab !== "more" && tab !== "ask" && !needsSetup && <div className="gx-seg" role="tablist" aria-label="Market">{(["INDIA", "GLOBAL"] as const).map((r) => <button key={r} className={region === r ? "on" : ""} onClick={() => setRegion(r)}>{r === "INDIA" ? "India" : "Global"}</button>)}</div>}
      {desk.error && settings.api && tab !== "more" && <div className="gx-note err"><span>{desk.error}</span></div>}
      {needsSetup && tab !== "more" ? <Setup settings={settings} onSave={setSettings} />
        : tab === "home" ? <Home desk={desk} go={setTab} />
        : tab === "trader" ? <Trader desk={desk} />
        : tab === "markets" ? <Markets desk={desk} />
        : tab === "ask" ? <Ask desk={desk} />
        : <More settings={settings} onSave={setSettings} />}
      <p className="gx-foot">Paper trading only. Virtual money, no real orders. Not investment advice.</p>
    </main>
    <nav className="gx-nav" aria-label="Main">{TABS.map(({ id, label, Icon }) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}><Icon size={21} />{label}</button>)}</nav>
  </div>;
}
