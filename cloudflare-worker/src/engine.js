// MarketPilot paper-trading decision engine (pure functions, no I/O).
// Virtual money only. It never talks to a broker and never invents quotes:
// if there is no fresh price for an instrument, it does not trade or mark it.

export const STRATEGY_VERSION = "trend-options-v2";
export const STRATEGIES = { cash: "trend-momentum-long", option: "trend-long-premium" };

// Documented, editable assumptions. Statutory charges, taxes, margin and market impact are NOT modelled.
export const COSTS = {
  INDIA: { currency: "INR", brokerage_per_order: 20, equity_slippage_bps: 5, option_slippage_bps: 100 },
  GLOBAL: { currency: "USD", brokerage_per_order: 0, equity_slippage_bps: 5, option_slippage_bps: 100 },
};
export const LIMITS = {
  max_positions: 12, max_options: 4, risk_per_trade: 0.0025, max_notional: 0.08, max_gross_exposure: 0.6,
  stop_pct: 0.03, target_pct: 0.06, option_stop_pct: 0.3, option_target_pct: 0.45, max_hold_days: 10,
  quote_max_age_ms: 300000, eod_max_age_ms: 40 * 3600000,
};

const finite = (x) => typeof x === "number" && Number.isFinite(x);
const round = (x, d = 2) => (finite(x) ? Number(x.toFixed(d)) : null);
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;

export function trend(i) {
  const c = i.candles?.map((x) => x.close);
  if (!Array.isArray(c) || c.length < 55 || !c.every((x) => finite(x) && x > 0)) {
    return { side: "NONE", reason: "Need at least 55 valid daily closes." };
  }
  const sma20 = avg(c.slice(-20)), sma50 = avg(c.slice(-50)), last = c.at(-1), prior = c.at(-6);
  let gain = 0, loss = 0;
  for (let n = c.length - 14; n < c.length; n++) { const d = c[n] - c[n - 1]; if (d > 0) gain += d; else loss -= d; }
  const rsi = loss === 0 ? 100 : 100 - 100 / (1 + gain / 14 / (loss / 14));
  const momentum = prior > 0 ? last / prior - 1 : 0;
  const base = { sma20, sma50, rsi, momentum };
  if (last > sma20 && sma20 > sma50 && rsi >= 52 && rsi <= 72 && momentum > 0.005) {
    return { side: "BULLISH", reason: "Price above rising 20/50-day averages; RSI and five-session momentum confirm.", ...base };
  }
  if (last < sma20 && sma20 < sma50 && rsi >= 28 && rsi <= 48 && momentum < -0.005) {
    return { side: "BEARISH", reason: "Price below falling 20/50-day averages; RSI and five-session momentum confirm.", ...base };
  }
  return { side: "NONE", reason: "Trend, RSI and momentum do not align.", ...base };
}

// Returns an executable simulated price or null. Prefers real bid/ask; falls back to last trade plus
// an explicit slippage assumption (clearly labelled). Stale or missing data returns null.
export function priceFor(q, side, cfg, kind, nowMs, mode = "intraday") {
  if (!q || !q.timestamp) return null;
  const age = nowMs - Date.parse(q.timestamp);
  const maxAge = mode === "eod" ? LIMITS.eod_max_age_ms : LIMITS.quote_max_age_ms;
  if (!Number.isFinite(age) || age < -60000 || age > maxAge) return null;
  if (finite(q.bid) && finite(q.ask) && q.bid > 0 && q.ask >= q.bid) {
    return { price: side === "BUY" ? q.ask : q.bid, basis: "bid_ask", slippage_bps: 0 };
  }
  if (finite(q.last) && q.last > 0) {
    const bps = kind === "OPTION" ? cfg.option_slippage_bps : cfg.equity_slippage_bps;
    const f = bps / 10000;
    return { price: side === "BUY" ? q.last * (1 + f) : q.last * (1 - f), basis: mode === "eod" ? "eod_close_with_modelled_slippage" : "last_trade_with_modelled_slippage", slippage_bps: bps };
  }
  return null;
}

export function dayChange(i) {
  const c = i.candles;
  if (!Array.isArray(c) || c.length < 2) return null;
  const a = c.at(-2)?.close, b = c.at(-1)?.close;
  if (!finite(a) || !finite(b) || a <= 0) return null;
  return { last: b, previous: a, change_pct: round((b / a - 1) * 100, 2), bar_time: c.at(-1)?.timestamp || null };
}

