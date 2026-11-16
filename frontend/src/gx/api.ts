import { useCallback, useEffect, useState } from "react";
import { demoInsights, demoEquity, demoPortfolio, demoPositions, demoReports, demoStatus } from "./demo";

export const KEY = "marketpilot-paperbot-api-v1"; // same key the earlier screens used, so saved settings carry over
export type Region = "INDIA" | "GLOBAL";

export type Settings = { api: string; token: string };
export function loadSettings(): Settings {
  let api = "", token = "";
  try {
    api = localStorage.getItem(KEY) || localStorage.getItem("marketpilot.apiBaseUrl") || "";
    token = sessionStorage.getItem(KEY + "-read-token") || localStorage.getItem(KEY + "-read-token-saved") || "";
  } catch { /* storage can be blocked */ }
  if (!api) api = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";
  return { api: api.trim().replace(/\/+$/, ""), token };
}
export function saveSettings(s: Settings, remember: boolean) {
  try {
    localStorage.setItem(KEY, s.api.trim().replace(/\/+$/, ""));
    sessionStorage.setItem(KEY + "-read-token", s.token);
    if (remember) localStorage.setItem(KEY + "-read-token-saved", s.token);
    else localStorage.removeItem(KEY + "-read-token-saved");
  } catch { /* ignore */ }
}
export function clearSettings() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + "-read-token-saved"); sessionStorage.removeItem(KEY + "-read-token"); } catch { /* ignore */ }
}

// The bot runs in GitHub Actions and publishes plain JSON files to this public branch. No API address or token needed.
export const DATA_BASE = ((import.meta.env.VITE_DATA_BASE as string | undefined) || "https://raw.githubusercontent.com/ashishnaikbackup/marketpilot-ai/bot-data/public/paper-bot").replace(/\/+$/, "");
async function getStatic<T>(name: string): Promise<T> {
  let res: Response;
  try { res = await fetch(DATA_BASE + "/" + name + ".json", { cache: "no-store" }); } catch { throw new ApiError("Could not reach the published bot data. Check your internet connection.", 0); }
  if (!res.ok) throw new ApiError(res.status === 404 ? "The bot has not published data yet." : "Could not load bot data (" + res.status + ").", res.status);
  return res.json() as Promise<T>;
}

