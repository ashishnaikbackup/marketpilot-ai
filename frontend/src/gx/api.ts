import { useCallback, useEffect, useState } from "react";

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

export type Provider = { provider: string | null; configured: boolean; data_mode: string; message: string; regions?: Region[] };
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
  fo_summary?: { contracts_seen: number; contracts_eligible: number; options_disabled_reason?: string | null; by_underlying: { underlying: string; contracts: number; eligible_contracts: number; call_open_interest: number; put_open_interest: number; pcr_oi: number | null; mean_iv_pct: number | null }[]; note?: string };
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
  settings: Settings; region: Region; loading: boolean; error: string; connected: boolean; needsToken: boolean; updated: string;
  status: Status | null; portfolio: Portfolio | null; positions: Position[]; reports: Report[]; equity: EquityPoint[]; refresh: () => void;
};

export function useDesk(settings: Settings, region: Region): Desk {
  const [state, setState] = useState<Omit<Desk, "settings" | "region" | "refresh">>({ loading: false, error: "", connected: false, needsToken: false, updated: "", status: null, portfolio: null, positions: [], reports: [], equity: [] });
  const refresh = useCallback(() => {
    if (!settings.api) { setState((s) => ({ ...s, connected: false, error: "", status: null })); return; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    (async () => {
      try {
        const status = await call<Status>(settings, "/api/v1/paper-bot/status");
        if (!settings.token) { if (!cancelled) setState({ loading: false, error: "", connected: true, needsToken: true, updated: new Date().toISOString(), status, portfolio: null, positions: [], reports: [], equity: [] }); return; }
        const q = "?region=" + region;
        const [portfolio, positions, reports, equity] = await Promise.all([
          call<Portfolio>(settings, "/api/v1/paper-bot/portfolio" + q),
          call<{ positions: Position[] }>(settings, "/api/v1/paper-bot/positions" + q + "&limit=300"),
          call<{ reports: Report[] }>(settings, "/api/v1/paper-bot/reports" + q + "&limit=60"),
          call<{ points: EquityPoint[] }>(settings, "/api/v1/paper-bot/equity" + q + "&limit=300"),
        ]);
        if (!cancelled) setState({ loading: false, error: "", connected: true, needsToken: false, updated: new Date().toISOString(), status, portfolio, positions: positions.positions, reports: reports.reports, equity: equity.points });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, connected: false, needsToken: e instanceof ApiError && e.status === 401, error: e instanceof Error ? e.message : "Something went wrong." }));
      }
    })();
    return () => { cancelled = true; };
  }, [settings, region]);
  useEffect(() => refresh(), [refresh]);
  return { settings, region, refresh, ...state };
}

export const money = (n: number | null | undefined, cur: string, digits = 0) => (typeof n === "number" && Number.isFinite(n) ? new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-US", { style: "currency", currency: cur, maximumFractionDigits: digits }).format(n) : "—");
export const signed = (n: number | null | undefined, cur: string, digits = 0) => (typeof n === "number" && Number.isFinite(n) ? (n > 0 ? "+" : n < 0 ? "−" : "") + money(Math.abs(n), cur, digits) : "—");
export const pctText = (n: number | null | undefined, digits = 2) => (typeof n === "number" && Number.isFinite(n) ? (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(digits) + "%" : "—");
export const tone = (n: number | null | undefined) => (typeof n === "number" ? (n > 0 ? "up" : n < 0 ? "down" : "flat") : "flat");
export const when = (iso: string | null | undefined) => { if (!iso) return "—"; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
export const modeLabel = (m: string | undefined) => (m === "live" ? "Live" : m === "delayed" ? "Delayed" : m === "eod" ? "End of day" : m === "unavailable" || !m ? "No data" : m);