function summariseOptions(contracts, eligibleIds) {
  const by = new Map();
  for (const o of contracts) {
    if (!o?.underlying) continue;
    const g = by.get(o.underlying) || { underlying: o.underlying, contracts: 0, call_oi: 0, put_oi: 0, ivs: [], eligible: 0 };
    g.contracts++;
    const call = o.option_type === "CE" || o.option_type === "CALL";
    if (Number.isInteger(o.open_interest)) { if (call) g.call_oi += o.open_interest; else g.put_oi += o.open_interest; }
    if (finite(o.iv) && o.iv > 0) g.ivs.push(o.iv);
    if (eligibleIds.has(o.contract_id)) g.eligible++;
    by.set(o.underlying, g);
  }
  return [...by.values()].map((g) => ({
    underlying: g.underlying, contracts: g.contracts, eligible_contracts: g.eligible,
    call_open_interest: g.call_oi, put_open_interest: g.put_oi,
    pcr_oi: g.call_oi ? round(g.put_oi / g.call_oi, 3) : null,
    mean_iv_pct: g.ivs.length ? round(avg(g.ivs) * 100, 2) : null,
  }));
}

function strategyStats(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = r.strategy || "unknown";
    const g = by.get(k) || { strategy: k, trades: 0, wins: 0, net_pnl: 0 };
    g.trades++; if (r.net_pnl > 0) g.wins++; g.net_pnl += r.net_pnl;
    by.set(k, g);
  }
  return [...by.values()].map((g) => ({ ...g, win_rate_pct: g.trades ? round((g.wins / g.trades) * 100, 1) : null, net_pnl: round(g.net_pnl), avg_net_pnl: g.trades ? round(g.net_pnl / g.trades) : null }));
}

/**
 * @param {object} a
 * @param {object} a.snapshot normalized snapshot (see docs/PAPER_BOT.md)
 * @param {{starting_cash:number}} a.account
 * @param {object[]} a.open open position rows from the database
 * @param {{strategy:string,net_pnl:number}[]} a.closedHistory all previously closed trades (for stats)
 * @param {number} a.nowMs
 */
