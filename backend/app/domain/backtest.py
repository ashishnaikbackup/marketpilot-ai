"""Small, transparent SMA crossover research simulator using close-only signals."""
from math import isfinite


def sma_crossover_backtest(closes: list[float], fast: int = 5, slow: int = 20,
                           fee_bps: float = 5.0, slippage_bps: float = 5.0) -> dict:
    if not 2 <= fast < slow <= 500:
        raise ValueError("Require 2 <= fast < slow <= 500.")
    if len(closes) < slow + 2:
        raise ValueError("Not enough closing prices for the selected windows.")
    if any(not isfinite(x) or x <= 0 for x in closes):
        raise ValueError("Closing prices must be finite positive numbers.")
    if not 0 <= fee_bps <= 500 or not 0 <= slippage_bps <= 500:
        raise ValueError("Costs must be between 0 and 500 basis points.")
    cash = 1.0
    position = 0
    equity = []
    trades = 0
    cost_rate = (fee_bps + slippage_bps) / 10000
    # Signal from completed bar t is applied at close t+1 to avoid same-bar look-ahead.
    for i in range(slow, len(closes) - 1):
        f = sum(closes[i-fast+1:i+1]) / fast
        s = sum(closes[i-slow+1:i+1]) / slow
        desired = 1 if f > s else 0
        if desired != position:
            cash *= (1 - cost_rate)
            position = desired
            trades += 1
        daily_return = closes[i+2] / closes[i+1] - 1
        if position:
            cash *= 1 + daily_return
        equity.append(cash)
    peak = 1.0
    max_drawdown = 0.0
    for value in equity:
        peak = max(peak, value)
        max_drawdown = max(max_drawdown, (peak - value) / peak)
    return {"strategy": "long-only SMA crossover", "fast_window": fast, "slow_window": slow,
            "initial_equity": 1.0, "final_equity": round(cash, 6),
            "total_return_pct": round((cash - 1) * 100, 4),
            "max_drawdown_pct": round(max_drawdown * 100, 4), "position_changes": trades,
            "fee_bps_per_change": fee_bps, "slippage_bps_per_change": slippage_bps,
            "bars_evaluated": len(equity), "data_mode": "user_supplied_historical",
            "warning": "Educational toy backtest; no survivorship, corporate-action, tax, liquidity or market-impact model. Not a forecast."}
