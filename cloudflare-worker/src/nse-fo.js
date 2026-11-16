// Official NSE end-of-day F&O "bhavcopy" (free, published daily on nsearchives.nseindia.com).
// Gives real option open interest for every index and stock option after the close: PCR, OI change,
// support/resistance by OI and max pain. End-of-day only; never labelled live. Parsers are pure.
import { inflateRawSync } from "node:zlib";
import { maxPain } from "./engine.js";

export const bhavUrl = (yyyymmdd) => `https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${yyyymmdd}_F_0000.csv.zip`;
const INDEX_NAMES = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"];
const num = (x) => { const n = Number(x); return Number.isFinite(n) ? n : NaN; };

/** First file of a ZIP archive (stored or deflated). */
export function unzipFirst(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not a zip file.");
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error("Bad zip directory.");
  const method = buf.readUInt16LE(cd + 10), csize = buf.readUInt32LE(cd + 20), lho = buf.readUInt32LE(cd + 42);
  const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
  const data = buf.subarray(start, start + csize);
  return method === 0 ? data : inflateRawSync(data);
}

/** Pure: UDiFF F&O bhavcopy CSV text → per-underlying option-OI summary for the nearest expiry. */
export function summariseBhavcopy(csv) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const head = lines.shift()?.split(",").map((h) => h.trim()) || [];
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const need of ["TckrSymb", "FinInstrmTp", "XpryDt", "StrkPric", "OptnTp", "OpnIntrst"]) if (!(need in col)) throw new Error("Unexpected bhavcopy format (missing " + need + ").");
  const by = new Map();
  let tradeDate = null;
  for (const line of lines) {
    const c = line.split(",");
    const tp = c[col.FinInstrmTp]?.trim(), ot = c[col.OptnTp]?.trim();
    if (!["IDO", "STO"].includes(tp) || !["CE", "PE"].includes(ot)) continue;
    const sym = c[col.TckrSymb].trim(), exp = c[col.XpryDt].trim(), strike = num(c[col.StrkPric]), oi = num(c[col.OpnIntrst]);
    if (!(strike > 0) || !Number.isFinite(oi)) continue;
    tradeDate ||= (c[col.TradDt] || "").trim() || null;
    const g = by.get(sym) || { sym, index: tp === "IDO", exps: new Map() };
    const e = g.exps.get(exp) || { rows: [], callChg: 0, putChg: 0, und: NaN, lot: null, vol: 0 };
    e.rows.push({ strike, call: ot === "CE", oi });
    const chg = num(c[col.ChngInOpnIntrst]); if (Number.isFinite(chg)) (ot === "CE" ? (e.callChg += chg) : (e.putChg += chg));
    if (Number.isFinite(num(c[col.UndrlygPric]))) e.und = num(c[col.UndrlygPric]);
    if (Number.isInteger(num(c[col.NewBrdLotQty]))) e.lot = num(c[col.NewBrdLotQty]);
    e.vol += Number.isFinite(num(c[col.TtlTradgVol])) ? num(c[col.TtlTradgVol]) : 0;
    g.exps.set(exp, e); by.set(sym, g);
  }
  const out = [];
  for (const g of by.values()) {
    const [expiry, e] = [...g.exps.entries()].sort(([a], [b]) => a.localeCompare(b))[0];
    const callOi = e.rows.filter((r) => r.call).reduce((s, r) => s + r.oi, 0), putOi = e.rows.filter((r) => !r.call).reduce((s, r) => s + r.oi, 0);
    const top = (call) => e.rows.filter((r) => r.call === call && r.oi > 0).sort((a, b) => b.oi - a.oi).slice(0, 3).map((r) => ({ strike: r.strike, oi: r.oi }));
    const pcr = callOi ? putOi / callOi : null;
    out.push({ underlying: g.sym, is_index: g.index, expiry, lot_size: e.lot, underlying_price: Number.isFinite(e.und) ? e.und : null,
      call_open_interest: callOi, put_open_interest: putOi, pcr_oi: pcr === null ? null : Math.round(pcr * 1000) / 1000,
      change_in_call_oi: e.callChg, change_in_put_oi: e.putChg, strikes: new Set(e.rows.map((r) => r.strike)).size,
      support_strike: top(false)[0]?.strike ?? null, resistance_strike: top(true)[0]?.strike ?? null, top_put_oi: top(false), top_call_oi: top(true),
      max_pain: e.rows.length >= 10 ? maxPain(e.rows) : null, volume: e.vol,
      bias: pcr === null ? null : pcr > 1.2 ? "PUT-HEAVY (often read as supportive)" : pcr < 0.8 ? "CALL-HEAVY (often read as capped)" : "BALANCED" });
  }
  const rank = (x) => (x.is_index ? (INDEX_NAMES.indexOf(x.underlying) < 0 ? 99 : INDEX_NAMES.indexOf(x.underlying)) : 1000);
  out.sort((a, b) => rank(a) - rank(b) || b.call_open_interest + b.put_open_interest - (a.call_open_interest + a.put_open_interest));
  return { trade_date: tradeDate, underlyings: out.slice(0, 80) };
}

/** Try today and the previous few days until NSE has a file. */
export async function fetchFoBhavcopy(fetchImpl = fetch, nowMs = Date.now()) {
  for (let back = 0; back < 6; back++) {
    const d = new Date(nowMs + 330 * 60000 - back * 86400000), wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const ymd = d.toISOString().slice(0, 10).replaceAll("-", "");
    try {
      const res = await fetchImpl(bhavUrl(ymd), { headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketPilotPaperBot/1.0)", Accept: "*/*" } });
      if (!res.ok) continue;
      const sum = summariseBhavcopy(unzipFirst(Buffer.from(await res.arrayBuffer())).toString("utf8"));
      if (sum.underlyings.length) return { source: "NSE F&O bhavcopy (official end-of-day file)", data_mode: "eod", file_date: ymd, ...sum };
    } catch { /* try the previous day */ }
  }
  throw new Error("NSE bhavcopy not available for the last few trading days.");
}
