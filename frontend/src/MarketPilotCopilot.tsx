import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles, ShieldAlert, BookOpen, TrendingUp, GitCompareArrows, Clock3, Database } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string; title?: string };

const starters = [
  { icon: TrendingUp, label: "Find a trade setup", prompt: "Analyse NIFTY for a possible intraday trade. What evidence is required?" },
  { icon: GitCompareArrows, label: "Compare CE vs PE", prompt: "Explain how to decide between buying a call and buying a put." },
  { icon: BookOpen, label: "Teach me option Greeks", prompt: "Teach me Delta, Gamma, Theta and Vega with simple examples." },
  { icon: Clock3, label: "Best time to trade", prompt: "Explain the best intraday time windows and when I should avoid trading." },
  { icon: Database, label: "Analyse imported option chain", prompt: "Analyse my latest imported option chain and explain the positioning." },
];

function answerFor(question: string): Message {
  const q = question.toLowerCase();
  let imported: any = null;
  try { imported = JSON.parse(localStorage.getItem("marketpilot.latestIndiaChain.v1") || "null"); } catch { imported = null; }
  if (imported?.metrics && /imported|latest chain|option chain|pcr|open interest|oi positioning/.test(q)) {
    const m = imported.metrics;
    return { role: "assistant", title: imported.instrument + " · imported chain review", text: "I found a locally saved option-chain snapshot from " + imported.source + ".\n\n**Snapshot metrics**\n- Put/Call OI ratio: " + (m.pcr == null ? "not available" : Number(m.pcr).toFixed(3)) + "\n- Put/Call change-OI ratio: " + (m.pcrChange == null ? "not available" : Number(m.pcrChange).toFixed(3)) + "\n- Highest call OI strike: " + m.topCall + "\n- Highest put OI strike: " + m.topPut + "\n- Modelled max-pain strike: " + m.maxPain + "\n- Nearest ATM strike: " + m.atm + "\n- ATM CE/PE IV: " + (m.callIv == null ? "—" : Number(m.callIv).toFixed(2) + "%") + " / " + (m.putIv == null ? "—" : Number(m.putIv).toFixed(2) + "%") + "\n\n**Interpretation limits:** OI concentrations are not guaranteed support/resistance; PCR and max pain are not directional predictors. The source and timestamp are user-entered and unverified. This snapshot alone cannot justify buying CE or PE. Add spot trend, VWAP, breadth, volatility, expiry and a risk plan before any human-reviewed setup.\n\nThis is a local calculation from your imported rows, not a live exchange feed or a buy/sell signal." };
  }
  if (/nifty|banknifty|finnifty|buy|sell|entry|call|put|ce|pe|signal|setup/.test(q)) {
    return { role: "assistant", title: "Market setup review · data gate", text: "I can help build and evaluate a trade plan, but I cannot honestly name a live CE/PE strike or entry right now: this workspace has no connected, authorised live NSE feed. The dashboard's sample values are demo data.\n\nFor a defensible setup, provide a timestamped underlying price series and option-chain snapshot with source, expiry, strike, CE/PE LTP, bid/ask, volume, OI, change in OI and IV. The analysis should then check:\n\n1. **Market regime:** trend, opening range, VWAP, breadth and India VIX.\n2. **Option selection:** expiry, ATM distance, spread, liquidity, IV and Greeks—not premium alone.\n3. **Trigger:** a pre-defined price level plus confirmation; no chasing.\n4. **Risk:** entry, invalidation/stop, target, lot size, fees, slippage and maximum rupee loss.\n5. **Decision:** bullish, bearish, neutral or **NO TRADE**.\n\nUntil verified data is connected, the correct live-trading answer is **NO TRADE**. I can still teach the method or analyse data you paste here." };
  }
  if (/greek|delta|gamma|theta|vega|iv|implied volatility/.test(q)) {
    return { role: "assistant", title: "F&O lesson · the four Greeks", text: "**Delta** estimates how much an option premium changes for a 1-point move in the underlying. A call has positive delta; a put has negative delta.\n\n**Gamma** measures how quickly delta changes. High gamma means delta can change rapidly, especially near expiry.\n\n**Theta** estimates time decay. Long options generally lose time value as expiry approaches, all else equal.\n\n**Vega** measures sensitivity to implied volatility. Long options generally benefit when IV rises; short options generally face the opposite exposure.\n\n**Quick memory trick:** Delta = direction, Gamma = acceleration, Theta = time, Vega = volatility. These are model sensitivities, not guaranteed premium changes. Try changing spot, days to expiry and IV in the F&O Workbench." };
  }
  if (/compare|spread|straddle|strangle|strategy/.test(q)) {
    return { role: "assistant", title: "Options strategy comparison", text: "**Bull call spread:** buy a lower-strike call and sell a higher-strike call. Defined maximum loss and capped profit; typically used for a moderately bullish view.\n\n**Bear put spread:** buy a higher-strike put and sell a lower-strike put. Defined maximum loss and capped profit; typically used for a moderately bearish view.\n\n**Long straddle:** buy call and put at the same strike. It needs a sufficiently large move to overcome the combined premium; time decay hurts.\n\n**Long strangle:** buy an OTM call and OTM put. Usually cheaper than a straddle but needs a larger move.\n\nCompare net debit/credit, breakevens, max loss, max profit, expiry payoff, IV and transaction costs in Strategy Lab before paper trading. A directional opinion alone is not an edge." };
  }
  if (/time|timing|session|opening|closing|when/.test(q)) {
    return { role: "assistant", title: "Intraday timing · process, not prediction", text: "**09:15–10:00 IST:** opening volatility and price discovery. Observe the opening range; avoid reacting to the first spike.\n\n**10:00–14:30 IST:** wait for a clean, liquid setup with trend/breadth confirmation. Midday can be quieter, but there is no universal best hour.\n\n**14:30–15:30 IST:** manage exits and overnight risk; avoid entering simply because the session is ending.\n\nAvoid trading around major announcements without a tested event strategy, during wide spreads/poor liquidity, after hitting your daily loss limit, or whenever your setup is absent. These are educational session references, not a timing signal." };
  }
  if (/risk|position size|stop|capital|loss/.test(q)) {
    return { role: "assistant", title: "Risk-first trade sizing", text: "Start with the maximum rupee loss you are willing to accept—not the number of lots you hope to trade.\n\n**Position size = maximum planned loss ÷ loss per unit at the stop.** For options, include lot size, premium/underlying sensitivity, gap risk, fees and slippage. A stop order does not guarantee the exact exit price.\n\nNever average down just to avoid booking a loss. Define invalidation before entry, keep a daily loss limit, and practise in the paper portfolio first. The Trade & Risk Planner can help calculate a hypothetical size." };
  }
  return { role: "assistant", title: "Research copilot", text: "I can help with F&O concepts, option Greeks, strategy comparisons, intraday process, position sizing, backtesting methodology and reviewing a trade plan.\n\nFor live market calls, this version needs a verified, authorised market-data feed first. It will not invent prices, strikes or buy/sell signals.\n\nTry asking: “Teach me option Greeks”, “Compare a bull call spread and long call”, or “What evidence is needed before choosing NIFTY CE or PE?”" };
}

