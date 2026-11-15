-- Stored market history used for trend signals, bot learning and best-time analysis. Paper trading only.
CREATE TABLE IF NOT EXISTS bot_candles (
  region TEXT NOT NULL,
  symbol TEXT NOT NULL,
  day TEXT NOT NULL,            -- trading day, YYYY-MM-DD (IST for INDIA)
  close REAL NOT NULL,
  high REAL,
  low REAL,
  volume REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (region, symbol, day)
);
CREATE TABLE IF NOT EXISTS bot_intraday (
  region TEXT NOT NULL,
  symbol TEXT NOT NULL,
  slot_ts TEXT NOT NULL,        -- ISO timestamp of the 30-minute bar start
  open REAL NOT NULL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  volume REAL,
  PRIMARY KEY (region, symbol, slot_ts)
);
CREATE TABLE IF NOT EXISTS bot_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