export function evaluate({ snapshot, account, open, closedHistory = [], nowMs }) {
  const region = snapshot.region, cfg = COSTS[region];
  const mode = snapshot.data_mode === "eod" ? "eod" : "intraday";
  const optionContracts = mode === "eod" ? [] : snapshot.option_contracts || [];
  const instruments = new Map(snapshot.instruments.map((x) => [x.symbol, x]));
  const contracts = new Map(optionContracts.map((x) => [x.contract_id, x]));
  const decisions = [], marks = [], exits = [], entries = [], skipped = [];
  let staleMarks = 0;

  // 1) Mark open positions and apply exit rules.
  const remaining = [];
  for (const p of open) {
    const isOption = p.asset_class === "OPTION";
    const src = isOption ? contracts.get(p.instrument_id) : instruments.get(p.symbol)?.quote;
    const px = priceFor(src, "SELL", cfg, isOption ? "OPTION" : "CASH", nowMs, mode);
    if (!px) {
      staleMarks++;
      remaining.push({ ...p, mark: p.last_price, stale: true });
      decisions.push({ symbol: p.symbol, action: "HOLD", side: "HOLD", reason: "No fresh quote; mark withheld and last known price kept.", entry: p.entry_price });
      continue;
    }
    const mark = px.price;
    marks.push({ id: p.id, last_price: mark, observed_at: snapshot.observed_at });
    const heldDays = (nowMs - Date.parse(p.opened_at)) / 86400000;
    const reason = mark <= p.stop_price ? "STOP" : mark >= p.target_price ? "TARGET" : heldDays >= LIMITS.max_hold_days ? "TIME_EXIT" : null;
    if (reason) {
      const gross = (mark - p.entry_price) * p.quantity * p.lot_size;
      const exitFee = cfg.brokerage_per_order, net = gross - (p.entry_fees || 0) - exitFee;
      exits.push({ id: p.id, exit_price: mark, exit_reason: reason, gross_pnl: gross, exit_fees: exitFee, net_pnl: net, holding_days: round(heldDays, 2), strategy: p.strategy });
      decisions.push({ symbol: p.symbol, action: "CLOSE", side: "SELL", reason, price: round(mark, 4), pnl: round(net), gross_pnl: round(gross), fees: round((p.entry_fees || 0) + exitFee), holding_days: round(heldDays, 2), price_basis: px.basis });
    } else {
      remaining.push({ ...p, mark });
      decisions.push({ symbol: p.symbol, action: "HOLD", side: "HOLD", reason: "Stop, target and time limit not reached.", price: round(mark, 4), entry: p.entry_price, stop: p.stop_price, target: p.target_price });
    }
  }

  // 2) Account state after exits.
  const realizedNet = closedHistory.reduce((s, r) => s + r.net_pnl, 0) + exits.reduce((s, e) => s + e.net_pnl, 0);
  const exposureOf = (p) => (p.mark ?? p.last_price) * p.quantity * p.lot_size;
  let deployedCost = remaining.reduce((s, p) => s + p.entry_price * p.quantity * p.lot_size + (p.entry_fees || 0), 0);
  let cash = account.starting_cash + realizedNet - deployedCost;
  let gross = remaining.reduce((s, p) => s + exposureOf(p), 0);
  const unrealized = remaining.reduce((s, p) => s + ((p.mark ?? p.last_price) - p.entry_price) * p.quantity * p.lot_size, 0);
  const equity = cash + gross;
  let slots = Math.max(0, LIMITS.max_positions - remaining.length);
  let optionSlots = Math.max(0, LIMITS.max_options - remaining.filter((p) => p.asset_class === "OPTION").length);
  const held = new Set(remaining.filter((p) => p.asset_class !== "OPTION").map((p) => p.symbol));
  const heldContracts = new Set(remaining.filter((p) => p.asset_class === "OPTION").map((p) => p.instrument_id));

  // 3) Read the market (also used for the report even when nothing is traded).
  const signals = new Map(), counts = { BULLISH: 0, BEARISH: 0, NONE: 0 };
  for (const i of snapshot.instruments) { const s = trend(i); signals.set(i.symbol, s); counts[s.side]++; }

  const canSpend = (cost) => cost <= cash && gross + cost <= equity * LIMITS.max_gross_exposure;
  const record = (rec, decision) => { entries.push(rec); decisions.push(decision); cash -= rec.entry_price * rec.quantity * rec.lot_size + rec.entry_fees; gross += rec.entry_price * rec.quantity * rec.lot_size; };

  // 4) Cash equity / ETF / futures candidates (long only).
  const candidates = [], watch = [];
  for (const i of snapshot.instruments) {
    if (!i?.symbol || !["EQUITY", "ETF", "FUTURE"].includes(i.asset_class)) continue;
    const s = signals.get(i.symbol);
    const lot = i.asset_class === "FUTURE" ? i.lot_size : 1;
    if (i.asset_class === "FUTURE" && (!Number.isInteger(lot) || lot < 1 || !i.instrument_id || !i.expiry || !(Date.parse(i.expiry) > nowMs))) {
      skipped.push({ symbol: i.symbol, action: "SKIP", reason: "Future contract ID, expiry or lot size is missing/invalid." });
      continue;
    }
    if (s.side === "BEARISH") {
      skipped.push({ symbol: i.symbol, action: "SKIP", reason: "Bearish trend. The desk does not short cash equities; bearish exposure is only via long PE/PUT options that pass liquidity filters." });
      watch.push({ symbol: i.symbol, bias: "BEARISH", note: "Watch for a liquid PE/PUT contract.", momentum_pct: round(s.momentum * 100, 2) });
      continue;
    }
    if (s.side !== "BULLISH") continue;
    if (held.has(i.symbol)) continue;
    const px = priceFor(i.quote, "BUY", cfg, "CASH", nowMs, mode);
    if (!px) { skipped.push({ symbol: i.symbol, action: "SKIP", reason: "Bullish trend but no fresh quote; no entry without a price." }); watch.push({ symbol: i.symbol, bias: "BULLISH", note: "Bullish trend; needs a fresh quote.", momentum_pct: round(s.momentum * 100, 2) }); continue; }
    candidates.push({ i, s, px, lot });
  }
  candidates.sort((a, b) => b.s.momentum - a.s.momentum);
  for (const c of candidates) {
    if (slots < 1) { watch.push({ symbol: c.i.symbol, bias: "BULLISH", note: "Position limit reached.", momentum_pct: round(c.s.momentum * 100, 2) }); continue; }
    const entry = c.px.price, stop = entry * (1 - LIMITS.stop_pct), target = entry * (1 + LIMITS.target_pct);
    const riskBudget = equity * LIMITS.risk_per_trade;
    let qty = Math.floor(Math.min(riskBudget / ((entry - stop) * c.lot), (equity * LIMITS.max_notional) / (entry * c.lot)));
    while (qty >= 1 && !canSpend(entry * qty * c.lot + cfg.brokerage_per_order)) qty--;
    if (qty < 1) { skipped.push({ symbol: c.i.symbol, action: "SKIP", reason: "Below minimum size under the risk, cash or exposure limit." }); watch.push({ symbol: c.i.symbol, bias: "BULLISH", note: "Setup valid; blocked by size/cash/exposure limit.", momentum_pct: round(c.s.momentum * 100, 2) }); continue; }
    const rec = { symbol: c.i.symbol, instrument_id: c.i.instrument_id || c.i.symbol, exchange: c.i.exchange || null, asset_class: c.i.asset_class, option_type: null, strike: null, expiry: c.i.asset_class === "FUTURE" ? c.i.expiry : null, quantity: qty, lot_size: c.lot, entry_price: entry, stop_price: stop, target_price: target, strategy: STRATEGIES.cash, risk_amount: (entry - stop) * qty * c.lot, capital_allocated: entry * qty * c.lot, entry_fees: cfg.brokerage_per_order, slippage_bps: c.px.slippage_bps, price_basis: c.px.basis, order_type: "MARKET (simulated)", thesis: c.s.reason, explanation: `${c.s.reason} RSI ${round(c.s.rsi, 1)}, 5-session momentum ${round(c.s.momentum * 100, 2)}%. Risk ${round((entry - stop) * qty * c.lot)} ${cfg.currency} (${LIMITS.risk_per_trade * 100}% of equity budget), stop ${LIMITS.stop_pct * 100}% / target ${LIMITS.target_pct * 100}%.` };
    slots--; held.add(c.i.symbol);
    record(rec, { action: "PAPER_BUY", side: "BUY", symbol: rec.symbol, exchange: rec.exchange, asset_class: rec.asset_class, quantity: qty, lot_size: c.lot, order_type: rec.order_type, entry: round(entry, 4), stop: round(stop, 4), target: round(target, 4), risk_amount: round(rec.risk_amount), capital_allocated: round(rec.capital_allocated), brokerage: rec.entry_fees, price_basis: rec.price_basis, slippage_bps: rec.slippage_bps, strategy: rec.strategy, reason: c.s.reason, explanation: rec.explanation });
  }

  // 5) Long-premium options. Underlying trend selects CE/CALL (bullish) or PE/PUT (bearish).
  const eligible = [];
  for (const o of optionContracts) {
    const s = signals.get(o.underlying);
    if (!s || !["BULLISH", "BEARISH"].includes(s.side) || !o.contract_id || !o.symbol) continue;
    const right = region === "INDIA" ? (s.side === "BULLISH" ? "CE" : "PE") : (s.side === "BULLISH" ? "CALL" : "PUT");
    const expiry = Date.parse(region === "INDIA" ? o.expiry + "T15:30:00+05:30" : o.expiry + "T23:59:59Z");
    const dte = (expiry - nowMs) / 86400000;
    const ask = priceFor(o, "BUY", cfg, "OPTION", nowMs, mode);
    const und = priceFor(instruments.get(o.underlying)?.quote, "BUY", cfg, "CASH", nowMs, mode);
    const hasBook = finite(o.bid) && finite(o.ask) && o.ask > 0;
    const mid = hasBook ? (o.bid + o.ask) / 2 : NaN;
    const minOI = region === "INDIA" ? 500 : 100, minVol = region === "INDIA" ? 50 : 10, maxSpread = region === "INDIA" ? 0.025 : 0.05;
    const ok = ask && und && hasBook && Number.isFinite(expiry) && o.option_type === right && finite(o.strike) && Number.isInteger(o.lot_size) && o.lot_size >= 1
      && finite(o.delta) && Math.abs(o.delta) >= 0.35 && Math.abs(o.delta) <= 0.65 && finite(o.iv) && o.iv > 0 && o.iv <= 1.5
      && Number.isInteger(o.open_interest) && o.open_interest >= minOI && Number.isInteger(o.volume) && o.volume >= minVol
      && dte >= 7 && dte <= (region === "INDIA" ? 45 : 60) && mid > 0 && (o.ask - o.bid) / mid <= maxSpread;
    if (!ok || heldContracts.has(o.contract_id)) continue;
    eligible.push({ o, s, ask, rank: Math.abs(Math.abs(o.delta) - 0.5) + (o.ask - o.bid) / mid, dte });
  }
  eligible.sort((a, b) => a.rank - b.rank);
  for (const { o, s, ask, dte } of eligible) {
    if (slots < 1 || optionSlots < 1) break;
    const entry = ask.price, lot = o.lot_size, stop = entry * (1 - LIMITS.option_stop_pct), target = entry * (1 + LIMITS.option_target_pct);
    const cost = entry * lot, risk = cost * LIMITS.option_stop_pct;
    if (risk > equity * LIMITS.risk_per_trade || cost > equity * LIMITS.max_notional || !canSpend(cost + cfg.brokerage_per_order)) {
      skipped.push({ symbol: o.symbol, action: "SKIP", reason: "One-lot option risk, size or cash exceeds the portfolio limit." });
      continue;
    }
    const why = `${s.reason} Underlying trend selects ${o.option_type}; long premium only. Delta ${round(o.delta, 2)}, IV ${round(o.iv * 100, 1)}%, OI ${o.open_interest}, volume ${o.volume}, ${round(dte, 0)} days to expiry.`;
    const rec = { symbol: o.symbol, instrument_id: o.contract_id, exchange: o.exchange || null, asset_class: "OPTION", option_type: o.option_type, strike: o.strike, expiry: o.expiry, quantity: 1, lot_size: lot, entry_price: entry, stop_price: stop, target_price: target, strategy: STRATEGIES.option, risk_amount: risk, capital_allocated: cost, entry_fees: cfg.brokerage_per_order, slippage_bps: ask.slippage_bps, price_basis: ask.basis, order_type: "MARKET (simulated)", thesis: why, explanation: why };
    slots--; optionSlots--;
    record(rec, { action: "PAPER_BUY", side: "BUY", symbol: o.symbol, exchange: rec.exchange, asset_class: "OPTION", option_type: o.option_type, strike: o.strike, expiry: o.expiry, quantity: 1, lot_size: lot, order_type: rec.order_type, entry: round(entry, 4), stop: round(stop, 4), target: round(target, 4), risk_amount: round(risk), capital_allocated: round(cost), brokerage: rec.entry_fees, price_basis: rec.price_basis, slippage_bps: rec.slippage_bps, strategy: rec.strategy, reason: s.reason, explanation: why });
  }

  // 6) Run-level stance, report and equity snapshot.
  const scanned = snapshot.instruments.length;
  const nothingDone = entries.length === 0 && exits.length === 0;
  const stance = entries.length ? "ACTIVE" : "NO_TRADE";
  const inactiveReason = entries.length ? null
    : counts.BULLISH + counts.BEARISH === 0 ? `No instrument among ${scanned} scanned shows an aligned trend, RSI and momentum setup. Staying in cash is a valid decision.`
      : "Setups exist but none passed freshness, liquidity, size, cash or exposure checks. See skipped trades.";
  const movers = snapshot.instruments.map((i) => ({ symbol: i.symbol, ...dayChange(i) })).filter((m) => m.change_pct !== null && m.change_pct !== undefined).sort((a, b) => b.change_pct - a.change_pct);
  const sectors = new Map();
  for (const i of snapshot.instruments) { const d = dayChange(i); if (i.sector && d) { const g = sectors.get(i.sector) || []; g.push(d.change_pct); sectors.set(i.sector, g); } }
  const allClosed = [...closedHistory, ...exits.map((e) => ({ strategy: e.strategy, net_pnl: e.net_pnl }))];
  const totalOpenPositions = remaining.length + entries.length;
  const openNow = [...remaining.map((p) => ({ symbol: p.symbol, asset_class: p.asset_class, entry: p.entry_price, mark: round(p.mark ?? p.last_price, 4), unrealized: round(((p.mark ?? p.last_price) - p.entry_price) * p.quantity * p.lot_size), stale: Boolean(p.stale) })),
    ...entries.map((e) => ({ symbol: e.symbol, asset_class: e.asset_class, entry: round(e.entry_price, 4), mark: round(e.entry_price, 4), unrealized: 0, stale: false }))];
  const equityNow = cash + gross;
  const snapshotRow = { equity: equityNow, cash, exposure: gross, realized_pnl: realizedNet, unrealized_pnl: unrealized, open_positions: totalOpenPositions };

  const report = {
    strategy_version: STRATEGY_VERSION, region, currency: cfg.currency, source: snapshot.source, data_mode: snapshot.data_mode, observed_at: snapshot.observed_at,
    stance, inactive_reason: inactiveReason,
    market_overview: {
      indices: snapshot.instruments.filter((i) => i.asset_class === "INDEX").map((i) => ({ symbol: i.symbol, ...dayChange(i), trend: signals.get(i.symbol)?.side })),
      breadth: { bullish: counts.BULLISH, bearish: counts.BEARISH, neutral: counts.NONE, scanned },
      note: "Changes use the last two daily closes supplied by the data adapter.",
    },
    sector_moves: [...sectors.entries()].map(([sector, v]) => ({ sector, avg_change_pct: round(avg(v), 2), constituents: v.length })).sort((a, b) => b.avg_change_pct - a.avg_change_pct),
    top_gainers: movers.filter((m) => m.change_pct > 0).slice(0, 5), top_losers: movers.filter((m) => m.change_pct < 0).slice(-5).reverse(),
    fo_summary: { contracts_seen: (snapshot.option_contracts || []).length, options_disabled_reason: mode === "eod" ? "End-of-day snapshots have no two-sided option quotes, so options are not traded." : null, contracts_eligible: eligible.length, by_underlying: summariseOptions(snapshot.option_contracts || [], new Set(eligible.map((e) => e.o.contract_id))), note: "Descriptive statistics over the contracts supplied by the adapter; not an exchange-wide chain unless the adapter provides one." },
    decisions, trades_executed: decisions.filter((d) => d.action === "PAPER_BUY"), trades_closed: decisions.filter((d) => d.action === "CLOSE"), trades_skipped: skipped,
    open_positions: openNow,
    portfolio: { starting_capital: account.starting_cash, equity: round(equityNow), cash: round(cash), invested: round(gross), realized_pnl_net: round(realizedNet), unrealized_pnl: round(unrealized), total_pnl: round(equityNow - account.starting_cash), total_return_pct: round(((equityNow - account.starting_cash) / account.starting_cash) * 100, 3), realized_this_run: round(exits.reduce((s, e) => s + e.net_pnl, 0)) },
    risk_exposure: { gross_exposure_pct: round((gross / equityNow) * 100, 2), max_gross_exposure_pct: LIMITS.max_gross_exposure * 100, open_positions: totalOpenPositions, max_positions: LIMITS.max_positions, open_options: remaining.filter((p) => p.asset_class === "OPTION").length + entries.filter((e) => e.asset_class === "OPTION").length, max_options: LIMITS.max_options, capital_at_risk_to_stops: round(entries.reduce((s, e) => s + e.risk_amount, 0) + remaining.reduce((s, p) => s + Math.max(0, ((p.mark ?? p.last_price) - p.stop_price) * p.quantity * p.lot_size), 0)), stale_marks: staleMarks },
    strategy_performance: strategyStats(allClosed),
    next_session_watchlist: watch.sort((a, b) => Math.abs(b.momentum_pct) - Math.abs(a.momentum_pct)).slice(0, 8),
    assumptions: { brokerage_per_order: cfg.brokerage_per_order, equity_slippage_bps_if_no_bid_ask: cfg.equity_slippage_bps, option_slippage_bps_if_no_bid_ask: cfg.option_slippage_bps, limits: LIMITS, not_modelled: ["statutory charges and taxes", "margin and funding", "market impact", "corporate actions"] },
    notes: ["Experimental rule-based paper simulation; not a validated strategy or investment advice.", "No broker orders are sent. Long-only equity/ETF/futures and long-premium option positions only.", "Fills use real bid/ask when supplied; otherwise last trade plus the stated slippage assumption.", "No fresh quote means no new trade and no fabricated mark."],
  };
  return { marks, exits, entries, decisions, report, snapshotRow, nothingDone };
}
