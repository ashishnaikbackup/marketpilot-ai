// Keyless market data from Yahoo Finance's public chart endpoint (UNOFFICIAL, delayed ~15 min for NSE and US).
// It is labelled "delayed" everywhere, has no option chains, and may be rate-limited or change without notice.
// Real live data and F&O option chains need a licensed source (see upstox.js). Paper trading only.
import universeSeed from "./universe-india.js";
import { istDay, marketPhase } from "./upstox.js";

export const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/";
export const DEFAULT_GLOBAL_FREE = "SPY:ETF,QQQ:ETF,DIA:ETF,IWM:ETF,AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,AVGO,JPM,V,UNH,XOM,LLY,WMT,COST,NFLX,AMD,ORCL,CRM,ADBE,KO,PEP,DIS,BAC,CSCO,INTC";
const INDIA_INDEX_YAHOO = { NIFTY: "^NSEI", BANKNIFTY: "^NSEBANK", FINNIFTY: "NIFTY_FIN_SERVICE.NS", MIDCPNIFTY: "NIFTY_MID_SELECT.NS" };
const finite = (x) => typeof x === "number" && Number.isFinite(x);
const DAY = 86400000;

/** Pure: one Yahoo chart payload → { price, timestamp(ISO), prevClose, closes:[{day,close}], bars:[{ts,open,close}] } or null. */
export function parseYahooChart(payload, { intraday = false } = {}) {
  const r = payload?.chart?.result?.[0];
  if (!r || payload?.chart?.error) return null;
  const meta = r.meta || {}, ts = r.timestamp || [], q = r.indicators?.quote?.[0] || {};
  const off = finite(meta.gmtoffset) ? meta.gmtoffset : 0;
  const local = (sec) => new Date((sec + off) * 1000).toISOString();
  const pad = (n) => String(Math.trunc(Math.abs(n))).padStart(2, "0");
  const tz = (off < 0 ? "-" : "+") + pad(off / 3600) + ":" + pad((Math.abs(off) % 3600) / 60);
  const out = { price: finite(meta.regularMarketPrice) && meta.regularMarketPrice > 0 ? meta.regularMarketPrice : null,
    timestamp: finite(meta.regularMarketTime) ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    prevClose: finite(meta.chartPreviousClose) ? meta.chartPreviousClose : null, closes: [], bars: [] };
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i], o = q.open?.[i];
    if (!finite(c) || c <= 0 || !finite(ts[i])) continue;
    const l = local(ts[i]);
    if (intraday) { if (finite(o) && o > 0) out.bars.push({ slot_ts: l.slice(0, 19) + tz, open: o, close: c }); }
    else out.closes.push({ day: l.slice(0, 10), close: c });
  }
  if (intraday) out.bars.pop(); // the newest bar may still be forming; only completed bars are stored
  return out.price && out.timestamp ? out : null;
}

export function yahooSymbols(region, env, universe = universeSeed) {
  if (region === "INDIA") {
    const u = env?.UNIVERSE_INDIA || universe, cap = Math.max(3, Math.min(parseInt(env?.FREE_MAX_INSTRUMENTS, 10) || 300, 600));
    return [
      ...(u.indices || []).filter((x) => INDIA_INDEX_YAHOO[x.symbol]).map((x) => ({ symbol: x.symbol, y: INDIA_INDEX_YAHOO[x.symbol], asset_class: "INDEX", key: x.key })),
      ...(u.stocks || []).map((x) => ({ symbol: x.symbol, y: x.symbol + ".NS", asset_class: "EQUITY", key: x.key })),
      ...(u.etfs || []).map((x) => ({ symbol: x.symbol, y: x.symbol + ".NS", asset_class: "ETF", key: x.key })),
    ].slice(0, cap);
  }
  return String(env?.GLOBAL_WATCHLIST || DEFAULT_GLOBAL_FREE).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 80).map((t) => {
    const [symbol, cls] = t.split(":");
    return { symbol: symbol.trim(), y: symbol.trim(), asset_class: (cls || "EQUITY").trim().toUpperCase() };
  }).filter((x) => /^[A-Z0-9.\-^]{1,15}$/i.test(x.symbol) && ["EQUITY", "ETF", "INDEX"].includes(x.asset_class));
}

async function getChart(fetchImpl, y, params) {
  const u = new URL(YAHOO + encodeURIComponent(y));
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetchImpl(u.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketPilotPaperBot/1.0)", Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error("Yahoo HTTP " + res.status);
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new Error("Yahoo rate-limited or unavailable");
}

async function pool(items, size, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (i < items.length) { const n = i++; out[n] = await fn(items[n]); } }));
  return out;
}

const upsertDaily = (db, region, symbol, closes, at) => db.prepare("INSERT INTO bot_candles (region,symbol,day,close,updated_at) SELECT ?1, ?2, json_extract(value,'$[0]'), json_extract(value,'$[1]'), ?3 FROM json_each(?4) WHERE true ON CONFLICT(region,symbol,day) DO UPDATE SET close=excluded.close, updated_at=excluded.updated_at")
  .bind(region, symbol, at, JSON.stringify(closes.map((c) => [c.day, c.close]))).run();
