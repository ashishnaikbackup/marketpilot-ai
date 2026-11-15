import { fetchUpstoxSnapshot } from "./upstox.js";

// Market-data provider adapters. Each adapter returns a normalized snapshot (docs/PAPER_BOT.md).
// Rules: never invent data, never label end-of-day data as live, never put vendor keys in URLs or logs.

export const DEFAULT_GLOBAL_WATCHLIST = "SPY:ETF,QQQ:ETF,AAPL,MSFT,NVDA,AMZN,GOOGL,META";

export function providerName(env) {
  const n = String(env?.MARKET_DATA_PROVIDER || "").trim().toLowerCase();
  if (n) return n;
  if (env?.MARKET_DATA_SNAPSHOT_URL) return "adapter_url";
  return env?.TWELVEDATA_API_KEY ? "twelvedata" : "none";
}

const UPSTOX_INFO = {
  provider: "upstox", configured: true, intraday: true,
  message: "Upstox Analytics Token (read-only): live NSE quotes, option chains with OI, IV and Greeks. Orders are never placed. Confirm your Upstox plan covers the data you display.",
};

// Which provider serves a region. India prefers Upstox when its token is set; everything else follows the old rules.
export function regionProvider(env, region) {
  const explicit = String(env?.MARKET_DATA_PROVIDER || "").trim().toLowerCase();
  if (region === "INDIA" && env?.UPSTOX_ACCESS_TOKEN && (!explicit || explicit === "upstox")) return { ...UPSTOX_INFO, data_mode: "live" };
  const name = explicit && explicit !== "upstox" ? explicit : env?.MARKET_DATA_SNAPSHOT_URL ? "adapter_url" : env?.TWELVEDATA_API_KEY ? "twelvedata" : "none";
  if (name === "twelvedata") {
    const hasKey = Boolean(env?.TWELVEDATA_API_KEY), covers = region === "GLOBAL" || Boolean(env?.TWELVEDATA_INDIA_SYMBOLS);
    return {
      provider: "twelvedata", configured: hasKey && covers, data_mode: "eod", intraday: false,
      message: hasKey
        ? (covers ? "" : "Twelve Data's free plan has no NSE/BSE. ") + "Twelve Data adapter configured for end-of-day closes (US markets). Per Twelve Data's pricing page the free plan is US-only and for internal, non-display use, so confirm your plan's terms before showing prices to others."
        : "Set the TWELVEDATA_API_KEY Worker secret to enable the Twelve Data adapter.",
    };
  }
  if (name === "adapter_url") return { provider: "adapter_url", configured: Boolean(env?.MARKET_DATA_SNAPSHOT_URL), data_mode: "live_or_delayed_per_adapter", intraday: true, message: "Custom normalized snapshot adapter. Entitlements and data mode are asserted by the adapter and are not independently verified." };
  return { provider: null, configured: false, data_mode: "unavailable", intraday: false, message: "No market-data provider configured. The bot stays inactive and invents nothing." };
}

export function providerInfo(env) {
  const by_region = { INDIA: regionProvider(env, "INDIA"), GLOBAL: regionProvider(env, "GLOBAL") };
  const regions = Object.keys(by_region).filter((r) => by_region[r].configured);
  const configuredOnes = regions.map((r) => by_region[r]);
  const modes = [...new Set(configuredOnes.map((x) => x.data_mode))];
  const single = (by_region.INDIA.configured ? by_region.INDIA : by_region.GLOBAL.configured ? by_region.GLOBAL : by_region.GLOBAL);
  return {
    provider: configuredOnes.length ? [...new Set(configuredOnes.map((x) => x.provider))].join("+") : single.provider,
    configured: regions.length > 0,
    data_mode: configuredOnes.length ? (modes.length === 1 ? modes[0] : "mixed") : single.data_mode,
    intraday: configuredOnes.some((x) => x.intraday), regions,
    message: configuredOnes.length ? [...new Set(configuredOnes.map((x) => x.message))].join(" ") : single.message,
    by_region,
  };
}

export function parseWatchlist(text) {
  return String(text || DEFAULT_GLOBAL_WATCHLIST).split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8).map((token) => {
    const [symbol, cls] = token.split(":");
    return { symbol: symbol.trim(), asset_class: (cls || "EQUITY").trim().toUpperCase() };
  }).filter((x) => /^[A-Z0-9.\-:]{1,20}$/i.test(x.symbol) && ["EQUITY", "ETF"].includes(x.asset_class));
}

