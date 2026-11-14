// Data-grounded market assistant. Every statement comes from the bot's own stored reports and portfolio
// (simulated data). It never invents prices, news or live quotes. An LLM, when enabled, may only rephrase.

const fmt = (n, cur) => (typeof n === "number" && Number.isFinite(n) ? (cur === "INR" ? "₹" : "$") + n.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "n/a");
const pct = (n) => (typeof n === "number" && Number.isFinite(n) ? (n > 0 ? "+" : "") + n.toFixed(2) + "%" : "n/a");

export async function loadGrounding(env, region) {
  const db = env.DB;
  const account = await db.prepare("SELECT * FROM bot_accounts WHERE region=?").bind(region).first();
  const run = await db.prepare("SELECT completed_at,status,data_mode,source,report_json FROM bot_runs WHERE region=? AND status='completed' ORDER BY started_at DESC LIMIT 1").bind(region).first();
  const snap = await db.prepare("SELECT * FROM bot_equity_snapshots WHERE region=? ORDER BY recorded_at DESC LIMIT 1").bind(region).first();
  let report = null;
  try { report = run?.report_json ? JSON.parse(run.report_json) : null; } catch { report = null; }
  return { region, currency: region === "INDIA" ? "INR" : "USD", account, snap, report, run };
}

const none = (g) => `There is no completed bot run for ${g.region} yet, so I have no market data to talk about. The bot only reports on data it has actually received, and I will not guess. Once a data provider is connected and the bot has run, ask me again.`;

