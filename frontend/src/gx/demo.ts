// Built-in SAMPLE data so the app can be explored before a backend exists.
// Everything here is invented for illustration and is always labelled DEMO in the UI.
import type { EquityPoint, Portfolio, Position, Report, ReportBody, Status } from "./api";

const day = 86400000;
const iso = (d: number) => new Date(Date.now() - d * day).toISOString();

export const demoStatus: Status = {
  configured: true, feed_configured: true, mode: "paper_only", strategy_version: "demo", schedule_utc: [],
  provider: { provider: "demo", configured: true, data_mode: "demo", message: "Sample data for exploring the app. Not real prices. Connect your own API in More → Connect to see your bot's real results." },
  message: "Demo",
};

export function demoPortfolio(region: "INDIA" | "GLOBAL"): Portfolio {
  const inr = region === "INDIA", start = inr ? 1000000 : 10000, pnl = inr ? 18240 : 182;
  return { region, currency: inr ? "INR" : "USD", starting_capital: start, equity: start + pnl, cash: start * 0.9, total_pnl: pnl, has_history: true,
    latest_snapshot: { exposure: start * 0.1, open_positions: 2, realized_pnl: pnl * 0.7, unrealized_pnl: pnl * 0.3, recorded_at: iso(0) },
    stats: { closed_trades: 8, wins: 5, losses: 3, win_rate_pct: 62.5, net_realized_pnl: pnl * 0.7, profit_factor: 1.9, avg_win: start * 0.004, avg_loss: -start * 0.002, avg_holding_days: 4.1, max_drawdown_pct: -1.4 } };
}

export function demoEquity(region: "INDIA" | "GLOBAL"): EquityPoint[] {
  const base = region === "INDIA" ? 1000000 : 10000, amp = base * 0.012;
  return Array.from({ length: 30 }, (_, i) => ({ recorded_at: iso(30 - i), equity: base + (i / 29) * base * 0.018 + Math.sin(i / 2.2) * amp * 0.5, cash: base * 0.9 }));
}

export function demoPositions(region: "INDIA" | "GLOBAL"): Position[] {
  const inr = region === "INDIA", s = inr ? { a: "RELIANCE", ax: "NSE", ap: 1450, b: "HDFCBANK", bp: 1010 } : { a: "NVDA", ax: "NASDAQ", ap: 188.4, b: "AAPL", bp: 210 };
  const mk = (id: string, symbol: string, exchange: string, px: number, status: "OPEN" | "CLOSED", n: number): Position => ({
    id, region, symbol, exchange, asset_class: "EQUITY", quantity: n, lot_size: 1, entry_price: px, last_price: status === "OPEN" ? px * 1.012 : px * 1.06, stop_price: px * 0.97, target_price: px * 1.06,
    exit_price: status === "CLOSED" ? px * 1.06 : null, status, opened_at: iso(status === "OPEN" ? 1 : 8), closed_at: status === "CLOSED" ? iso(2) : null,
    realized_pnl: status === "CLOSED" ? px * 0.06 * n - 40 : null, exit_reason: status === "CLOSED" ? "TARGET" : null, holding_days: status === "CLOSED" ? 6 : null,
    strategy: "trend-momentum-long", risk_amount: px * 0.03 * n, capital_allocated: px * n, entry_fees: inr ? 20 : 0, exit_fees: inr ? 20 : 0, slippage_bps: 5, order_type: "MARKET (simulated)",
    explanation: "Price above rising 20/50-day averages; RSI and five-session momentum confirm (sample)." });
  return [mk("d1", s.a, s.ax, s.ap, "OPEN", inr ? 10 : 12), mk("d2", s.b, s.ax, s.bp, "OPEN", inr ? 15 : 8), mk("d3", s.b, s.ax, s.bp * 0.95, "CLOSED", inr ? 12 : 9)];
}

