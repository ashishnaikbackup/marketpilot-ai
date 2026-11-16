// Upstox market-data adapter (read-only Analytics Token). Paper trading only: no order endpoint is ever called.
// Parsers are pure so they can be tested with fixtures; only fetchUpstoxSnapshot touches the network and D1.
import universeSeed from "./universe-india.js";

export const UPSTOX_BASE = "https://api.upstox.com";
const IST_MS = 330 * 60000;
const finite = (x) => typeof x === "number" && Number.isFinite(x);
const num = (x) => (x === null || x === undefined || x === "" ? NaN : Number(x));
const DAY = 86400000;
export const istDay = (ms) => new Date(ms + IST_MS).toISOString().slice(0, 10);

/** "open" during NSE cash/F&O hours (09:15–15:30 IST, Mon–Fri). Exchange holidays are NOT known here;
 *  stale quotes on a holiday are rejected by the engine's freshness check instead. */
export function marketPhase(nowMs) {
  const d = new Date(nowMs + IST_MS), m = d.getUTCHours() * 60 + d.getUTCMinutes(), wd = d.getUTCDay();
  return wd >= 1 && wd <= 5 && m >= 555 && m <= 930 ? "open" : "closed";
}

const toIso = (v) => {
  if (v === null || v === undefined || v === "") return null;
  let ms = typeof v === "number" ? v : /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));
  if (!Number.isFinite(ms)) return null;
  if (ms < 1e11) ms *= 1000; // seconds → ms
  return new Date(ms).toISOString();
};

/** Full-quote response → Map(instrument_key → quote). Quotes without a timestamp or price are dropped, never guessed. */
export function parseQuotes(payload) {
  const out = new Map();
  const data = payload?.data;
  if (!data || typeof data !== "object") return out;
  for (const [k, v] of Object.entries(data)) {
    if (!v) continue;
    const key = v.instrument_token || k.replace(":", "|");
    const last = num(v.last_price), timestamp = toIso(v.timestamp ?? v.last_trade_time);
    if (!(last > 0) || !timestamp) continue;
    const bid = num(v.depth?.buy?.[0]?.price), ask = num(v.depth?.sell?.[0]?.price);
    const q = { last, timestamp, volume: finite(num(v.volume)) ? num(v.volume) : null };
    if (bid > 0 && ask >= bid) { q.bid = bid; q.ask = ask; }
    out.set(key, q);
  }
  return out;
}

/** Historical candle response → ascending bars. Upstox returns newest first: [ts,o,h,l,c,v,oi]. */
export function parseCandles(payload) {
  const rows = Array.isArray(payload?.data?.candles) ? payload.data.candles : [];
  const bars = [];
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const [ts, o, h, l, c, v] = r;
    const close = num(c);
    if (typeof ts !== "string" || !(close > 0)) continue;
    bars.push({ ts, day: ts.slice(0, 10), open: num(o), high: num(h), low: num(l), close, volume: finite(num(v)) ? num(v) : null });
  }
  return bars.sort((a, b) => a.ts.localeCompare(b.ts));
}

const iv01 = (iv) => (finite(iv) && iv > 0 ? (iv > 3 ? iv / 100 : iv) : null); // Upstox sends percent; the engine uses a fraction
const intOrNull = (x) => (finite(x) ? Math.round(x) : null);

/** Option-chain response → flat contract list in the normalized snapshot shape. */
export function parseOptionChain(payload, { underlying, lotSize, fetchedAt, maxStrikeDistance = 0.12 }) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const out = [];
  for (const row of rows) {
    const strike = num(row?.strike_price), spot = num(row?.underlying_spot_price);
    const expiry = String(row?.expiry || "").slice(0, 10);
    if (!(strike > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) continue;
    if (spot > 0 && Math.abs(strike / spot - 1) > maxStrikeDistance) continue;
    for (const [side, type] of [["call_options", "CE"], ["put_options", "PE"]]) {
      const o = row[side], md = o?.market_data, g = o?.option_greeks;
      if (!o?.instrument_key || !md) continue;
      const bid = num(md.bid_price), ask = num(md.ask_price), oi = num(md.oi), prev = num(md.prev_oi);
      out.push({
        contract_id: o.instrument_key, symbol: `${underlying} ${strike} ${type} ${expiry}`, underlying, exchange: "NFO",
        option_type: type, strike, expiry, lot_size: Number.isInteger(lotSize) ? lotSize : null,
        bid: bid > 0 ? bid : null, ask: ask > 0 ? ask : null, last: num(md.ltp) > 0 ? num(md.ltp) : null,
        timestamp: fetchedAt, delta: finite(num(g?.delta)) ? num(g.delta) : null, gamma: finite(num(g?.gamma)) ? num(g.gamma) : null,
        theta: finite(num(g?.theta)) ? num(g.theta) : null, vega: finite(num(g?.vega)) ? num(g.vega) : null, iv: iv01(num(g?.iv)),
        open_interest: intOrNull(oi), oi_change: finite(oi) && finite(prev) ? oi - prev : null, volume: intOrNull(num(md.volume)),
      });
    }
  }
  return out;
}