const upsertBars = (db, region, symbol, bars) => db.prepare("INSERT OR REPLACE INTO bot_intraday (region,symbol,slot_ts,open,close) SELECT ?1, ?2, json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]') FROM json_each(?3) WHERE true")
  .bind(region, symbol, JSON.stringify(bars.map((b) => [b.slot_ts, b.open, b.close]))).run();

/** Live-ish (delayed) or end-of-day snapshot from Yahoo for INDIA or GLOBAL. */
export async function fetchYahooSnapshot(env, region, purpose, fetchImpl = fetch, nowMs = Date.now()) {
  const list = yahooSymbols(region, env);
  if (!list.length) throw new Error("No symbols to fetch.");
  const eod = purpose === "paper_eod", at = new Date(nowMs).toISOString();
  const results = await pool(list, 6, async (x) => {
    try { return { x, d: parseYahooChart(await getChart(fetchImpl, x.y, { range: "6mo", interval: "1d" })) }; } catch (e) { return { x, d: null, err: e instanceof Error ? e.message : "error" }; }
  });
  const instruments = [], skipped = [];
  for (const { x, d, err } of results) {
    if (!d) { skipped.push({ symbol: x.symbol, reason: err || "No data returned." }); continue; }
    const day = d.timestamp.slice(0, 10);
    const closes = d.closes.filter((c) => c.day < (region === "INDIA" ? istDay(Date.parse(d.timestamp)) : day)); // completed sessions
    const lastDay = region === "INDIA" ? istDay(Date.parse(d.timestamp)) : day;
    closes.push({ day: lastDay, close: d.price });
    if (closes.length < 55) { skipped.push({ symbol: x.symbol, reason: `Only ${closes.length} daily closes.` }); continue; }
    if (env.DB) try { await upsertDaily(env.DB, region, x.symbol, closes.slice(-130), at); } catch { /* history store is best-effort */ }
    instruments.push({ symbol: x.symbol, instrument_id: x.key || x.symbol, exchange: region === "INDIA" ? (x.asset_class === "INDEX" ? "NSE_INDEX" : "NSE") : null, asset_class: x.asset_class,
      candles: closes.slice(-80).map((c) => ({ timestamp: c.day + "T00:00:00Z", close: c.close })), quote: { last: d.price, timestamp: d.timestamp, basis: eod ? "eod_close" : "delayed_last" } });
  }
  if (!instruments.length) throw new Error("Yahoo returned no usable instruments (" + (results.find((r) => r.err)?.err || "no data") + ").");
  // Best-time statistics: 30-minute bars for a handful of liquid symbols, refreshed at most daily.
  let timing = 0;
  if (env.DB && !eod) {
    const latest = new Map(((await env.DB.prepare("SELECT symbol,MAX(slot_ts) s FROM bot_intraday WHERE region=? GROUP BY symbol").bind(region).all()).results || []).map((r) => [r.symbol, r.s]));
    const want = instruments.filter((i) => ["INDEX", "ETF"].includes(i.asset_class) || true).slice(0, 10).filter((i) => (latest.get(i.symbol) || "").slice(0, 10) < new Date(nowMs - 2 * DAY).toISOString().slice(0, 10));
    await pool(want, 4, async (i) => {
      try {
        const x = list.find((l) => l.symbol === i.symbol);
        const d = parseYahooChart(await getChart(fetchImpl, x.y, { range: "1mo", interval: "30m" }), { intraday: true });
        if (d?.bars.length) { await upsertBars(env.DB, region, i.symbol, d.bars); timing++; }
      } catch { /* optional */ }
    });
  }
  const asOf = instruments.map((i) => i.quote.timestamp).sort().at(-1);
  // Label by MEASUREMENT, never by assumption: the median age of last-trade times decides "live" vs "delayed".
  const ages = instruments.map((i) => (nowMs - Date.parse(i.quote.timestamp)) / 1000).filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  const medianAge = ages.length ? Math.round(ages[Math.floor(ages.length / 2)]) : null;
  const measuredLive = !eod && medianAge !== null && medianAge >= -5 && medianAge <= 120 && region === "INDIA" ? marketPhase(nowMs) === "open" : !eod && medianAge !== null && medianAge >= -5 && medianAge <= 120;
  return { schema_version: 1, region, source: "yahoo-finance (unofficial, delayed)", data_mode: eod ? "eod" : measuredLive ? "live" : "delayed", observed_at: at, as_of: asOf, instruments, option_contracts: [], skipped: skipped.slice(0, 50),
    coverage: { measured_quote_age_sec: medianAge, universe_size: list.length, quoted: instruments.length, ready: instruments.length, failed: skipped.length, timing_symbols_refreshed: timing,
      note: `Free Yahoo feed (unofficial, no option chains). Measured median age of last trades: ${medianAge === null ? "unknown" : medianAge + " s"}; labelled live only when that is 2 minutes or less in session, otherwise delayed.` } };
}

export { marketPhase };