export default function MarketPilotCopilot() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", title: "Your research desk is ready", text: "I’m MarketPilot’s research copilot. Ask me to explain a concept, compare F&O strategies, build a risk checklist or review what data is needed for a trade.\n\nI will distinguish verified data from assumptions—and say NO TRADE when evidence is missing." },
  ]);
  const [draft, setDraft] = useState("");
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem("marketpilot.apiBaseUrl") || import.meta.env.VITE_API_BASE_URL || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  function saveApiUrl() {
    const value = apiUrl.trim().replace(/\/$/, "");
    setApiUrl(value);
    if (value) localStorage.setItem("marketpilot.apiBaseUrl", value);
    else localStorage.removeItem("marketpilot.apiBaseUrl");
  }
  async function send(text = draft) {
    const clean = text.trim();
    if (!clean || loading) return;
    const history = [...messages.slice(-8).map(m => ({ role: m.role, content: m.text })), { role: "user" as const, content: clean }];
    setMessages(old => [...old, { role: "user", text: clean }]);
    setDraft("");
    setError("");
    const base = apiUrl.trim().replace(/\/$/, "");
    if (!base) {
      setMessages(old => [...old, answerFor(clean)]);
      return;
    }
    setLoading(true);
    try {
      let context = "";
      try {
        const saved = JSON.parse(localStorage.getItem("marketpilot.latestIndiaChain.v1") || "null");
        const money = JSON.parse(localStorage.getItem("marketpilot.moneyManager.v1") || "null");
        const parts: string[] = [];
        if (saved?.metrics) parts.push("Imported Indian option-chain snapshot (unverified): " + JSON.stringify({instrument:saved.instrument,expiry:saved.expiry,source:saved.source,observedAt:saved.observedAt,metrics:saved.metrics}));
        if (money) {
          const tx = Array.isArray(money.transactions) ? money.transactions : [];
          const month = new Date().toISOString().slice(0,7);
          const recent = tx.filter((x:any)=>typeof x.date==="string"&&x.date.startsWith(month));
          const income = recent.filter((x:any)=>x.type==="income").reduce((s:number,x:any)=>s+(Number(x.amount)||0),0);
          const expenses = recent.filter((x:any)=>x.type==="expense").reduce((s:number,x:any)=>s+(Number(x.amount)||0),0);
          parts.push("Personal finance summary (local browser records, current month only): " + JSON.stringify({month,income,expenses,netCashFlow:income-expenses,transactionCount:recent.length,budgets:money.budgets||{},savingsGoals:Array.isArray(money.goals)?money.goals.map((g:any)=>({name:g.name,target:g.target,saved:g.saved,due:g.due})):[]}));
        }
        context = parts.join("\\n").slice(0,6000);
      } catch { context = ""; }
      const response = await fetch(base + "/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, context })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "AI request failed. Check the Worker URL and AI binding.");
      if (typeof body.answer !== "string" || !body.answer.trim()) throw new Error("The AI service returned an empty response.");
      setMessages(old => [...old, { role: "assistant", title: "MarketPilot AI · Workers AI", text: body.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the AI service.");
      setMessages(old => [...old, { role: "assistant", title: "Local research fallback", text: answerFor(clean).text }]);
    } finally { setLoading(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void send(); }

  return <div className="copilot-layout">
    <section className="copilot-main panel">
      <div className="copilot-head"><div className="copilot-avatar"><Bot size={22}/></div><div><h3>MarketPilot Copilot</h3><p>AI-assisted research · local educational fallback</p></div><span className="copilot-status">ONLINE</span></div>
      <div className="copilot-safety"><ShieldAlert size={16}/><span>Live market data is not connected. Configure the free-tier Cloudflare Worker URL below to enable AI chat; without it, the local educational fallback is used. Neither mode generates live buy/sell calls.</span></div>
      <div className="copilot-messages" aria-live="polite">{messages.map((m,i)=><article key={i} className={m.role==="user"?"chat-message user-message":"chat-message assistant-message"}>{m.role==="assistant"&&<div className="message-icon"><Sparkles size={14}/></div>}<div className="message-body">{m.title&&<strong>{m.title}</strong>}<p>{m.text}</p></div></article>)}</div>
      <form className="copilot-input" onSubmit={submit}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ask about markets, F&O, risk or a strategy…" aria-label="Ask MarketPilot Copilot"/><button type="submit" disabled={!draft.trim()||loading} aria-label="Send message">{loading?<span className="copilot-spinner">…</span>:<Send size={17}/>}</button></form>
      {error&&<div className="copilot-error">{error}</div>}
      <div className="copilot-footnote">Educational research only · verify all data independently · no order execution</div>
    </section>
    <aside className="copilot-side">
      <section className="panel"><div className="panel-title"><div><h3>Connect AI research</h3><p>Paste your deployed Cloudflare Worker URL</p></div><Bot size={17}/></div><div className="copilot-connect"><input value={apiUrl} onChange={e=>setApiUrl(e.target.value)} placeholder="https://marketpilot-api.your-subdomain.workers.dev" aria-label="Cloudflare Worker API URL"/><button className="outline-button" onClick={saveApiUrl}>Save</button></div><p className="copilot-connect-note">Workers AI has a free daily inference allowance. Usage stops at the free limit on the Free plan; no paid upgrade is enabled.</p></section>
      <section className="panel"><div className="panel-title"><div><h3>What I can help with</h3><p>Choose a starting point</p></div><Sparkles size={17}/></div><div className="copilot-starters">{starters.map(({icon:Icon,label,prompt})=><button key={label} onClick={()=>void send(prompt)}><Icon size={17}/><span>{label}</span><span className="starter-arrow">↗</span></button>)}</div></section>
      <section className="panel"><div className="panel-title"><div><h3>Live analysis requirements</h3><p>Before any specific trade setup</p></div><ShieldAlert size={17}/></div><ul className="copilot-checklist"><li>Authorised NSE market-data provider</li><li>Timestamped spot and option-chain data</li><li>Verified expiry and lot-size master</li><li>Spread, liquidity, IV and Greeks</li><li>Tested rules, costs and risk limits</li></ul><div className="copilot-no-trade">Missing evidence? The answer is NO TRADE.</div></section>
    </aside>
  </div>;
}
