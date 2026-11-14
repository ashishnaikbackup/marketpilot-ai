-- Paper bot v2: full trade records, fees/slippage, equity history for charts. Virtual money only.
ALTER TABLE bot_positions ADD COLUMN strategy TEXT;
ALTER TABLE bot_positions ADD COLUMN exchange TEXT;
ALTER TABLE bot_positions ADD COLUMN order_type TEXT;
ALTER TABLE bot_positions ADD COLUMN risk_amount REAL;
ALTER TABLE bot_positions ADD COLUMN capital_allocated REAL;
ALTER TABLE bot_positions ADD COLUMN entry_fees REAL NOT NULL DEFAULT 0;
ALTER TABLE bot_positions ADD COLUMN exit_fees REAL NOT NULL DEFAULT 0;
ALTER TABLE bot_positions ADD COLUMN gross_pnl REAL;
ALTER TABLE bot_positions ADD COLUMN holding_days REAL;
ALTER TABLE bot_positions ADD COLUMN slippage_bps REAL;
ALTER TABLE bot_positions ADD COLUMN price_basis TEXT;
ALTER TABLE bot_positions ADD COLUMN explanation TEXT;

CREATE TABLE IF NOT EXISTS bot_equity_snapshots (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  data_mode TEXT NOT NULL,
  equity REAL NOT NULL,
  cash REAL NOT NULL,
  exposure REAL NOT NULL,
  realized_pnl REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  open_positions INTEGER NOT NULL,
  run_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bot_equity_region_time ON bot_equity_snapshots(region, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_runs_status ON bot_runs(region, status, started_at DESC);
