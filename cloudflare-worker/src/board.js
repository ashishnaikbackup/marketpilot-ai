// "All stocks" board: a searchable list of every NSE equity and every US-listed stock/ETF, refreshed in rolling slices
// (the oldest-priced symbols first) so a free keyless feed is not hammered. Each row carries its own price time.
// Reference only: nothing here is traded by the bot unless it is also in the bot's scan universe.
import { parseYahooChart, YAHOO } from "./free-feeds.js";

const UA = { "User-Agent": "Mozilla/5.0 (compatible; MarketPilotPaperBot/1.0)", Accept: "application/json" };

/** nasdaqlisted.txt + otherlisted.txt (official Nasdaq Trader symbol directory) → [{symbol,name,etf}]. */
export function parseNasdaqListings(nasdaq, other) {
  const out = [], seen = new Set();
  const add = (sym, name, etf, test) => {
    if (!sym || test === "Y" || /[$^]/.test(sym) || /\b(warrant|rights?|units?|preferred|notes?|depositary shares?|trust preferred)\b/i.test(name || "")) return;
    const symbol = sym.replace(/\./g, "-");
    if (!/^[A-Z0-9-]{1,10}$/.test(symbol) || seen.has(symbol)) return;
    seen.add(symbol); out.push({ symbol, name: (name || "").split(" - ")[0].slice(0, 60), etf: etf === "Y" });
  };
  for (const line of String(nasdaq || "").split(/\r?\n/).slice(1)) { const c = line.split("|"); if (c.length >= 7 && !line.startsWith("File Creation")) add(c[0], c[1], c[6], c[3]); }
  for (const line of String(other || "").split(/\r?\n/).slice(1)) { const c = line.split("|"); if (c.length >= 7 && !line.startsWith("File Creation")) add(c[0], c[1], c[4], c[6]); }
  return out;
}

/** Price + change from one Yahoo daily chart payload. */
export function boardQuote(payload) {
  const d = parseYahooChart(payload);
  if (!d) return null;
  const day = d.timestamp.slice(0, 10);
  const prev = [...d.closes].reverse().find((c) => c.day < day)?.close ?? d.prevClose;
  return { p: d.price, c: prev > 0 ? Math.round((d.price / prev - 1) * 10000) / 100 : null, t: d.timestamp };
}

/** Refresh the `budget` stalest symbols. state: { [symbol]: {p,c,t,u(updated ms),f(failures)} }. */
export async function refreshBoard({ state, symbols, budget, suffix = "", fetchImpl = fetch, nowMs = Date.now(), pool = 8 }) {
  const order = symbols.map((s) => s.symbol).sort((a, b) => (state[a]?.u || 0) - (state[b]?.u || 0) || a.localeCompare(b)).slice(0, budget);
  let ok = 0, failed = 0, i = 0;
  await Promise.all(Array.from({ length: Math.min(pool, order.length) }, async () => {
    while (i < order.length) {
      const sym = order[i++];
      try {
        const u = new URL(YAHOO + encodeURIComponent(sym + suffix)); u.searchParams.set("range", "5d"); u.searchParams.set("interval", "1d");
        const res = await fetchImpl(u.toString(), { headers: UA, signal: AbortSignal.timeout(12000) });
        const q = res.ok ? boardQuote(await res.json()) : null;
        if (q) { state[sym] = { ...q, u: nowMs, f: 0 }; ok++; } else { state[sym] = { ...(state[sym] || {}), u: nowMs, f: (state[sym]?.f || 0) + 1 }; failed++; }
      } catch { state[sym] = { ...(state[sym] || {}), u: nowMs, f: (state[sym]?.f || 0) + 1 }; failed++; }
    }
  }));
  return { ok, failed, attempted: order.length };
}

/** Compact rows for the website: [symbol, name, last, change%, priceTime, kind] where kind is S, E (ETF) or F (F&O stock). */
export function boardRows(state, symbols) {
  return symbols.filter((s) => state[s.symbol]?.p > 0).map((s) => [s.symbol, s.name || "", state[s.symbol].p, state[s.symbol].c, state[s.symbol].t, s.kind || "S"]);
}
