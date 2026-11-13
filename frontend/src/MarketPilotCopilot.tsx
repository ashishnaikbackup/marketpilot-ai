import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles, ShieldAlert, BookOpen, TrendingUp, GitCompareArrows, Clock3 } from "lucide-react";

type Message = { role: "assistant" | "user"; text: string; title?: string };

const starters = [
  { icon: TrendingUp, label: "Find a trade setup", prompt: "Analyse NIFTY for a possible intraday trade. What evidence is required?" },
  { icon: GitCompareArrows, label: "Compare CE vs PE", prompt: "Explain how to decide between buying a call and buying a put." },
  { icon: BookOpen, label: "Teach me option Greeks", prompt: "Teach me Delta, Gamma, Theta and Vega with simple examples." },
  { icon: Clock3, label: "Best time to trade", prompt: "Explain the best intraday time windows and when I should avoid trading." },
];

function answerFor(question: string): Message {
  const q = question.toLowerCase();
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
  function send(text = draft) {
    const clean = text.trim();
    if (!clean) return;
    setMessages((old) => [...old, { role: "user", text: clean }, answerFor(clean)]);
    setDraft("");
  }
  function submit(e: FormEvent) { e.preventDefault(); send(); }

  return <div className="copilot-layout">
    <section className="copilot-main panel">
      <div className="copilot-head"><div className="copilot-avatar"><Bot size={22}/></div><div><h3>MarketPilot Copilot</h3><p>Research & learning assistant · rule-based preview</p></div><span className="copilot-status">ONLINE</span></div>
      <div className="copilot-safety"><ShieldAlert size={16}/><span>No live feed or AI model is connected yet. This preview uses a transparent educational knowledge base; it does not generate live buy/sell calls.</span></div>
      <div className="copilot-messages" aria-live="polite">{messages.map((m,i)=><article key={i} className={m.role==="user"?"chat-message user-message":"chat-message assistant-message"}>{m.role==="assistant"&&<div className="message-icon"><Sparkles size={14}/></div>}<div className="message-body">{m.title&&<strong>{m.title}</strong>}<p>{m.text}</p></div></article>)}</div>
      <form className="copilot-input" onSubmit={submit}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ask about markets, F&O, risk or a strategy…" aria-label="Ask MarketPilot Copilot"/><button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send size={17}/></button></form>
      <div className="copilot-footnote">Educational research only · verify all data independently · no order execution</div>
    </section>
    <aside className="copilot-side">
      <section className="panel"><div className="panel-title"><div><h3>What I can help with</h3><p>Choose a starting point</p></div><Sparkles size={17}/></div><div className="copilot-starters">{starters.map(({icon:Icon,label,prompt})=><button key={label} onClick={()=>send(prompt)}><Icon size={17}/><span>{label}</span><span className="starter-arrow">↗</span></button>)}</div></section>
      <section className="panel"><div className="panel-title"><div><h3>Live analysis requirements</h3><p>Before any specific trade setup</p></div><ShieldAlert size={17}/></div><ul className="copilot-checklist"><li>Authorised NSE market-data provider</li><li>Timestamped spot and option-chain data</li><li>Verified expiry and lot-size master</li><li>Spread, liquidity, IV and Greeks</li><li>Tested rules, costs and risk limits</li></ul><div className="copilot-no-trade">Missing evidence? The answer is NO TRADE.</div></section>
    </aside>
  </div>;
}