export class ApiError extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s; } }
export async function call<T>(s: Settings, path: string, init?: RequestInit): Promise<T> {
  if (!s.api) throw new ApiError("Add your MarketPilot API address first.", 0);
  let res: Response;
  try {
    res = await fetch(s.api + path, { cache: "no-store", ...init, headers: { ...(s.token ? { Authorization: "Bearer " + s.token } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  } catch { throw new ApiError("Could not reach the API. Check the address and your internet connection.", 0); }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const detail = (data as { detail?: string } | null)?.detail;
    throw new ApiError(res.status === 401 ? "The read token is missing or wrong." : res.status === 429 ? "Too many requests. Wait a minute and retry." : detail || "Request failed (" + res.status + ").", res.status);
  }
  return data as T;
}

export type RegionProvider = { provider: string | null; configured: boolean; data_mode: string; intraday: boolean; message: string };
export type Provider = { provider: string | null; configured: boolean; data_mode: string; message: string; regions?: Region[]; by_region?: Record<Region, RegionProvider> };
export type TimingSlot = { slot: string; samples: number; avg_return_pct: number | null; up_share_pct: number | null; t_stat: number | null };
export type Timing = { symbol: string; reliable: boolean; best_buy_slot: TimingSlot | null; best_sell_slot: TimingSlot | null; slots: TimingSlot[]; weekdays: { weekday: string; samples: number; avg_return_pct: number | null; up_share_pct: number | null }[]; sample_bars: number; note: string };
export type FoUnderlying = { underlying: string; is_index: boolean; expiry: string; lot_size: number | null; underlying_price: number | null; call_open_interest: number; put_open_interest: number; pcr_oi: number | null; change_in_call_oi: number; change_in_put_oi: number; support_strike: number | null; resistance_strike: number | null; max_pain: number | null; bias: string | null };
export type FoEod = { source: string; file_date: string; trade_date: string | null; underlyings: FoUnderlying[] };
export type NewsItem = { title: string; source: string | null; link: string; published: string | null };
export type News = { source: string; fetched_at: string; INDIA: NewsItem[]; GLOBAL: NewsItem[] };
export type Insights = { learning: { ready: boolean; total_trades: number; rules: string; strategies: Record<string, { trades: number; win_rate_pct: number | null; avg_net_pnl: number | null; net_pnl: number; risk_multiplier: number; note: string }>; cooldowns: Record<string, { until: string; reason: string }> }; timing: Timing[]; stored_symbols: number; disclaimer: string };
export type Status = { configured: boolean; feed_configured: boolean; provider?: Provider; mode: string; strategy_version: string; schedule_utc: string[]; message: string };
export type Stats = { closed_trades: number; wins: number; losses: number; win_rate_pct: number | null; net_realized_pnl: number; profit_factor: number | null; avg_win: number | null; avg_loss: number | null; avg_holding_days: number | null; max_drawdown_pct: number };
export type Portfolio = { region: Region; currency: string; starting_capital: number; equity: number; cash: number; total_pnl: number; stats: Stats; has_history: boolean; latest_snapshot: { exposure: number; open_positions: number; realized_pnl: number; unrealized_pnl: number; recorded_at: string } | null };
export type Position = { id: string; region: Region; symbol: string; exchange?: string; asset_class: string; option_type?: string | null; strike?: number | null; expiry?: string | null; quantity: number; lot_size: number; entry_price: number; last_price: number; stop_price: number; target_price: number; exit_price?: number | null; status: "OPEN" | "CLOSED"; opened_at: string; closed_at?: string | null; realized_pnl?: number | null; gross_pnl?: number | null; entry_fees?: number | null; exit_fees?: number | null; exit_reason?: string | null; holding_days?: number | null; strategy?: string | null; order_type?: string | null; risk_amount?: number | null; capital_allocated?: number | null; slippage_bps?: number | null; price_basis?: string | null; explanation?: string | null; thesis?: string | null };
export type Decision = { symbol: string; action: string; reason: string; side?: string; entry?: number; stop?: number; target?: number; pnl?: number; quantity?: number; lot_size?: number; asset_class?: string; option_type?: string; strike?: number; risk_amount?: number; capital_allocated?: number; explanation?: string; strategy?: string; holding_days?: number; price?: number; brokerage?: number; order_type?: string };
export type Move = { symbol: string; change_pct: number; last?: number };
export type ReportBody = {
  stance?: string; inactive_reason?: string | null; reason?: string; data_mode?: string; source?: string; observed_at?: string; currency?: string; region?: Region;
  market_overview?: { indices: (Move & { trend?: string })[]; breadth: { bullish: number; bearish: number; neutral: number; scanned: number }; note?: string };
  sector_moves?: { sector: string; avg_change_pct: number; constituents: number }[];
  top_gainers?: Move[]; top_losers?: Move[];
  fo_summary?: { contracts_seen: number; contracts_eligible: number; options_disabled_reason?: string | null; by_underlying: { underlying: string; contracts: number; eligible_contracts: number; call_open_interest: number; put_open_interest: number; pcr_oi: number | null; pcr_volume?: number | null; change_in_call_oi?: number | null; change_in_put_oi?: number | null; support_strike?: number | null; resistance_strike?: number | null; max_pain_strike?: number | null; strikes_used?: number; mean_iv_pct: number | null; mean_gamma?: number | null; mean_theta?: number | null; mean_vega?: number | null; bias?: string | null }[]; note?: string };
  decisions?: Decision[]; trades_executed?: Decision[]; trades_closed?: Decision[]; trades_skipped?: { symbol: string; reason: string }[];
  open_positions?: { symbol: string; asset_class: string; entry: number; mark: number; unrealized: number; stale: boolean }[];
  portfolio?: { starting_capital: number; equity: number; cash: number; invested: number; realized_pnl_net: number; unrealized_pnl: number; total_pnl: number; total_return_pct: number; realized_this_run: number };
  risk_exposure?: { gross_exposure_pct: number; max_gross_exposure_pct: number; open_positions: number; max_positions: number; open_options: number; max_options: number; capital_at_risk_to_stops: number; stale_marks: number };
  strategy_performance?: { strategy: string; trades: number; wins: number; win_rate_pct: number | null; net_pnl: number; avg_net_pnl: number | null }[];
  next_session_watchlist?: { symbol: string; bias: string; note: string; momentum_pct: number }[];
  assumptions?: { brokerage_per_order: number; equity_slippage_bps_if_no_bid_ask: number; option_slippage_bps_if_no_bid_ask: number; not_modelled: string[] };
  notes?: string[];
};
export type Report = { id: string; region: Region; trigger: string; source: string; data_mode: string; observed_at: string; started_at: string; completed_at: string; status: string; scanned: number; opened: number; closed: number; realized_pnl: number; report: ReportBody };
export type EquityPoint = { recorded_at: string; equity: number; cash: number };

export type Desk = {
  settings: Settings; region: Region; demo: boolean; foEod: FoEod | null; news: News | null; demoReason: string; grounding: unknown; publishedAt: string; loading: boolean; error: string; connected: boolean; needsToken: boolean; updated: string;
  status: Status | null; portfolio: Portfolio | null; positions: Position[]; reports: Report[]; equity: EquityPoint[]; insights: Insights | null; refresh: () => void;
};

export function useDesk(settings: Settings, region: Region): Desk {
  const [state, setState] = useState<Omit<Desk, "settings" | "region" | "demo" | "refresh">>({ demoReason: "", grounding: null, foEod: null, news: null, publishedAt: "", loading: false, error: "", connected: false, needsToken: false, updated: "", status: null, portfolio: null, positions: [], reports: [], equity: [], insights: null });
  const refresh = useCallback(() => {
    if (!settings.api) { // default: read the files the GitHub Action publishes
      let off = false;
      setState((st) => ({ ...st, loading: true, error: "" }));
      (async () => {
        try {
          const [status, portfolio, positions, reports, equity, insights, grounding, meta, foEod, news] = await Promise.all([
            getStatic<Status>("status"), getStatic<Portfolio>("portfolio-" + region), getStatic<{ positions: Position[] }>("positions-" + region),
            getStatic<{ reports: Report[] }>("reports-" + region), getStatic<{ points: EquityPoint[] }>("equity-" + region),
            getStatic<Insights>("insights-" + region).catch(() => null), getStatic<unknown>("grounding-" + region).catch(() => null),
            getStatic<{ generated_at: string }>("meta").catch(() => null), getStatic<FoEod>("fo-eod").catch(() => null), getStatic<News>("news").catch(() => null),
          ]);
          if (!off) setState({ demoReason: "", grounding, foEod, news, publishedAt: meta?.generated_at || "", loading: false, error: "", connected: true, needsToken: false, updated: new Date().toISOString(), status, portfolio, positions: positions.positions, reports: reports.reports, equity: equity.points, insights });
        } catch (e) {
          if (!off) setState({ demoReason: e instanceof Error ? e.message : "No data.", grounding: null, foEod: null, news: null, publishedAt: "", loading: false, error: "", connected: true, needsToken: false, updated: new Date().toISOString(), status: demoStatus, portfolio: demoPortfolio(region), positions: demoPositions(region), reports: demoReports(region), equity: demoEquity(region), insights: demoInsights(region) });
        }
      })();
      return () => { off = true; };
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    (async () => {
      try {
        const status = await call<Status>(settings, "/api/v1/paper-bot/status");
        if (!settings.token) { if (!cancelled) setState({ demoReason: "", grounding: null, foEod: null, news: null, publishedAt: "", loading: false, error: "", connected: true, needsToken: true, updated: new Date().toISOString(), status, portfolio: null, positions: [], reports: [], equity: [], insights: null }); return; }
        const q = "?region=" + region;
        const [portfolio, positions, reports, equity, insights] = await Promise.all([
          call<Portfolio>(settings, "/api/v1/paper-bot/portfolio" + q),
          call<{ positions: Position[] }>(settings, "/api/v1/paper-bot/positions" + q + "&limit=300"),
          call<{ reports: Report[] }>(settings, "/api/v1/paper-bot/reports" + q + "&limit=60"),
          call<{ points: EquityPoint[] }>(settings, "/api/v1/paper-bot/equity" + q + "&limit=300"),
          call<Insights>(settings, "/api/v1/paper-bot/insights" + q).catch(() => null),
        ]);
        if (!cancelled) setState({ demoReason: "", grounding: null, foEod: null, news: null, publishedAt: "", loading: false, error: "", connected: true, needsToken: false, updated: new Date().toISOString(), status, portfolio, positions: positions.positions, reports: reports.reports, equity: equity.points, insights });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, connected: false, needsToken: e instanceof ApiError && e.status === 401, error: e instanceof Error ? e.message : "Something went wrong." }));
      }
    })();
    return () => { cancelled = true; };
  }, [settings, region]);
  useEffect(() => refresh(), [refresh]);
  return { settings, region, refresh, demo: !settings.api && Boolean(state.demoReason), ...state };
}

export const money = (n: number | null | undefined, cur: string, digits = 0) => (typeof n === "number" && Number.isFinite(n) ? new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-US", { style: "currency", currency: cur, maximumFractionDigits: digits }).format(n) : "—");
export const signed = (n: number | null | undefined, cur: string, digits = 0) => (typeof n === "number" && Number.isFinite(n) ? (n > 0 ? "+" : n < 0 ? "−" : "") + money(Math.abs(n), cur, digits) : "—");
export const pctText = (n: number | null | undefined, digits = 2) => (typeof n === "number" && Number.isFinite(n) ? (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(digits) + "%" : "—");
export const tone = (n: number | null | undefined) => (typeof n === "number" ? (n > 0 ? "up" : n < 0 ? "down" : "flat") : "flat");
export const when = (iso: string | null | undefined) => { if (!iso) return "—"; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
export const modeLabel = (m: string | undefined) => (m === "demo" ? "Demo" : m === "live" ? "Live" : m === "delayed" ? "Delayed" : m === "eod" ? "End of day" : m === "unavailable" || !m ? "No data" : m);