/** Option-contract listing → { lot_size, expiries[] } for one underlying. */
export function parseContracts(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const expiries = [...new Set(rows.map((r) => String(r?.expiry || "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  const lot = rows.map((r) => num(r?.lot_size)).find((x) => Number.isInteger(x) && x > 0) ?? null;
  return { lot_size: lot, expiries };
}

/** Expiries worth loading: nearest two, plus the first one at least 7 days out (the engine's minimum for entries). */
export function pickExpiries(expiries, nowMs, { stock = false } = {}) {
  const today = istDay(nowMs);
  const up = (expiries || []).filter((e) => e >= today).sort();
  if (!up.length) return [];
  if (stock) return [up[0]];
  const far = up.find((e) => (Date.parse(e + "T15:30:00+05:30") - nowMs) / DAY >= 7);
  return [...new Set([...up.slice(0, 2), ...(far ? [far] : [])])];
}

/** Pure assembly of the normalized snapshot from already-fetched pieces. */
export function buildUpstoxSnapshot({ nowMs, mode, instruments, contracts, coverage }) {
  const live = mode === "live";
  const kept = instruments.filter((i) => i.quote && i.closes.length >= 55);
  return {
    schema_version: 1, region: "INDIA", source: "upstox", data_mode: live ? "live" : "eod",
    observed_at: new Date(nowMs).toISOString(),
    as_of: kept.map((i) => i.quote.timestamp).sort().at(-1) || null,
    instruments: kept.map((i) => ({
      symbol: i.symbol, instrument_id: i.key, exchange: i.asset_class === "INDEX" ? "NSE_INDEX" : "NSE", asset_class: i.asset_class,
      candles: i.closes.map((c) => ({ timestamp: c.day + "T15:30:00+05:30", close: c.close })),
      quote: i.quote,
    })),
    option_contracts: live ? contracts : [],
    skipped: instruments.filter((i) => !kept.includes(i)).slice(0, 50).map((i) => ({ symbol: i.symbol, reason: !i.quote ? "No fresh quote returned." : `Warming up: ${i.closes.length}/55 daily closes stored.` })),
    coverage,
  };
}

// ---------- network + D1 orchestration ----------
const intEnv = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isInteger(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export function universeList(universe = universeSeed, cap = 250) {
  return [
    ...(universe.indices || []).map((x) => ({ ...x, asset_class: "INDEX" })),
    ...(universe.stocks || []).map((x) => ({ ...x, asset_class: "EQUITY" })),
    ...(universe.etfs || []).map((x) => ({ ...x, asset_class: "ETF" })),
  ].filter((x) => x.symbol && x.key).slice(0, cap);
}

export async function fetchUpstoxSnapshot(env, region, purpose, fetchImpl = fetch, nowMs = Date.now(), universe = env?.UNIVERSE_INDIA || universeSeed) {
  if (region !== "INDIA") throw new Error("Upstox covers Indian markets only.");
  if (!env?.UPSTOX_ACCESS_TOKEN) throw new Error("UPSTOX_ACCESS_TOKEN is not configured.");
  if (!env?.DB) throw new Error("D1 database is not configured.");
  const eod = purpose === "paper_eod";
  if (!eod && marketPhase(nowMs) !== "open") throw new Error("NSE is closed; no live run.");
  const mode = eod ? "eod" : "live";
  const cap = intEnv(env.UPSTOX_MAX_INSTRUMENTS, 250, 3, 500);
  const histBatch = intEnv(env.UPSTOX_HISTORY_BATCH, 20, 0, 200), chainBatch = intEnv(env.UPSTOX_CHAIN_BATCH, 6, 0, 100);
  const list = universeList(universe, cap);
  const db = env.DB, today = istDay(nowMs), fetchedAt = new Date(nowMs).toISOString();
  const call = async (path, params) => {
    const u = new URL(UPSTOX_BASE + path);
    for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
    const res = await fetchImpl(u.toString(), { headers: { Authorization: "Bearer " + env.UPSTOX_ACCESS_TOKEN, Accept: "application/json" } });
    if (!res.ok) throw new Error("Upstox HTTP " + res.status);
    return res.json();
  };

  // 1) Live quotes (full quotes include the best bid/ask).
  const quotes = new Map();
  for (const keys of chunk(list.map((x) => x.key), 100)) {
    for (const [k, v] of parseQuotes(await call("/v2/market-quote/quotes", { instrument_key: keys.join(",") }))) quotes.set(k, v);
  }
  if (!quotes.size) throw new Error("Upstox returned no usable quotes.");

  // 2) Stored daily closes (one query), then merge today's quote as the newest bar.
  const from = istDay(nowMs - 130 * DAY);
  const rows = ((await db.prepare("SELECT symbol,day,close FROM bot_candles WHERE region='INDIA' AND day>=? ORDER BY symbol,day").bind(from).all()).results) || [];
  const closes = new Map();
  for (const r of rows) (closes.get(r.symbol) || closes.set(r.symbol, []).get(r.symbol)).push({ day: r.day, close: Number(r.close) });
  const quoteRows = [];
  for (const x of list) {
    const q = quotes.get(x.key); if (!q) continue;
    const day = istDay(Date.parse(q.timestamp));
    quoteRows.push([x.symbol, day, q.last]);
    const arr = closes.get(x.symbol) || closes.set(x.symbol, []).get(x.symbol);
    if (arr.at(-1)?.day === day) arr[arr.length - 1] = { day, close: q.last }; else if (!arr.length || arr.at(-1).day < day) arr.push({ day, close: q.last });
  }
  for (const part of chunk(quoteRows, 100)) {
    await db.prepare("INSERT INTO bot_candles (region,symbol,day,close,updated_at) SELECT 'INDIA', json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'), ?1 FROM json_each(?2) WHERE true ON CONFLICT(region,symbol,day) DO UPDATE SET close=excluded.close, updated_at=excluded.updated_at").bind(fetchedAt, JSON.stringify(part)).run();
  }

  // 3) Backfill history for a few instruments per run (stays inside the free-plan subrequest budget).
  const staleBefore = istDay(nowMs - 4 * DAY);
  const needDaily = list.filter((x) => { const a = closes.get(x.symbol) || []; return a.length < 55 || (a.at(-2)?.day || "") < staleBefore; })
    .sort((a, b) => (closes.get(a.symbol)?.length || 0) - (closes.get(b.symbol)?.length || 0));
  const timingSyms = list.filter((x) => x.asset_class === "INDEX").concat(list.filter((x) => x.asset_class === "EQUITY").slice(0, 7));
  const latestSlot = new Map(((await db.prepare("SELECT symbol,MAX(slot_ts) s FROM bot_intraday WHERE region='INDIA' GROUP BY symbol").all()).results || []).map((r) => [r.symbol, r.s]));
  const needIntraday = timingSyms.filter((x) => !latestSlot.get(x.symbol) || latestSlot.get(x.symbol).slice(0, 10) < istDay(nowMs - 4 * DAY));
  const jobs = [...needDaily.map((x) => ({ x, kind: "days" })), ...needIntraday.map((x) => ({ x, kind: "minutes" }))].slice(0, histBatch);
  const backfill = { attempted: jobs.length, ok: 0, failed: 0 };
  for (const part of chunk(jobs, 5)) {
    await Promise.all(part.map(async ({ x, kind }) => {
      try {
        const unit = kind === "days" ? "days/1" : "minutes/30", span = kind === "days" ? 130 : 30;
        const bars = parseCandles(await call(`/v3/historical-candle/${encodeURIComponent(x.key)}/${unit}/${today}/${istDay(nowMs - span * DAY)}`));
        if (!bars.length) throw new Error("empty");
        if (kind === "days") {
          await db.prepare("INSERT INTO bot_candles (region,symbol,day,close,high,low,volume,updated_at) SELECT 'INDIA', ?1, json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'), json_extract(value,'$[3]'), json_extract(value,'$[4]'), ?2 FROM json_each(?3) WHERE true ON CONFLICT(region,symbol,day) DO UPDATE SET close=excluded.close, high=excluded.high, low=excluded.low, volume=excluded.volume, updated_at=excluded.updated_at")
            .bind(x.symbol, fetchedAt, JSON.stringify(bars.map((b) => [b.day, b.close, b.high, b.low, b.volume]))).run();
          const have = new Map((closes.get(x.symbol) || []).map((c) => [c.day, c]));
          for (const b of bars) if (!have.has(b.day) || b.day !== today) have.set(b.day, { day: b.day, close: b.close });
          closes.set(x.symbol, [...have.values()].sort((a, b) => a.day.localeCompare(b.day)));
        } else {
          await db.prepare("INSERT OR REPLACE INTO bot_intraday (region,symbol,slot_ts,open,high,low,close,volume) SELECT 'INDIA', ?1, json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'), json_extract(value,'$[3]'), json_extract(value,'$[4]'), json_extract(value,'$[5]') FROM json_each(?2) WHERE true")
            .bind(x.symbol, JSON.stringify(bars.map((b) => [b.ts, b.open, b.high, b.low, b.close, b.volume]))).run();
        }
        backfill.ok++;
      } catch { backfill.failed++; }
    }));
  }

  // 4) Option chains (live session only). Indices every run; F&O stocks rotate through a stored cursor.
  const contracts = [], chains = { loaded: [], failed: [], pending_stocks: 0 };
  if (mode === "live" && chainBatch >= 0) {
    const state = async (key) => { const r = await db.prepare("SELECT value FROM bot_state WHERE key=?").bind(key).first(); try { return r ? JSON.parse(r.value) : null; } catch { return null; } };
    const setState = (key, v) => db.prepare("INSERT INTO bot_state (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(key, JSON.stringify(v), fetchedAt).run();
    const meta = async (x) => {
      if (x.lot_size && x.expiries?.length) return { lot_size: x.lot_size, expiries: x.expiries };
      const cached = await state("contract:" + x.symbol);
      if (cached?.day === today && cached.lot_size) return cached;
      const c = parseContracts(await call("/v2/option/contract", { instrument_key: x.key }));
      if (c.lot_size) await setState("contract:" + x.symbol, { ...c, day: today });
      return c;
    };
    const loadChain = async (x, stock) => {
      try {
        const m = await meta(x), expiries = pickExpiries(m.expiries, nowMs, { stock });
        for (const expiry of expiries) {
          contracts.push(...parseOptionChain(await call("/v2/option/chain", { instrument_key: x.key, expiry_date: expiry }), { underlying: x.symbol, lotSize: m.lot_size, fetchedAt }));
        }
        chains.loaded.push(x.symbol);
      } catch { chains.failed.push(x.symbol); }
    };
    for (const x of list.filter((i) => i.asset_class === "INDEX")) await loadChain(x, false);
    const fno = list.filter((i) => i.asset_class === "EQUITY" && i.lot_size && i.expiries?.length);
    if (fno.length && chainBatch > 0) {
      const cur = ((await state("chain_cursor"))?.i || 0) % fno.length;
      const pick = Array.from({ length: Math.min(chainBatch, fno.length) }, (_, n) => fno[(cur + n) % fno.length]);
      for (const x of pick) await loadChain(x, true);
      await setState("chain_cursor", { i: (cur + pick.length) % fno.length });
      chains.pending_stocks = Math.max(0, fno.length - pick.length);
    }
  }

  const instruments = list.map((x) => ({ symbol: x.symbol, key: x.key, asset_class: x.asset_class, quote: quotes.get(x.key) || null, closes: (closes.get(x.symbol) || []).slice(-80) }));
  const coverage = {
    universe_size: list.length, quoted: instruments.filter((i) => i.quote).length, ready: instruments.filter((i) => i.quote && i.closes.length >= 55).length,
    warming_up: instruments.filter((i) => i.closes.length < 55).length, history_backfill: backfill, option_chains: chains,
    universe_source: universe.source || "seed", universe_generated_at: universe.generated_at || null,
    note: universe.stocks?.length ? "Stocks and ETFs come from the stored NSE universe." : "Universe has indices only. Run the Refresh India universe workflow to add all F&O stocks and ETFs.",
  };
  const snap = buildUpstoxSnapshot({ nowMs, mode, instruments, contracts, coverage });
  if (!snap.instruments.length) throw new Error(`Upstox data loaded but history is still warming up (${coverage.warming_up} instruments below 55 closes; ${backfill.ok} backfilled this run). Try again in a few minutes.`);
  return snap;
}