const toBarTimestamp = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d + "T00:00:00Z" : d);

// Pure parser so it can be tested without network access.
export function buildTwelveDataSnapshot({ region, payload, entries, fetchedAt, exchange = null, maxBarAgeDays = 5 }) {
  if (payload?.status === "error" || payload?.code >= 400) throw new Error("Twelve Data error: " + String(payload.message || payload.code).slice(0, 200));
  const bySymbol = entries.length === 1 && Array.isArray(payload?.values) ? { [entries[0].symbol]: payload } : payload || {};
  const instruments = [], skipped = [];
  let asOf = null;
  for (const e of entries) {
    const node = bySymbol[e.symbol];
    if (!node || node.status === "error" || !Array.isArray(node.values)) { skipped.push({ symbol: e.symbol, reason: "No data returned." }); continue; }
    const candles = node.values.map((v) => ({ timestamp: toBarTimestamp(String(v.datetime)), close: Number(v.close) })).filter((c) => Number.isFinite(c.close) && c.close > 0).reverse();
    if (candles.length < 55) { skipped.push({ symbol: e.symbol, reason: "Fewer than 55 valid daily closes." }); continue; }
    const last = candles.at(-1);
    const ageDays = (Date.parse(fetchedAt) - Date.parse(last.timestamp)) / 86400000;
    if (!Number.isFinite(ageDays) || ageDays > maxBarAgeDays) { skipped.push({ symbol: e.symbol, reason: "Latest bar is older than " + maxBarAgeDays + " days." }); continue; }
    if (!asOf || last.timestamp > asOf) asOf = last.timestamp;
    instruments.push({ symbol: e.symbol, exchange: exchange || node.meta?.exchange || null, asset_class: e.asset_class, candles, quote: { last: last.close, timestamp: fetchedAt, basis: "eod_close" } });
  }
  if (!instruments.length) throw new Error("Provider returned no usable instruments.");
  return { schema_version: 1, region, source: "twelvedata", data_mode: "eod", observed_at: fetchedAt, as_of: asOf, instruments, option_contracts: [], skipped };
}

async function fetchTwelveData(env, region, fetchImpl) {
  if (!env.TWELVEDATA_API_KEY) throw new Error("TWELVEDATA_API_KEY is not configured.");
  if (region === "INDIA" && !env.TWELVEDATA_INDIA_SYMBOLS) throw new Error("India symbols are not configured; Twelve Data's free plan does not include NSE/BSE.");
  const entries = parseWatchlist(region === "INDIA" ? env.TWELVEDATA_INDIA_SYMBOLS : env.GLOBAL_WATCHLIST);
  if (!entries.length) throw new Error("Watchlist is empty or invalid.");
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", entries.map((e) => e.symbol).join(","));
  url.searchParams.set("interval", "1day");
  url.searchParams.set("outputsize", "60");
  // Key goes in a header, never in the URL, so it cannot leak through logs.
  const res = await fetchImpl(url.toString(), { headers: { Authorization: "apikey " + env.TWELVEDATA_API_KEY } });
  if (!res.ok) throw new Error("Twelve Data HTTP " + res.status);
  return buildTwelveDataSnapshot({ region, payload: await res.json(), entries, fetchedAt: new Date().toISOString() });
}

async function fetchAdapterUrl(env, region, purpose, fetchImpl) {
  if (!env.MARKET_DATA_SNAPSHOT_URL) throw new Error("MARKET_DATA_SNAPSHOT_URL is not configured.");
  const u = new URL(env.MARKET_DATA_SNAPSHOT_URL);
  u.searchParams.set("region", region);
  u.searchParams.set("purpose", purpose);
  const res = await fetchImpl(u.toString(), { headers: env.MARKET_DATA_API_TOKEN ? { Authorization: "Bearer " + env.MARKET_DATA_API_TOKEN } : {} });
  if (!res.ok) throw new Error("Provider adapter HTTP " + res.status);
  return res.json();
}

export async function fetchSnapshot(env, region, purpose, fetchImpl = fetch) {
  const name = regionProvider(env, region).provider;
  if (name === "upstox") return fetchUpstoxSnapshot(env, region, purpose, fetchImpl);
  if (name === "twelvedata") return fetchTwelveData(env, region, fetchImpl);
  if (name === "adapter_url") return fetchAdapterUrl(env, region, purpose, fetchImpl);
  throw new Error("No market-data provider configured.");
}
