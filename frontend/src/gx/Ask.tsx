import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { call, type Desk } from "./api";

type Msg = { role: "u" | "a"; text: string; note?: string };
const IDEAS = ["Explain the latest trade", "How is my portfolio doing?", "What are the risks right now?", "Which stocks have momentum?", "What is happening in the market?", "Is the data live?"];

export default function Ask({ desk }: { desk: Desk }) {
  const [msgs, setMsgs] = useState<Msg[]>([]), [q, setQ] = useState(""), [busy, setBusy] = useState(false), end = useRef<HTMLDivElement>(null);
  async function send(text: string) {
    const question = text.trim(); if (!question || busy) return;
    setMsgs((m) => [...m, { role: "u", text: question }]); setQ(""); setBusy(true);
    try {
      const r = await call<{ answer: string; data_as_of: string | null; data_mode: string; phrased_by_ai: boolean }>(desk.settings, "/api/v1/paper-bot/ask", { method: "POST", body: JSON.stringify({ question, region: desk.region }) });
      setMsgs((m) => [...m, { role: "a", text: r.answer, note: (r.phrased_by_ai ? "AI-worded from your bot's data · " : "From your bot's data · ") + (r.data_as_of ? "as of " + new Date(r.data_as_of).toLocaleString() + " · " : "") + "simulated money" }]);
    } catch (e) { setMsgs((m) => [...m, { role: "a", text: e instanceof Error ? e.message : "Something went wrong." }]); }
    finally { setBusy(false); setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50); }
  }
  if (!desk.settings.token) return <div className="gx-card gx-empty"><strong>Connect first</strong><p>Add your API address and read token in More → Connection so the assistant can read your bot's data.</p></div>;
  return <div className="gx-card">
    <div className="gx-h"><h2>Ask your trading desk</h2></div>
    <p className="gx-sub">Answers come only from what the bot actually recorded. It has no live prices, news or fundamentals, and says so instead of guessing.</p>
    <div className="gx-chat">{msgs.length === 0 && <div className="gx-chips">{IDEAS.map((i) => <button key={i} onClick={() => send(i)}>{i}</button>)}</div>}
      {msgs.map((m, i) => <div key={i} className={"gx-msg " + m.role}>{m.text}{m.note && <small>{m.note}</small>}</div>)}{busy && <div className="gx-msg a">Thinking…</div>}<div ref={end} /></div>
    {msgs.length > 0 && <div className="gx-chips">{IDEAS.slice(0, 4).map((i) => <button key={i} onClick={() => send(i)}>{i}</button>)}</div>}
    <form className="gx-ask" onSubmit={(e) => { e.preventDefault(); void send(q); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about trades, risk, portfolio…" maxLength={500} aria-label="Your question" /><button className="gx-btn" disabled={busy || !q.trim()} aria-label="Send"><Send size={17} /></button></form>
  </div>;
}
