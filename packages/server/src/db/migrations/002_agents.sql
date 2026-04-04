CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  model TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
