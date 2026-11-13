-- MarketPilot autonomous paper trader. Virtual cash only; no broker linkage.
CREATE TABLE IF NOT EXISTS bot_accounts (
  region TEXT PRIMARY KEY CHECK (region IN ('INDIA','GLOBAL')),
  currency TEXT NOT NULL,
  starting_cash REAL NOT NULL,
  realized_pnl REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO bot_accounts(region,currency,starting_cash,realized_pnl,created_at,updated_at)
VALUES ('INDIA','INR',1000000,0,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO bot_accounts(region,currency,starting_cash,realized_pnl,created_at,updated_at)
VALUES ('GLOBAL','USD',10000,0,datetime('now'),datetime('now'));

CREATE TABLE IF NOT EXISTS bot_positions (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  symbol TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('LONG')),
  option_type TEXT,
  strike REAL,
  expiry TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  lot_size INTEGER NOT NULL CHECK (lot_size > 0),
  entry_price REAL NOT NULL,
  last_price REAL NOT NULL,
  stop_price REAL NOT NULL,
  target_price REAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  opened_at TEXT NOT NULL,
  last_observed_at TEXT NOT NULL,
  closed_at TEXT,
  source TEXT NOT NULL,
  run_id TEXT NOT NULL,
  thesis TEXT NOT NULL,
  exit_price REAL,
  exit_reason TEXT,
  realized_pnl REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(region) REFERENCES bot_accounts(region)
);
CREATE INDEX IF NOT EXISTS idx_bot_positions_region_status ON bot_positions(region,status);
CREATE INDEX IF NOT EXISTS idx_bot_positions_instrument ON bot_positions(region,instrument_id,status);
CREATE INDEX IF NOT EXISTS idx_bot_positions_opened ON bot_positions(opened_at DESC);

CREATE TABLE IF NOT EXISTS bot_runs (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  trigger TEXT NOT NULL,
  source TEXT NOT NULL,
  data_mode TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  scanned INTEGER NOT NULL DEFAULT 0,
  opened INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  realized_pnl REAL NOT NULL DEFAULT 0,
  report_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bot_runs_region_started ON bot_runs(region,started_at DESC);
