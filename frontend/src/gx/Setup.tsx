import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { clearSettings, saveSettings, type Settings } from "./api";

export function Setup({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => void }) {
  const [api, setApi] = useState(settings.api), [token, setToken] = useState(settings.token), [remember, setRemember] = useState(false);
  return <div className="gx-card">
    <div className="gx-h"><h2>Connect your paper trader</h2></div>
    <p className="gx-sub">MarketPilot runs on your own free Cloudflare account. Two things connect this screen to it:</p>
    <ol className="gx-steps">
      <li><span><b>API address</b>: the <code>workers.dev</code> link printed by the "Deploy MarketPilot API" GitHub Action.</span></li>
      <li><span><b>Read token</b>: the <code>BOT_READ_TOKEN</code> you chose. It can only <i>read</i>; it cannot place trades or change anything.</span></li>
    </ol>
    <label className="gx-field">API address<input value={api} onChange={(e) => setApi(e.target.value)} placeholder="https://marketpilot-api.yourname.workers.dev" inputMode="url" autoCapitalize="off" /></label>
    <label className="gx-field">Read token<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste BOT_READ_TOKEN" autoComplete="off" /><small>Kept only in this browser tab unless you tick the box below.</small></label>
    <label className="gx-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember the token on this device</label>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="gx-btn" onClick={() => { const s = { api: api.trim().replace(/\/+$/, ""), token: token.trim() }; saveSettings(s, remember); onSave(s); }}>Save and connect</button>
      <button className="gx-btn plain" onClick={() => { clearSettings(); setApi(""); setToken(""); onSave({ api: "", token: "" }); }}>Disconnect</button>
    </div>
    <div className="gx-note info" style={{ marginTop: 16, marginBottom: 0 }}><ShieldCheck size={16} /><span>Never paste a broker password or a market-data vendor key here. Those live only as Cloudflare secrets. This app is paper-trading only and cannot place real orders.</span></div>
  </div>;
}
