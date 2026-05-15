-- Migration 005: Server runtime configuration
-- Stores key-value config pairs that can be updated via API without restart.
-- Each value is a JSON string (supports string/number/boolean/null).
CREATE TABLE IF NOT EXISTS server_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Full snapshots of config taken before each write operation, for rollback.
CREATE TABLE IF NOT EXISTS config_history (
  id          TEXT PRIMARY KEY,
  snapshot    TEXT NOT NULL,   -- full config as JSON object string
  changed_by  TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'api' | 'agent'
  note        TEXT,            -- optional human-readable summary of what changed
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_config_history_time ON config_history(created_at DESC);