function latestTrades(g) {
  const r = g.report; if (!r) return none(g);
  const buys = (r.decisions || []).filter((d) => d.action === "PAPER_BUY"), exits = (r.decisions || []).filter((d) => d.action === "CLOSE");
  if (!buys.length && !exits.length) return `In its last run (${g.run.completed_at}) the bot did not trade. ${r.inactive_reason || "No setup passed its checks."}`;
  const lines = [];
  for (const b of buys) lines.push(`BOUGHT ${b.symbol}${b.option_type ? " " + b.option_type + " " + b.strike : ""} x${b.quantity} at ${fmt(b.entry, g.currency)}. Stop ${fmt(b.stop, g.currency)}, target ${fmt(b.target, g.currency)}, risk ${fmt(b.risk_amount, g.currency)}. Why: ${b.explanation || b.reason}`);
  for (const x of exits) lines.push(`CLOSED ${x.symbol} (${x.reason}) with net P&L ${fmt(x.pnl, g.currency)} after fees, held ${x.holding_days} days.`);
  return lines.join("\n");
}
function portfolio(g) {
  if (!g.account) return none(g);
  const s = g.snap, start = Number(g.account.starting_cash);
  if (!s) return `The paper account has ${fmt(start, g.currency)} of virtual starting capital and no completed run yet, so nothing has been traded.`;
  return `Virtual equity ${fmt(s.equity, g.currency)} (started ${fmt(start, g.currency)}), so total P&L is ${fmt(s.equity - start, g.currency)} (${pct(((s.equity - start) / start) * 100)}). Cash ${fmt(s.cash, g.currency)}, invested ${fmt(s.exposure, g.currency)}, ${s.open_positions} open position(s). Realised ${fmt(s.realized_pnl, g.currency)}, unrealised ${fmt(s.unrealized_pnl, g.currency)}. This is simulated money.`;
}
function risks(g) {
  const r = g.report; if (!r) return none(g);
  const k = r.risk_exposure || {}, b = r.market_overview?.breadth || {};
  const out = [`Exposure is ${k.gross_exposure_pct}% of equity (cap ${k.max_gross_exposure_pct}%), with ${k.open_positions}/${k.max_positions} positions. If every stop were hit, the loss would be about ${fmt(k.capital_at_risk_to_stops, g.currency)}.`];
  if (k.stale_marks) out.push(`${k.stale_marks} open position(s) have no fresh price, so their values are not updated.`);
  if (b.scanned) out.push(`Market breadth in the scan: ${b.bullish} bullish, ${b.bearish} bearish, ${b.neutral} neutral of ${b.scanned}.`);
  out.push("Data note: " + (r.data_mode === "eod" ? "end-of-day closes, not live." : r.data_mode + " data."));
  return out.join(" ");
}
function opportunities(g) {
  const r = g.report; if (!r) return none(g);
  const w = r.next_session_watchlist || [];
  if (!w.length) return `Nothing is on the watchlist. ${r.inactive_reason || "No instrument shows an aligned trend and momentum setup."}`;
  return "Names the rules like right now (momentum is the 5-session move):\n" + w.map((x) => `- ${x.symbol}: ${x.bias.toLowerCase()}, ${x.momentum_pct}% momentum. ${x.note}`).join("\n") + "\nThese are rule-based watch items from past closes, not recommendations.";
}
function overview(g) {
  const r = g.report; if (!r) return none(g);
  const idx = (r.market_overview?.indices || []).map((i) => `${i.symbol} ${pct(i.change_pct)}`).join(", ");
  const up = (r.top_gainers || []).slice(0, 3).map((x) => `${x.symbol} ${pct(x.change_pct)}`).join(", ");
  const dn = (r.top_losers || []).slice(0, 3).map((x) => `${x.symbol} ${pct(x.change_pct)}`).join(", ");
  const sec = (r.sector_moves || []).slice(0, 3).map((x) => `${x.sector} ${pct(x.avg_change_pct)}`).join(", ");
  return [`As of ${r.observed_at} (${r.data_mode}, source ${r.source}):`, idx && `Indices: ${idx}.`, up && `Top gainers: ${up}.`, dn && `Top losers: ${dn}.`, sec && `Sectors: ${sec}.`, !idx && !up && "No index or mover data was supplied in this run."].filter(Boolean).join(" ");
}
function compare(g, q) {
  const r = g.report; if (!r) return none(g);
  const all = new Map(); for (const m of [...(r.top_gainers || []), ...(r.top_losers || []), ...(r.market_overview?.indices || [])]) all.set(m.symbol.toUpperCase(), m);
  for (const w of r.next_session_watchlist || []) all.set(w.symbol.toUpperCase(), { ...all.get(w.symbol.toUpperCase()), ...w });
  const found = [...all.keys()].filter((s) => new RegExp("\\b" + s.replace(/[^A-Z0-9]/g, "") + "\\b", "i").test(q.replace(/[^A-Za-z0-9 ]/g, ""))).slice(0, 2);
  if (found.length < 2) return "I can compare names that appear in the latest bot report. Tell me two symbols from the watchlist or movers, for example: compare AAPL and MSFT.";
  return found.map((s) => { const m = all.get(s); return `${s}: day change ${pct(m.change_pct)}${m.bias ? ", bias " + m.bias.toLowerCase() : ""}${m.momentum_pct !== undefined ? ", 5-session momentum " + m.momentum_pct + "%" : ""}.`; }).join("\n") + "\nBased only on the bot's last supplied closes; no fundamentals or news are connected.";
}
function status(g, provider) {
  return `Data provider: ${provider?.provider || "none"} (${provider?.data_mode || "unavailable"}). ${provider?.message || ""} Last completed run: ${g.run ? g.run.completed_at + " using " + g.run.data_mode + " data" : "none yet"}.`;
}
const HELP = "I can explain the bot's latest trades, review the paper portfolio, summarise market moves from the last report, list risks, show the watchlist, compare two names from the report, and tell you the data status. I only use data the bot actually received.";

export function answerQuestion(question, g, provider) {
  const q = String(question || "").toLowerCase();
  let topic, text;
  if (/compare|versus| vs /.test(q)) { topic = "compare"; text = compare(g, question); }
  else if (/trade|bought|buy|sold|sell|latest|decision|why/.test(q)) { topic = "latest_trades"; text = latestTrades(g); }
  else if (/portfolio|p&l|pnl|profit|loss|balance|cash|equity|money|return/.test(q)) { topic = "portfolio"; text = portfolio(g); }
  else if (/risk|exposure|danger|drawdown|safe/.test(q)) { topic = "risk"; text = risks(g); }
  else if (/momentum|opportunit|best|watch|idea|pick|strong/.test(q)) { topic = "opportunities"; text = opportunities(g); }
  else if (/market|nifty|sensex|index|indices|happening|global|today|sector|gainer|loser/.test(q)) { topic = "overview"; text = overview(g); }
  else if (/status|data|provider|live|connected/.test(q)) { topic = "status"; text = status(g, provider); }
  else { topic = "help"; text = HELP; }
  return { topic, answer: text, grounded: topic !== "help", data_as_of: g.run?.completed_at || null, data_mode: g.report?.data_mode || "unavailable", simulated: true };
}