function demoBody(region: "INDIA" | "GLOBAL"): ReportBody {
  const inr = region === "INDIA", cur = inr ? "INR" : "USD", sym = inr ? ["NIFTY 50", "BANK NIFTY"] : ["SPY", "QQQ"];
  return {
    stance: "ACTIVE", data_mode: "demo", source: "built-in sample", observed_at: iso(0.1), currency: cur, region,
    market_overview: { indices: [{ symbol: sym[0], change_pct: 0.62, trend: "BULLISH" }, { symbol: sym[1], change_pct: -0.18, trend: "NONE" }], breadth: { bullish: 4, bearish: 1, neutral: 3, scanned: 8 } },
    sector_moves: [{ sector: inr ? "IT" : "Tech", avg_change_pct: 1.1, constituents: 3 }, { sector: inr ? "Banks" : "Energy", avg_change_pct: -0.4, constituents: 3 }],
    top_gainers: [{ symbol: inr ? "INFY" : "NVDA", change_pct: 2.1 }, { symbol: inr ? "TCS" : "META", change_pct: 1.3 }], top_losers: [{ symbol: inr ? "SBIN" : "AMZN", change_pct: -1.2 }],
    fo_summary: { contracts_seen: 0, contracts_eligible: 0, options_disabled_reason: "Sample data has no option chain. Real F&O analysis needs a licensed live options feed.", by_underlying: [] },
    decisions: [{ action: "PAPER_BUY", symbol: inr ? "RELIANCE" : "NVDA", asset_class: "EQUITY", quantity: inr ? 10 : 12, lot_size: 1, entry: inr ? 1450 : 188.4, stop: inr ? 1406.5 : 182.75, target: inr ? 1537 : 199.7, risk_amount: inr ? 435 : 68, capital_allocated: inr ? 14500 : 2260, explanation: "Price above rising 20/50-day averages; RSI 61 and 5-session momentum +3.4% confirm (sample).", reason: "Trend aligned" },
      { action: "CLOSE", symbol: inr ? "HDFCBANK" : "AAPL", reason: "TARGET", pnl: inr ? 640 : 41, holding_days: 6 }, { action: "HOLD", symbol: inr ? "TCS" : "MSFT", reason: "Stop, target and time limit not reached." }],
    trades_skipped: [{ symbol: inr ? "SBIN" : "AMZN", reason: "Bearish trend. The desk does not short cash equities." }],
    open_positions: [{ symbol: inr ? "RELIANCE" : "NVDA", asset_class: "EQUITY", entry: inr ? 1450 : 188.4, mark: inr ? 1467 : 190.7, unrealized: inr ? 170 : 28, stale: false }],
    portfolio: { starting_capital: inr ? 1000000 : 10000, equity: inr ? 1018240 : 10182, cash: inr ? 900000 : 9000, invested: inr ? 100000 : 1000, realized_pnl_net: inr ? 12800 : 127, unrealized_pnl: inr ? 5440 : 55, total_pnl: inr ? 18240 : 182, total_return_pct: 1.82, realized_this_run: inr ? 640 : 41 },
    risk_exposure: { gross_exposure_pct: 10, max_gross_exposure_pct: 60, open_positions: 2, max_positions: 12, open_options: 0, max_options: 4, capital_at_risk_to_stops: inr ? 900 : 14, stale_marks: 0 },
    strategy_performance: [{ strategy: "trend-momentum-long", trades: 8, wins: 5, win_rate_pct: 62.5, net_pnl: inr ? 12800 : 127, avg_net_pnl: inr ? 1600 : 16 }],
    next_session_watchlist: [{ symbol: inr ? "TCS" : "MSFT", bias: "BULLISH", note: "Setup valid; blocked by size/cash/exposure limit.", momentum_pct: 2.1 }],
    assumptions: { brokerage_per_order: inr ? 20 : 0, equity_slippage_bps_if_no_bid_ask: 5, option_slippage_bps_if_no_bid_ask: 100, not_modelled: ["statutory charges and taxes", "margin and funding", "market impact"] },
    notes: ["DEMO: every number on this page is sample data, not a real market or a real bot run."],
  };
}

export function demoReports(region: "INDIA" | "GLOBAL"): Report[] {
  const mk = (id: string, d: number): Report => ({ id, region, trigger: "demo", source: "built-in sample", data_mode: "demo", observed_at: iso(d), started_at: iso(d), completed_at: iso(d), status: "completed", scanned: 8, opened: d < 1 ? 1 : 0, closed: d < 1 ? 1 : 0, realized_pnl: d < 1 ? (region === "INDIA" ? 640 : 41) : 0, report: demoBody(region) });
  return [mk("demo-1", 0.1), mk("demo-2", 1.1), mk("demo-3", 2.1)];
}

const A: [RegExp, string][] = [
  [/trade|bought|buy|why|latest/, "BOUGHT RELIANCE ×10 at ₹1,450. Stop ₹1,406.50, target ₹1,537, risk ₹435. Why: price above rising 20/50-day averages; RSI and 5-session momentum confirm. (Sample answer)"],
  [/portfolio|pnl|profit|how am i|balance/, "Virtual equity ₹10,18,240 (started ₹10,00,000), total P&L +₹18,240 (+1.82%), 2 open positions. This is simulated sample money."],
  [/risk|exposure/, "Exposure is 10% of equity (cap 60%) with 2 of 12 positions. If every stop were hit you would lose about ₹900. (Sample answer)"],
  [/momentum|opportunit|watch|best/, "Watchlist: TCS is bullish with +2.1% momentum but was blocked by a size limit. Rule-based watch item, not advice. (Sample answer)"],
  [/market|nifty|happening|global/, "NIFTY 50 +0.62%, BANK NIFTY −0.18%. Top gainers INFY and TCS; SBIN is weakest. IT leads the sectors. (Sample answer)"],
  [/live|data|status/, "You are looking at built-in demo data. Connect your API in More → Connect to see your bot's real, timestamped data."],
];
export const demoAnswer = (q: string) => A.find(([r]) => r.test(q.toLowerCase()))?.[1] ?? "In demo mode I can answer: latest trade, portfolio, risks, momentum, market summary and data status. Connect your API for answers from your real bot.";
